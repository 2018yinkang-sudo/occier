import { runString } from "../exec/runner.mjs";

const CHECK_TARGETS = [
  { name: "Google", url: "https://www.google.com", group: "General" },
  { name: "Baidu", url: "https://www.baidu.com", group: "General" },
  { name: "Cloudflare", url: "https://1.1.1.1", group: "General" },
  { name: "OpenAI API", url: "https://api.openai.com", group: "AI Services" },
  { name: "Anthropic API", url: "https://api.anthropic.com", group: "AI Services" },
  { name: "HuggingFace", url: "https://huggingface.co", group: "AI Services" },
  { name: "Google AI", url: "https://generativelanguage.googleapis.com", group: "AI Services" },
  { name: "DeepSeek API", url: "https://api.deepseek.com", group: "AI Services" },
  { name: "GitHub", url: "https://github.com", group: "Dev Platforms" },
  { name: "GitLab", url: "https://gitlab.com", group: "Dev Platforms" },
  { name: "Stack Overflow", url: "https://stackoverflow.com", group: "Dev Platforms" },
  { name: "npm Registry", url: "https://registry.npmjs.org", group: "Package Registries" },
  { name: "PyPI", url: "https://pypi.org", group: "Package Registries" },
  { name: "Docker Hub", url: "https://hub.docker.com", group: "Package Registries" },
  { name: "npmjs.com", url: "https://www.npmjs.com", group: "Package Registries" },
];

export async function checkDns(hostname) {
  const { promises: dns } = await import("dns");
  try {
    const start = Date.now();
    const addresses = await dns.resolve4(hostname);
    return { pass: true, addresses, ms: Date.now() - start };
  } catch {
    return { pass: false, addresses: [], ms: 0 };
  }
}

export async function checkConnectivity(url, timeout = 5000) {
  const start = Date.now();
  const r = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", String(Math.ceil(timeout / 1000)),
    url,
  ], { timeout: timeout + 1000 });

  const ms = Date.now() - start;
  if (r.exitCode === 0) {
    const code = parseInt(r.stdout);
    return {
      pass: code >= 200 && code < 500,
      code,
      ms,
      error: null,
    };
  }
  return { pass: false, code: 0, ms, error: r.stderr || r.stdout || "connection failed" };
}

export async function checkAll() {
  const results = await Promise.all(
    CHECK_TARGETS.map(async (target) => {
      const hostname = target.url.replace(/^https?:\/\//, "").split("/")[0];
      const [dnsResult, httpResult] = await Promise.all([
        checkDns(hostname),
        checkConnectivity(target.url),
      ]);
      return {
        ...target,
        dns: dnsResult,
        http: httpResult,
        status: dnsResult.pass && httpResult.pass ? "ok" : "fail",
      };
    }),
  );
  return results;
}
