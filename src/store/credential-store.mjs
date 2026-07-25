import { readFile, writeFile, mkdir, access } from "fs/promises";
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
    try {
      await access(this.filePath, constants.R_OK);
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw);
    } catch {
      return {};
    }
  }

  async writeRaw(data) {
    await this.ensureDir();
    await writeFile(this.filePath, JSON.stringify(data, null, 2), {
      mode: 0o600,
    });
  }

  async get(key) {
    const data = await this.readRaw();
    return data[key] ?? null;
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
    return Object.entries(data).map(([key, value]) => ({
      key,
      type: typeof value === "object" ? value.type : "unknown",
      fingerprint: maskValue(typeof value === "string" ? value : value.value ?? ""),
      updatedAt: value.updatedAt || null,
    }));
  }

  async has(key) {
    const data = await this.readRaw();
    return key in data;
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
    if (!entry) return null;
    return entry;
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
    await writeFile(this.filePath, output, { mode: 0o600 });
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

export function createStore(type = "file", options = {}) {
  if (type === "encrypted") {
    const masterKey =
      options.masterKey || deriveMasterKey(getDeviceFingerprint());
    return new EncryptedFileStore(masterKey, options.filePath);
  }
  return new FileCredentialStore(options.filePath || VAULT_FILE);
}
