import { hasCommand, runString } from "../../exec/runner.mjs";

export async function detectGitHubCLI() {
  const installed = await hasCommand("gh");
  if (!installed) return { installed: false, loggedIn: false };

  const r = await runString("gh", ["auth", "status"], { timeout: 5000 });
  return {
    installed: true,
    loggedIn: r.exitCode === 0,
  };
}

export async function installGitHubCLI() {
  const detected = await detectGitHubCLI();
  if (detected.installed) return detected;

  console.log("  Install GitHub CLI:");
  console.log("    Linux:  sudo apt install gh   (or brew install gh)");
  console.log("    macOS:  brew install gh");
  console.log("    Windows: winget install GitHub.cli");
  console.log("    Docs:   https://cli.github.com/");

  try {
    const r = await runString("sudo", ["apt", "install", "-y", "gh"], { timeout: 30000 });
    return {
      installed: r.exitCode === 0,
      loggedIn: false,
      error: r.exitCode !== 0 ? r.stderr + r.stdout : null,
    };
  } catch {
    return { installed: false, loggedIn: false };
  }
}

export async function ghAuthLogin() {
  const r = await runString("gh", ["auth", "login", "--git-protocol", "https", "--web"], { timeout: 30000 });
  return r.exitCode === 0;
}

export async function testGitHubAPI() {
  const r = await runString("curl", [
    "-s", "-o", "/dev/null", "-w", "%{http_code}",
    "--connect-timeout", "5",
    "https://api.github.com",
  ], { timeout: 8000 });
  return r.exitCode === 0 && r.stdout === "200";
}

export async function testGitHubAuth() {
  const r = await runString("gh", ["api", "user", "--jq", ".login"], { timeout: 10000 });
  if (r.exitCode === 0) return { authenticated: true, user: r.stdout.trim() };
  return { authenticated: false, user: null };
}

export async function configureGitHub(name, email) {
  await runString("git", ["config", "--global", "user.name", name], { timeout: 5000 });
  await runString("git", ["config", "--global", "user.email", email], { timeout: 5000 });
}
