#!/usr/bin/env python3
"""Standalone OpenCV + MediaPipe hand-gesture toggle bridge.

Serves:
  GET /status    -> JSON payload with `state`, `fingersHeldUp`, and `frameToken`
  GET /frame.jpg -> Latest annotated camera frame

Install dependencies before running:
  pip install opencv-python mediapipe
"""

from __future__ import annotations

import json
import os
import sys
import threading
import time
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

if sys.platform == "darwin":
    os.environ.setdefault("OPENCV_AVFOUNDATION_SKIP_AUTH", "1")


try:
    import cv2
except ImportError:  # pragma: no cover - runtime dependency
    cv2 = None

try:
    import mediapipe as mp
except ImportError:  # pragma: no cover - runtime dependency
    mp = None


GESTURE_EMPTY = ""
GESTURE_DRAWING = "drawing"
GESTURE_VOICE = "voice"
GESTURE_MENU = "menu"


def resolve_gesture_state(previous_state: str, finger_count: int) -> str:
    count = max(0, min(5, int(finger_count)))

    if previous_state == GESTURE_MENU:
        if count in (0, 1, 2, 3):
            return GESTURE_MENU
        if count == 5:
            return GESTURE_EMPTY
        return previous_state

    if count == 1:
        return GESTURE_DRAWING
    if count == 2:
        return GESTURE_VOICE
    if count == 3:
        return GESTURE_MENU
    if count in (0, 5):
        return GESTURE_EMPTY
    return previous_state


class GestureToggleBridge:
    def __init__(self, camera_index: int = 0) -> None:
        self.camera_index = camera_index
        self.state = GESTURE_EMPTY
        self.fingers_held_up = 0
        self.frame_token = int(time.time() * 1000)
        self.latest_frame_jpeg = b""
        self.message = "Starting gesture bridge..."
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def request_stop(self) -> None:
        self._stop_event.set()

    def get_status_payload(self) -> dict:
        with self._lock:
            return {
                "state": self.state,
                "fingersHeldUp": self.fingers_held_up,
                "frameToken": self.frame_token,
                "message": self.message,
            }

    def get_latest_frame(self) -> bytes:
        with self._lock:
            return self.latest_frame_jpeg

    def run_camera_loop(self) -> None:
        if cv2 is None or mp is None:
            with self._lock:
                self.message = "Missing dependencies. Install `opencv-python` and `mediapipe`."
            return

        drawing_utils = mp.solutions.drawing_utils
        hands_module = mp.solutions.hands

        capture = cv2.VideoCapture(self.camera_index)
        if not capture.isOpened():
            with self._lock:
                self.message = f"Unable to open camera index {self.camera_index}."
            return

        self.message = "Camera connected"

        with hands_module.Hands(
            static_image_mode=False,
            max_num_hands=1,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.5,
        ) as hands:
            while not self._stop_event.is_set():
                ok, frame = capture.read()
                if not ok:
                    with self._lock:
                        self.message = "Camera frame read failed."
                    time.sleep(0.05)
                    continue

                frame = cv2.flip(frame, 1)
                rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                results = hands.process(rgb_frame)

                finger_count = 0
                handedness_label = "Right"

                if results.multi_hand_landmarks:
                    landmarks = results.multi_hand_landmarks[0]
                    drawing_utils.draw_landmarks(
                        frame,
                        landmarks,
                        hands_module.HAND_CONNECTIONS,
                    )

                    if results.multi_handedness:
                        handedness_label = results.multi_handedness[0].classification[0].label

                    finger_count = count_extended_fingers(landmarks, handedness_label)

                next_state = resolve_gesture_state(self.state, finger_count)
                overlay_status(frame, next_state, finger_count)

                ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ok:
                    with self._lock:
                        self.fingers_held_up = finger_count
                        self.state = next_state
                        self.frame_token = int(time.time() * 1000)
                        self.latest_frame_jpeg = encoded.tobytes()
                        self.message = "Tracking live hand landmarks"

                time.sleep(0.03)

        capture.release()


def count_extended_fingers(hand_landmarks, handedness_label: str) -> int:
    landmark = hand_landmarks.landmark
    finger_count = 0

    thumb_tip_x = landmark[4].x
    thumb_ip_x = landmark[3].x
    if handedness_label == "Right":
        thumb_extended = thumb_tip_x < thumb_ip_x
    else:
        thumb_extended = thumb_tip_x > thumb_ip_x
    if thumb_extended:
        finger_count += 1

    finger_joint_pairs = (
        (8, 6),
        (12, 10),
        (16, 14),
        (20, 18),
    )
    for tip_index, pip_index in finger_joint_pairs:
        if landmark[tip_index].y < landmark[pip_index].y:
            finger_count += 1

    return finger_count


def overlay_status(frame, state: str, finger_count: int) -> None:
    if cv2 is None:
        return

    lines = [
        f"State: {state or 'none'}",
        f"Fingers held up: {finger_count}",
    ]
    y = 30
    for line in lines:
        cv2.rectangle(frame, (12, y - 18), (250, y + 8), (15, 23, 42), -1)
        cv2.putText(
            frame,
            line,
            (20, y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.6,
            (241, 245, 249),
            2,
            cv2.LINE_AA,
        )
        y += 34


class GestureRequestHandler(BaseHTTPRequestHandler):
    bridge: GestureToggleBridge

    def do_GET(self) -> None:  # noqa: N802
        if self.path.startswith("/status"):
            self._send_json(self.bridge.get_status_payload())
            return

        if self.path.startswith("/frame.jpg"):
            frame = self.bridge.get_latest_frame()
            if not frame:
                self.send_error(HTTPStatus.SERVICE_UNAVAILABLE, "No frame available yet")
                return

            self.send_response(HTTPStatus.OK)
            self.send_header("Content-Type", "image/jpeg")
            self.send_header("Cache-Control", "no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(frame)))
            self.end_headers()
            self.wfile.write(frame)
            return

        self.send_error(HTTPStatus.NOT_FOUND, "Unknown endpoint")

    def log_message(self, format_: str, *args) -> None:
        return

    def _send_json(self, payload: dict) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/json")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    bridge = GestureToggleBridge()
    GestureRequestHandler.bridge = bridge
    server = ThreadingHTTPServer(("127.0.0.1", 8765), GestureRequestHandler)
    server_thread = threading.Thread(target=server.serve_forever, name="gesture-http-server", daemon=True)

    print("Gesture toggle bridge listening on http://127.0.0.1:8765")
    print("Endpoints: /status and /frame.jpg")

    try:
        server_thread.start()
        bridge.run_camera_loop()
    except KeyboardInterrupt:
        pass
    finally:
        bridge.request_stop()
        server.shutdown()
        server.server_close()
        server_thread.join(timeout=2)


if __name__ == "__main__":
    main()
