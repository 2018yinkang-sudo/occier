
const API = "/api";

async function api(path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json();
  if (!res.ok || data.ok === false) {
    throw new Error(data.error || "Request failed");
  }
  return data.data || data;
}

function toast(msg, kind = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + kind;
  setTimeout(() => el.classList.add("hidden"), 3000);
}

function dot(ok) {
  return '<span class="dot ' + (ok ? "dot-green" : "dot-gray") + '"></span>';
}

function badge(text, kind) {
  return '<span class="badge badge-' + kind + '">' + text + '</span>';
}

const tabs = document.querySelectorAll("#tabs button");
tabs.forEach((btn) => {
  btn.addEventListener("click", () => {
    tabs.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    render(btn.dataset.tab);
  });
});

async function render(tab) {
  const content = document.getElementById("content");
  content.innerHTML = '<p style="color:var(--text-dim)">Loading...</p>';
  try {
    if (tab === "dashboard") await renderDashboard(content);
    else if (tab === "network") await renderNetwork(content);
    else if (tab === "vault") await renderVault(content);
    else if (tab === "providers") await renderProviders(content);
    else if (tab === "tools") await renderTools(content);
  } catch (err) {
    content.innerHTML = '<p class="badge badge-error">' + err.message + '</p>';
  }
}

async function renderDashboard(el) {
  const data = await api("/status");
  const { tools, providers, network, vault } = data;
  const hasProxy = !!(network && network.proxy && network.proxy.http_proxy);
  const configuredProviders = providers.filter((p) => p.configured);

  el.innerHTML = [
    '<div class="card"><div class="card-title">System Status</div>',
    '<div class="row"><span class="label">Claude Code</span>', dot(tools.claude.installed), '<span class="value">', tools.claude.installed ? "installed " + (tools.claude.version || "") : "not installed", '</span></div>',
    '<div class="row"><span class="label">OpenCode</span>', dot(tools.opencode.installed), '<span class="value">', tools.opencode.installed ? "installed " + (tools.opencode.version || "") : "not installed", '</span></div>',
    '<div class="row"><span class="label">GitHub CLI</span>', dot(tools.gh.installed && tools.gh.loggedIn), '<span class="value">', tools.gh.installed ? (tools.gh.loggedIn ? "authenticated" : "not authenticated") : "not installed", '</span></div>',
    '<div class="row"><span class="label">Network</span>', dot(hasProxy), '<span class="value">', hasProxy ? "proxy set" : "direct", '</span></div>',
    '</div>',
    '<div class="card"><div class="card-title">Providers (', configuredProviders.length, ')</div>',
    configuredProviders.length === 0 ? '<p style="color:var(--text-dim)">No providers configured</p>' :
      configuredProviders.map((p) => '<div class="row"><span class="label">' + p.label + '</span>' + dot(true) + '<span class="value">' + p.protocol + " " + (p.fingerprint || "") + '</span></div>').join(""),
    '</div>',
    '<div class="card"><div class="card-title">Summary</div>',
    '<div class="row"><span class="value">', vault.count, " credentials | ", configuredProviders.length, " providers | ", (network?.mirrors?.filter((m) => m.enabled).length || 0), ' mirrors</span></div>',
    '</div>',
  ].join("");
}

