const { PrismaClient } = require('@prisma/client');

async function testConnection() {
  const prisma = new PrismaClient({
    log: ['error'],
  });

  try {
    await prisma.$connect();
    console.log('Database connection successful.');
    await prisma.$disconnect();
    process.exit(0);
  } catch (error) {
    console.error('Database connection failed:');
    console.error('Error:', error.message);
    console.error('\nConnection string from env:');
    console.error('DATABASE_URL:', process.env.DATABASE_URL?.replace(/:[^:@]+@/, ':***@'));
    process.exit(1);
  }
}

testConnection();
