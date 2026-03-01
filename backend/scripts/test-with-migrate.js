// backend/scripts/test-with-migrate.js
//
// Runs Prisma migrations against the TEST database (backend/.env.test), then executes vitest.
// This keeps the test DB schema in sync with the repo migrations.
//
// NOTE: This script intentionally loads backend/.env.test explicitly so running `npm test`
// cannot accidentally target a developer's local/prod database.

const path = require('path');
const { spawnSync } = require('child_process');

// Load .env.test explicitly (and override any ambient env) before running prisma/vitest.
require('dotenv').config({
  path: path.resolve(__dirname, '..', '.env.test'),
  override: true,
});

// For tests we prefer a reachable connection string for migrations.
// Some environments cannot reach the direct Supabase host, but pooler works.
if (process.env.DATABASE_URL) {
  process.env.DIRECT_URL = process.env.DATABASE_URL;
}

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    stdio: 'inherit',
    shell: true,
    env: process.env,
  });

  if (result.status !== 0) {
    process.exit(result.status == null ? 1 : result.status);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('npx', ['vitest', 'run']);
