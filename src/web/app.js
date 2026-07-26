
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

// HTML-escape interpolated values to prevent injection via key names / labels.
function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[ch]));
}

// Cached credential type schema + model presets (drives the add-credential form).
let _credTypes = null;
let _credPresets = null;

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
  const [data, types] = await Promise.all([api("/vault"), api("/vault/types")]);
  _credTypes = types.types;
  const labelOf = Object.fromEntries(_credTypes.map((t) => [t.id, t.label]));

  const rows = data.count === 0 ? "" :
    "<table><tr><th>Key</th><th>Type</th><th>Details</th><th>Fingerprint</th><th></th></tr>" +
    data.credentials.map((c) => {
      const details = c.type === "model_key" && c.fields
        ? esc(c.fields.endpoint_type) + " · " + esc(hostOf(c.fields.base_url))
        : "";
      const testable = ["model_key", "github_token", "sudo_password", "proxy_password"].includes(c.type);
      const testBtn = testable
        ? '<button class="btn btn-sm" data-test="' + esc(c.key) + '">Test</button>'
        : '';
      return "<tr><td>" + esc(c.key) + "</td><td>" + esc(labelOf[c.type] || c.type) + "</td><td>" + details + "</td><td>" + esc(c.fingerprint || "") + '</td><td>' + testBtn + '<button class="btn btn-danger btn-sm" data-cred="' + esc(c.key) + '">Remove</button></td></tr>';
    }).join("") +
    "</table>";

  el.innerHTML = '<div class="card"><div class="card-title">Credentials (' + data.count + ')</div>' +
    (data.count === 0 ? '<p style="color:var(--text-dim)">No credentials stored</p>' : rows) +
    '<div class="btn-group"><button class="btn btn-primary" id="btn-add-cred">Add credential</button></div></div>';

  el.querySelector("#btn-add-cred")?.addEventListener("click", showAddCredential);
  el.querySelectorAll("[data-cred]").forEach((btn) => {
    btn.addEventListener("click", () => confirmRemoveCredential(btn.dataset.cred));
  });
  el.querySelectorAll("[data-test]").forEach((btn) => {
    btn.addEventListener("click", () => testCredentialUI(btn.dataset.test));
  });
}

function hostOf(url) {
  try { return new URL(url).host; } catch { return url; }
}

async function ensurePresets() {
  if (!_credPresets) _credPresets = (await api("/vault/presets")).presets;
  return _credPresets;
}

function showAddCredential() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal"><h3>Add Credential</h3>' +
    '<div class="form-group"><label>Type</label><select id="cred-type"></select></div>' +
    '<div id="cred-fields"></div>' +
    '<div class="btn-group"><button class="btn btn-primary" id="btn-save-cred">Save</button><button class="btn" id="btn-cancel-cred">Cancel</button></div></div>';
  document.body.appendChild(overlay);

  const typeSel = overlay.querySelector("#cred-type");
  for (const t of _credTypes || []) {
    const opt = document.createElement("option");
    opt.value = t.id; opt.textContent = t.label;
    typeSel.appendChild(opt);
  }
  typeSel.addEventListener("change", () => renderCredFields(overlay, typeSel.value));
  // Default to model_key if present (the headline feature), else first type.
  typeSel.value = _credTypes?.find((t) => t.id === "model_key") ? "model_key" : (_credTypes[0]?.id || "");
  renderCredFields(overlay, typeSel.value);

  overlay.querySelector("#btn-save-cred").addEventListener("click", addCredential);
  overlay.querySelector("#btn-cancel-cred").addEventListener("click", () => overlay.remove());
}

