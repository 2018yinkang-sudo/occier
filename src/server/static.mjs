import { readFile } from "fs/promises";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const WEB_DIR = join(__dirname, "..", "web");

const MIME = {
  ".html": "text/html",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
};

export function serveStatic(req, res, url) {
  let pathname = url.pathname;
  if (pathname === "/") pathname = "/index.html";

  const filePath = join(WEB_DIR, pathname);
  const ext = extname(filePath);
  const contentType = MIME[ext] || "application/octet-stream";

  readFile(filePath)
    .then((data) => {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(data);
    })
    .catch(() => {
      res.writeHead(404, { "Content-Type": "text/html" });
      res.end("<h1>404 Not Found</h1>");
    });
}
