// Credential type registry and model-key presets.
//
// Each credential type declares a field schema that drives both the Web UI
// form and the CLI prompts, so adding/changing a type only touches this file.
//
// Storage shapes (in vault.enc):
//   - non-structured type: { type, value: <string>, updatedAt }
//   - structured type:     { type, fields: { ... }, updatedAt }
//
// Fields may declare `dependsOn: { field, value: <string|array> }` so
// conditional fields only appear when their dependency matches (e.g. xray
// proxy protocol selects which auth fields are relevant).
//
// Each type declares a `keyMode`:
//   "fixed"   — key is pre-determined (fixedKey); form hides the name input.
//   "default" — key defaults to something (os username for sudo_password);
//               the form pre-fills it but the user can edit.
//   "user"    — user chooses a free-form alias.

import { userInfo } from "os";

export const SYSTEM_USERNAME = userInfo().username || process.env.USER || process.env.USERNAME || "";

// ── endpoint types (model_key.endpoint_type) ──
export const ENDPOINT_TYPES = ["anthropic", "openai", "gemini"];

export const ENDPOINT_LABELS = {
  anthropic: "Anthropic (/v1/messages)",
  openai: "OpenAI 兼容 (/v1/chat/completions)",
  gemini: "Google Gemini (原生)",
};

const FIELD = { TEXT: "text", PASSWORD: "password", URL: "url", SELECT: "select" };

export const XRAY_PROTOCOLS = ["http", "socks", "shadowsocks", "trojan", "vless", "vmess"];
export const XRAY_METHODS = [
  "2022-blake3-aes-128-gcm", "2022-blake3-aes-256-gcm",
  "2022-blake3-chacha20-poly1305", "aes-256-gcm", "aes-128-gcm",
  "chacha20-poly1305", "xchacha20-poly1305",
];

export const CREDENTIAL_TYPES = [
  {
    id: "model_key",
    label: "模型密钥",
    description: "自定义 provider：base_url + api_key + 端点类型",
    keyMode: "user",
    fixedKey: null,
    structured: true,
    fields: [
      {
        name: "endpoint_type", label: "端点类型", type: FIELD.SELECT,
        options: ENDPOINT_TYPES, optionLabels: ENDPOINT_LABELS, required: true,
      },
      {
        name: "base_url", label: "Base URL", type: FIELD.URL,
        required: true, placeholder: "https://api.example.com/v1",
      },
      { name: "api_key", label: "API Key", type: FIELD.PASSWORD, required: true, secret: true },
      { name: "label", label: "显示名 (可选)", type: FIELD.TEXT, required: false },
    ],
  },
  {
    id: "github_token",
    label: "GitHub Token",
    description: "GitHub 个人访问令牌 (PAT)",
    keyMode: "fixed",
    fixedKey: "github_token",
    structured: true,
    fields: [
      { name: "token", label: "Token", type: FIELD.PASSWORD, required: true, secret: true },
      { name: "email", label: "邮箱 (可选)", type: FIELD.TEXT, required: false },
    ],
  },
  {
    id: "sudo_password",
    label: "系统密码",
    description: "本地 sudo 提权密码",
    keyMode: "default",
    fixedKey: null,
    structured: false,
    fields: [{ name: "value", label: "密码", type: FIELD.PASSWORD, required: true, secret: true }],
  },
  {
    id: "proxy_password",
    label: "代理密码",
    description: "Xray 代理协议认证信息 — 按协议填写对应字段",
    keyMode: "user",
    fixedKey: null,
    structured: true,
    fields: [
      {
        name: "protocol", label: "协议", type: FIELD.SELECT,
        options: XRAY_PROTOCOLS,
        optionLabels: { "http": "HTTP", "socks": "SOCKS", "shadowsocks": "Shadowsocks",
                         "trojan": "Trojan", "vless": "VLESS", "vmess": "VMess" },
        required: true,
      },
      { name: "username", label: "用户名", type: FIELD.TEXT, required: false,
        dependsOn: { field: "protocol", value: ["http", "socks"] } },
      { name: "password", label: "密码/Key", type: FIELD.PASSWORD, required: true, secret: true,
        dependsOn: { field: "protocol", value: ["http", "socks", "shadowsocks", "trojan"] } },
      { name: "method", label: "加密方法", type: FIELD.SELECT, required: true,
        options: XRAY_METHODS,
        dependsOn: { field: "protocol", value: ["shadowsocks"] } },
      { name: "id", label: "UUID", type: FIELD.TEXT, required: true, secret: true,
        dependsOn: { field: "protocol", value: ["vless", "vmess"] } },
      { name: "security", label: "Security (VMess)", type: FIELD.SELECT, required: false,
        options: ["auto", "aes-128-gcm", "chacha20-poly1305"],
        dependsOn: { field: "protocol", value: ["vmess"] } },
      { name: "flow", label: "Flow (VLESS)", type: FIELD.SELECT, required: false,
        options: ["", "xtls-rprx-vision", "xtls-rprx-vision-udp443"],
        dependsOn: { field: "protocol", value: ["vless"] } },
      { name: "email", label: "Email (可选)", type: FIELD.TEXT, required: false,
        dependsOn: { field: "protocol", value: ["shadowsocks", "trojan"] } },
    ],
  },
];

