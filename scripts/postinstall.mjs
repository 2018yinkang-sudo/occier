import { homedir } from 'os';
import { join, dirname } from 'path';
import { readFileSync, writeFileSync, accessSync, R_OK } from 'fs';

const HOME = homedir();

function getShellRcFiles() {
  const files = [];
  for (const name of ['.bashrc', '.zshrc', '.profile']) {
    try {
      accessSync(join(HOME, name), R_OK);
      files.push(name);
    } catch {}
  }
  return files.length > 0 ? files : ['.bashrc'];
}

function binDirFromPrefix() {
  const prefix = process.env.npm_config_prefix || join(HOME, '.local');
  return prefix.endsWith('/bin') ? prefix : join(prefix, 'bin');
}

function addToShellRc(binDir) {
  for (const name of getShellRcFiles()) {
    const rc = join(HOME, name);
    try {
      const content = readFileSync(rc, 'utf-8');
      if (content.includes(`"${binDir}:$PATH"`) || content.includes(`"${binDir}:"`)) {
        return { name, existed: true };
      }
      writeFileSync(rc, `${content.trimEnd()}\n\n# Added by ociier\nexport PATH="${binDir}:$PATH"\n`);
      return { name, existed: false };
    } catch {}
  }
  return null;
}

const result = addToShellRc(binDirFromPrefix());

if (result && !result.existed) {
  console.log(`\n  ociier: Added PATH entry to ~/${result.name}`);
  console.log(`  Run: source ~/${result.name}\n`);
} else if (result && result.existed) {
  console.log(`  ociier: PATH already configured in ~/${result.name}\n`);
}
