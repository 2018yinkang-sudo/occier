import { readFile, writeFile, mkdir, access, rename } from "fs/promises";
import { readFileSync } from "fs";
import { constants } from "fs";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";
import { homedir, hostname } from "os";
import { join } from "path";

const OC_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
);
const VAULT_FILE = join(OC_DIR, "vault.enc");

// Serialize writes per file to avoid read-modify-write races between
// concurrent vault operations within this process.
const _writeQueues = new Map();

function enqueueWrite(filePath, task) {
  const prev = _writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(task, task);
  _writeQueues.set(filePath, next.catch(() => {}));
  return next;
}

async function atomicWriteFile(filePath, data, options) {
  const tmp = `${filePath}.tmp-${process.pid}`;
  await writeFile(tmp, data, options);
  await rename(tmp, filePath);
}

// Legacy v1 credentials live in ~/.config/claude-code/providers.env with
// original-case keys (DEEPSEEK_API_KEY). The v2 vault uses lowercase keys.
// Surface v1 entries (lowercased) so both generations see each other's keys.
// NOTE: the env file is parsed directly here (not via config-io) to avoid a
// module cycle — config-io reads the v2 vault through this module.
const LEGACY_ENV_FILE = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "claude-code",
  "providers.env",
);

async function readLegacyEnvEntries() {
  let raw;
  try {
    raw = await readFile(LEGACY_ENV_FILE, "utf-8");
  } catch {
    return {};
  }
  const merged = {};
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (!val) continue;
    merged[key.toLowerCase()] = {
      type: "api_key",
      value: val,
      updatedAt: null,
      source: "legacy-env",
    };
  }
  return merged;
}

export class CredentialStore {
  async get(_key) {
    throw new Error("Not implemented");
  }
  async set(_key, _value) {
    throw new Error("Not implemented");
  }
  async delete(_key) {
    throw new Error("Not implemented");
  }
  async list() {
    throw new Error("Not implemented");
  }
}

export class FileCredentialStore extends CredentialStore {
  constructor(filePath = null) {
    super();
    this.filePath = filePath || VAULT_FILE;
  }

  async ensureDir() {
    await mkdir(OC_DIR, { recursive: true, mode: 0o700 });
  }

  async readRaw() {
    let raw;
    try {
      await access(this.filePath, constants.R_OK);
      raw = await readFile(this.filePath, "utf-8");
    } catch {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
      // Never destroy credentials: move the unreadable file aside instead of
      // silently overwriting it with an empty object on the next set().
      const aside = `${this.filePath}.corrupt-${Date.now()}`;
      await rename(this.filePath, aside).catch(() => {});
      process.stderr.write(
        `\n\x1b[33m⚠\x1b[0m  Vault file was unreadable — preserved as ${aside}\n\n`,
      );
      return {};
    }
  }

  async writeRaw(data) {
    await this.ensureDir();
    await enqueueWrite(this.filePath, () =>
      atomicWriteFile(this.filePath, JSON.stringify(data, null, 2), {
        mode: 0o600,
      }),
    );
  }

  // Raw local data without legacy-env merge. Used by the v1 bridge.
  async readAll() {
    return this.readRaw();
  }

  async get(key) {
    const data = await this.readRaw();
    if (data[key] !== undefined) return data[key];
    const legacy = await readLegacyEnvEntries();
    return legacy[key] ?? null;
  }

  async set(key, value) {
    const data = await this.readRaw();
    data[key] = value;
    await this.writeRaw(data);
  }

  async delete(key) {
    const data = await this.readRaw();
    delete data[key];
    await this.writeRaw(data);
  }

  async list() {
    const data = await this.readRaw();
    const legacy = await readLegacyEnvEntries();
    for (const [key, value] of Object.entries(legacy)) {
      if (!(key in data)) data[key] = value;
    }
    return Object.entries(data).map(([key, value]) => ({
      key,
      type: typeof value === "object" ? value.type : "unknown",
      fingerprint: maskValue(typeof value === "string" ? value : value.value ?? ""),
      updatedAt: value.updatedAt || null,
    }));
  }

  async has(key) {
    const data = await this.readRaw();
    if (key in data) return true;
    const legacy = await readLegacyEnvEntries();
    return key in legacy;
  }
}

