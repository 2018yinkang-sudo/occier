import { input, select } from '@inquirer/prompts';
import { c, ok, warn } from '../../tui.mjs';
import { run } from '../../exec/runner.mjs';
import { join } from 'path';
import { homedir } from 'os';
import { readFile, writeFile, mkdir, access } from 'fs/promises';
import { constants } from 'fs';

export async function projectCreate() {
  const name = await input({
    message: 'Project name:',
    validate: (v) => v.trim().length > 0 || 'Name is required',
  });

  const dir = await input({
    message: 'Project directory:',
    default: join(process.cwd(), name.trim()),
  });

  const tool = await select({
    message: 'Development tool:',
    choices: [
      { name: 'Claude Code', value: 'claude' },
      { name: 'OpenCode', value: 'opencode' },
    ],
  });

  console.log(`\n  ${c.gray(`Creating project at ${dir}...`)}`);

  const r = await run('mkdir', ['-p', dir], { timeout: 5000 });
  if (r.exitCode !== 0) {
    warn(`Could not create directory: ${r.stderr}`);
    console.log(``);
    return;
  }

  ok(`Project directory created`);

  const ocDir = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'occier',
  );
  const projectsPath = join(ocDir, 'projects.json');

  let projects = {};
  try {
    await access(projectsPath, constants.R_OK);
    const raw = await readFile(projectsPath, 'utf-8');
    try {
      projects = JSON.parse(raw);
    } catch {
      console.log(`\n  ${c.yellow('!')} projects.json is corrupted — creating new one\n`);
    }
  } catch { /* no existing projects file */ }

  projects[name.trim()] = {
    path: dir,
    tool,
    modelGroup: 'balanced',
    template: 'minimal',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await mkdir(ocDir, { recursive: true, mode: 0o700 });
  await writeFile(projectsPath, JSON.stringify(projects, null, 2), { mode: 0o600 });
  ok(`Project '${name}' saved`);

  console.log(`\n  ${c.bold('Next steps:')}`);
  console.log(`    ${c.cyan(`cd ${dir}`)}`);
  console.log(`    ${c.cyan(`occier launch --tool ${tool}`)}`);
  console.log(``);
}

export async function projectOpen() {
  const ocDir = join(
    process.env.XDG_CONFIG_HOME || join(homedir(), '.config'),
    'occier',
  );
  const projectsPath = join(ocDir, 'projects.json');

  try {
    await access(projectsPath, constants.R_OK);
  } catch {
    console.log(`\n  ${c.gray('No saved projects.')} Run ${c.cyan('occier project create')} first.\n`);
    return;
  }

  let projects;
  try {
    projects = JSON.parse(await readFile(projectsPath, 'utf-8'));
  } catch {
    console.log(`\n  ${c.red('Error:')} Failed to read projects.json — file may be corrupted\n`);
    return;
  }

  const names = Object.keys(projects);

  if (names.length === 0) {
    console.log(`\n  ${c.gray('No saved projects.')}\n`);
    return;
  }

  const chosen = await select({
    message: 'Select project:',
    choices: names.map((n) => ({
      name: `${n.padEnd(20)} ${c.gray(projects[n].path)}`,
      value: n,
    })),
  });

  const project = projects[chosen];
  console.log(`\n  ${c.green('✓')} ${chosen}`);
  console.log(`    Path: ${c.gray(project.path)}`);
  console.log(`    Tool: ${c.cyan(project.tool)}`);
  console.log(`    ${c.gray('Run:')} ${c.cyan(`cd "${project.path}" && occier launch --tool ${project.tool}`)}\n`);
}
