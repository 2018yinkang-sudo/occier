
const API = "/api";

// ── Helpers ──
function api(path, opts = {}) {
  return fetch(API + path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json" } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  }).then((r) => r.json()).then((d) => {
    if (d.ok === false) throw new Error(d.error || "Request failed");
    return d.data || d;
  });
}

function toast(msg, kind = "info") {
  const el = document.getElementById("toast");
  el.textContent = msg;
  el.className = "toast " + kind + " show";
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove("show"), 3000);
}

function dot(on) {
  return '<span class="dot ' + (on ? "dot-on" : "dot-off") + '"></span>';
}

function badge(text, kind) {
  return '<span class="badge badge-' + kind + '">' + text + '</span>';
}

function button(id, label, cls) {
  return '<button class="btn ' + (cls || "") + '" id="' + id + '">' + label + '</button>';
}



function setButtonLoading(id, loading) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = loading;
  btn._origText = btn._origText || btn.textContent;
  btn.textContent = loading ? "..." : btn._origText;
}

// ── SSE ──
let _sseReconnect = null;

function connectSSE() {
  const dot = document.getElementById("connection-dot");
  const evtSource = new EventSource(API + "/events");

  evtSource.addEventListener("connected", () => {
    dot.classList.add("connected");
    dot.title = "Connected";
  });

  evtSource.addEventListener("status", (e) => {
    const data = JSON.parse(e.data);
    updateDashboardSections(data);
  });

  evtSource.addEventListener("action", (e) => {
    const data = JSON.parse(e.data);
    handleSSEAction(data);
  });

  evtSource.addEventListener("error", () => {
    dot.classList.remove("connected");
    dot.title = "Disconnected";
    evtSource.close();
    clearTimeout(_sseReconnect);
    _sseReconnect = setTimeout(connectSSE, 5000);
  });
}

function handleSSEAction(data) {
  if (!data.result || data.result.ok === false) return;

  switch (data.tab) {
    case "network":
      refreshNetworkSection(data.path);
      break;
    case "vault":
      if (document.getElementById("tabs")?.querySelector(".active")?.dataset.tab === "vault") {
        render("vault");
      }
      break;
    case "providers":
      updateDashboardSectionsFromEvent();
      break;
    case "tools":
      updateDashboardSectionsFromEvent();
      break;
  }
}

function refreshNetworkSection(path) {
  const active = document.getElementById("tabs")?.querySelector(".active")?.dataset.tab;
  if (active !== "network") return;

  if (path.includes("/proxy")) {
    api("/network").then((d) => {
      updateProxyCard(d);
      updateConnectivityCard(d.connectivity);
    }).catch(() => {});
  } else if (path.includes("/mirrors")) {
    api("/network").then((d) => {
      updateMirrorsCard(d.mirrors);
      updateConnectivityCard(d.connectivity);
    }).catch(() => {});
  }
}

function updateDashboardSections(data) {
  const active = document.getElementById("tabs")?.querySelector(".active")?.dataset.tab;
  if (active !== "dashboard" || !data) return;

  const el = document.getElementById("content");
  if (!el || !el.querySelector(".card")) return;

  const toolsEl = el.querySelector("#dash-tools");
  const provEl = el.querySelector("#dash-providers");
  const netEl = el.querySelector("#dash-network");
  const credEl = el.querySelector("#dash-creds");
  const mirEl = el.querySelector("#dash-mirrors");

  if (data.tools && toolsEl) {
    const tools = data.tools;
    toolsEl.innerHTML =
      '<tr><td>Claude Code</td><td>' + dot(tools.claude.installed) + '</td><td>' + (tools.claude.installed ? "installed " + tools.claude.version : badge("missing", "warn")) + '</td></tr>' +
      '<tr><td>OpenCode</td><td>' + dot(tools.opencode.installed) + '</td><td>' + (tools.opencode.installed ? "installed " + tools.opencode.version : badge("missing", "warn")) + '</td></tr>' +
      '<tr><td>GitHub CLI</td><td>' + dot(tools.gh.installed && tools.gh.loggedIn) + '</td><td>' + (tools.gh.installed ? (tools.gh.loggedIn ? "authenticated" : "not authenticated") : badge("missing", "warn")) + '</td></tr>';
  }

  if (data.providers && provEl) {
    const configured = data.providers.filter((p) => p.configured);
    provEl.innerHTML = configured.length === 0
      ? '<p class="muted">No providers configured</p>'
      : configured.map((p) => '<tr><td>' + p.label + '</td><td>' + p.protocol + '</td></tr>').join("");
  }

  if (data.network && netEl) {
    const hasProxy = !!(data.network.proxy && data.network.proxy.http_proxy);
    netEl.textContent = hasProxy ? "proxy set" : "direct";
  }

  if (data.vault && credEl) {
    credEl.textContent = data.vault.count;
  }

  if (data.network && mirEl) {
    mirEl.textContent = (data.network.mirrors || []).filter((m) => m.enabled).length;
  }
}

