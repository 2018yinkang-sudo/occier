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

export function getMirror(id) {
  const m = _internal.get(id);
  if (!m) throw new Error(`Unknown mirror: ${id}`);
  return m;
}

export function getMirrorSafe(id) {
  return _internal.get(id) ?? null;
}

export function allMirrors() {
  return Array.from(_internal.values());
}

export function mirrorsByScope(scope) {
  return allMirrors().filter((m) => m.scope === scope);
}

export function enableMirror(id) {
  const m = _internal.get(id);
  if (!m) return false;
  m.enabled = true;
  return true;
}

export function disableMirror(id) {
  const m = _internal.get(id);
  if (!m) return false;
  m.enabled = false;
  return true;
}
