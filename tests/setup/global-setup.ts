import { execSync } from 'child_process';

export default async function globalSetup(): Promise<void> {
  if (process.env['TEST_BOOTSTRAP_LOCAL_STACK'] !== 'true') {
    return;
  }

  const env = {
    ...process.env,
    NODE_ENV: 'test',
  };

  execSync('pnpm migrate', { stdio: 'inherit', env });
  execSync('pnpm fixtures:load -- --fixture baseline', {
    stdio: 'inherit',
    env,
  });
}
