function ensureEnv(key: string, value: string): void {
  if (!process.env[key]) {
    process.env[key] = value;
  }
}

ensureEnv('NODE_ENV', 'test');
ensureEnv(
  'DATABASE_URL',
  'postgresql://app_test_user:app_test_password@localhost:5433/app_test'
);
ensureEnv('DB_HOST', 'localhost');
ensureEnv('DB_PORT', '5433');
ensureEnv('DB_NAME', 'app_test');
  ensureEnv('DB_USER', 'app_test_user');
  ensureEnv('DB_PASSWORD', 'app_test_password');
ensureEnv('JWT_SECRET', 'test-jwt-secret-should-be-at-least-32');
ensureEnv('COOKIE_SECRET', 'test-cookie-secret-should-be-32char');
ensureEnv('AWS_REGION', 'eu-west-1');
