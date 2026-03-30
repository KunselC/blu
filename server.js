import { createServer } from "node:http";
import { Server } from "socket.io";
import translateModule from "google-translate-api";

const translate =
  typeof translateModule === "function"
    ? translateModule
    : translateModule.default;

const PORT = Number(process.env.PORT ?? 3001);

async function fallbackTranslate({ text, from, to }) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: from || "auto",
    tl: to,
    dt: "t",
    q: text,
  });

  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new Error(`Fallback translation failed with HTTP ${response.status}`);
  }

  const payload = await response.json();
  const translatedText = Array.isArray(payload?.[0])
    ? payload[0]
        .map((part) => (Array.isArray(part) ? part[0] : ""))
        .filter(Boolean)
        .join("")
    : "";

  return {
    text: translatedText,
    from: {
      language: {
        iso: typeof payload?.[2] === "string" ? payload[2] : "",
      },
    },
  };
}

const sessionState = {
  chatMessages: [],
  drawingSegments: [],
  transcriptionLog: [],
  liveTranscript: "",
  cameraFrames: {},
};

const clientIdBySocketId = new Map();

function setCorsHeaders(response) {
  response.setHeader("Access-Control-Allow-Origin", "*");
  response.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function sendJson(response, statusCode, payload) {
  setCorsHeaders(response);
  response.writeHead(statusCode, { "Content-Type": "application/json" });
  response.end(JSON.stringify(payload));
}

async function readJsonBody(request) {
  let rawBody = "";
  for await (const chunk of request) {
    rawBody += chunk;
  }
  if (!rawBody) return {};
  return JSON.parse(rawBody);
}

const httpServer = createServer(async (request, response) => {
  if (request.method === "OPTIONS") {
    setCorsHeaders(response);
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.url === "/api/translate" && request.method === "POST") {
    try {
      const payload = await readJsonBody(request);
      const text = typeof payload?.text === "string" ? payload.text.trim() : "";
      const from =
        typeof payload?.from === "string" ? payload.from.trim() : "auto";
      const to = typeof payload?.to === "string" ? payload.to.trim() : "";

      if (!text) {
        sendJson(response, 400, { error: "Missing text to translate." });
        return;
      }

      if (!to) {
        sendJson(response, 400, { error: "Missing target language code." });
        return;
      }

      let result;
      try {
        result = await translate(text, {
          from: from || "auto",
          to,
        });
      } catch {
        result = await fallbackTranslate({ text, from, to });
      }

      sendJson(response, 200, {
        translatedText: result?.text ?? "",
        detectedSourceLanguage: result?.from?.language?.iso ?? "",
      });
    } catch (error) {
      const message =
        (error &&
          typeof error === "object" &&
          "message" in error &&
          error.message) ||
        (typeof error === "string" ? error : "") ||
        "Translation failed using google-translate-api.";

      sendJson(response, 500, {
        error: String(message),
      });
    }
    return;
  }

  sendJson(response, 404, { error: "Not found." });
});
const io = new Server(httpServer, {
  cors: {
    origin: "*",
  },
});

io.on("connection", (socket) => {
  socket.emit("session:snapshot", sessionState);

  socket.on("client:identify", (payload) => {
    if (typeof payload?.clientId !== "string") return;
    clientIdBySocketId.set(socket.id, payload.clientId);
  });

  socket.on("chat:message", (payload) => {
    sessionState.chatMessages = [
      ...sessionState.chatMessages.slice(-199),
      payload,
    ];
    socket.broadcast.emit("chat:message", payload);
  });

  socket.on("drawing:segment", (payload) => {
    if (!payload?.segment) return;
    sessionState.drawingSegments = [
      ...sessionState.drawingSegments.slice(-5999),
      payload.segment,
    ];
    socket.broadcast.emit("drawing:segment", payload);
  });

  socket.on("drawing:clear", () => {
    sessionState.drawingSegments = [];
    io.emit("drawing:clear");
  });

  socket.on("transcript:append", (payload) => {
    if (typeof payload?.segment !== "string") return;
    const segment = payload.segment.trim();
    if (!segment) return;
    sessionState.transcriptionLog = [
      ...sessionState.transcriptionLog.slice(-499),
      segment,
    ];
    socket.broadcast.emit("transcript:append", payload);
  });

  socket.on("transcript:update", (payload) => {
    if (typeof payload?.text !== "string") return;
    sessionState.liveTranscript = payload.text;
    socket.broadcast.emit("transcript:update", payload);
  });

  socket.on("camera:frame", (payload) => {
    const senderId =
      typeof payload?.senderId === "string"
        ? payload.senderId
        : clientIdBySocketId.get(socket.id) ?? "";
    if (!senderId) return;

    const frame =
      typeof payload?.frame === "string" && payload.frame
        ? payload.frame
        : null;

    if (frame) {
      sessionState.cameraFrames[senderId] = frame;
    } else {
      delete sessionState.cameraFrames[senderId];
    }

    socket.broadcast.emit("camera:frame", {
      senderId,
      frame,
    });
  });

  socket.on("disconnect", () => {
    const clientId = clientIdBySocketId.get(socket.id);
    clientIdBySocketId.delete(socket.id);
    if (!clientId) return;
    delete sessionState.cameraFrames[clientId];
    socket.broadcast.emit("camera:frame", {
      senderId: clientId,
      frame: null,
    });
  });
});

httpServer.listen(PORT, () => {
  console.log(`Socket.io server running on http://0.0.0.0:${PORT}`);
});
