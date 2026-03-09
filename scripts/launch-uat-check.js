/* eslint-disable no-console */
require('dotenv').config();

const { spawn, spawnSync } = require('child_process');

const skipLlmCheck = process.argv.includes('--skip-llm') || process.env.SKIP_LLM_KEY_CHECK === 'true';
const checks = [];

function recordCheck(name, ok, details = '') {
  checks.push({ name, ok, details });
  const prefix = ok ? 'PASS' : 'FAIL';
  console.log(`[${prefix}] ${name}${details ? ` - ${details}` : ''}`);
}

function runCommand(name, command, args, env = process.env) {
  console.log(`\n[RUN] ${name}: ${command} ${args.join(' ')}`);
  const result = spawnSync(command, args, {
    env,
    stdio: 'pipe',
    encoding: 'utf8',
  });

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  if (result.status === 0) {
    recordCheck(name, true);
    return true;
  }

  recordCheck(name, false, `exit code ${result.status}`);
  return false;
}

function stopProcess(processRef) {
  return new Promise((resolve) => {
    if (!processRef || processRef.exitCode !== null) {
      resolve();
      return;
    }

    const killTimer = setTimeout(() => {
      if (processRef.exitCode === null) {
        processRef.kill('SIGKILL');
      }
    }, 5000);

    processRef.once('exit', () => {
      clearTimeout(killTimer);
      resolve();
    });

    processRef.kill('SIGINT');
  });
}

function waitForDevServer(devProcess, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };

    const pass = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timer = setTimeout(() => {
      fail(new Error('Timed out waiting for dev server readiness'));
    }, timeoutMs);

    devProcess.stdout.on('data', (chunk) => {
      const text = chunk.toString();
      process.stdout.write(text);
      if (text.includes('Ready in')) {
        clearTimeout(timer);
        pass();
      }
    });

    devProcess.stderr.on('data', (chunk) => {
      const text = chunk.toString();
      process.stderr.write(text);
      if (text.toLowerCase().includes('eaddrinuse')) {
        clearTimeout(timer);
        fail(new Error('Port 3000 is already in use'));
      }
    });

    devProcess.once('exit', (code) => {
      if (!settled) {
        clearTimeout(timer);
        fail(new Error(`Dev server exited before readiness (code ${code})`));
      }
    });
  });
}

async function checkHttp(name, path, options = {}) {
  const acceptedStatuses = options.acceptedStatuses || [200];
  const baseUrl = options.baseUrl || 'http://localhost:3000';
  const url = `${baseUrl}${path}`;

  try {
    const response = await fetch(url);
    const responseText = await response.text();

    if (!acceptedStatuses.includes(response.status)) {
      recordCheck(
        name,
        false,
        `HTTP ${response.status}; expected ${acceptedStatuses.join('/')} (${responseText.slice(0, 180)})`
      );
      return;
    }

    if (options.validateJson) {
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (error) {
        recordCheck(name, false, `invalid JSON: ${error.message}`);
        return;
      }

      const validationError = options.validateJson(parsed, response.status);
      if (validationError) {
        recordCheck(name, false, validationError);
        return;
      }
    }

    recordCheck(name, true, `HTTP ${response.status}`);
  } catch (error) {
    recordCheck(name, false, error.message);
  }
}

async function main() {
  console.log('=== Launch UAT Check ===');
  if (skipLlmCheck) {
    console.log('LLM credential checks are skipped for this run.');
  }

  const launchCheckArgs = ['scripts/launch-readiness-check.js'];
  if (skipLlmCheck) launchCheckArgs.push('--skip-llm');

  runCommand('Launch readiness preflight', 'node', launchCheckArgs);
  runCommand('CI gate (prisma + typecheck + build)', 'npm', ['run', 'ci:check']);
  runCommand('Security gate (audit high+)', 'npm', ['audit', '--omit=dev', '--audit-level=high']);

  let devProcess;
  try {
    console.log('\n[RUN] Runtime smoke (start dev server)');
    devProcess = spawn('npm', ['run', 'dev'], {
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    await waitForDevServer(devProcess);
    recordCheck('Dev server startup', true, 'ready on port 3000');

    await checkHttp('Health endpoint', '/api/v1/health', {
      validateJson: (data) => (data?.status === 'healthy' ? null : 'health status is not "healthy"'),
    });
    await checkHttp('Voice webhook boot', '/api/webhooks/twilio/voice');
    await checkHttp('SMS webhook boot', '/api/webhooks/twilio/sms');
    await checkHttp('Call status webhook boot', '/api/webhooks/twilio/status');
    await checkHttp('SMS status webhook boot', '/api/webhooks/twilio/status/sms');
    await checkHttp('WhatsApp webhook boot', '/api/webhooks/twilio/whatsapp');
    await checkHttp('Auth wrapper route exists', '/api/auth/register', { acceptedStatuses: [405] });
    await checkHttp('Canonical auth route exists', '/api/v1/auth', { acceptedStatuses: [405] });
    await checkHttp('Cron endpoint auth guard', '/api/cron/daily-summary', { acceptedStatuses: [401, 403] });
  } catch (error) {
    recordCheck('Runtime smoke execution', false, error.message);
  } finally {
    await stopProcess(devProcess);
  }

  const passed = checks.filter((check) => check.ok).length;
  const failed = checks.filter((check) => !check.ok);

  console.log('\n=== UAT Summary ===');
  console.log(`Total checks: ${checks.length}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${failed.length}`);

  if (failed.length > 0) {
    console.log('\nFailed checks:');
    for (const check of failed) {
      console.log(`- ${check.name}${check.details ? `: ${check.details}` : ''}`);
    }
    process.exitCode = 1;
    return;
  }

  console.log('\nAll UAT checks passed. Launch gate is green.');
}

main().catch((error) => {
  console.error('UAT check crashed:', error);
  process.exitCode = 1;
});