function updateDashboardSectionsFromEvent() {
  api("/status").then((d) => updateDashboardSections(d)).catch(() => {});
}

// ── Tabs ──
let _currentTab = "dashboard";
const TABS_MAP = ["dashboard", "network", "vault", "providers", "tools"];

function switchTab(id) {
  _currentTab = id;
  const btns = document.querySelectorAll("#tabs button");
  btns.forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector('#tabs button[data-tab="' + id + '"]');
  if (btn) btn.classList.add("active");
  render(id);
}

async function render(tab) {
  _currentTab = tab;
  const content = document.getElementById("content");

  if (tab === "dashboard") { content.innerHTML = buildDashboardSkeleton(); await loadDashboard(content); }
  else if (tab === "network") { content.innerHTML = buildNetworkSkeleton(); await loadNetwork(content); }
  else if (tab === "vault") { content.innerHTML = buildCardSkeleton(); await loadVault(content); }
  else if (tab === "providers") { content.innerHTML = buildCardSkeleton(); await loadProviders(content); }
  else if (tab === "tools") { content.innerHTML = buildCardSkeleton(); await loadTools(content); }
  else if (tab === "cmd") showShortcuts();
}

document.querySelectorAll("#tabs button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = btn.dataset.tab;
    if (tab === "cmd") { showShortcuts(); return; }
    switchTab(tab);
  });
});

// ── Keyboard shortcuts ──
document.addEventListener("keydown", (e) => {
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT") return;
  if (e.ctrlKey || e.metaKey || e.altKey) return;

  if (e.key === "Escape") {
    const modal = document.querySelector(".modal-overlay");
    if (modal) { modal.remove(); return; }
    document.querySelectorAll(".inline-confirm.active").forEach((c) => c.classList.remove("active"));
  }

  if (e.key >= "1" && e.key <= "5") {
    const idx = parseInt(e.key) - 1;
    switchTab(TABS_MAP[idx]);
  }

  if (e.key === "r" || e.key === "R") {
    render(_currentTab);
    toast("Refreshed", "info");
  }
});

// ── Modals ──
function showModal(title, bodyHtml, buttons) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  overlay.innerHTML = '<div class="modal"><h3>' + title + '</h3>' + bodyHtml + '<div class="btn-group">' + buttons + '</div></div>';
  document.body.appendChild(overlay);
  return overlay;
}

// ── Shortcuts help ──
function showShortcuts() {
  const content = document.getElementById("content");
  content.innerHTML = [
    '<div class="card"><div class="card-head">Keyboard Shortcuts</div><div class="card-body">',
    '<table><tr><td>1-5</td><td>Switch tabs</td></tr><tr><td>Esc</td><td>Close modal / cancel</td></tr><tr><td>r</td><td>Refresh current tab</td></tr><tr><td>Enter</td><td>Submit form</td></tr></table>',
    '</div></div>'
  ].join("");
}

// ── Skeleton builders ──
function buildCardSkeleton() {
  return '<div class="skeleton-card"><div class="skel-h"></div><div class="skel-r"></div><div class="skel-r w80"></div></div>';
}

function buildDashboardSkeleton() {
  return '<div class="grid"><div class="skeleton-card"><div class="skel-h"></div><div class="skel-r"></div><div class="skel-r w80"></div><div class="skel-r w60"></div></div><div class="skeleton-card"><div class="skel-h"></div><div class="skel-r"></div></div></div>';
}

function buildNetworkSkeleton() {
  return '<div class="net-grid"><div class="skeleton-card"><div class="skel-h"></div><div class="skel-r"></div><div class="skel-r w80"></div></div><div class="skeleton-card"><div class="skel-h"></div><div class="skel-r w60"></div></div><div class="skeleton-card" style="grid-column:1/-1"><div class="skel-h"></div><div class="skel-r w80"></div></div><div class="skeleton-card" style="grid-column:1/-1"><div class="skel-h"></div><div class="skel-r w80"></div><div class="skel-r w60"></div></div></div>';
}

// ── Dashboard ──
async function loadDashboard(el) {
  try {
    const data = await api("/status");
    const { tools, providers, network, vault } = data;
    const hasProxy = !!(network && network.proxy && network.proxy.http_proxy);
    const configured = providers.filter((p) => p.configured);
    const enabledMirrors = (network?.mirrors || []).filter((m) => m.enabled).length;

    el.innerHTML = [
      '<div class="grid">',
      '<div class="card"><div class="card-head">System Status</div><div class="card-body"><table id="dash-tools">',
      '<tr><td>Claude Code</td><td>', dot(tools.claude.installed), '</td><td>', tools.claude.installed ? "installed " + (tools.claude.version || "") : badge("missing","warn"), '</td></tr>',
      '<tr><td>OpenCode</td><td>', dot(tools.opencode.installed), '</td><td>', tools.opencode.installed ? "installed " + (tools.opencode.version || "") : badge("missing","warn"), '</td></tr>',
      '<tr><td>GitHub CLI</td><td>', dot(tools.gh.installed && tools.gh.loggedIn), '</td><td>', tools.gh.installed ? (tools.gh.loggedIn ? "authenticated" : "not authenticated") : badge("missing","warn"), '</td></tr>',
      '</table></div></div>',
      '<div class="card"><div class="card-head">Providers <span class="count">', configured.length, '</span></div><div class="card-body"><table id="dash-providers">',
      configured.length === 0 ? '<p class="muted">No providers configured</p>' :
        configured.map((p) => '<tr><td>' + p.label + '</td><td>' + p.protocol + '</td></tr>').join(""),
      '</table></div></div>',
      '<div class="card" style="grid-column:1/-1"><div class="card-head">Summary</div><div class="card-body">',
      '<span id="dash-creds">', vault.count, '</span> credentials &middot; ',
      configured.length, ' providers &middot; ',
      '<span id="dash-mirrors">', enabledMirrors, '</span> mirrors &middot; ',
      'Network: <span id="dash-network">', hasProxy ? "proxy set" : "direct", '</span>',
      '</div></div>',
      '</div>',
    ].join("");
  } catch (err) {
    el.innerHTML = '<div class="card"><div class="card-body empty"><span class="badge badge-err">' + err.message + '</span></div></div>';
  }
}

// ── Network ──
async function loadNetwork(el) {
  try {
    const data = await api("/network");
    buildNetworkContent(el, data);
  } catch (err) {
    el.innerHTML = '<div class="card"><div class="card-body empty"><span class="badge badge-err">' + err.message + '</span></div></div>';
  }
}

function buildNetworkContent(el, data) {
  const { platform, proxy, mirrors, connectivity } = data;
  const hasProxy = !!(proxy && proxy.http_proxy);
  let proto = "", host = "", port = "";
  if (hasProxy) {
    try { const u = new URL(proxy.http_proxy); proto = u.protocol.replace(":","").replace("socks5h","socks5"); host = u.hostname; port = u.port || ""; } catch { /* URL parse non-critical */ }
  }

  el.innerHTML = [
    '<div class="net-grid">',

    '<div class="card"><div class="card-head">Proxy</div><div class="card-body" id="proxy-card">',
    hasProxy
      ? '<p class="proxy-url"><span class="dot dot-on"></span><code>' + proxy.http_proxy + '</code></p>' +
        '<div class="proxy-detail"><span class="pd-item">' + proto + '</span><span class="pd-sep">\u00b7</span>' +
        '<span class="pd-item">' + host + '</span><span class="pd-sep">\u00b7</span>' +
        '<span class="pd-item">port ' + (port || "-") + '</span></div>' +
        '<span class="status-ok hidden" id="proxy-result"></span>'
      : '<p class="muted proxy-url"><span class="dot dot-off"></span>No proxy configured</p>',
    '<div class="btn-group">',
    hasProxy ? button("btn-test-proxy", "Test", "") : button("btn-scan-proxy", "Scan", ""),
    button("btn-conf-proxy", "Configure", ""),
    hasProxy ? '<span id="proxy-remove-group">' + button("btn-rm-proxy", "Remove", "btn-dng") + '<span class="inline-confirm" id="cf-rm-proxy">Confirm: <button class="btn btn-sm btn-pri" data-confirm="yes">Yes</button> <button class="btn btn-sm" data-confirm="no">No</button></span></span>' : "",
    '</div></div></div>',

    '<div class="card"><div class="card-head">Platform</div><div class="card-body">' +
    '<span class="muted">' + platform.os + (platform.isWSL ? " WSL" + platform.wslVersion + " (" + (platform.wslMode || "nat") + ")" : "") + '</span></div></div>',

    buildMirrorsCompact(mirrors),

    buildConnectivityCompact(connectivity),

    '</div>',
  ].join("");

  attachNetworkEvents(el);
}

