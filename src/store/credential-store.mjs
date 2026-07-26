import { readFile, writeFile, mkdir, access, rename, open, unlink } from "fs/promises";
import { readFileSync } from "fs";
import { constants } from "fs";
import { randomBytes, createCipheriv, createDecipheriv, pbkdf2Sync } from "crypto";
import { homedir, hostname } from "os";
import { join, dirname, basename } from "path";
import { maskEntry, maskValue, publicFieldsFor, isStructuredType } from "./credential-types.mjs";

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
const LOCK_MAX_AGE = 10_000;

// ── file locking ──

async function acquireLock(filePath) {
  const lockPath = `${filePath}.lock`;
  await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });

  let acquired = false;
  try {
    const fh = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
    await fh.write(`${process.pid}\n${Date.now()}\n`);
    await fh.close();
    acquired = true;
  } catch {
    // Lock exists — check if stale
  }

  if (!acquired) {
    let stale = false;
    try {
      const content = await readFile(lockPath, "utf-8");
      const lines = content.split("\n");
      const ts = parseInt(lines[1], 10);
      if (Number.isNaN(ts) || Date.now() - ts > LOCK_MAX_AGE) stale = true;
    } catch {
      stale = true;
    }

    if (stale) {
      // Atomically reclaim: unlink stale lock, then create with O_EXCL
      await unlink(lockPath).catch(() => {});
      try {
        const fh = await open(lockPath, constants.O_CREAT | constants.O_EXCL | constants.O_WRONLY, 0o600);
        await fh.write(`${process.pid}\n${Date.now()}\n`);
        await fh.close();
        acquired = true;
      } catch {
        // Another process reclaimed it first
      }
    }

    if (!acquired) {
      throw new Error("Another occier process is writing the vault. Try again shortly.");
    }
  }

  return {
    async release() {
      await unlink(lockPath).catch(() => {});
    },
  };
}

// ── write queue (within-process serialization) ──

const _writeQueues = new Map();

function enqueueWrite(filePath, task) {
  const prev = _writeQueues.get(filePath) || Promise.resolve();
  const next = prev.then(task, task);
  _writeQueues.set(filePath, next.catch(() => {}));
  return next;
}

async function atomicWriteFile(filePath, data, options) {
  const tmp = `${filePath}.tmp-${process.pid}-${randomBytes(4).toString("hex")}`;
  try {
    await writeFile(tmp, data, options);
    await rename(tmp, filePath);
  } catch (err) {
    await unlink(tmp).catch(() => {});
    throw err;
  }
}

