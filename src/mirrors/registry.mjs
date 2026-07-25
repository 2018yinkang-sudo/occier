import { join } from "path";
import { homedir } from "os";
import { readFile, writeFile, mkdir } from "fs/promises";

const MIRROR_STATE_FILE = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
  "mirrors.json",
);

const BUILTIN_MIRRORS = [
  { id: "npm-aliyun", scope: "npm", baseUrl: "https://registry.npmmirror.com", region: "cn", official: false, enabled: false },
  { id: "npm-official", scope: "npm", baseUrl: "https://registry.npmjs.org", region: "global", official: true, enabled: true },
  { id: "pip-tsinghua", scope: "pip", baseUrl: "https://pypi.tuna.tsinghua.edu.cn/simple", region: "cn", official: false, enabled: false },
  { id: "pip-official", scope: "pip", baseUrl: "https://pypi.org/simple", region: "global", official: true, enabled: true },
  { id: "apt-aliyun", scope: "apt", baseUrl: "http://mirrors.aliyun.com/ubuntu/", region: "cn", official: false, enabled: false, distro: "ubuntu" },
  { id: "apt-official", scope: "apt", baseUrl: "http://archive.ubuntu.com/ubuntu/", region: "global", official: true, enabled: true, distro: "ubuntu" },
  { id: "node-official", scope: "node", baseUrl: "https://nodejs.org/dist", region: "global", official: true, enabled: true },
  { id: "node-aliyun", scope: "node", baseUrl: "https://npmmirror.com/mirrors/node", region: "cn", official: false, enabled: false },
];

const _internal = new Map();

for (const m of BUILTIN_MIRRORS) {
  _internal.set(m.id, { ...m });
}

async function loadMirrorState() {
  try {
    const raw = await readFile(MIRROR_STATE_FILE, "utf-8");
    const state = JSON.parse(raw);
    for (const [id, enabled] of Object.entries(state)) {
      const m = _internal.get(id);
      if (m) m.enabled = enabled;
    }
  } catch { /* no persisted state yet */ }
}

async function saveMirrorState() {
  const state = {};
  for (const [id, m] of _internal) {
    state[id] = m.enabled;
  }
  await mkdir(join(MIRROR_STATE_FILE, ".."), { recursive: true, mode: 0o700 });
  await writeFile(MIRROR_STATE_FILE, JSON.stringify(state, null, 2), { mode: 0o600 });
}

let _loaded = false;

async function ensureLoaded() {
  if (!_loaded) {
    _loaded = true;
    await loadMirrorState();
  }
}

export function getMirror(id) {
  const m = _internal.get(id);
  if (!m) throw new Error(`Unknown mirror: ${id}`);
  return m;
}

export function getMirrorSafe(id) {
  return _internal.get(id) ?? null;
}

export async function allMirrors() {
  await ensureLoaded();
  return Array.from(_internal.values());
}

export async function mirrorsByScope(scope) {
  await ensureLoaded();
  return (await allMirrors()).filter((m) => m.scope === scope);
}

export async function enableMirror(id) {
  await ensureLoaded();
  const m = _internal.get(id);
  if (!m) return false;
  m.enabled = true;
  await saveMirrorState();
  return true;
}

export async function disableMirror(id) {
  await ensureLoaded();
  const m = _internal.get(id);
  if (!m) return false;
  m.enabled = false;
  await saveMirrorState();
  return true;
}
