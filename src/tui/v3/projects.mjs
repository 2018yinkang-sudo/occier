import { readFile, writeFile, mkdir } from "fs/promises";
import { homedir } from "os";
import { join } from "path";
import { line, selectedLine, sectionHeader } from "../v3/panel-utils.mjs";

const PROJECTS_FILE = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
  "projects.json",
);

let _lastUpdate = 0;
let _lastCacheGen = 0;
let _cache = null;

export function isCached() {
  return _cache !== null && (Date.now() - _lastUpdate) <= 10000;
}

export async function renderPanel(term, state, budget) {
  const now = Date.now();
  if (now - _lastUpdate > 10000 || !_cache || state.forceRefresh || state.cacheGen !== _lastCacheGen) {
    try {
      const raw = await readFile(PROJECTS_FILE, "utf-8");
      _cache = JSON.parse(raw);
    } catch {
      _cache = {};
    }
    _lastUpdate = now;
    _lastCacheGen = state.cacheGen;
  }

  const entries = Object.entries(_cache).map(([name, info]) => ({
    name,
    path: info.path || "",
    tool: info.tool || "",
  }));

  const pad = "  ";
  const selectedId = state.cursorItemId ?? null;
  const draw = (id, ...parts) => {
    if (id && selectedId === id) {
      selectedLine(term, { text: "▸ " }, ...parts);
    } else {
      line(term, { text: "› ", fg: "brightWhite" }, ...parts);
    }
  };

  const emitLine = (...parts) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") line(term, ...parts);
    return false;
  };
  const emitHeader = (title) => {
    const st = budget.nextLine();
    if (st === "beyond") return true;
    if (st === "draw") sectionHeader(term, title);
    return false;
  };
  const emitItem = (id, label, ...parts) => {
    const st = budget.nextLine();
    if (st === "draw") { budget.tag(id, label); draw(id, ...parts); }
    else if (st === "beyond") { budget.tag(id, label); }
    return false;
  };

  if (emitHeader("Projects")) return;

  if (entries.length === 0) {
    if (emitItem("create-project", "Create project",
      { text: `${pad}No saved projects — press Enter to create one`, fg: "yellow" },
    )) return;
  } else {
    for (const p of entries) {
      if (!budget.shouldShow(p.name)) continue;
      const displayPath = p.path.length > 42
        ? p.path.slice(0, 41) + "…"
        : p.path;
      if (emitItem(p.name, p.name,
        { text: pad, fg: "white" },
        { text: "● ", fg: "brightCyan" },
        { text: p.name.padEnd(22), fg: "brightWhite" },
        { text: displayPath.padEnd(44), fg: "gray" },
        { text: p.tool, fg: "gray" },
      )) break;
    }

    if (emitLine({ text: "", fg: "white" })) return;
    if (emitItem("create-project", "Create project",
      { text: `${pad}+ Create project`, fg: "yellow" },
    )) return;
  }

  term.styleReset();
}

export function getTabSummary() {
  if (!_cache) return null;
  return { count: Object.keys(_cache).length };
}

export async function handleAction(term, itemId) {
  if (itemId === "create-project") {
    return {
      input: { title: "Create Project", prompt: "Project name: " },
      async continue(name) {
        if (!name || !name.trim()) return "Cancelled";
        const k = name.trim();
        const defaultDir = join(process.cwd(), k);
        return {
          input: { title: `Directory for ${k}`, prompt: `Directory [${defaultDir}]: ` },
          async continue(dirInput) {
            const finalDir = dirInput?.trim() || defaultDir;
            return {
              select: {
                prompt: "Development tool",
                choices: [
                  { label: "1  Claude Code", value: "claude" },
                  { label: "2  OpenCode", value: "opencode" },
                ],
                defaultCursor: 0,
              },
              async continue(tool) {
                if (!tool) return "Cancelled";
                try {
                  await mkdir(finalDir, { recursive: true, mode: 0o700 });
                  let projects = {};
                  try {
                    projects = JSON.parse(await readFile(PROJECTS_FILE, "utf-8"));
                  } catch { /* new file */ }
                  projects[k] = { path: finalDir, tool, createdAt: new Date().toISOString() };
                  const dirPath = join(PROJECTS_FILE, "..");
                  await mkdir(dirPath, { recursive: true, mode: 0o700 });
                  await writeFile(PROJECTS_FILE, JSON.stringify(projects, null, 2), { mode: 0o600 });
                  _lastUpdate = 0;
                  return `${k} created`;
                } catch (err) {
                  return `Error: ${err.message}`;
                }
              },
            };
          },
        };
      },
    };
  }

  if (!_cache || !_cache[itemId]) return null;

  const project = _cache[itemId];
  const { spawn } = await import("child_process");
  const { clearProviderEnv, applyProviderEnv } = await import("../../launch.mjs");
  const { createStore } = await import("../../store/credential-store.mjs");
  const { allProviders } = await import("../../registry/providers.mjs");

  const store = createStore();
  const entries = await store.list();
  const configured = allProviders().filter((p) =>
    entries.some((e) => e.key === p.envVarName.toLowerCase()),
  );

  // Exit TUI
  term.grabInput(false);
  term.fullscreen(false);
  term.styleReset();
  term.clear();
  term("\n");

  if (configured.length === 0) {
    process.stdout.write("  No providers configured.\n\n");
    process.exit(1);
  }

  // Use the first configured provider (user can specify in the future)
  const provider = configured[0];
  const data = await store.get(provider.envVarName.toLowerCase());

  if (!data?.value) {
    process.stdout.write(`  ${provider.label} API key not found.\n\n`);
    process.exit(1);
  }

  const env = { ...process.env };
  clearProviderEnv(env);

  if (project.tool === "claude") {
    const toolEnv = { ...(provider.claudeEnv || {}) };
    if (provider.id === "anthropic") {
      toolEnv.ANTHROPIC_API_KEY = data.value;
    } else {
      toolEnv.ANTHROPIC_AUTH_TOKEN = data.value;
    }
    applyProviderEnv(env, toolEnv);
  } else {
    env[provider.envVarName] = data.value;
  }

  process.stdout.write(`  Launching ${project.name} with ${project.tool}...\n\n`);

  const child = spawn(project.tool, [], {
    cwd: project.path,
    stdio: "inherit",
    env,
  });

  child.on("error", (err) => {
    process.stderr.write(`\n  Error: ${err.message}\n`);
    process.exit(1);
  });
  child.on("exit", (code) => {
    process.exit(code ?? 0);
  });

  return null;
}