export class EncryptedFileStore extends CredentialStore {
  constructor(masterKey, filePath = null) {
    super();
    this.masterKey = masterKey;
    this.filePath = filePath || VAULT_FILE;
  }

  async ensureDir() {
    await mkdir(OC_DIR, { recursive: true, mode: 0o700 });
  }

  async get(key) {
    const data = await this._readEncrypted();
    const entry = data[key];
    if (entry) return entry;
    const legacy = await readLegacyEnvEntries();
    return legacy[key] ?? null;
  }

  // Raw local data without legacy-env merge. Used by the v1 bridge.
  async readAll() {
    return this._readEncrypted();
  }

  async set(key, value) {
    const data = await this._readEncrypted();
    data[key] = value;
    await this._writeEncrypted(data);
  }

  async delete(key) {
    const data = await this._readEncrypted();
    delete data[key];
    await this._writeEncrypted(data);
  }

  async list() {
    const data = await this._readEncrypted();
    const legacy = await readLegacyEnvEntries();
    for (const [key, value] of Object.entries(legacy)) {
      if (!(key in data)) data[key] = value;
    }
    return Object.entries(data).map(([key, entry]) => ({
      key,
      type: entry.type || "api_key",
      fingerprint: maskValue(entry.value ?? ""),
      updatedAt: entry.updatedAt || null,
    }));
  }

  async _readEncrypted() {
    try {
      await access(this.filePath, constants.R_OK);
    } catch {
      return {};
    }

    const raw = await readFile(this.filePath);

    // Auto-migration: early vault versions stored plaintext JSON in vault.enc.
    // Detect it and parse as-is; the next write re-encrypts the contents.
    if (raw.length > 0 && raw[0] === 0x7b /* '{' */) {
      try {
        return JSON.parse(raw.toString("utf-8"));
      } catch {
        return {};
      }
    }

    const SALT_LEN = 32;
    const IV_LEN = 16;
    const TAG_LEN = 16;

    if (raw.length < SALT_LEN + IV_LEN + TAG_LEN + 1) {
      const msg = "Vault file is too short — may be corrupted";
      process.stderr.write(`\n\x1b[33m⚠\x1b[0m  ${msg}\n\n`);
      throw new Error(msg);
    }

    const salt = raw.subarray(0, SALT_LEN);
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = raw.subarray(raw.length - TAG_LEN);
    const ciphertext = raw.subarray(SALT_LEN + IV_LEN, raw.length - TAG_LEN);
    const key = deriveKey(this.masterKey, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return JSON.parse(decrypted.toString("utf-8"));
  }

  async _writeEncrypted(data) {
    await this.ensureDir();
    const SALT_LEN = 32;
    const IV_LEN = 16;
    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(this.masterKey, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const output = Buffer.concat([salt, iv, encrypted, tag]);
    await enqueueWrite(this.filePath, () =>
      atomicWriteFile(this.filePath, output, { mode: 0o600 }),
    );
  }
}

function deriveKey(masterKey, salt) {
  return pbkdf2Sync(masterKey, salt, 100000, 32, "sha256");
}

export function getDeviceFingerprint() {
  const parts = [hostname()];
  if (process.platform === "linux") {
    try {
      try {
        parts.push(readFileSync("/etc/machine-id", "utf-8").trim());
      } catch {
        try {
          parts.push(readFileSync("/var/lib/dbus/machine-id", "utf-8").trim());
        } catch { /* file not found, skip */ }
      }
    } catch { /* cannot read, skip */ }
  }
  parts.push(process.env.USER || process.env.USERNAME || "unknown");
  return parts.join("|");
}

export function deriveMasterKey(passphrase) {
  return pbkdf2Sync(passphrase, "occier-vault-salt", 100000, 32, "sha256")
    .toString("hex");
}

export function maskValue(value) {
  if (!value) return "<not set>";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

export function createStore(type = "encrypted", options = {}) {
  if (type === "encrypted") {
    const masterKey =
      options.masterKey || deriveMasterKey(getDeviceFingerprint());
    return new EncryptedFileStore(masterKey, options.filePath);
  }
  return new FileCredentialStore(options.filePath || VAULT_FILE);
}