async function renderCredFields(overlay, typeId) {
  const t = (_credTypes || []).find((x) => x.id === typeId);
  const host = overlay.querySelector("#cred-fields");
  if (!t) { host.innerHTML = ""; return; }

  let html = "";
  // Credential name: hidden for fixed-key types, shown (with optional default) otherwise.
  if (t.keyMode !== "fixed") {
    const ph = t.keyMode === "default" && t.defaultKey
      ? ' placeholder="' + esc(t.defaultKey) + '"'
      : ' placeholder="e.g. my_key"';
    html += '<div class="form-group"><label>Credential name <span style="color:var(--danger)">*</span></label><input id="cred-name"' + ph + '></div>';
  }

  // Model-key preset selector.
  if (typeId === "model_key") {
    html += '<div class="form-group"><label>Preset</label><select id="cred-preset"><option value="">— 自定义 —</option></select></div>';
  }
  for (const f of t.fields) {
    const cls = f.dependsOn ? ' cred-depends cred-dep-' + esc(f.name) : "";
    const req = f.required ? ' <span style="color:var(--danger)">*</span>' : "";
    html += '<div class="form-group' + cls + '"><label>' + esc(f.label) + req + '</label>';
    if (f.type === "select") {
      html += '<select id="cred-f-' + esc(f.name) + '">';
      for (const opt of (f.options || [])) {
        const label = f.optionLabels ? f.optionLabels[opt] : opt;
        html += '<option value="' + esc(opt) + '">' + esc(label) + '</option>';
      }
      html += '</select>';
    } else {
      const inputType = f.type === "password" ? "password" : (f.type === "url" ? "url" : "text");
      const ph = f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : "";
      html += '<input id="cred-f-' + esc(f.name) + '" type="' + inputType + '"' + ph + '>';
    }
    html += '</div>';
  }
  host.innerHTML = html;

  // Pre-fill name for "default" keyMode.
  if (t.keyMode === "default" && t.defaultKey) {
    const nameEl = host.querySelector("#cred-name");
    if (nameEl && !nameEl.value) nameEl.value = t.defaultKey;
  }

  // Refresh conditional-field visibility.
  applyDependsVisibility(host, t);

  if (typeId === "model_key") {
    const presets = await ensurePresets();
    const sel = host.querySelector("#cred-preset");
    for (const p of presets) {
      const opt = document.createElement("option");
      opt.value = p.id; opt.textContent = p.label;
      sel.appendChild(opt);
    }
    sel.addEventListener("change", () => {
      const p = presets.find((x) => x.id === sel.value);
      if (!p) return;
      const et = host.querySelector("#cred-f-endpoint_type");
      const bu = host.querySelector("#cred-f-base_url");
      if (et && p.endpoint_type) et.value = p.endpoint_type;
      if (bu && p.base_url !== undefined) bu.value = p.base_url;
    });
  }

  // Re-evaluate conditional-field visibility when a controlling field changes.
  const controllers = new Set();
  for (const f of t.fields) {
    if (f.dependsOn) controllers.add(f.dependsOn.field);
  }
  for (const ctrl of controllers) {
    const el = host.querySelector("#cred-f-" + ctrl);
    if (el) el.addEventListener("change", () => applyDependsVisibility(host, t));
  }
}

function fieldMatchesDependJS(dependsOn, values) {
  if (!dependsOn) return true;
  const v = (values || {})[dependsOn.field];
  const target = dependsOn.value;
  return Array.isArray(target) ? target.includes(v) : v === target;
}

function applyDependsVisibility(host, t) {
  // Collect current field values so we can check dependsOn.
  const values = {};
  for (const f of t.fields) {
    const el = host.querySelector("#cred-f-" + f.name);
    if (el) values[f.name] = el.value;
  }
  for (const f of t.fields) {
    if (!f.dependsOn) continue;
    const visible = fieldMatchesDependJS(f.dependsOn, values);
    const row = host.querySelector(".cred-dep-" + f.name);
    if (row) row.style.display = visible ? "" : "none";
    const input = host.querySelector("#cred-f-" + f.name);
    if (input) {
      if (!visible) {
        // Hide and store original required state.
        if (!input.dataset._origReq) input.dataset._origReq = input.required;
        input.required = false;
      } else {
        input.required = input.dataset._origReq === "true";
      }
    }
  }
}

async function addCredential() {
  const overlay = document.querySelector(".modal-overlay");
  const typeId = overlay.querySelector("#cred-type").value;
  const t = (_credTypes || []).find((x) => x.id === typeId);
  if (!t) return;

  // Fixed-key types don't render a name input; the key is pre-determined.
  const nameEl = overlay.querySelector("#cred-name");
  const credKey = t.keyMode === "fixed" && t.fixedKey
    ? t.fixedKey
    : (nameEl ? nameEl.value.trim() : "");
  if (!credKey) { toast("Credential name is required", "error"); return; }

  let body = { key: credKey, type: typeId };
  if (t.structured) {
    const fields = {};
    for (const f of t.fields) {
      const el = overlay.querySelector("#cred-f-" + f.name);
      if (el) fields[f.name] = el.value.trim();
    }
    body.fields = fields;
  } else {
    const el = overlay.querySelector("#cred-f-value");
    if (!el || !el.value) { toast("Value is required", "error"); return; }
    body.value = el.value;
  }

  try {
    await api("/vault", { method: "POST", body });
    toast("Credential saved", "success");
    overlay.remove();

    // Auto-test model_key and github_token credentials immediately.
    if ((typeId === "model_key" || typeId === "github_token") && credKey) {
      try {
        const r = await api("/vault/" + encodeURIComponent(credKey) + "/test", { method: "POST" });
        appendToTerminal(r.commands);
        const el = document.getElementById("toast");
        el.className = "toast " + (r.keyValid === true ? "success" : r.keyValid === false ? "error" : "warn");
        el.textContent = "Test: " + (r.reachable === false ? "unreachable (" + r.detail + ")" : r.keyValid === true ? "key valid!" : r.keyValid === false ? "key INVALID" : r.detail);
      } catch { /* test failure is non-fatal */ }
    }
  } catch (err) { toast(err.message, "error"); }
  render("vault");
}

// ── terminal panel ──