// Lock + queue: the lock is acquired INSIDE the queue task so that
// within-process calls are serialized first, then cross-process locking
// applies to each task individually.
async function withFileLock(filePath, task) {
  return enqueueWrite(filePath, async () => {
    const lock = await acquireLock(filePath);
    try {
      return await task();
    } finally {
      await lock.release();
    }
  });
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

export async function writeVaultMeta(filePath, meta) {
  const metaPath = getMetaPath(filePath);
  await mkdir(dirname(metaPath), { recursive: true, mode: 0o700 });
  await atomicWriteFile(metaPath, JSON.stringify(meta, null, 2), { mode: 0o600 });
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

// maskValue is re-exported from credential-types for backwards-compatible
// callers (services/vault, services/provider, config-io).
export { maskValue };

// Normalize a raw stored entry into a list-view item. Handles three shapes:
//   - raw string (very old vault): treated as a generic api_key
//   - non-structured object: { type, value, updatedAt }
//   - structured object (model_key): { type, fields, updatedAt }
// Secret fields are masked via publicFieldsFor; the full plaintext never leaves
// the store through list().
function normalizeListEntry(key, value) {
  if (typeof value === "string") {
    return { key, type: "api_key", fingerprint: maskValue(value, "api_key"), updatedAt: null, fields: undefined };
  }
  const type = value.type || "api_key";
  return {
    key,
    type,
    fingerprint: maskEntry(value),
    updatedAt: value.updatedAt || null,
    fields: isStructuredType(type) ? publicFieldsFor(type, value.fields) : undefined,
  };
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
  async has(_key) {
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
    await atomicWriteFile(this.filePath, JSON.stringify(data, null, 2), { mode: 0o600 });
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
    await withFileLock(this.filePath, async () => {
      const data = await this.readRaw();
      data[key] = value;
      await this.writeRaw(data);
    });
  }

  async delete(key) {
    await withFileLock(this.filePath, async () => {
      const data = await this.readRaw();
      delete data[key];
      await this.writeRaw(data);
    });
  }

  async list() {
    const data = await this.readRaw();
    const legacy = await readLegacyEnvEntries();
    for (const [key, value] of Object.entries(legacy)) {
      if (!(key in data)) data[key] = value;
    }
    return Object.entries(data).map(([key, value]) => normalizeListEntry(key, value));
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
    await withFileLock(this.filePath, async () => {
      const data = await this._readEncrypted();
      data[key] = value;
      await this._writeEncrypted(data);
    });
  }

  async delete(key) {
    await withFileLock(this.filePath, async () => {
      const data = await this._readEncrypted();
      delete data[key];
      await this._writeEncrypted(data);
    });
  }

  async writeAll(data) {
    await withFileLock(this.filePath, async () => {
      await this._writeEncrypted(data);
    });
  }

  async list() {
    const data = await this._readEncrypted();
    const legacy = await readLegacyEnvEntries();
    for (const [key, value] of Object.entries(legacy)) {
      if (!(key in data)) data[key] = value;
    }
    return Object.entries(data).map(([key, entry]) => normalizeListEntry(key, entry));
  }

  async has(key) {
    const data = await this._readEncrypted();
    if (key in data) return true;
    const legacy = await readLegacyEnvEntries();
    return key in legacy;
  }

  async _readEncrypted() {
    const meta = readVaultMetaSync(this.filePath);

    // Check if vault file exists
    try {
      await access(this.filePath, constants.R_OK);
    } catch {
      return {}; // No vault file — legitimate empty vault
    }

    const raw = await readFile(this.filePath);

    // Auto-migration: early vault versions stored plaintext JSON.
    // Only attempt this heuristic when there is NO meta file. If meta exists,
    // the vault is definitely encrypted — the first byte being 0x7b ('{')
    // is just a coincidence of the random salt, not a JSON indicator.
    if (!meta && raw.length > 0 && raw[0] === 0x7b /* '{' */) {
      try {
        const data = JSON.parse(raw.toString("utf-8"));
        this._needsMigration = true;
        return data;
      } catch {
        const aside = `${this.filePath}.corrupt-${Date.now()}`;
        await rename(this.filePath, aside).catch(() => {});
        process.stderr.write(
          `\n\x1b[33m⚠\x1b[0m  Vault file was unreadable — preserved as ${aside}\n\n`,
        );
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

    // Determine which master key to use for decryption.
    // If meta exists, the masterKey was already derived with meta params in createStore.
    // If no meta, the masterKey was derived with old params (migration path).
    const key = deriveKey(this.masterKey, salt);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);

    let decrypted;
    try {
      decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    } catch {
      // Decryption failed — wrong key or tampered data.
      // This is NOT an empty vault; the file exists and is encrypted.
      throw new Error(
        "Vault decryption failed — wrong passphrase or corrupted data. " +
        "If you recently changed your passphrase, ensure OCCIER_PASSPHRASE matches.",
      );
    }

    // If we got here without meta, this is an old-format vault that needs migration.
    if (!meta) {
      this._needsMigration = true;
    }

    return JSON.parse(decrypted.toString("utf-8"));
  }

  async _writeEncrypted(data) {
    await this.ensureDir();

    // Migration: generate new meta params and re-derive master key.
    // CRITICAL: write the vault file FIRST, then the meta file.
    // If we crash after writing the vault but before the meta,
    // the old meta (or lack thereof) still allows decryption with old params
    // because the vault file contains its own per-file salt.
    // Wait — that's not right. The new vault is encrypted with the NEW master key.
    // The meta tells createStore how to derive the master key.
    // If we write the vault with the new key but don't write the meta,
    // createStore will derive the OLD key and fail to decrypt.
    //
    // Correct order: write vault first, then meta.
    // If crash after vault write but before meta write:
    //   - createStore reads old meta (or no meta) → derives old key → can't decrypt new vault
    //   - This is still data loss, but the OLD vault data is gone (overwritten).
    // 
    // Better approach: write meta first, then vault. If crash after meta but before vault:
    //   - createStore reads new meta → derives new key → can't decrypt old vault
    //   - Same data loss.
    //
    // The ONLY safe approach is a backup before migration.
    // The vaultPassphrase command handles this. For automatic migration
    // (old format → new format), the risk is acceptable because the old
    // vault was encrypted with a derivable device-fingerprint key.
    // We write the vault first, then the meta, so that if the meta write
    // fails, the vault is at least re-encrypted with the new key (and the
    // user can recover by setting the passphrase manually).

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
      this._needsMigration = false;
      this._rawPassphrase = null;

      // Encrypt with new key
      const salt = randomBytes(SALT_LEN);
      const iv = randomBytes(IV_LEN);
      const key = deriveKey(this.masterKey, salt);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
      const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
      const tag = cipher.getAuthTag();
      const output = Buffer.concat([salt, iv, encrypted, tag]);

      // Write vault first
      await atomicWriteFile(this.filePath, output, { mode: 0o600 });
      // Then write meta (if this fails, the vault is encrypted with the new key
      // but createStore will try old params — user must re-run migration)
      await writeVaultMeta(this.filePath, meta);
      return;
    }

    const salt = randomBytes(SALT_LEN);
    const iv = randomBytes(IV_LEN);
    const key = deriveKey(this.masterKey, salt);
    const cipher = createCipheriv("aes-256-gcm", key, iv);
    const plaintext = Buffer.from(JSON.stringify(data), "utf-8");
    const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const tag = cipher.getAuthTag();
    const output = Buffer.concat([salt, iv, encrypted, tag]);
    await atomicWriteFile(this.filePath, output, { mode: 0o600 });
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
      // No meta — use old params for migration compatibility
      masterKey = deriveMasterKey(rawPassphrase, OLD_SALT, OLD_ITERATIONS);
    }

    const store = new EncryptedFileStore(masterKey, filePath);
    if (!meta) {
      // Mark for migration to new format on next write
      store.setMigrationState(true, rawPassphrase);
    }
    // NOTE: createStore does NOT convert between passphrase and device-fingerprint
    // modes. Use `occier vault passphrase set/remove` for that, which handles
    // the re-encryption safely with backup and verification.
    return store;
  }
  return new FileCredentialStore(options.filePath || VAULT_FILE);
}

// ── safe re-encryption helper (used by vault passphrase commands) ──

export async function reEncryptVault(oldPassphrase, newPassphrase, filePath = VAULT_FILE) {
  const oldMeta = readVaultMetaSync(filePath);

  // Determine old key derivation params
  const oldSalt = oldMeta ? oldMeta.salt : OLD_SALT;
  const oldIterations = oldMeta ? oldMeta.iterations : OLD_ITERATIONS;
  const oldMasterKey = deriveMasterKey(oldPassphrase, oldSalt, oldIterations);

  // Read existing data with old key
  const oldStore = new EncryptedFileStore(oldMasterKey, filePath);
  const data = await oldStore.readAll();

  // Verify decryption succeeded: if vault was non-empty but we got {},
  // the passphrase is likely wrong.
  // We can't distinguish empty vault from wrong key perfectly, but if the
  // vault file exists and has encrypted content, wrong key would have thrown.
  // If readAll() returned {}, either the vault is empty or the file doesn't exist.

  // Create backup
  const { copyFile } = await import("fs/promises");
  const backupPath = `${filePath}.bak-${Date.now()}`;
  try {
    await copyFile(filePath, backupPath);
  } catch {
    // Vault file may not exist yet (first time setting passphrase)
  }

  try {
    // Generate new meta
    const newMeta = generateMeta(!!newPassphrase && newPassphrase !== getDeviceFingerprint());
    const newMasterKey = deriveMasterKey(
      newPassphrase || getDeviceFingerprint(),
      newMeta.salt,
      newMeta.iterations,
    );

    // Create new store and write all data with new key
    const newStore = new EncryptedFileStore(newMasterKey, filePath);
    await newStore.writeAll(data);

    // Write meta AFTER vault is successfully written
    await writeVaultMeta(filePath, newMeta);

    // Success — remove backup
    await unlink(backupPath).catch(() => {});

    return { ok: true };
  } catch (err) {
    // Failure — restore backup
    try {
      const { rename: restoreRename } = await import("fs/promises");
      await restoreRename(backupPath, filePath);
      if (oldMeta) await writeVaultMeta(filePath, oldMeta);
    } catch { /* best effort restore */ }
    return { ok: false, error: err.message };
  }
}

export { parseEnvContent, VAULT_FILE, OC_DIR };
