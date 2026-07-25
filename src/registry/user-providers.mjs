const USER_PROVIDER_FILE = "user-providers.json";

const _providers = [];

export function registerUserProvider(provider) {
  _providers.push(provider);
}

export function getUserProviders() {
  return [..._providers];
}

export async function loadUserProviders() {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { readFile, access } = await import("fs/promises");
  const { constants } = await import("fs");
  const filePath = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "occier",
    USER_PROVIDER_FILE,
  );

  try {
    await access(filePath, constants.R_OK);
  } catch {
    return;
  }

  const raw = await readFile(filePath, "utf-8");
  let data;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    process.stderr.write(`\n\x1b[31mError:\x1b[0m Failed to parse user providers: ${err.message}\n\n`);
    return;
  }

  if (!Array.isArray(data)) {
    process.stderr.write(`\n\x1b[33m⚠\x1b[0m  user-providers.json is not an array — ignoring\n\n`);
    return;
  }

  _providers.length = 0;
  for (const p of data) {
    _providers.push(p);
  }
}

export async function saveUserProviders() {
  const { join } = await import("path");
  const { homedir } = await import("os");
  const { writeFile, mkdir: mkdirAsync } = await import("fs/promises");
  const dir = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
    "occier",
  );
  await mkdirAsync(dir, { recursive: true, mode: 0o700 });
  await writeFile(join(dir, USER_PROVIDER_FILE), JSON.stringify(_providers, null, 2), { mode: 0o600 });
}

export { USER_PROVIDER_FILE };
