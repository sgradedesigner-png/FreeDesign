import { prisma } from '../src/lib/prisma';

async function checkDatabase() {
  console.log('🔍 Checking database tables and counts...\n');

  try {
    // Check all tables
    const results = {
      profiles: await prisma.profile.count(),
      categories: await prisma.category.count(),
      products: await prisma.product.count(),
      productVariants: await prisma.productVariant.count(),
      orders: await prisma.order.count(),
      paymentWebhookLog: await prisma.paymentWebhookLog.count(),
    };

    console.log('📊 Table Counts:');
    console.log('━'.repeat(50));

    Object.entries(results).forEach(([table, count]) => {
      const status = count === 0 ? '❌ EMPTY' : '✅ Has data';
      console.log(`${table.padEnd(25)} ${count.toString().padStart(5)} rows  ${status}`);
    });

    console.log('━'.repeat(50));
    console.log(`\n📝 Total records: ${Object.values(results).reduce((a, b) => a + b, 0)}`);

    // Sample some data
    console.log('\n📦 Sample Data:');
    console.log('━'.repeat(50));

    if (results.profiles > 0) {
      const profiles = await prisma.profile.findMany({ take: 3, select: { email: true, role: true } });
      console.log('\nProfiles (sample):');
      profiles.forEach(p => console.log(`  - ${p.email} (${p.role})`));
    } else {
      console.log('\n❌ Profiles: EMPTY (all users deleted by tests!)');
    }

    if (results.products > 0) {
      const products = await prisma.product.findMany({ take: 3, select: { title: true, basePrice: true } });
      console.log('\nProducts (sample):');
      products.forEach(p => console.log(`  - ${p.title} - $${p.basePrice}`));
    } else {
      console.log('\n❌ Products: EMPTY (all products deleted by tests!)');
    }

    if (results.categories > 0) {
      const categories = await prisma.category.findMany({ take: 3, select: { name: true } });
      console.log('\nCategories (sample):');
      categories.forEach(c => console.log(`  - ${c.name}`));
    } else {
      console.log('\n❌ Categories: EMPTY (all categories deleted by tests!)');
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkDatabase();
