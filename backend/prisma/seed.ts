import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  // 1. Нууц үг шифрлэх (Hash)
  // Та нэвтрэхдээ "admin123" гэж бичнэ
  const hashedPassword = await bcrypt.hash('admin123', 10);

  // 2. Хэрэглэгч үүсгэх
  const user = await prisma.user.upsert({
    where: { email: 'admin@ecommerce.com' },
    update: {}, // Хэрэв аль хэдийн байвал юу ч хийхгүй
    create: {
      email: 'admin@ecommerce.com',
      password: hashedPassword,
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created:', user.email);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });