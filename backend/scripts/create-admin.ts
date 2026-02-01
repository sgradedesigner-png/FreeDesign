// Script to create admin profile
import { PrismaClient, Role } from '@prisma/client';

const prisma = new PrismaClient();

async function createAdminProfile() {
  // ✅ USER ID-г command line-аас авах эсвэл default ашиглах
  const userId = process.argv[2] || '3a6cade0-ca82-4101-b35d-e5be6490928a';
  const email = process.argv[3] || 'admin@ecommerce.com';

  console.log(`Creating admin profile for: ${email} (${userId})`);

  try {
    console.log('Creating admin profile...');

    const profile = await prisma.profile.upsert({
      where: { id: userId },
      update: {
        role: Role.ADMIN,
        email: email,
      },
      create: {
        id: userId,
        role: Role.ADMIN,
        email: email,
      },
    });

    console.log('✅ Admin profile created successfully!');
    console.log(profile);

    // Verify
    const check = await prisma.profile.findUnique({
      where: { id: userId },
    });

    console.log('\n✅ Verification:');
    console.log(check);
  } catch (error) {
    console.error('❌ Error creating admin profile:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createAdminProfile();
