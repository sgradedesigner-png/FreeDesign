import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Note: Supabase auth handles passwords, not Prisma.
  // The user must be created in Supabase Auth first with email: admin@ecommerce.com.
  const adminId = 'admin-seed-id'; // Replace with actual Supabase user ID

  const profile = await prisma.profile.upsert({
    where: { id: adminId },
    update: { role: 'ADMIN' },
    create: {
      id: adminId,
      email: 'admin@ecommerce.com',
      name: 'Admin User',
      role: 'ADMIN',
    },
  });

  const printAreas = await Promise.all([
    prisma.printArea.upsert({
      where: { name: 'front' },
      update: {
        label: 'Front',
        labelEn: 'Front',
        maxWidthCm: 30,
        maxHeightCm: 40,
        sortOrder: 1,
        isActive: true,
      },
      create: {
        name: 'front',
        label: 'Front',
        labelEn: 'Front',
        maxWidthCm: 30,
        maxHeightCm: 40,
        sortOrder: 1,
      },
    }),
    prisma.printArea.upsert({
      where: { name: 'back' },
      update: {
        label: 'Back',
        labelEn: 'Back',
        maxWidthCm: 30,
        maxHeightCm: 40,
        sortOrder: 2,
        isActive: true,
      },
      create: {
        name: 'back',
        label: 'Back',
        labelEn: 'Back',
        maxWidthCm: 30,
        maxHeightCm: 40,
        sortOrder: 2,
      },
    }),
    prisma.printArea.upsert({
      where: { name: 'left_chest' },
      update: {
        label: 'Left Chest',
        labelEn: 'Left Chest',
        maxWidthCm: 12,
        maxHeightCm: 12,
        sortOrder: 3,
        isActive: true,
      },
      create: {
        name: 'left_chest',
        label: 'Left Chest',
        labelEn: 'Left Chest',
        maxWidthCm: 12,
        maxHeightCm: 12,
        sortOrder: 3,
      },
    }),
  ]);

  const printSizeTiers = await Promise.all([
    prisma.printSizeTier.upsert({
      where: { name: 'S' },
      update: {
        label: 'Small (15x15cm)',
        widthCm: 15,
        heightCm: 15,
        sortOrder: 1,
        isActive: true,
      },
      create: {
        name: 'S',
        label: 'Small (15x15cm)',
        widthCm: 15,
        heightCm: 15,
        sortOrder: 1,
      },
    }),
    prisma.printSizeTier.upsert({
      where: { name: 'M' },
      update: {
        label: 'Medium (20x20cm)',
        widthCm: 20,
        heightCm: 20,
        sortOrder: 2,
        isActive: true,
      },
      create: {
        name: 'M',
        label: 'Medium (20x20cm)',
        widthCm: 20,
        heightCm: 20,
        sortOrder: 2,
      },
    }),
    prisma.printSizeTier.upsert({
      where: { name: 'L' },
      update: {
        label: 'Large (30x30cm)',
        widthCm: 30,
        heightCm: 30,
        sortOrder: 3,
        isActive: true,
      },
      create: {
        name: 'L',
        label: 'Large (30x30cm)',
        widthCm: 30,
        heightCm: 30,
        sortOrder: 3,
      },
    }),
  ]);

  const frontArea = printAreas.find((area) => area.name === 'front');
  const sizeTierS = printSizeTiers.find((tier) => tier.name === 'S');
  const sizeTierM = printSizeTiers.find((tier) => tier.name === 'M');
  const sizeTierL = printSizeTiers.find((tier) => tier.name === 'L');

  if (!frontArea || !sizeTierS || !sizeTierM || !sizeTierL) {
    throw new Error('Seed prerequisite entities are missing');
  }

  const pricingRuleNames = [
    'PRINT_FEE_S',
    'PRINT_FEE_M',
    'PRINT_FEE_L',
    'EXTRA_SIDE_FEE',
    'QUANTITY_DISCOUNT_10_PLUS',
    'QUANTITY_DISCOUNT_25_PLUS',
    'RUSH_ORDER_FEE_1_9',
    'RUSH_ORDER_FEE_10_PLUS',
    'ADD_ON_INDIVIDUAL_POLYBAG',
    'ADD_ON_NECK_LABEL',
  ];

  await prisma.pricingRule.deleteMany({
    where: {
      name: {
        in: pricingRuleNames,
      },
    },
  });

  await prisma.pricingRule.createMany({
    data: [
      {
        name: 'PRINT_FEE_S',
        ruleType: 'PRINT_FEE',
        printSizeTierId: sizeTierS.id,
        printAreaId: frontArea.id,
        price: '8000',
        isActive: true,
      },
      {
        name: 'PRINT_FEE_M',
        ruleType: 'PRINT_FEE',
        printSizeTierId: sizeTierM.id,
        printAreaId: frontArea.id,
        price: '12000',
        isActive: true,
      },
      {
        name: 'PRINT_FEE_L',
        ruleType: 'PRINT_FEE',
        printSizeTierId: sizeTierL.id,
        printAreaId: frontArea.id,
        price: '17000',
        isActive: true,
      },
      {
        name: 'EXTRA_SIDE_FEE',
        ruleType: 'EXTRA_SIDE',
        price: '5000',
        isActive: true,
      },
      {
        name: 'QUANTITY_DISCOUNT_10_PLUS',
        ruleType: 'QUANTITY_DISCOUNT',
        minQuantity: 10,
        maxQuantity: 24,
        discountPercent: 5,
        price: '0',
        isActive: true,
      },
      {
        name: 'QUANTITY_DISCOUNT_25_PLUS',
        ruleType: 'QUANTITY_DISCOUNT',
        minQuantity: 25,
        discountPercent: 10,
        price: '0',
        isActive: true,
      },
      {
        name: 'RUSH_ORDER_FEE_1_9',
        ruleType: 'RUSH_FEE',
        price: '10000',
        minQuantity: 1,
        maxQuantity: 9,
        isActive: true,
      },
      {
        name: 'RUSH_ORDER_FEE_10_PLUS',
        ruleType: 'RUSH_FEE',
        price: '18000',
        minQuantity: 10,
        maxQuantity: null,
        isActive: true,
      },
      {
        name: 'ADD_ON_INDIVIDUAL_POLYBAG',
        ruleType: 'ADD_ON',
        price: '1500',
        isActive: true,
      },
      {
        name: 'ADD_ON_NECK_LABEL',
        ruleType: 'ADD_ON',
        price: '2500',
        isActive: true,
      },
    ],
  });

  console.log(`Admin profile seeded: ${profile.email}`);
  console.log(`Print areas seeded: ${printAreas.length}`);
  console.log(`Print size tiers seeded: ${printSizeTiers.length}`);
  console.log(`Pricing rules seeded: ${pricingRuleNames.length}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