function buildConnectivityCompact(conn) {
  if (!conn || conn.length === 0) {
    return '<div class="card"><div class="card-head">Connectivity</div><div class="card-body"><p class="muted">No data \u2014 press r to refresh</p></div></div>';
  }

  const groups = {};
  const groupOrder = [];
  for (const r of conn) {
    const g = r.group || "Other";
    if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
    groups[g].push(r);
  }

  const rows = groupOrder.map((g) => {
    const items = groups[g];
    const okCount = items.filter((r) => r.status === "ok").length;
    const dots = items.map((r) => '<span class="dot ' + (r.status === "ok" ? "dot-on" : "dot-err") + '" title="' + r.name + '"></span>').join("");
    return '<div class="conn-compact-row"><span class="conn-g-label">' + g + '</span>' +
      '<span class="conn-dots">' + dots + '</span>' +
      '<span class="conn-g-count">' + okCount + '/' + items.length + '</span></div>';
  }).join("");

  return '<div class="card"><div class="card-head">Connectivity</div><div class="card-body" id="conn-card">' +
    '<div class="conn-compact">' + rows + '</div>' +
    '<div class="btn-group" style="margin-top:10px">' +
    button("btn-conn-test", "Test All", "btn-sm") +
    '</div></div></div>';
}

const SCOPES = ["npm", "pip", "apt", "node"];

function buildMirrorsCompact(mirrors) {
  const scopeRows = SCOPES.map((scope) => {
    const scopeMirrors = (mirrors || []).filter((m) => m.scope === scope);
    if (scopeMirrors.length === 0) return "";
    const active = scopeMirrors.find((m) => m.enabled);
    const activeName = active ? active.id.replace(scope + "-", "") : "\u2014";
    const activeRegion = active ? (active.region || "") : "";
    return '<div class="mirror-compact-row">' +
      '<span class="mc-scope">' + scope + (scope === "apt" ? '*' : '') + '</span>' +
      '<span class="dot ' + (active ? "dot-on" : "dot-off") + '"></span>' +
      '<span class="mc-name">' + activeName + '</span>' +
      '<span class="mc-region">' + activeRegion + '</span>' +
      '<span class="mc-count">' + scopeMirrors.length + ' mirrors</span>' +
      '<button class="btn btn-sm mc-swap" data-scope="' + scope + '">switch</button>' +
      '</div>';
  }).join("");

  return '<div class="card"><div class="card-head">Mirrors <span class="count">' + (mirrors || []).filter((m) => m.enabled).length + '/' + (mirrors || []).length + ' active</span></div><div class="card-body" id="mirrors-card">' +
    '<div class="mirror-compact">' + scopeRows + '</div>' +
    '<div class="btn-group" style="margin-top:10px">' +
    button("btn-test-mirrors", "Test Latencies", "btn-sm") +
    button("btn-auto-mirrors", "Auto Fastest", "btn-sm btn-pri") +
    '</div></div></div>';
}

function buildMirrorTable(mirrors, latencies) {
  const latMap = {};
  if (latencies) latencies.forEach((l) => { latMap[l.mirrorId] = l; });

  return '<div id="mirror-table">' + SCOPES.map((scope) => {
    const scopeMirrors = (mirrors || []).filter((m) => m.scope === scope);
    if (scopeMirrors.length === 0) return "";
    const active = scopeMirrors.find((m) => m.enabled);
    const label = scope + (scope === "apt" ? " (requires sudo)" : "");
    return '<div class="mirror-scope"><div class="mirror-scope-head">' + label +
      ' — <span class="muted">' + scopeMirrors.length + ' mirrors</span>' +
      (active ? ' · active: <strong>' + active.id.replace(scope + "-", "") + '</strong>' : "") +
      '</div>' +
      scopeMirrors.map((m) => {
        const lat = latMap[m.id];
        const isActive = m.enabled;
        return '<div class="mirror-row">' +
          '<span class="dot ' + (isActive ? "dot-on" : "dot-off") + '"></span>' +
          '<span class="mirror-name">' + m.id.replace(scope + "-", "") + '</span>' +
          '<span class="mirror-region">' + (m.region || "global") + '</span>' +
          '<span class="mirror-lat">' + (lat ? (lat.status === "ok" ? lat.ms + "ms" : lat.status) : "\u2014") + '</span>' +
          (isActive
            ? '<span class="mirror-action status-ok">active</span>'
            : '<button class="btn btn-sm mir-switch-btn" data-scope="' + scope + '" data-id="' + m.id + '">switch</button>') +
          '</div>';
      }).join("") + '</div>';
  }).join("") + '</div>';
}

