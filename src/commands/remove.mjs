import { confirm } from '@inquirer/prompts';
import { rm, readFile, writeFile, readdir, rmdir } from 'fs/promises';
import { homedir } from 'os';
import { join } from 'path';
import { ENV_FILE, CONFIG_FILE, CC_CONFIG_DIR } from '../paths.mjs';
import { shellRcPath } from '../paths.mjs';
import { c } from '../tui.mjs';

export async function runRemove() {
  console.log('');
  console.log(`  ${c.bold('╔══════════════════════════════════════════╗')}`);
  console.log(`  ${c.bold('║')}         ${c.red('Remove All Configuration')}          ${c.bold('║')}`);
  console.log(`  ${c.bold('╚══════════════════════════════════════════╝')}`);
  console.log('');
  console.log('  This will remove:');
  console.log('');
  console.log(`    • Credential file     ${c.gray(ENV_FILE)}`);
  console.log(`    • Config file         ${c.gray(CONFIG_FILE)}`);
  console.log(`    • Empty config dir    ${c.gray(CC_CONFIG_DIR)}`);
  console.log(`    • PATH entry          ${c.gray('from shell rc')}`);
  console.log(`    • npm global package  ${c.gray('occier')}`);
  console.log('');

  const confirmed = await confirm({
    message: `This action cannot be undone. Continue?`,
    default: false,
  });

  if (!confirmed) {
    console.log(`\n  Aborted.\n`);
    return;
  }

  console.log('');

  try {
    await rm(ENV_FILE, { force: true });
    console.log(`  ${c.green('✓')} Removed providers.env`);
  } catch {
    console.log(`  ${c.yellow('!')} providers.env not found`);
  }

  try {
    await rm(CONFIG_FILE, { force: true });
    console.log(`  ${c.green('✓')} Removed config.json`);
  } catch {
    console.log(`  ${c.yellow('!')} config.json not found`);
  }

  const shellRc = shellRcPath();
  try {
    const content = await readFile(shellRc, 'utf-8');
    const binDir = join(homedir(), '.local', 'bin');
    const escapedBin = binDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `^(# Added by occier\\n)?export PATH="${escapedBin}:\\$PATH"\\n?`,
      "m",
    );
    if (pattern.test(content) || content.includes('export PATH="$HOME/.local/bin:$PATH"')) {
      const newContent = content.replace(pattern, '').replace(/export PATH="\$HOME\/\.local\/bin:\$PATH"\n?/g, '');
      await writeFile(shellRc, newContent);
      console.log(`  ${c.green('✓')} Removed PATH entry from ${shellRc.split('/').pop()}`);
    } else {
      console.log(`  ${c.gray('○')} No PATH entry in shell rc`);
    }
  } catch {
    console.log(`  ${c.yellow('!')} Could not clean shell rc`);
  }

  try {
    const entries = await readdir(CC_CONFIG_DIR);
    if (entries.length === 0) {
      await rmdir(CC_CONFIG_DIR);
      console.log(`  ${c.green('✓')} Removed empty config directory`);
    } else {
      console.log(`  ${c.gray('○')} Config directory not empty (preserved)`);
    }
  } catch { /* dir cannot be read, skip */ }

  console.log(`\n  ${c.bold('Run the following to uninstall the npm package:')}`);
  console.log(`  ${c.cyan('npm uninstall -g ociier')}`);
  console.log(`\n  ${c.green('Done.')} Run ${c.cyan('source ~/.bashrc')} or open a new terminal.\n`);
}
