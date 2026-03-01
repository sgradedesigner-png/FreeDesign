import { PrismaClient } from '@prisma/client';
import { readFileSync } from 'fs';
import { join } from 'path';

const prisma = new PrismaClient();

async function applyRlsAndViews() {
  console.log('📦 Applying RLS and Views migration...');

  const sqlPath = join(__dirname, '../prisma/migrations/20260215093000_phase0_rls_views/migration.sql');
  const sql = readFileSync(sqlPath, 'utf-8');

  // Split SQL into individual statements (rough split by semicolons, skipping DO blocks)
  const statements = sql
    .split(/;(?![^$]*\$\$)/g) // Split by ; but not inside $$ blocks
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  let executed = 0;
  let failed = 0;

  for (const statement of statements) {
    if (!statement) continue;

    try {
      await prisma.$executeRawUnsafe(statement + ';');
      executed++;
      console.log(`✓ Executed statement ${executed}`);
    } catch (error: any) {
      // Ignore "already exists" errors
      if (error.code === 'P2010' && error.meta?.message?.includes('already exists')) {
        console.log(`⚠ Skipped (already exists): ${statement.substring(0, 50)}...`);
      } else {
        console.error(`✗ Failed: ${statement.substring(0, 100)}...`);
        console.error(error.message);
        failed++;
      }
    }
  }

  console.log(`\n📊 Summary: ${executed} executed, ${failed} failed`);

  if (failed > 0) {
    process.exit(1);
  }

  console.log('✅ RLS and Views applied successfully!');
  await prisma.$disconnect();
}

applyRlsAndViews();
