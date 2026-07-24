import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";
import { runString } from "../../exec/runner.mjs";
import { detectGitHubCLI } from "./manager.mjs";

export function detectSSHKeys() {
  const sshDir = join(homedir(), ".ssh");
  const keyFiles = ["id_rsa", "id_ed25519", "id_ecdsa", "id_ecdsa_sk", "id_ed25519_sk"];
  const found = [];

  for (const name of keyFiles) {
    const pubPath = join(sshDir, `${name}.pub`);
    const privPath = join(sshDir, name);
    if (existsSync(pubPath) && existsSync(privPath)) {
      try {
        const pubContent = readFileSync(pubPath, "utf-8").trim();
        const parts = pubContent.split(/\s+/);
        found.push({
          name,
          publicKey: parts.slice(0, 2).join(" "),
          comment: parts[2] || "",
          hasPrivate: true,
        });
      } catch {
        found.push({ name, publicKey: "", comment: "", hasPrivate: false });
      }
    }
  }
  return found;
}

export async function testGitSSH() {
  const r = await runString("ssh", ["-T", "git@github.com"], { timeout: 10000 });
  if (r.exitCode === 1) {
    return { success: true, detail: "Authentication succeeded" };
  }
  return { success: false, detail: r.stderr || r.stdout || "SSH connection failed" };
}

export async function saveGitHubPAT(token, description = "fine-grained PAT") {
  const { createStore } = await import("../../store/credential-store.mjs");
  const store = createStore();
  await store.set("github_token", {
    type: "github_token",
    value: token,
    description,
    updatedAt: new Date().toISOString(),
  });
  return true;
}

export async function getGitHubPAT() {
  const { createStore } = await import("../../store/credential-store.mjs");
  const store = createStore();
  const data = await store.get("github_token");
  return data?.value || null;
}

export async function getPreferredAuthMethod() {
  const gh = await detectGitHubCLI();
  if (gh.loggedIn) return "gh_cli";
  const keys = detectSSHKeys();
  if (keys.length > 0) {
    const test = await testGitSSH();
    if (test.success) return "ssh";
  }
  const pat = await getGitHubPAT();
  if (pat) return "pat";
  return "none";
}

export async function testGitHubAuthAll() {
  const results = { ghCli: false, ssh: false, pat: false };
  const gh = await detectGitHubCLI();
  results.ghCli = gh.loggedIn;
  const keys = detectSSHKeys();
  if (keys.length > 0) {
    const test = await testGitSSH();
    results.ssh = test.success;
  }
  const pat = await getGitHubPAT();
  if (pat) {
    const r = await runString("curl", [
      "-s", "-o", "/dev/null", "-w", "%{http_code}",
      "-H", `Authorization: token ${pat.slice(0, 4)}***${pat.slice(-4)}`,
      "https://api.github.com/user",
    ], { timeout: 8000 });
    results.pat = r.exitCode === 0 && (r.stdout === "200" || r.stdout === "401");
  }
  return results;
}
