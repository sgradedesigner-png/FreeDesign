import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';

describe('Signed Upload Intents', () => {
  it('can create and mark an upload intent as used', async () => {
    const intent = await prisma.uploadIntent.create({
      data: {
        userId: 'test-user-upload-intent',
        purpose: 'CUSTOMIZATION_DESIGN',
        folder: 'uploads/test-user-upload-intent/customization',
        publicId: 'test-public-id',
        contentType: 'image/png',
        originalFilename: 'test.png',
        requestedFileSizeBytes: 1234,
        maxBytes: 20 * 1024 * 1024,
        expiresAt: new Date(Date.now() + 5 * 60 * 1000),
        usedAt: null,
      },
    });

    expect(intent.id).toBeTruthy();
    expect(intent.usedAt).toBeNull();

    const updated = await prisma.uploadIntent.update({
      where: { id: intent.id },
      data: { usedAt: new Date() },
    });

    expect(updated.usedAt).not.toBeNull();
  });
});