function attachNetworkEvents(el) {
  const map = {
    "btn-test-proxy": testProxy,
    "btn-scan-proxy": scanProxy,
    "btn-conf-proxy": showProxyModal,
    "btn-rm-proxy": () => confirmRemoveDelegate(el, "cf-rm-proxy", removeProxy),
    "btn-auto-mirrors": autoSwitchMirrors,
    "btn-test-mirrors": testMirrorLatencies,
    "btn-conn-test": testConnectivityNow,
  };

  Object.entries(map).forEach(([id, fn]) => {
    el.querySelector("#" + id)?.addEventListener("click", fn);
  });

  el.querySelectorAll("[data-confirm]").forEach((btn) => {
    btn.addEventListener("click", function () {
      this.closest(".inline-confirm")?.classList.remove("active");
      if (this.dataset.confirm === "yes") {
        const tag = this.closest(".inline-confirm")?.id;
        if (tag === "cf-rm-proxy") removeProxy();
      }
    });
  });

  el.querySelectorAll(".mir-switch-btn, .mc-swap").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.classList.contains("mc-swap")) {
        showMirrorPicker(btn.dataset.scope, btn);
      } else {
        switchToMirror(btn.dataset.scope, btn.dataset.id);
      }
    });
  });
}

function confirmRemoveDelegate(el, confirmId, onYes) {
  const cf = el.querySelector("#" + confirmId);
  if (!cf) return;
  cf.classList.add("active");
  el.querySelector("#" + confirmId + " [data-confirm=yes]").onclick = () => { cf.classList.remove("active"); onYes(); };
}

function updateProxyCard(data) {
  const proxy = data.proxy;
  const hasProxy = !!(proxy && proxy.http_proxy);
  const card = document.getElementById("proxy-card");
  if (!card) return;

  const resultEl = document.getElementById("proxy-result");
  if (resultEl && hasProxy) {
    resultEl.classList.remove("hidden");
  }

  const btnGroup = card.querySelector(".btn-group");
  if (hasProxy && btnGroup) {
    const rmBtn = card.querySelector("#btn-rm-proxy");
    if (!rmBtn) {
      const rmSpan = document.getElementById("proxy-remove-group");
      if (rmSpan) rmSpan.innerHTML = button("btn-rm-proxy", "Remove", "btn-dng", "confirmRemoveProxy()") +
        '<span class="inline-confirm" id="cf-rm-proxy">Confirm: <button class="btn btn-sm btn-pri" data-confirm="yes">Yes</button> <button class="btn btn-sm" data-confirm="no">No</button></span>';
    }
  }
}

function updateMirrorsCard(mirrors) {
  const tbl = document.getElementById("mirror-table");
  if (!tbl) return;
  tbl.innerHTML = "";
  tbl.outerHTML = buildMirrorTable(mirrors);
  rebindMirrorButtons();
}

function rebindMirrorButtons() {
  document.querySelectorAll(".mir-switch-btn").forEach((btn) => {
    btn.addEventListener("click", () => switchToMirror(btn.dataset.scope, btn.dataset.id));
  });
  document.querySelectorAll(".mc-swap").forEach((btn) => {
    btn.addEventListener("click", () => showMirrorPicker(btn.dataset.scope, btn));
  });
}

async function showMirrorPicker(scope, triggerBtn) {
  try {
    const data = await api("/network");
    const scopeMirrors = (data.mirrors || []).filter((m) => m.scope === scope);
    if (scopeMirrors.length === 0) return;

    const items = scopeMirrors.map((m) =>
      '<button class="pick-mirror-btn" data-scope="' + scope + '" data-id="' + m.id + '">' +
      '<span class="dot ' + (m.enabled ? "dot-on" : "dot-off") + '"></span> ' +
      m.id.replace(scope + "-", "") +
      (m.region ? ' <span class="muted">' + m.region + '</span>' : "") +
      '</button>'
    ).join("");

    const existing = document.getElementById("mirror-picker");
    if (existing) { existing.remove(); return; }

    const picker = document.createElement("div");
    picker.id = "mirror-picker";
    picker.className = "mirror-picker";
    picker.innerHTML = '<div class="mirror-picker-inner"><div class="picker-head">' + scope + ' mirrors</div>' + items + '</div>';
    document.body.appendChild(picker);

    const rect = triggerBtn.getBoundingClientRect();
    picker.style.top = (rect.bottom + 4) + "px";
    picker.style.left = Math.min(rect.left, window.innerWidth - 220) + "px";

    picker.querySelectorAll(".pick-mirror-btn").forEach((b) => {
      b.addEventListener("click", async () => {
        picker.remove();
        await switchToMirror(b.dataset.scope, b.dataset.id);
      });
    });

    const close = (e) => {
      if (!picker.contains(e.target)) { picker.remove(); document.removeEventListener("mousedown", close); }
    };
    setTimeout(() => document.addEventListener("mousedown", close), 0);
  } catch { /* picker non-critical */ }
}

