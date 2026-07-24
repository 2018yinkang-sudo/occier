import { runString } from "../exec/runner.mjs";

const CHECK_TARGETS = [
  { name: "GitHub", url: "https://github.com", tier: 4 },
  { name: "npm Registry", url: "https://registry.npmjs.org", tier: 4 },
  { name: "Google", url: "https://www.google.com", tier: 4 },
  { name: "Baike (CN)", url: "https://www.baidu.com", tier: 4 },
  { name: "npmjs.com", url: "https://www.npmjs.com", tier: 4 },
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
  const results = [];
  for (const target of CHECK_TARGETS) {
    const hostname = target.url.replace(/^https?:\/\//, "").split("/")[0];
    const dnsResult = await checkDns(hostname);
    const httpResult = await checkConnectivity(target.url);
    results.push({
      ...target,
      dns: dnsResult,
      http: httpResult,
      status: dnsResult.pass && httpResult.pass ? "ok" : "fail",
    });
  }
  return results;
}

export function getTierLabel(tier) {
  const labels = {
    1: "Port",
    2: "DNS",
    3: "TCP/TLS",
    4: "HTTP",
    5: "Auth",
    6: "Model",
  };
  return labels[tier] || `Tier ${tier}`;
}
