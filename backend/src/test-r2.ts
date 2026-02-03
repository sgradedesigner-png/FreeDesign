// Test R2 Connection
import { S3Client, ListBucketsCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import https from 'https';
import crypto from 'crypto';
import * as dotenv from 'dotenv';

dotenv.config();

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID!;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID!;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY!;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME!;

console.log('\n========== R2 CONNECTION TEST ==========\n');
console.log('Account ID:', R2_ACCOUNT_ID);
console.log('Bucket:', R2_BUCKET_NAME);
console.log('Endpoint:', `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);

// Test 1: Basic S3 Client
async function testBasicClient() {
  console.log('\n[Test 1] Testing basic S3 client...');

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const command = new ListBucketsCommand({});
    const response = await client.send(command);

    console.log('✅ Basic client works!');
    console.log('Buckets:', response.Buckets?.map(b => b.Name).join(', '));
    return true;
  } catch (error: any) {
    console.error('❌ Basic client failed:', error.message);
    console.error('Error code:', error.code);
    return false;
  }
}

// Test 2: Client with SSL workarounds
async function testWithSSLWorkarounds() {
  console.log('\n[Test 2] Testing with SSL workarounds...');

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      secureOptions: crypto.constants.SSL_OP_NO_SSLv2 |
                     crypto.constants.SSL_OP_NO_SSLv3 |
                     crypto.constants.SSL_OP_NO_TLSv1 |
                     crypto.constants.SSL_OP_NO_TLSv1_1,
      checkServerIdentity: () => undefined,
    });

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      requestHandler: new NodeHttpHandler({
        httpsAgent,
        connectionTimeout: 30000,
        requestTimeout: 60000,
      }),
    });

    const command = new ListBucketsCommand({});
    const response = await client.send(command);

    console.log('✅ SSL workaround client works!');
    console.log('Buckets:', response.Buckets?.map(b => b.Name).join(', '));
    return true;
  } catch (error: any) {
    console.error('❌ SSL workaround client failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error details:', error);
    return false;
  }
}

// Test 3: Upload test file
async function testUpload() {
  console.log('\n[Test 3] Testing file upload...');

  try {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
      keepAlive: true,
      minVersion: 'TLSv1.2',
      maxVersion: 'TLSv1.3',
      secureOptions: crypto.constants.SSL_OP_NO_SSLv2 |
                     crypto.constants.SSL_OP_NO_SSLv3 |
                     crypto.constants.SSL_OP_NO_TLSv1 |
                     crypto.constants.SSL_OP_NO_TLSv1_1,
      checkServerIdentity: () => undefined,
    });

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
      requestHandler: new NodeHttpHandler({
        httpsAgent,
        connectionTimeout: 30000,
        requestTimeout: 60000,
      }),
    });

    const testContent = Buffer.from('Test file content - ' + new Date().toISOString());
    const testKey = `test/test-${Date.now()}.txt`;

    console.log('Uploading test file:', testKey);

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: testKey,
      Body: testContent,
      ContentType: 'text/plain',
    });

    const response = await client.send(command);

    console.log('✅ Upload successful!');
    console.log('ETag:', response.ETag);
    console.log('Key:', testKey);
    return true;
  } catch (error: any) {
    console.error('❌ Upload failed:', error.message);
    console.error('Error code:', error.code);
    console.error('Error syscall:', error.syscall);
    console.error('Full error:', error);
    return false;
  }
}

// Run all tests
async function runTests() {
  const test1 = await testBasicClient();
  const test2 = await testWithSSLWorkarounds();
  const test3 = await testUpload();

  console.log('\n========== TEST SUMMARY ==========');
  console.log('Basic Client:', test1 ? '✅ PASS' : '❌ FAIL');
  console.log('SSL Workaround Client:', test2 ? '✅ PASS' : '❌ FAIL');
  console.log('Upload Test:', test3 ? '✅ PASS' : '❌ FAIL');
  console.log('==================================\n');

  if (test1 || test2 || test3) {
    console.log('✅ At least one method works! Use the working configuration.');
  } else {
    console.log('❌ All methods failed. This is a Windows SSL/TLS compatibility issue with Cloudflare R2.');
    console.log('\nPossible solutions:');
    console.log('1. Use presigned URLs (generate on backend, upload from frontend)');
    console.log('2. Use HTTP proxy');
    console.log('3. Deploy backend to Linux (WSL, Docker, or cloud)');
    console.log('4. Use alternative storage (Supabase Storage)');
  }
}

runTests().catch(console.error);