async function renderNetwork(el) {
  const data = await api("/network");
  const { platform, proxy, mirrors, connectivity } = data;
  const hasProxy = !!(proxy && proxy.http_proxy);
  const scopes = ["npm", "pip", "apt", "node"];

  const mirrorRows = scopes.map((scope) => {
    const scopeMirrors = (mirrors || []).filter((m) => m.id.startsWith(scope));
    const active = scopeMirrors.find((m) => m.enabled);
    const name = active ? active.id.replace(scope + "-", "") : "none";
    return "<tr><td>" + scope + "</td><td>" + dot(!!active) + " " + name + "</td><td>" + scopeMirrors.length + '</td><td><button class="btn" data-mirror="' + scope + '">Switch</button></td></tr>';
  }).join("");

  const connRows = connectivity && connectivity.length > 0
    ? connectivity.map((r) => "<tr><td>" + r.name + "</td><td>" + dot(r.status === "ok") + " " + r.status + "</td><td>" + (r.status === "ok" ? r.http.ms + "ms" : "-") + "</td></tr>").join("")
    : "";

  el.innerHTML = [
    '<div class="card"><div class="card-title">Proxy</div>',
    hasProxy
      ? '<div class="row"><span class="dot dot-green"></span><span class="value">' + proxy.http_proxy + '</span></div>'
      : '<div class="row"><span class="dot dot-gray"></span><span class="value" style="color:var(--text-dim)">No proxy configured</span></div>',
    '<div class="btn-group">',
    hasProxy ? '<button class="btn" id="btn-test-proxy">Test</button>' : '<button class="btn" id="btn-scan-proxy">Scan</button>',
    '<button class="btn" id="btn-configure-proxy">Configure</button>',
    hasProxy ? '<button class="btn btn-danger" id="btn-remove-proxy">Remove</button>' : "",
    '</div></div>',
    '<div class="card"><div class="card-title">Mirrors</div>',
    '<table><tr><th>Scope</th><th>Active</th><th>Count</th><th>Action</th></tr>',
    mirrorRows,
    '</table><div class="btn-group"><button class="btn btn-primary" id="btn-auto-mirrors">Auto-switch fastest</button></div></div>',
    connRows ? '<div class="card"><div class="card-title">Connectivity</div><table><tr><th>Target</th><th>Status</th><th>Latency</th></tr>' + connRows + '</table></div>' : "",
    '<div class="card"><div class="card-title">Platform</div><div class="row"><span class="value">' + platform.os + (platform.isWSL ? " WSL" + platform.wslVersion + " (" + (platform.wslMode || "nat") + ")" : "") + '</span></div></div>',
  ].join("");

  el.querySelector("#btn-test-proxy")?.addEventListener("click", testProxy);
  el.querySelector("#btn-scan-proxy")?.addEventListener("click", scanProxy);
  el.querySelector("#btn-configure-proxy")?.addEventListener("click", showProxyModal);
  el.querySelector("#btn-remove-proxy")?.addEventListener("click", removeProxy);
  el.querySelector("#btn-auto-mirrors")?.addEventListener("click", autoSwitchMirrors);
  el.querySelectorAll("[data-mirror]").forEach((btn) => {
    btn.addEventListener("click", () => switchMirror(btn.dataset.mirror));
  });
}

async function testProxy() {
  toast("Testing proxy...", "info");
  try {
    const data = await api("/network/proxy/test", { method: "POST" });
    toast("Proxy works (" + data.latency + "ms)", "success");
  } catch (err) { toast("Proxy not working: " + err.message, "error"); }
  render("network");
}