(function initTerminal() {
  const term = document.getElementById("terminal");
  const body = document.getElementById("terminal-body");
  const toggle = document.getElementById("terminal-toggle");
  const clear = document.getElementById("terminal-clear");
  toggle.addEventListener("click", () => {
    term.classList.toggle("collapsed");
    toggle.textContent = term.classList.contains("collapsed") ? "▲" : "▼";
  });
  clear.addEventListener("click", () => { body.innerHTML = ""; });
})();

function appendToTerminal(commands) {
  if (!Array.isArray(commands) || commands.length === 0) return;
  const term = document.getElementById("terminal");
  const body = document.getElementById("terminal-body");
  // Auto-expand when commands appear.
  if (term.classList.contains("collapsed")) {
    term.classList.remove("collapsed");
    document.getElementById("terminal-toggle").textContent = "▼";
  }
  let html = body.innerHTML;
  if (html) html += '<span class="sep">\n──\n</span>';
  for (const c of commands) {
    html += '<span class="cmd">$ ' + esc(c.cmd) + '</span>\n';
    if (c.stdout) html += '<span class="out">' + esc(c.stdout) + '</span>\n';
    if (c.stderr) html += '<span class="err">' + esc(c.stderr) + '</span>\n';
    const cls = c.exitCode === 0 ? "ok" : "fail";
    html += '<span class="' + cls + ' meta">[exit: ' + c.exitCode + '] ' + (c.duration || '') + 'ms</span>\n';
  }
  body.innerHTML = html;
  body.scrollTop = body.scrollHeight;
}

async function testCredentialUI(key) {
  toast("Testing " + key + "...", "info");
  try {
    const r = await api("/vault/" + encodeURIComponent(key) + "/test", { method: "POST" });
    appendToTerminal(r.commands);
    const el = document.getElementById("toast");
    let kind = "warn", msg = r.detail || "Unknown result";
    if (r.reachable === false) {
      kind = "error"; msg = key + ": unreachable (" + r.detail + ")";
    } else if (r.keyValid === true) {
      kind = "success"; msg = key + ": valid! (" + r.detail + ")";
    } else if (r.keyValid === false) {
      kind = "error"; msg = key + ": INVALID (" + r.detail + ")";
    } else if (r.keyValid === null && r.reachable === null) {
      kind = r.detail.startsWith("Missing") ? "error" : "info";
      msg = key + ": " + r.detail;
    } else if (r.reachable) {
      msg = key + ": reachable, " + r.detail;
    }
    el.className = "toast " + kind;
    el.textContent = msg;
  } catch (err) { toast(err.message, "error"); }
}

function confirmRemoveCredential(key) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = '<div class="modal"><h3>Remove ' + esc(key) + '?</h3>' +
    '<p style="color:var(--text-dim)">This cannot be undone. Type the key name to confirm.</p>' +
    '<div class="form-group"><input id="cred-confirm-name" placeholder="' + esc(key) + '"></div>' +
    '<div class="btn-group"><button class="btn btn-danger" id="btn-confirm-remove">Remove</button><button class="btn" id="btn-cancel-remove">Cancel</button></div></div>';
  document.body.appendChild(overlay);
  overlay.querySelector("#btn-cancel-remove").addEventListener("click", () => overlay.remove());
  overlay.querySelector("#btn-confirm-remove").addEventListener("click", async () => {
    const typed = overlay.querySelector("#cred-confirm-name").value.trim();
    if (typed !== key) { toast("Key name does not match", "error"); return; }
    try {
      await api("/vault/" + encodeURIComponent(key), { method: "DELETE" });
      toast("Removed " + key, "success");
      overlay.remove();
    } catch (err) { toast(err.message, "error"); }
    render("vault");
  });
}

async function renderProviders(el) {
  const data = await api("/providers");
  const rows = data.map((p) => "<tr><td>" + p.label + "</td><td>" + p.protocol + "</td><td>" + (p.configured ? badge("configured", "ok") : badge("not set", "warn")) + '</td><td>' + (p.configured ? '<button class="btn btn-sm" data-provider="' + p.id + '">Test</button>' : '') + '</td></tr>').join("");
  el.innerHTML = '<div class="card"><div class="card-title">Providers</div><table><tr><th>Provider</th><th>Protocol</th><th>Status</th><th></th></tr>' + rows + '</table></div>';
  el.querySelectorAll("[data-provider]").forEach((btn) => {
    btn.addEventListener("click", () => testProvider(btn.dataset.provider));
  });
}

async function testProvider(id) {
  toast("Testing " + id + "...", "info");
  try {
    const data = await api("/providers/" + id + "/test", { method: "POST" });
    appendToTerminal(data.commands);
    if (data.reachable === false) {
      toast(id + ": unreachable (" + data.detail + ")", "error");
    } else if (data.keyValid === true) {
      toast(id + ": key valid!", "success");
    } else if (data.keyValid === false) {
      toast(id + ": key INVALID", "error");
    } else {
      toast(id + ": " + (data.detail || "tested"), "warn");
    }
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
