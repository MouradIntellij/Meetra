const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const envFilePath = path.join(projectRoot, '.env.desktop.local');

function parseEnvFile(contents) {
  const env = {};

  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separatorIndex = line.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      env[key] = value;
    }
  }

  return env;
}

function loadDesktopEnv() {
  if (!fs.existsSync(envFilePath)) {
    return {};
  }

  const contents = fs.readFileSync(envFilePath, 'utf8');
  return parseEnvFile(contents);
}

const desktopEnv = loadDesktopEnv();
const mergedEnv = {
  ...process.env,
  ...desktopEnv,
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const child = spawn(npmCommand, ['run', 'dev:desktop:raw'], {
  cwd: projectRoot,
  stdio: 'inherit',
  env: mergedEnv,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
