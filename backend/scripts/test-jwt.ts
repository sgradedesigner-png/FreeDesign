// Test JWT verification and Profile lookup
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { prisma } from '../src/lib/prisma';
import { Role } from '@prisma/client';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL;

if (!SUPABASE_URL) {
  console.error('❌ SUPABASE_URL not found in environment');
  process.exit(1);
}

console.log('✅ SUPABASE_URL:', SUPABASE_URL);

const JWKS = createRemoteJWKSet(new URL(`${SUPABASE_URL}/auth/v1/certs`));

async function testToken() {
  // Get token from command line
  const token = process.argv[2];

  if (!token) {
    console.error('Usage: npx ts-node scripts/test-jwt.ts <JWT_TOKEN>');
    console.log('\nTo get your token:');
    console.log('1. Open browser console on dashboard page');
    console.log('2. Run: localStorage.getItem("sb-access-token")');
    console.log('3. Copy the token and pass it here');
    process.exit(1);
  }

  try {
    console.log('\n🔍 Testing JWT token...\n');

    // Step 1: Verify JWT
    console.log('Step 1: Verifying JWT signature...');
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `${SUPABASE_URL}/auth/v1`,
      audience: 'authenticated',
    });

    console.log('✅ JWT signature valid!');
    console.log('Token payload:', JSON.stringify(payload, null, 2));

    const userId = payload.sub as string;

    // Step 2: Check Profile
    console.log('\n Step 2: Looking up Profile in database...');
    console.log('User ID:', userId);

    const profile = await prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true, email: true, id: true },
    });

    if (!profile) {
      console.error('❌ Profile not found in database for user:', userId);
      console.log('\nAll profiles in database:');
      const allProfiles = await prisma.profile.findMany();
      console.log(allProfiles);
      process.exit(1);
    }

    console.log('✅ Profile found:', profile);

    // Step 3: Check role
    console.log('\nStep 3: Checking role...');
    if (profile.role !== Role.ADMIN) {
      console.error('❌ User is not ADMIN. Role:', profile.role);
      process.exit(1);
    }

    console.log('✅ User has ADMIN role!');
    console.log('\n🎉 All checks passed! Token should work.');

  } catch (err: any) {
    console.error('\n❌ Error:', err.message);
    console.error('Full error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

testToken();
