const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const hoodie = await prisma.product.findUnique({
    where: { slug: 'blank-hoodie' },
    include: {
      variants: {
        select: {
          id: true,
          name: true,
          imagePath: true,
          galleryPaths: true
        }
      }
    }
  });

  console.log(JSON.stringify(hoodie, null, 2));

  await prisma.$disconnect();
})();
