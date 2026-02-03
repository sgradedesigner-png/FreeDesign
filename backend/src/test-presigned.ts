// Test Presigned URL Generation
import * as dotenv from 'dotenv';
dotenv.config();

import { generateProductImageUploadUrl } from './lib/r2-presigned';

async function testPresignedGeneration() {
  console.log('\n========== TESTING PRESIGNED URL GENERATION ==========\n');

  try {
    console.log('Generating presigned URL...');

    const result = await generateProductImageUploadUrl(
      'test-product-123',
      'test-image.jpg',
      'image/jpeg'
    );

    console.log('\n✅ SUCCESS! Presigned URL generated without SSL error!\n');
    console.log('Upload URL length:', result.uploadUrl.length);
    console.log('Public URL:', result.publicUrl);
    console.log('Key:', result.key);
    console.log('\n✨ This method works because it only SIGNS the URL, doesn\'t upload!');
    console.log('✨ The actual upload will happen from the browser to R2 directly!');

  } catch (error: any) {
    console.error('\n❌ FAILED:', error.message);
    console.error('Error:', error);
  }
}

testPresignedGeneration();
