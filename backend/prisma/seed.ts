import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Note: Supabase auth handles passwords, not Prisma
  // This seed file creates a Profile entry for an admin user
  // The user must be created in Supabase Auth first with email: admin@ecommerce.com

  const adminId = 'admin-seed-id'; // Replace with actual Supabase user ID

  // Create admin profile
  const profile = await prisma.profile.upsert({
    where: { id: adminId },
    update: { role: 'ADMIN' }, // Update role if exists
    create: {
      id: adminId,
      email: 'admin@ecommerce.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin profile created:', profile.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });