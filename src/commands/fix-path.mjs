import { homedir } from 'os';
import { join } from 'path';
import { readFileSync, writeFileSync, accessSync, R_OK } from 'fs';
import { c } from '../tui.mjs';

export async function fixPath() {
  const HOME = homedir();
  const binDir = join(HOME, '.local', 'bin');
  const line = `export PATH="${binDir}:$PATH"`;

  const candidates = ['.bashrc', '.zshrc', '.profile'];
  let found = false;
  let modified = null;

  for (const name of candidates) {
    const rc = join(HOME, name);
    try {
      accessSync(rc, R_OK);
      const content = readFileSync(rc, 'utf-8');

      if (content.includes(binDir)) {
        console.log(`\n  ${c.green('✓')} ~/.local/bin already in ~/${name}`);
        found = true;
        break;
      }

      writeFileSync(rc, `${content.trimEnd()}\n\n# Added by ociier\n${line}\n`);
      modified = name;
      found = true;
      break;
    } catch { /* file not found, skip */ }
  }

  if (!found) {
    const rc = join(HOME, '.bashrc');
    try {
      accessSync(rc, R_OK);
      const content = readFileSync(rc, 'utf-8');
      if (!content.includes(binDir)) {
        writeFileSync(rc, `${content.trimEnd()}\n\n# Added by ociier\n${line}\n`);
        modified = '.bashrc';
      }
    } catch {
      writeFileSync(rc, `# Added by ociier\n${line}\n`);
      modified = '.bashrc';
    }
  }

  if (modified) {
    console.log(`\n  ${c.green('✓')} Added PATH entry to ~/${modified}`);
    console.log(`  ${c.boldWhite('Run:')} ${c.cyan(`source ~/${modified}`)}`);
    console.log('');
  } else {
    console.log(`\n  ${c.green('✓')} PATH is already configured correctly.\n`);
  }
}