async function scanProxy() {
  toast("Scanning...", "info");
  try {
    const data = await api("/network/proxy/scan", { method: "POST" });
    if (data.found) toast("Found: " + data.host + ":" + data.port, "success");
    else toast("No proxy detected", "info");
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

async function removeProxy() {
  if (!confirm("Remove proxy configuration?")) return;
  try {
    await api("/network/proxy", { method: "DELETE" });
    toast("Proxy removed", "success");
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

async function switchMirror(scope) {
  toast("Switching " + scope + " mirror...", "info");
  try {
    const data = await api("/network/mirrors/" + scope, { method: "POST" });
    toast("Switched to " + data.mirror + " (" + data.latency + "ms)", "success");
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

async function autoSwitchMirrors() {
  toast("Testing all mirrors...", "info");
  try {
    const data = await api("/network/mirrors/auto", { method: "POST" });
    toast("Switched " + data.switched + " scopes", "success");
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

function showProxyModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal"><h3>Configure Proxy</h3><div class="form-group"><label>Proxy URL</label><input id="proxy-url" placeholder="http://127.0.0.1:10808"></div><div class="btn-group"><button class="btn btn-primary" id="btn-apply-proxy">Apply</button><button class="btn" id="btn-cancel-proxy">Cancel</button></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector("#btn-apply-proxy").addEventListener("click", applyProxy);
  overlay.querySelector("#btn-cancel-proxy").addEventListener("click", () => overlay.remove());
}

async function applyProxy() {
  const url = document.getElementById("proxy-url").value.trim();
  if (!url) return;
  try {
    const u = new URL(url);
    const proto = u.protocol.replace(":", "");
    await api("/network/proxy", {
      method: "POST",
      body: { protocol: proto, host: u.hostname, port: u.port || (proto === "socks5" ? "1080" : "3128") },
    });
    toast("Proxy configured", "success");
    document.querySelector(".modal-overlay")?.remove();
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

async function renderVault(el) {
  const data = await api("/vault");
  const rows = data.count === 0 ? "" :
    "<table><tr><th>Key</th><th>Type</th><th>Fingerprint</th><th></th></tr>" +
    data.credentials.map((c) => "<tr><td>" + c.key + "</td><td>" + c.type + "</td><td>" + (c.fingerprint || "") + '</td><td><button class="btn btn-danger" data-cred="' + c.key + '">Remove</button></td></tr>').join("") +
    "</table>";

  el.innerHTML = '<div class="card"><div class="card-title">Credentials (' + data.count + ')</div>' +
    (data.count === 0 ? '<p style="color:var(--text-dim)">No credentials stored</p>' : rows) +
    '<div class="btn-group"><button class="btn btn-primary" id="btn-add-cred">Add credential</button></div></div>';

  el.querySelector("#btn-add-cred")?.addEventListener("click", showAddCredential);
  el.querySelectorAll("[data-cred]").forEach((btn) => {
    btn.addEventListener("click", () => removeCredential(btn.dataset.cred));
  });
}

function showAddCredential() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal"><h3>Add Credential</h3><div class="form-group"><label>Key</label><input id="cred-key" placeholder="api_key"></div><div class="form-group"><label>Value</label><input id="cred-value" type="password" placeholder="secret"></div><div class="form-group"><label>Type</label><select id="cred-type"><option value="api_key">API Key</option><option value="github_token">GitHub Token</option><option value="sudo_password">System Password</option><option value="other">Other</option></select></div><div class="btn-group"><button class="btn btn-primary" id="btn-save-cred">Save</button><button class="btn" id="btn-cancel-cred">Cancel</button></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector("#btn-save-cred").addEventListener("click", addCredential);
  overlay.querySelector("#btn-cancel-cred").addEventListener("click", () => overlay.remove());
}

async function addCredential() {
  const key = document.getElementById("cred-key").value.trim();
  const value = document.getElementById("cred-value").value;
  const type = document.getElementById("cred-type").value;
  if (!key || !value) return;
  try {
    await api("/vault", { method: "POST", body: { key, value, type } });
    toast("Credential saved", "success");
    document.querySelector(".modal-overlay")?.remove();
  } catch (err) { toast(err.message, "error"); }
  render("vault");
}

async function removeCredential(key) {
  if (!confirm("Remove " + key + "?")) return;
  try {
    await api("/vault/" + key, { method: "DELETE" });
    toast("Removed " + key, "success");
  } catch (err) { toast(err.message, "error"); }
  render("vault");
}

async function renderProviders(el) {
  const data = await api("/providers");
  const rows = data.map((p) => "<tr><td>" + p.label + "</td><td>" + p.protocol + "</td><td>" + (p.configured ? badge("configured", "ok") : badge("not set", "warn")) + '</td><td><button class="btn" data-provider="' + p.id + '">Test</button></td></tr>').join("");
  el.innerHTML = '<div class="card"><div class="card-title">Providers</div><table><tr><th>Provider</th><th>Protocol</th><th>Status</th><th></th></tr>' + rows + '</table></div>';
  el.querySelectorAll("[data-provider]").forEach((btn) => {
    btn.addEventListener("click", () => testProvider(btn.dataset.provider));
  });
}

async function testProvider(id) {
  toast("Testing " + id + "...", "info");
  try {
    const data = await api("/providers/" + id + "/test", { method: "POST" });
    if (data.ok && data.data?.reachable) toast(id + " is reachable", "success");
    else toast(id + " unreachable", "error");
  } catch (err) { toast(err.message, "error"); }
}

async function renderTools(el) {
  const data = await api("/tools");
  el.innerHTML = '<div class="card"><div class="card-title">Tools</div><table><tr><th>Tool</th><th>Status</th><th>Version</th><th>Actions</th></tr>' +
    "<tr><td>Claude Code</td><td>" + dot(data.claude.installed) + "</td><td>" + (data.claude.version || "-") + "</td><td>" + (data.claude.installed ? '<button class="btn" data-tool-update="claude">Update</button>' : '<button class="btn btn-primary" data-tool-install="claude">Install</button>') + "</td></tr>" +
    "<tr><td>OpenCode</td><td>" + dot(data.opencode.installed) + "</td><td>" + (data.opencode.version || "-") + "</td><td>" + (data.opencode.installed ? '<button class="btn" data-tool-update="opencode">Update</button>' : '<button class="btn btn-primary" data-tool-install="opencode">Install</button>') + "</td></tr>" +
    "<tr><td>GitHub CLI</td><td>" + dot(data.gh.installed && data.gh.loggedIn) + "</td><td>" + (data.gh.version || "-") + "</td><td>-</td></tr>" +
    "</table></div>";

  el.querySelectorAll("[data-tool-install]").forEach((btn) => {
    btn.addEventListener("click", () => installTool(btn.dataset.toolInstall));
  });
  el.querySelectorAll("[data-tool-update]").forEach((btn) => {
    btn.addEventListener("click", () => updateTool(btn.dataset.toolUpdate));
  });
}

async function installTool(id) {
  toast("Installing " + id + "...", "info");
  try {
    await api("/tools/" + id + "/install", { method: "POST" });
    toast("Installed " + id, "success");
  } catch (err) { toast(err.message, "error"); }
  render("tools");
}

async function updateTool(id) {
  toast("Updating " + id + "...", "info");
  try {
    await api("/tools/" + id + "/update", { method: "POST" });
    toast("Updated " + id, "success");
  } catch (err) { toast(err.message, "error"); }
  render("tools");
}

(async () => {
  try {
    const pkg = await fetch("/package.json").then((r) => r.json()).catch(() => ({}));
    document.getElementById("version").textContent = "v" + (pkg.version || "3.0.0");
  } catch { /* version display is optional */ }
  render("dashboard");
})();
