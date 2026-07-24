import { select } from '@inquirer/prompts';
import { c, ok, warn, info, fail, divider } from '../tui.mjs';
import { hasCommand, run } from '../../exec/runner.mjs';

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

  const installed = await hasCommand(tool);
  if (installed) {
    const r = await run(tool, ['--version'], { timeout: 5000 });
    ok(`${tool === 'claude' ? 'Claude Code' : 'OpenCode'} already installed (${r.stdout.toString().trim()})`);
    console.log(``);
    return;
  }

  if (tool === 'claude') {
    info('Claude Code installation requires npm.');
    const npmOk = await hasCommand('npm');
    if (!npmOk) {
      fail('npm is required. Install Node.js + npm first.');
      console.log(``);
      return;
    }
    console.log(`  ${c.gray('Installing Claude Code globally...')}`);
    const r = await run('npm', ['install', '-g', '@anthropic-ai/claude-code'], { timeout: 120000 });
    if (r.exitCode === 0) {
      ok('Claude Code installed');
      info('Run: claude --version to verify');
    } else {
      fail(`Installation failed: ${r.stderr}`);
    }
  } else if (tool === 'opencode') {
    info('OpenCode installation requires npm.');
    const npmOk = await hasCommand('npm');
    if (!npmOk) {
      fail('npm is required. Install Node.js + npm first.');
      console.log(``);
      return;
    }
    console.log(`  ${c.gray('See https://opencode.ai for installation instructions')}`);
    info('OpenCode can be installed via: npm install -g @opencode-ai/cli or brew');
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

  const r = await run('npm', ['update', '-g', tool === 'claude' ? '@anthropic-ai/claude-code' : '@opencode-ai/cli'], { timeout: 120000 });
  if (r.exitCode === 0) {
    ok(`${tool === 'claude' ? 'Claude Code' : 'OpenCode'} updated`);
  } else {
    warn(`Update attempted. Check npm for latest version.`);
  }
  console.log(``);
}
