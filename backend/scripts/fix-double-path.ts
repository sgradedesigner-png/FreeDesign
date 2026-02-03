// backend/scripts/fix-double-path.ts
// Fixes products uploaded to wrong path (products/products/{uuid}/ → {uuid}/)

import dotenv from 'dotenv';

// ✅ Load .env file FIRST
dotenv.config();

import { r2Client } from '../src/lib/r2';
import { prisma } from '../src/lib/prisma';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';

const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;
const R2_PUBLIC_DOMAIN = process.env.R2_PUBLIC_DOMAIN!;

async function fixDoublePath() {
  console.log('🔧 Starting migration: Fix double "products/" path...\n');

  // Step 1: List all objects under "products/" prefix
  console.log('📋 Step 1: Listing files with "products/" prefix...');

  const listResult = await r2Client.send(
    new ListObjectsV2Command({
      Bucket: R2_BUCKET_NAME,
      Prefix: 'products/',
    })
  );

  const objects = listResult.Contents || [];
  console.log(`   Found ${objects.length} files with "products/" prefix\n`);

  if (objects.length === 0) {
    console.log('✅ No files to migrate!');
    return;
  }

  // Step 2: Copy each file to new location and delete old
  console.log('🔄 Step 2: Moving files to correct location...');

  let movedCount = 0;
  const urlUpdates: { oldUrl: string; newUrl: string }[] = [];

  for (const obj of objects) {
    const oldKey = obj.Key!;

    // Remove "products/" prefix
    const newKey = oldKey.replace(/^products\//, '');

    console.log(`   Moving: ${oldKey}`);
    console.log(`        → ${newKey}`);

    try {
      // Copy to new location
      await r2Client.send(
        new CopyObjectCommand({
          Bucket: R2_BUCKET_NAME,
          CopySource: `${R2_BUCKET_NAME}/${oldKey}`,
          Key: newKey,
        })
      );

      // Delete old location
      await r2Client.send(
        new DeleteObjectCommand({
          Bucket: R2_BUCKET_NAME,
          Key: oldKey,
        })
      );

      movedCount++;

      // Track URL changes for database update
      const oldUrl = `https://${R2_PUBLIC_DOMAIN}/${oldKey}`;
      const newUrl = `https://${R2_PUBLIC_DOMAIN}/${newKey}`;
      urlUpdates.push({ oldUrl, newUrl });

      console.log(`   ✅ Moved successfully\n`);
    } catch (error) {
      console.error(`   ❌ Failed to move: ${error}\n`);
    }
  }

  console.log(`\n📊 Moved ${movedCount} files\n`);

  // Step 3: Update database image URLs
  console.log('💾 Step 3: Updating database image URLs...');

  let updatedProducts = 0;

  for (const { oldUrl, newUrl } of urlUpdates) {
    try {
      // Find products with this old URL
      const products = await prisma.product.findMany({
        where: {
          images: {
            has: oldUrl,
          },
        },
      });

      for (const product of products) {
        // Replace old URL with new URL in images array
        const updatedImages = product.images.map((img) =>
          img === oldUrl ? newUrl : img
        );

        await prisma.product.update({
          where: { id: product.id },
          data: { images: updatedImages },
        });

        updatedProducts++;
        console.log(`   ✅ Updated product: ${product.title} (${product.id})`);
      }
    } catch (error) {
      console.error(`   ❌ Failed to update database: ${error}`);
    }
  }

  console.log(`\n📊 Updated ${updatedProducts} products in database\n`);

  // Step 4: Summary
  console.log('✅ Migration complete!');
  console.log(`   Files moved: ${movedCount}`);
  console.log(`   Products updated: ${updatedProducts}`);
}

// Run migration
fixDoublePath()
  .then(() => {
    console.log('\n🎉 Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  });
