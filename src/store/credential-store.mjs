import { readFile, writeFile, mkdir, access, rename, open } from "fs/promises";
import { readFileSync } from "fs";
import { constants } from "fs";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";
import { homedir, hostname } from "os";
import { join, dirname, basename } from "path";

const OC_DIR = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "occier",
);
const VAULT_FILE = join(OC_DIR, "vault.enc");

const OLD_SALT = "occier-vault-salt";
const OLD_ITERATIONS = 100000;
const DEFAULT_ITERATIONS = 600000;
const SALT_LEN = 32;
const IV_LEN = 16;
const TAG_LEN = 16;
const KEY_LEN = 32;
const KEY_DIGEST = "sha256";

// ── file locking ──

async function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  const MAX_AGE = 10_000;
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });

  let fh;
  try {
    // O_CREAT|O_EXCL fails if file already exists
    fh = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
  } catch {
    // Lock exists — check if it's stale
    let stale = false;
    try {
      const stat = await readFile(lockPath, "utf-8").catch(() => "");
      const lines = stat.split("\n");
      const ts = parseInt(lines[1], 10);
      if (Number.isNaN(ts) || Date.now() - ts > MAX_AGE) stale = true;
    } catch { stale = true; }
    if (stale) {
      await writeFile(lockPath, `${process.pid}\n${Date.now()}\n`, { mode: 0o600 }).catch(() => {});
      fh = await open(lockPath, constants.O_WRONLY | constants.O_CREAT, 0o600).catch(() => null);
    }
    if (!fh) throw new Error("Another occier process is writing the vault. Try again shortly.");
  }

  await fh.write(`${process.pid}\n${Date.now()}\n`);
  await fh.close();

  return {
    async release() {
      try { await writeFile(lockPath, ""); /* suppress unused */ } catch { /* ignore */ }
    },
  };
}

// ── write queue ──

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

async function lockedWrite(filePath, data, options) {
  const lock = await acquireLock(filePath);
  try {
    await enqueueWrite(filePath, () => atomicWriteFile(filePath, data, options));
  } finally {
    await lock.release();
  }
}

// ── vault meta ──

function getMetaPath(filePath) {
  const base = basename(filePath);
  return join(dirname(filePath), `${base}.meta`);
}

