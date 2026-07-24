import { runString } from "../exec/runner.mjs";
import { getMirror, allMirrors, enableMirror, disableMirror } from "./registry.mjs";

export async function testMirrorLatency(mirrorId) {
  const mirror = getMirror(mirrorId);
  const start = Date.now();
  const r = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "5",
    "--max-time", "10",
    mirror.baseUrl,
  ], { timeout: 12000 });
  const ms = Date.now() - start;
  return {
    mirrorId,
    ms,
    status: r.exitCode === 0 ? (r.stdout === "200" ? "ok" : "partial") : "fail",
    httpCode: r.exitCode === 0 ? r.stdout : null,
  };
}

export async function testAllMirrors() {
  const results = [];
  for (const m of allMirrors()) {
    results.push(await testMirrorLatency(m.id));
  }
  return results;
}

export async function testMirrorsByScope(scope) {
  const { mirrorsByScope } = await import("./registry.mjs");
  const mirrors = mirrorsByScope(scope);
  const results = [];
  for (const m of mirrors) {
    results.push(await testMirrorLatency(m.id));
  }
  return results;
}

export async function autoSwitchMirror(scope, thresholdMs = 500) {
  const { mirrorsByScope, enableMirror: enable, disableMirror: disable } = await import("./registry.mjs");
  const mirrors = mirrorsByScope(scope);
  const results = await Promise.all(mirrors.map((m) => testMirrorLatency(m.id)));
  const best = results.filter((r) => r.status === "ok" && r.ms < thresholdMs)
    .sort((a, b) => a.ms - b.ms);

  if (best.length === 0) {
    return { switched: false, reason: "No available mirror below threshold", results };
  }

  const bestId = best[0].mirrorId;
  for (const m of mirrors) {
    if (m.id === bestId) {
      enable(m.id);
    } else {
      disable(m.id);
    }
  }
  return { switched: true, best: bestId, latency: best[0].ms, results };
}

export async function restoreOfficialMirror(scope) {
  const { mirrorsByScope } = await import("./registry.mjs");
  const mirrors = mirrorsByScope(scope);
  for (const m of mirrors) {
    if (m.official) {
      enableMirror(m.id);
    } else {
      disableMirror(m.id);
    }
  }
  return true;
}
