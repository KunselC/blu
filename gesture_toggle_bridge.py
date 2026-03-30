#!/usr/bin/env python3
"""Standalone OpenCV + MediaPipe hand-gesture toggle bridge.

Serves:
  GET /status    -> JSON payload with `state`, `fingersHeldUp`, and `frameToken`
  GET /frame.jpg -> Latest annotated camera frame

Install dependencies before running:
  pip install opencv-python mediapipe
"""

from __future__ import annotations

import argparse
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
    def __init__(self, camera_index: int | None = None) -> None:
        self.camera_index = camera_index
        self.state = GESTURE_EMPTY
        self.fingers_held_up = 0
        self.pointer_tip = None
        self.frame_token = int(time.time() * 1000)
        self.latest_frame_jpeg = b""
        self.message = "Starting gesture bridge..."
        self._forced_state = None
        self._forced_fingers = None
        self._forced_until = 0.0
        self._lock = threading.Lock()
        self._stop_event = threading.Event()

    def _open_capture(self):
        preferred = [self.camera_index]
        fallback_indexes = [index for index in range(0, 6) if index != self.camera_index]
        attempted_indexes = preferred + fallback_indexes

        for index in attempted_indexes:
            capture = cv2.VideoCapture(index)
            if capture.isOpened():
                self.camera_index = index
                return capture, attempted_indexes
            capture.release()

        return None, attempted_indexes

    def request_stop(self) -> None:
        self._stop_event.set()

    def pulse_exit(self, duration: float = 0.2) -> None:
        with self._lock:
            self.state = GESTURE_EMPTY
            self.fingers_held_up = 5
            self.frame_token = int(time.time() * 1000)
            self._forced_state = GESTURE_EMPTY
            self._forced_fingers = 5
            self._forced_until = time.time() + duration
            self.message = f"Forced 5-finger exit pulse on camera {self.camera_index}"

    def get_status_payload(self) -> dict:
        with self._lock:
            forced_active = self._forced_until > time.time()
            return {
                "state": self._forced_state if forced_active else self.state,
                "fingersHeldUp": self._forced_fingers if forced_active else self.fingers_held_up,
                "pointerTip": self.pointer_tip,
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

        if not hasattr(mp, "solutions"):
            with self._lock:
                version = getattr(mp, "__version__", "unknown")
                self.message = (
                    "Installed `mediapipe` API is incompatible with this app "
                    f"(detected {version}). Reinstall with `mediapipe==0.10.14`."
                )
            return

        drawing_utils = mp.solutions.drawing_utils
        hands_module = mp.solutions.hands

        capture, attempted_indexes = self._open_capture()
        if capture is None:
            with self._lock:
                attempted = ", ".join(str(index) for index in attempted_indexes)
                self.message = (
                    f"Unable to open camera. Tried indexes: {attempted}. "
                    "Check macOS camera permission for your Python/Terminal app."
                )
            return

        self.message = f"Camera connected (index {self.camera_index})"

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
                pointer_tip = None
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
                    pointer_tip = {
                        "x": max(0.0, min(1.0, landmarks.landmark[8].x)),
                        "y": max(0.0, min(1.0, landmarks.landmark[8].y)),
                    }

                next_state = resolve_gesture_state(self.state, finger_count)
                overlay_status(frame, next_state, finger_count)

                ok, encoded = cv2.imencode(".jpg", frame, [int(cv2.IMWRITE_JPEG_QUALITY), 85])
                if ok:
                    with self._lock:
                        self.fingers_held_up = finger_count
                        self.pointer_tip = pointer_tip
                        self.state = next_state
                        self.frame_token = int(time.time() * 1000)
                        self.latest_frame_jpeg = encoded.tobytes()
                        self.message = f"Tracking live hand landmarks on camera {self.camera_index}"

                time.sleep(0.03)

        capture.release()


def open_camera_capture(preferred_index: int | None) -> tuple["cv2.VideoCapture | None", int | None]:
    if cv2 is None:
        return None, None

    indices = [preferred_index] if preferred_index is not None else list(range(4))
    tried = set()

    for index in indices:
        if index in tried or index is None:
            continue
        tried.add(index)
        capture = cv2.VideoCapture(index)
        if not capture.isOpened():
            capture.release()
            continue

        ok, _ = capture.read()
        if ok:
            return capture, index

        capture.release()

    return None, None


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

    def do_POST(self) -> None:  # noqa: N802
        if self.path.startswith("/pulse-exit"):
            self.bridge.pulse_exit()
            self._send_json(self.bridge.get_status_payload())
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


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="OpenCV hand gesture bridge")
    parser.add_argument("--camera-index", type=int, default=None, help="Preferred OpenCV camera index")
    return parser.parse_args()


def resolve_camera_index(preferred_index: int | None) -> int | None:
    if preferred_index is not None:
        return preferred_index

    env_value = os.environ.get("GESTURE_CAMERA_INDEX")
    if env_value is None or env_value == "":
        return None

    try:
        return int(env_value)
    except ValueError:
        return None


def main() -> None:
    camera_index = int(os.getenv("GESTURE_CAMERA_INDEX", "0"))
    bridge = GestureToggleBridge(camera_index=camera_index)
    GestureRequestHandler.bridge = bridge
    server = ThreadingHTTPServer(("127.0.0.1", 8765), GestureRequestHandler)
    camera_thread = threading.Thread(target=bridge.run_camera_loop, name="gesture-camera-loop", daemon=True)

    print("Gesture toggle bridge listening on http://127.0.0.1:8765")
    print("Endpoints: /status and /frame.jpg")
    if bridge.camera_index is None:
        print("Camera selection: auto-detect (override with GESTURE_CAMERA_INDEX or --camera-index)")
    else:
        print(f"Camera selection: preferred index {bridge.camera_index}")

    try:
        camera_thread.start()
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        bridge.request_stop()
        server.shutdown()
        server.server_close()
        camera_thread.join(timeout=2)


if __name__ == "__main__":
    main()
