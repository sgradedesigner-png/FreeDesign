import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function listAllTables() {
  try {
    console.log('\n=== SUPABASE DATABASE TABLES ===\n');

    // Query to get all tables from public schema
    const tables: any[] = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `;

    if (tables.length === 0) {
      console.log('No tables found in the database.');
    } else {
      tables.forEach((row, index) => {
        console.log(`${index + 1}. ${row.table_name}`);
      });
      console.log(`\nTotal: ${tables.length} tables`);
    }

    // Also get table with column counts
    console.log('\n=== TABLE DETAILS ===\n');
    const tableDetails: any[] = await prisma.$queryRaw`
      SELECT
        t.table_name,
        COUNT(c.column_name) as column_count
      FROM information_schema.tables t
      LEFT JOIN information_schema.columns c
        ON t.table_name = c.table_name
        AND t.table_schema = c.table_schema
      WHERE t.table_schema = 'public'
      AND t.table_type = 'BASE TABLE'
      GROUP BY t.table_name
      ORDER BY t.table_name;
    `;

    tableDetails.forEach((row) => {
      console.log(`${row.table_name.padEnd(30)} (${row.column_count} columns)`);
    });

  } catch (error: any) {
    console.error('Error querying database:', error.message);
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

listAllTables();
