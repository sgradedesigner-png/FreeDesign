import { readdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';

const rootDir = path.resolve(process.cwd(), 'src');
const checkOnly = process.argv.includes('--check');
const matches = [];

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!fullPath.endsWith('.js') && !fullPath.endsWith('.jsx')) continue;
    matches.push(fullPath);
  }
}

async function main() {
  try {
    const rootStats = await stat(rootDir);
    if (!rootStats.isDirectory()) {
      console.error(`src directory not found at ${rootDir}`);
      process.exit(1);
    }
  } catch {
    console.error(`src directory not found at ${rootDir}`);
    process.exit(1);
  }

  await walk(rootDir);

  if (checkOnly) {
    if (matches.length > 0) {
      console.error('Found JS artifacts under src/:');
      for (const file of matches) console.error(`- ${path.relative(process.cwd(), file)}`);
      process.exit(1);
    }
    console.log('No JS artifacts found under src/.');
    return;
  }

  for (const file of matches) {
    await rm(file, { force: true });
  }

  console.log(`Removed ${matches.length} JS artifact file(s) from src/.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