// ── model-key presets ──
export const MODEL_PRESETS = [
  {
    id: "anthropic", label: "Anthropic (官方 Claude API)",
    endpoint_type: "anthropic", base_url: "https://api.anthropic.com",
    note: "claude.ai 订阅登录时无需配置", verified: true,
  },
  {
    id: "deepseek", label: "DeepSeek (anthropic 兼容)",
    endpoint_type: "anthropic", base_url: "https://api.deepseek.com/anthropic",
    verified: true,
  },
  {
    id: "kimi", label: "Kimi / Moonshot (anthropic 兼容)",
    endpoint_type: "anthropic", base_url: "https://api.moonshot.cn/anthropic",
    note: "使用 Kimi 开放平台 key，非订阅 key", verified: true,
  },
  {
    id: "openai", label: "OpenAI",
    endpoint_type: "openai", base_url: "https://api.openai.com/v1",
    verified: true,
  },
  {
    id: "zhipu", label: "智谱 GLM",
    endpoint_type: "openai", base_url: "https://open.bigmodel.cn/api/paas/v4",
    verified: true,
  },
  {
    id: "qwen", label: "通义千问 / DashScope",
    endpoint_type: "openai", base_url: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    note: "也可用业务空间专属域名", verified: true,
  },
  {
    id: "openrouter", label: "OpenRouter",
    endpoint_type: "openai", base_url: "https://openrouter.ai/api/v1",
    verified: true,
  },
  {
    id: "gemini", label: "Google Gemini (原生)",
    endpoint_type: "gemini", base_url: "https://generativelanguage.googleapis.com",
    verified: true,
  },
  {
    id: "openai-compat", label: "OpenAI 兼容 (豆包/MiniMax/文心/Yi/StepFun/硅基流动等)",
    endpoint_type: "openai", base_url: "",
    note: "中国大陆多数厂商为 OpenAI 兼容；请按官方文档填写 base_url", verified: false,
  },
  {
    id: "custom", label: "自定义 (手动填写)",
    endpoint_type: "", base_url: "", verified: false,
  },
];

// ── helpers ──

const TYPE_MAP = new Map(CREDENTIAL_TYPES.map((t) => [t.id, t]));

export function getType(typeId) {
  return TYPE_MAP.get(typeId) || null;
}

export function isStructuredType(typeId) {
  return !!getType(typeId)?.structured;
}

export function listTypes() {
  return CREDENTIAL_TYPES.map((t) => ({ ...t }));
}

export function fieldMatchesDepend(dependsOn, fields) {
  if (!dependsOn) return true;
  const v = (fields || {})[dependsOn.field];
  const target = dependsOn.value;
  return Array.isArray(target) ? target.includes(v) : v === target;
}

