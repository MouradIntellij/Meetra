function getDatabaseUrl() {
  return process.env.DATABASE_URL || '';
}

function shouldUseSsl(connectionString) {
  const explicit = String(process.env.DATABASE_SSL || process.env.PGSSLMODE || '').trim().toLowerCase();
  if (['1', 'true', 'require', 'required'].includes(explicit)) return true;
  if (['0', 'false', 'disable', 'disabled'].includes(explicit)) return false;

  return /render\.com|neon\.tech/i.test(connectionString)
    || /[?&]sslmode=require\b/i.test(connectionString);
}

export function hasDatabaseUrl() {
  return Boolean(getDatabaseUrl());
}

export function createPostgresPoolConfig() {
  const connectionString = getDatabaseUrl();

  return {
    connectionString,
    ssl: shouldUseSsl(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  };
}
