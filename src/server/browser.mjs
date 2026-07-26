import { exec } from "child_process";

export function openBrowser(url) {
  const platform = process.platform;
  let cmd;
  if (platform === "darwin") {
    cmd = `open ${url}`;
  } else if (platform === "win32") {
    cmd = `start ${url}`;
  } else {
    cmd = `xdg-open ${url}`;
  }
  exec(cmd, () => {});
}