export function listTypesForApi() {
  return CREDENTIAL_TYPES.map((t) => ({
    id: t.id,
    label: t.label,
    description: t.description,
    structured: t.structured,
    keyMode: t.keyMode,
    fixedKey: t.fixedKey || null,
    defaultKey: t.keyMode === "default" ? defaultKeyFor(t.id) : null,
    fields: t.fields.map((f) => ({
      name: f.name,
      label: f.label,
      type: f.type,
      required: !!f.required,
      secret: !!f.secret,
      placeholder: f.placeholder || null,
      options: f.options || null,
      optionLabels: f.optionLabels || null,
      dependsOn: f.dependsOn || null,
    })),
  }));
}

export function getModelPresets() {
  return MODEL_PRESETS.map((p) => ({ ...p }));
}

export function secretFieldsFor(typeId) {
  const t = getType(typeId);
  if (!t) return [];
  return t.fields.filter((f) => f.secret).map((f) => f.name);
}

export function defaultKeyFor(typeId) {
  if (typeId === "sudo_password") return SYSTEM_USERNAME || null;
  return null;
}

// ── validation ──

const KEY_PATTERN = /^[a-z][a-z0-9_]{0,63}$/i;

export function isValidKeyName(name) {
  return typeof name === "string" && KEY_PATTERN.test(name.trim());
}

function isValidBaseUrl(url) {
  if (typeof url !== "string") return false;
  const v = url.trim();
  if (!v) return false;
  let u;
  try { u = new URL(v); } catch { return false; }
  if (u.protocol !== "https:" && u.protocol !== "http:") return false;
  if (u.protocol === "http:" && !["localhost", "127.0.0.1", "::1"].includes(u.hostname)) return false;
  return true;
}

export function validateCredential(typeId, payload) {
  const t = getType(typeId);
  if (!t) return { ok: false, error: `Unknown credential type: ${typeId}` };

  if (t.structured) {
    const fields = (payload && typeof payload.fields === "object") ? payload.fields : {};
    for (const f of t.fields) {
      if (f.dependsOn && !fieldMatchesDepend(f.dependsOn, fields)) continue;
      const v = fields[f.name];
      if (f.required && (v === undefined || v === null || String(v).trim() === "")) {
        return { ok: false, error: `${f.label} 为必填项` };
      }
    }
    if (typeId === "model_key") {
      if (!ENDPOINT_TYPES.includes(fields.endpoint_type)) {
        return { ok: false, error: "端点类型无效" };
      }
      if (!isValidBaseUrl(fields.base_url)) {
        return { ok: false, error: "Base URL 必须是合法 https 地址（http 仅限本地）" };
      }
      if (typeof fields.api_key !== "string" || fields.api_key.length === 0) {
        return { ok: false, error: "API Key 不能为空" };
      }
    }
    if (typeId === "proxy_password") {
      if (!XRAY_PROTOCOLS.includes(fields.protocol)) {
        return { ok: false, error: "协议类型无效" };
      }
    }
    return { ok: true };
  }

  const value = payload && payload.value;
  if (typeof value !== "string" || value.length === 0) {
    return { ok: false, error: "值不能为空" };
  }
  return { ok: true };
}

// ── masking ──

function maskString(value) {
  if (!value) return "<not set>";
  if (value.length <= 4) return "****";
  return "****" + value.slice(-4);
}

export function maskEntry(entry) {
  if (!entry || typeof entry !== "object") return "<not set>";
  const type = entry.type || "api_key";
  if (type === "sudo_password") {
    return entry.value ? "configured" : "<not set>";
  }
  const t = getType(type);
  if (t && t.structured) {
    const fields = entry.fields || {};
    for (const f of t.fields) {
      if (f.secret && fields[f.name]) return maskString(fields[f.name]);
    }
    return "<not set>";
  }
  return maskString(entry.value);
}

export function publicFieldsFor(typeId, fields) {
  const t = getType(typeId);
  if (!t || !t.structured) return undefined;
  const secrets = new Set(secretFieldsFor(typeId));
  const out = {};
  for (const f of t.fields) {
    if (fields && f.name in fields) {
      out[f.name] = secrets.has(f.name) ? maskString(fields[f.name]) : fields[f.name];
    }
  }
  return out;
}

export function maskValue(value, type) {
  if (type === "sudo_password") return value ? "configured" : "<not set>";
  return maskString(value);
}