function updateConnectivityCard(conn) {
  const card = document.getElementById("conn-card");
  if (!card) return;
  card.innerHTML = '<div class="conn-compact">' + buildConnectivityRows(conn) + '</div>' +
    '<div class="btn-group" style="margin-top:10px">' +
    button("btn-conn-test", "Test All", "btn-sm") + '</div>';
  card.querySelector("#btn-conn-test")?.addEventListener("click", testConnectivityNow);
}

function buildConnectivityRows(conn) {
  if (!conn || conn.length === 0) return '<p class="muted">No data</p>';
  const groups = {};
  const groupOrder = [];
  for (const r of conn) {
    const g = r.group || "Other";
    if (!groups[g]) { groups[g] = []; groupOrder.push(g); }
    groups[g].push(r);
  }
  return groupOrder.map((g) => {
    const items = groups[g];
    const okCount = items.filter((r) => r.status === "ok").length;
    const dots = items.map((r) => '<span class="dot ' + (r.status === "ok" ? "dot-on" : "dot-err") + '" title="' + r.name + '"></span>').join("");
    return '<div class="conn-compact-row"><span class="conn-g-label">' + g + '</span>' +
      '<span class="conn-dots">' + dots + '</span>' +
      '<span class="conn-g-count">' + okCount + '/' + items.length + '</span></div>';
  }).join("");
}

// ── Network actions ──
async function testProxy() {
  setButtonLoading("btn-test-proxy", true);
  const resultEl = document.getElementById("proxy-result");
  try {
    const data = await api("/network/proxy/test", { method: "POST" });
    if (resultEl) { resultEl.textContent = "Works (" + data.latency + "ms)"; resultEl.className = "status-ok"; resultEl.classList.remove("hidden"); }
    toast("Proxy works (" + data.latency + "ms)", "success");
  } catch (err) {
    if (resultEl) { resultEl.textContent = "Failed: " + err.message; resultEl.className = "status-err"; resultEl.classList.remove("hidden"); }
    toast(err.message, "error");
  } finally {
    setButtonLoading("btn-test-proxy", false);
  }
}

