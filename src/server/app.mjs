import { createServer } from "http";
import { route } from "./router.mjs";
import { serveStatic } from "./static.mjs";
import { broadcast } from "./sse.mjs";

let _pollTimer = null;

function startStatusPoller() {
  if (_pollTimer) return;
  _pollTimer = setInterval(async () => {
    try {
      const { statusApi } = await import("./api/status.mjs");
      const result = await statusApi.get();
      broadcast("status", result.data);
    } catch { /* poll failures are silent */ }
  }, 30000);
}

export function startServer(port = 17790) {
  const server = createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    try {
      const url = new URL(req.url, "http://127.0.0.1");
      if (url.pathname.startsWith("/api/")) {
        await route(req, res, url);
      } else {
        serveStatic(req, res, url);
      }
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    }
  });

  startStatusPoller();

  return new Promise((resolve) => {
    const tryListen = (p) => {
      server.once("error", () => {
        if (p < 65535) tryListen(p + 1);
      });
      server.listen(p, "127.0.0.1", () => {
        resolve({ server, port: p });
      });
    };
    tryListen(port);
  });
}
