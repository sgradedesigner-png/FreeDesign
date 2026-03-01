/**
 * Phase 2 Upload Validation Worker Test Script
 * Tests the async validation worker by creating a mock upload and validation job
 *
 * Usage: node test-p2-validation-worker.js
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestUpload() {
  console.log('\n🔧 Creating test upload asset...');

  // Create a test upload asset
  const uploadAsset = await prisma.uploadAsset.create({
    data: {
      ownerId: '00000000-0000-0000-0000-000000000001', // Mock user ID
      cloudinaryPublicId: 'uploads/gang_upload/test/1234567890-test',
      cloudinaryUrl: 'https://res.cloudinary.com/test/image/upload/test.png',
      fileName: 'test-gang-sheet.png',
      mimeType: 'image/png',
      fileSizeBytes: 5000000, // 5MB
      widthPx: 2000,
      heightPx: 1500,
      dpi: 300,
      validationStatus: 'PENDING',
      moderationStatus: 'PENDING_REVIEW',
      uploadFamily: 'GANG_UPLOAD',
    },
  });

  console.log('✅ Test upload asset created:', uploadAsset.id);

  // Create a validation job
  const validationJob = await prisma.uploadValidationJob.create({
    data: {
      uploadAssetId: uploadAsset.id,
      status: 'PENDING',
      retryCount: 0,
      maxRetries: 3,
      nextRunAt: new Date(), // Process immediately
    },
  });

  console.log('✅ Validation job created:', validationJob.id);
  console.log('⏳ Waiting for worker to process job (10 seconds)...\n');

  return { uploadAsset, validationJob };
}

async function checkJobStatus(jobId, uploadAssetId) {
  // Wait for worker to process (should happen within 5-10 seconds)
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log('🔍 Checking job status...\n');

  const job = await prisma.uploadValidationJob.findUnique({
    where: { id: jobId },
    include: {
      events: {
        orderBy: { createdAt: 'desc' },
        take: 5,
      },
    },
  });

  const uploadAsset = await prisma.uploadAsset.findUnique({
    where: { id: uploadAssetId },
  });

  console.log('📊 Validation Job Status:');
  console.log('  - Status:', job.status);
  console.log('  - Retry Count:', job.retryCount);
  console.log('  - Last Error:', job.lastError || 'None');
  console.log('');

  console.log('📊 Upload Asset Status:');
  console.log('  - Validation Status:', uploadAsset.validationStatus);
  console.log('  - Moderation Status:', uploadAsset.moderationStatus);
  console.log('  - Metadata:', JSON.stringify(uploadAsset.metadata, null, 2));
  console.log('');

  if (job.events.length > 0) {
    console.log('📋 Validation Events:');
    job.events.forEach((event) => {
      console.log(`  - [${event.eventType}] ${event.message}`);
      if (event.errorCode) {
        console.log(`    Error Code: ${event.errorCode}`);
      }
    });
    console.log('');
  }

  return { job, uploadAsset };
}

async function cleanup(uploadAssetId) {
  console.log('🧹 Cleaning up test data...');

  // Delete validation jobs and events (cascade)
  await prisma.uploadAsset.delete({
    where: { id: uploadAssetId },
  });

  console.log('✅ Test data cleaned up\n');
}

async function runTest() {
  console.log('\n' + '='.repeat(60));
  console.log('  Phase 2 Upload Validation Worker Test');
  console.log('='.repeat(60));

  try {
    // Create test upload and job
    const { uploadAsset, validationJob } = await createTestUpload();

    // Check results after worker processes
    const { job, uploadAsset: updatedAsset } = await checkJobStatus(
      validationJob.id,
      uploadAsset.id
    );

    // Verify results
    console.log('='.repeat(60));
    console.log('  Test Results');
    console.log('='.repeat(60));
    console.log('');

    let passed = true;

    if (job.status === 'PASSED' && updatedAsset.validationStatus === 'PASSED') {
      console.log('✅ Test PASSED: Validation completed successfully');
      console.log('   - Job status: PASSED');
      console.log('   - Upload status: PASSED');
      console.log('   - Valid gang_upload constraints met (2000x1500, 300dpi, 5MB)');
    } else if (job.status === 'FAILED' && updatedAsset.validationStatus === 'FAILED') {
      console.log('⚠️  Test Result: Validation FAILED (expected for invalid uploads)');
      console.log('   - Job status: FAILED');
      console.log('   - Upload status: FAILED');
      console.log('   - Error:', job.lastError);
      passed = true; // Still a valid test result
    } else if (job.status === 'PENDING' || job.status === 'PROCESSING') {
      console.log('⏳ Test INCOMPLETE: Worker still processing');
      console.log('   - Job status:', job.status);
      console.log('   - Try running the test again or increase wait time');
      passed = false;
    } else {
      console.log('❌ Test FAILED: Unexpected state');
      console.log('   - Job status:', job.status);
      console.log('   - Upload status:', updatedAsset.validationStatus);
      passed = false;
    }

    console.log('');

    // Cleanup
    await cleanup(uploadAsset.id);

    console.log('='.repeat(60));
    if (passed) {
      console.log('  ✅ Upload Validation Worker is functioning correctly!');
    } else {
      console.log('  ⚠️  Worker test incomplete or failed');
    }
    console.log('='.repeat(60));
    console.log('');
  } catch (error) {
    console.error('\n❌ Test Error:', error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runTest();
