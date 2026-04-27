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

const cliArgs = new Set(process.argv.slice(2));
const shouldUseRemoteClient =
  cliArgs.has('--remote') &&
  Boolean(mergedEnv.APP_CLIENT_URL || mergedEnv.APP_PUBLIC_JOIN_BASE_URL);

if (!shouldUseRemoteClient) {
  delete mergedEnv.APP_CLIENT_URL;
  delete mergedEnv.APP_PUBLIC_JOIN_BASE_URL;
  delete mergedEnv.APP_API_URL;
  delete mergedEnv.VITE_PUBLIC_JOIN_BASE_URL;
  delete mergedEnv.VITE_API_URL;
}

const npmScript = shouldUseRemoteClient ? 'dev:desktop:remote' : 'dev:desktop:raw';

const child = spawn(`npm run ${npmScript}`, {
  cwd: projectRoot,
  stdio: 'inherit',
  env: mergedEnv,
  shell: true,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