export function readVaultMetaSync(filePath) {
  const metaPath = getMetaPath(filePath || VAULT_FILE);
  try {
    const raw = readFileSync(metaPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

async function writeVaultMeta(filePath, meta) {
  const metaPath = getMetaPath(filePath);
  await mkdir(dirname(metaPath), { recursive: true, mode: 0o700 });
  await writeFile(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
}

function generateMeta(passphraseProtected = false) {
  return {
    version: 2,
    kdf: "pbkdf2-sha256",
    iterations: DEFAULT_ITERATIONS,
    salt: randomBytes(SALT_LEN).toString("base64"),
    passphraseProtected,
  };
}

// ── key derivation ──

export function deriveMasterKey(passphrase, salt, iterations = DEFAULT_ITERATIONS) {
  const saltBuf = typeof salt === "string" && salt !== OLD_SALT
    ? Buffer.from(salt, "base64")
    : Buffer.from(salt, "utf-8");
  return pbkdf2Sync(passphrase, saltBuf, iterations, KEY_LEN, KEY_DIGEST).toString("hex");
}

function deriveKey(masterKey, salt) {
  return pbkdf2Sync(masterKey, salt, DEFAULT_ITERATIONS, KEY_LEN, KEY_DIGEST);
}

export function getDeviceFingerprint() {
  const parts = [hostname()];
  if (process.platform === "linux") {
    try {
      const machineId = readFileSync("/etc/machine-id", "utf-8").trim();
      parts.push(machineId);
    } catch {
      try {
        const dbusId = readFileSync("/var/lib/dbus/machine-id", "utf-8").trim();
        parts.push(dbusId);
      } catch { /* file not found, skip */ }
    }
  }
  parts.push(process.env.USER || process.env.USERNAME || "unknown");
  return parts.join("|");
}

export function maskValue(value) {
  if (!value) return "<not set>";
  if (value.length <= 8) return "****";
  return value.slice(0, 4) + "****" + value.slice(-4);
}

// ── legacy env parsing ──

const LEGACY_ENV_FILE = join(
  process.env.XDG_CONFIG_HOME || join(homedir(), ".config"),
  "claude-code",
  "providers.env",
);

function parseEnvContent(raw) {
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

async function readLegacyEnvEntries() {
  let raw;
  try {
    raw = await readFile(LEGACY_ENV_FILE, "utf-8");
  } catch {
    return {};
  }
  return parseEnvContent(raw);
}

// ── stores ──

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
      raw = await readFile(this.filePath, "utf-8");
    } catch {
      return {};
    }
    try {
      return JSON.parse(raw);
    } catch {
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
    await lockedWrite(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
  }

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
    this._needsMigration = false;
    this._rawPassphrase = null;
  }

  setMigrationState(migrate, rawPassphrase) {
    this._needsMigration = migrate;
    this._rawPassphrase = rawPassphrase;
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

  async has(key) {
    const data = await this._readEncrypted();
    if (key in data) return true;
    const legacy = await readLegacyEnvEntries();
    return key in legacy;
  }

  async _readEncrypted() {
    const meta = readVaultMetaSync(this.filePath);

    if (!meta) {
      return this._tryOldDecrypt();
    }

    return this._decryptWithParams();
  }

  async _tryOldDecrypt() {
    try {
      await access(this.filePath, constants.R_OK);
    } catch {
      return {};
    }

    const raw = await readFile(this.filePath);

    if (raw.length > 0 && raw[0] === 0x7b /* '{' */) {
      try {
        const data = JSON.parse(raw.toString("utf-8"));
        this._needsMigration = true;
        return data;
      } catch {
        return {};
      }
    }

    if (raw.length < SALT_LEN + IV_LEN + TAG_LEN + 1) {
      const msg = "Vault file is too short — may be corrupted";
      process.stderr.write(`\n\x1b[33m⚠\x1b[0m  ${msg}\n\n`);
      throw new Error(msg);
    }

    const salt = raw.subarray(0, SALT_LEN);
    const iv = raw.subarray(SALT_LEN, SALT_LEN + IV_LEN);
    const tag = raw.subarray(raw.length - TAG_LEN);
    const ciphertext = raw.subarray(SALT_LEN + IV_LEN, raw.length - TAG_LEN);

    try {
      const oldKey = deriveKey(this.masterKey, salt);
      const decipher = createDecipheriv("aes-256-gcm", oldKey, iv);
      decipher.setAuthTag(tag);
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      this._needsMigration = true;
      return JSON.parse(decrypted.toString("utf-8"));
    } catch {
      return {};
    }
  }

  async _decryptWithParams() {
    try {
      await access(this.filePath, constants.R_OK);
    } catch {
      return {};
    }

    const raw = await readFile(this.filePath);

    if (raw.length > 0 && raw[0] === 0x7b /* '{' */) {
      try {
        const data = JSON.parse(raw.toString("utf-8"));
        this._needsMigration = true;
        return data;
      } catch {
        return {};
      }
    }

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
    try {
      const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
      return JSON.parse(decrypted.toString("utf-8"));
    } catch {
      return {};
    }
  }

  async _writeEncrypted(data) {
    await this.ensureDir();

    if (this._needsMigration) {
      const meta = generateMeta(
        this._rawPassphrase ? this._rawPassphrase !== getDeviceFingerprint() : false,
      );
      const newMasterKey = deriveMasterKey(
        this._rawPassphrase || getDeviceFingerprint(),
        meta.salt,
        meta.iterations,
      );
      this.masterKey = newMasterKey;
      await writeVaultMeta(this.filePath, meta);
      this._needsMigration = false;
    }

    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(this.masterKey, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const output = Buffer.concat([salt, iv, encrypted, tag]);
    await lockedWrite(this.filePath, output, { mode: 0o600 });
  }
}

// ── factory ──

export function createStore(type = "encrypted", options = {}) {
  if (type === "encrypted") {
    const filePath = options.filePath || VAULT_FILE;
    const rawPassphrase = options.passphrase
      || process.env.OCCIER_PASSPHRASE
      || getDeviceFingerprint();

    const meta = readVaultMetaSync(filePath);

    let masterKey;
    if (meta) {
      masterKey = deriveMasterKey(rawPassphrase, meta.salt, meta.iterations);
    } else {
      masterKey = deriveMasterKey(rawPassphrase, OLD_SALT, OLD_ITERATIONS);
    }

    const store = new EncryptedFileStore(masterKey, filePath);
    if (!meta) {
      store.setMigrationState(true, rawPassphrase);
    } else if (options.passphrase && meta && !meta.passphraseProtected) {
      // User is providing passphrase but vault wasn't created with one
      meta.passphraseProtected = true;
      // Migration: re-derive with passphrase
      const newMasterKey = deriveMasterKey(rawPassphrase, meta.salt, meta.iterations);
      store.masterKey = newMasterKey;
      store._needsMigration = true;
      store._rawPassphrase = rawPassphrase;
    }
    return store;
  }
  return new FileCredentialStore(options.filePath || VAULT_FILE);
}

export { parseEnvContent };