async function scanProxy() {
  setButtonLoading("btn-scan-proxy", true);
  try {
    const data = await api("/network/proxy/scan", { method: "POST" });
    if (data.found) toast("Found: " + data.host + ":" + data.port + " — Use Configure to apply", "success");
    else toast("No proxy detected", "info");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-scan-proxy", false); }
}

async function removeProxy() {
  try {
    await api("/network/proxy", { method: "DELETE" });
    toast("Proxy removed", "success");
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

async function testMirrorLatencies() {
  setButtonLoading("btn-test-mirrors", true);
  try {
    const data = await api("/network/mirrors/test", { method: "POST" });
    const netData = await api("/network");
    const tbl = document.getElementById("mirror-table");
    if (tbl) {
      tbl.outerHTML = buildMirrorTable(netData.mirrors, data);
      rebindMirrorButtons();
    }
    toast("Latency test complete", "success");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-test-mirrors", false); }
}

async function switchToMirror(scope, mirrorId) {
  try {
    const data = await api("/network/mirrors/" + scope, { method: "POST", body: { mirrorId } });
    toast("Switched to " + data.mirror.replace(scope + "-", "") + (data.latency ? " (" + data.latency + "ms)" : ""), "success");
    const netData = await api("/network");
    updateMirrorsCard(netData.mirrors);
  } catch (err) { toast(err.message, "error"); }
}

async function autoSwitchMirrors() {
  setButtonLoading("btn-auto-mirrors", true);
  try {
    const data = await api("/network/mirrors/auto", { method: "POST" });
    const parts = Object.entries(data.results).map(([scope, r]) => scope + "\u2192" + (r.mirror || "") + (r.ms ? "(" + r.ms + "ms)" : r.error ? " failed" : ""));
    toast("Switched " + data.switched + " scopes: " + parts.join(", "), "success");
    const netData = await api("/network");
    updateMirrorsCard(netData.mirrors);
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-auto-mirrors", false); }
}

async function testConnectivityNow() {
  setButtonLoading("btn-conn-test", true);
  try {
    const data = await api("/network");
    updateConnectivityCard(data.connectivity);
    toast("Connectivity test complete", "success");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-conn-test", false); }
}

function showProxyModal() {
  const overlay = showModal("Configure Proxy",
    '<div class="form-group"><label>Protocol</label><select id="proxy-proto"><option value="http">HTTP</option><option value="socks5">SOCKS5</option></select></div>' +
    '<div class="form-row"><div class="form-group" style="flex:3"><label>Host</label><input id="proxy-host" placeholder="127.0.0.1"></div>' +
    '<div class="form-group" style="flex:1"><label>Port</label><input id="proxy-port" placeholder="10808"></div></div>' +
    '<div class="form-row"><div class="form-group" style="flex:1"><label>Username <span class="muted">(optional)</span></label><input id="proxy-user" placeholder=""></div>' +
    '<div class="form-group" style="flex:1"><label>Password <span class="muted">(optional)</span></label><input id="proxy-pass" type="password" placeholder=""></div></div>',
    '<button class="btn btn-pri" id="btn-apply-proxy">Apply</button><button class="btn" id="btn-cancel-proxy">Cancel</button>'
  );
  overlay.querySelector("#btn-apply-proxy").addEventListener("click", applyProxy);
  overlay.querySelector("#btn-cancel-proxy").addEventListener("click", () => overlay.remove());
}

async function applyProxy() {
  const proto = document.getElementById("proxy-proto").value;
  const host = document.getElementById("proxy-host").value.trim();
  const port = document.getElementById("proxy-port").value.trim() || (proto === "socks5" ? "1080" : "3128");
  const username = document.getElementById("proxy-user").value.trim();
  const password = document.getElementById("proxy-pass").value;
  if (!host) return;
  try {
    await api("/network/proxy", {
      method: "POST",
      body: { protocol: proto, host, port, username, password },
    });
    toast("Proxy configured", "success");
    document.querySelector(".modal-overlay")?.remove();
  } catch (err) { toast(err.message, "error"); }
  render("network");
}

// ── Vault ──
async function loadVault(el) {
  try {
    const data = await api("/vault");
    el.innerHTML = [
      '<div class="card"><div class="card-head">Credentials <span class="count">' + data.count + '</span></div><div class="card-body">',
      data.count === 0
        ? '<p class="empty">No credentials stored</p>'
        : '<table>' + data.credentials.map((c) => '<tr><td>' + c.key + '</td><td>' + c.type + '</td><td class="muted">' + (c.fingerprint || "") + '</td><td><span id="cred-row-' + c.key + '">' + button("btn-cred-" + c.key, "Remove", "btn-dng btn-sm") + '<span class="inline-confirm" id="cf-cred-' + c.key + '">Confirm: <button class="btn btn-sm btn-pri" data-confirm="yes">Yes</button> <button class="btn btn-sm" data-confirm="no">No</button></span></span></td></tr>').join("") + '</table>',
      '<div class="btn-group">' + button("btn-add-cred", "Add credential", "btn-pri", "showAddCredential()") + '</div>',
      '</div></div>',
    ].join("");

    el.querySelector("#btn-add-cred")?.addEventListener("click", showAddCredential);
    el.querySelectorAll("[id^='btn-cred-']").forEach((btn) => {
      const key = btn.id.replace("btn-cred-", "");
      btn.addEventListener("click", () => {
        document.getElementById("cf-cred-" + key)?.classList.add("active");
        document.getElementById("cf-cred-" + key)?.querySelector("[data-confirm=yes]").addEventListener("click", () => removeCredential(key));
      });
    });
    el.querySelectorAll("[data-confirm]").forEach((b) => {
      b.addEventListener("click", function () { this.closest(".inline-confirm")?.classList.remove("active"); });
    });
  } catch (err) {
    el.innerHTML = '<div class="card"><div class="card-body empty"><span class="badge badge-err">' + err.message + '</span></div></div>';
  }
}

function showAddCredential() {
  const overlay = showModal("Add Credential",
    '<div class="form-group"><label>Key</label><input id="cred-key" placeholder="api_key"></div>' +
    '<div class="form-group"><label>Value</label><input id="cred-value" type="password" placeholder="secret"></div>' +
    '<div class="form-group"><label>Type</label><select id="cred-type"><option value="api_key">API Key</option><option value="github_token">GitHub Token</option><option value="sudo_password">System Password</option><option value="other">Other</option></select></div>',
    '<button class="btn btn-pri" id="btn-save-cred">Save</button><button class="btn" id="btn-cancel-cred">Cancel</button>'
  );
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
  try {
    await api("/vault/" + key, { method: "DELETE" });
    toast("Removed " + key, "success");
  } catch (err) { toast(err.message, "error"); }
  render("vault");
}

// ── Providers ──
async function loadProviders(el) {
  try {
    const data = await api("/providers");
    el.innerHTML = [
      '<div class="card"><div class="card-head">Providers</div><div class="card-body">',
      '<table>',
      data.map((p) => '<tr><td>' + p.label + '</td><td>' + p.protocol + '</td><td>' + (p.configured ? badge("configured","ok") : badge("not set","warn")) + '</td><td>' + (p.configured ? button("btn-prov-" + p.id, "Test", "btn-sm", 'testProvider("' + p.id + '")') : "") + '</td></tr>').join(""),
      '</table></div></div>',
    ].join("");
    data.forEach((p) => {
      document.getElementById("btn-prov-" + p.id)?.addEventListener("click", () => testProvider(p.id));
    });
  } catch (err) {
    el.innerHTML = '<div class="card"><div class="card-body empty"><span class="badge badge-err">' + err.message + '</span></div></div>';
  }
}

async function testProvider(id) {
  setButtonLoading("btn-prov-" + id, true);
  try {
    const data = await api("/providers/" + id + "/test", { method: "POST" });
    if (data.ok && data.data?.reachable) toast(id + " is reachable", "success");
    else toast(id + " unreachable", "error");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-prov-" + id, false); }
}

// ── Tools ──
async function loadTools(el) {
  try {
    const data = await api("/tools");
    el.innerHTML = [
      '<div class="card"><div class="card-head">Tools</div><div class="card-body"><table>',
      '<tr><td>Claude Code</td><td>' + dot(data.claude.installed) + '</td><td>' + (data.claude.version || "-") + '</td><td>' + (data.claude.installed ? button("btn-upd-claude", "Update", "btn-sm", "updateTool('claude')") : button("btn-inst-claude", "Install", "btn-sm btn-pri", "installTool('claude')")) + '</td></tr>',
      '<tr><td>OpenCode</td><td>' + dot(data.opencode.installed) + '</td><td>' + (data.opencode.version || "-") + '</td><td>' + (data.opencode.installed ? button("btn-upd-opencode", "Update", "btn-sm", "updateTool('opencode')") : button("btn-inst-opencode", "Install", "btn-sm btn-pri", "installTool('opencode')")) + '</td></tr>',
      '<tr><td>GitHub CLI</td><td>' + dot(data.gh.installed && data.gh.loggedIn) + '</td><td>' + (data.gh.version || "-") + '</td><td>-</td></tr>',
      '</table></div></div>',
    ].join("");

    document.getElementById("btn-inst-claude")?.addEventListener("click", () => installTool("claude"));
    document.getElementById("btn-inst-opencode")?.addEventListener("click", () => installTool("opencode"));
    document.getElementById("btn-upd-claude")?.addEventListener("click", () => updateTool("claude"));
    document.getElementById("btn-upd-opencode")?.addEventListener("click", () => updateTool("opencode"));
  } catch (err) {
    el.innerHTML = '<div class="card"><div class="card-body empty"><span class="badge badge-err">' + err.message + '</span></div></div>';
  }
}

async function installTool(id) {
  setButtonLoading("btn-inst-" + id, true);
  try {
    await api("/tools/" + id + "/install", { method: "POST" });
    toast("Installed " + id, "success");
    render("tools");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-inst-" + id, false); }
}

async function updateTool(id) {
  setButtonLoading("btn-upd-" + id, true);
  try {
    await api("/tools/" + id + "/update", { method: "POST" });
    toast("Updated " + id, "success");
    render("tools");
  } catch (err) { toast(err.message, "error"); }
  finally { setButtonLoading("btn-upd-" + id, false); }
}

// ── Init ──
(async () => {
  try {
    const pkg = await fetch("/package.json").then((r) => r.json()).catch(() => ({}));
    document.getElementById("version").textContent = "v" + (pkg.version || "3.0.0");
  } catch { /* optional */ }
  connectSSE();
  switchTab("dashboard");
})();
