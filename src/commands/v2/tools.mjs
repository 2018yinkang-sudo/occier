import { select } from '@inquirer/prompts';
import { c, ok, fail, divider } from '../tui.mjs';
import { installClaude, updateClaude } from '../../tools/claude/install.mjs';
import { installOpenCode, updateOpenCode } from '../../tools/opencode/install.mjs';

export async function installTool(tool) {
  if (!tool) {
    const chosen = await select({
      message: 'Select tool to install:',
      choices: [
        { name: 'Claude Code', value: 'claude' },
        { name: 'OpenCode', value: 'opencode' },
      ],
    });
    await doInstall(chosen);
  } else {
    await doInstall(tool);
  }
}

async function doInstall(tool) {
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite(`Install ${tool === 'claude' ? 'Claude Code' : 'OpenCode'}`)}`);
  console.log(``);

  if (tool === 'claude') {
    const result = await installClaude();
    if (result.installed) ok(`Claude Code ${result.version || 'installed'}`);
    else fail(`Installation failed: ${result.error || 'unknown error'}`);
  } else {
    const result = await installOpenCode();
    if (result.installed) ok(`OpenCode ${result.version || 'installed'}`);
    else fail(`Installation failed: ${result.error || 'unknown error'}`);
  }
  console.log(``);
}

export async function updateTool(tool) {
  if (!tool) {
    const chosen = await select({
      message: 'Select tool to update:',
      choices: [
        { name: 'Claude Code', value: 'claude' },
        { name: 'OpenCode', value: 'opencode' },
      ],
    });
    await doUpdate(chosen);
  } else {
    await doUpdate(tool);
  }
}

async function doUpdate(tool) {
  console.log(``);
  divider();
  console.log(`  ${c.boldWhite(`Update ${tool === 'claude' ? 'Claude Code' : 'OpenCode'}`)}`);
  console.log(``);

  if (tool === 'claude') {
    const result = await updateClaude();
    ok(result.version === 'updated' ? 'Updated' : 'Already up to date');
  } else {
    const result = await updateOpenCode();
    ok(result.version === 'updated' ? 'Updated' : 'Already up to date');
  }
  console.log(``);
}
