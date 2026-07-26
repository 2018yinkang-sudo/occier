import { networkApi } from "./api/network.mjs";
import { vaultApi } from "./api/vault.mjs";
import { providersApi } from "./api/providers.mjs";
import { toolsApi } from "./api/tools.mjs";
import { statusApi } from "./api/status.mjs";
import { handle as sseHandle, broadcast } from "./sse.mjs";

const ROUTES = [
  ["GET",    "/api/status",                 () => statusApi.get()],
  ["GET",    "/api/network",                () => networkApi.get()],
  ["POST",   "/api/network/proxy/test",     (b) => networkApi.testProxy(b)],
  ["POST",   "/api/network/proxy/scan",     () => networkApi.scanProxy()],
  ["POST",   "/api/network/proxy",          (b) => networkApi.configureProxy(b)],
  ["DELETE", "/api/network/proxy",          () => networkApi.removeProxy()],
  ["POST",   "/api/network/mirrors/auto",   () => networkApi.autoSwitchMirrors()],
  ["POST",   "/api/network/mirrors/:scope", (b, p) => networkApi.switchMirror(p.scope, b)],
  ["GET",    "/api/vault",                  () => vaultApi.list()],
  ["POST",   "/api/vault",                  (b) => vaultApi.set(b)],
  ["DELETE", "/api/vault/:key",             (b, p) => vaultApi.remove(p.key)],
  ["GET",    "/api/providers",              () => providersApi.list()],
  ["POST",   "/api/providers/:id/test",     (b, p) => providersApi.test(p.id)],
  ["GET",    "/api/tools",                  () => toolsApi.list()],
  ["POST",   "/api/tools/:id/install",      (b, p) => toolsApi.install(p.id)],
  ["POST",   "/api/tools/:id/update",       (b, p) => toolsApi.update(p.id)],
];

function matchRoute(method, pathname) {
  for (const [m, pattern, handler] of ROUTES) {
    if (m !== method) continue;
    const parts = pattern.split("/");
    const pathParts = pathname.split("/");
    if (parts.length !== pathParts.length) continue;
    const params = {};
    let matched = true;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i].startsWith(":")) {
        params[parts[i].slice(1)] = decodeURIComponent(pathParts[i]);
      } else if (parts[i] !== pathParts[i]) {
        matched = false;
        break;
      }
    }
    if (matched) return { handler, params };
  }
  return null;
}

async function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => { data += chunk; });
    req.on("end", () => {
      if (!data) return resolve({});
      try { resolve(JSON.parse(data)); } catch { resolve({}); }
    });
  });
}

export async function route(req, res, url) {
  if (url.pathname === "/api/events" && req.method === "GET") {
    return sseHandle(req, res);
  }

  const match = matchRoute(req.method, url.pathname);
  if (!match) {
    if (url.pathname.startsWith("/api/")) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: false, error: "Not found" }));
    } else {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("Not found");
    }
    return;
  }

  const body = ["POST", "DELETE"].includes(req.method) ? await readBody(req) : {};
  const result = await match.handler(body, match.params);
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify(result));

  if (req.method !== "GET") {
    broadcast("action", {
      path: url.pathname,
      tab: url.pathname.split("/")[2] || "status",
      result,
    });
  }
}
