import type { UploadedDesignAsset } from '@/components/customize/DesignUploader';
import { addBreadcrumb, captureException } from '@/lib/sentry';

type UploadSignResponse = {
  intentId: string;
  uploadUrl: string;
  fields: {
    apiKey: string;
    timestamp: number;
    signature: string;
    folder: string;
    publicId: string;
  };
};

type UploadCompleteResponse = {
  asset: UploadedDesignAsset;
};

async function readJsonSafe(response: Response): Promise<any> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function attachRequestId(error: any, requestId: string | null): any {
  if (requestId && error && typeof error === 'object') {
    error.requestId = requestId;
  }

  return error;
}

export async function uploadCustomizationDesignSigned(params: {
  file: File;
  accessToken: string;
  apiBase: string;
}): Promise<UploadedDesignAsset> {
  const { file, accessToken, apiBase } = params;

  const signRes = await fetch(`${apiBase}/api/uploads/sign`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      purpose: 'CUSTOMIZATION_DESIGN',
      filename: file.name,
      contentType: file.type || 'application/octet-stream',
      fileSizeBytes: file.size,
    }),
  });

  const signRequestId = signRes.headers.get('x-request-id');

  const signData = (await readJsonSafe(signRes)) as Partial<UploadSignResponse> & {
    error?: string;
  };

  if (!signRes.ok) {
    const error = attachRequestId(
      new Error(signData?.error || 'Failed to start upload') as any,
      signRequestId
    );

    addBreadcrumb({
      message: 'upload_sign_failed',
      category: 'api',
      level: 'error',
      data: { status: signRes.status, requestId: signRequestId },
    });

    if (signRes.status >= 500) {
      captureException(error, { api: { path: '/api/uploads/sign', status: signRes.status } });
    }

    throw error;
  }

  if (!signData?.intentId || !signData?.uploadUrl || !signData?.fields) {
    throw new Error('Upload sign response is missing required fields');
  }

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', signData.fields.apiKey);
  form.append('timestamp', String(signData.fields.timestamp));
  form.append('signature', signData.fields.signature);
  form.append('folder', signData.fields.folder);
  form.append('public_id', signData.fields.publicId);

  const cloudRes = await fetch(signData.uploadUrl, {
    method: 'POST',
    body: form,
  });

  const cloudJson = await readJsonSafe(cloudRes);
  if (!cloudRes.ok) {
    const cloudErrorMsg = cloudJson?.error?.message;
    throw new Error(cloudErrorMsg || 'Cloud upload failed');
  }

  const completeRes = await fetch(`${apiBase}/api/uploads/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      intentId: signData.intentId,
    }),
  });

  const completeRequestId = completeRes.headers.get('x-request-id');

  const completeData = (await readJsonSafe(completeRes)) as Partial<UploadCompleteResponse> & {
    error?: string;
  };

  if (!completeRes.ok) {
    const error = attachRequestId(
      new Error(completeData?.error || 'Failed to complete upload') as any,
      completeRequestId
    );

    addBreadcrumb({
      message: 'upload_complete_failed',
      category: 'api',
      level: 'error',
      data: { status: completeRes.status, requestId: completeRequestId },
    });

    if (completeRes.status >= 500) {
      captureException(error, {
        api: { path: '/api/uploads/complete', status: completeRes.status },
      });
    }

    throw error;
  }

  if (!completeData?.asset?.id) {
    throw new Error('Upload complete response is missing asset');
  }

  return completeData.asset;
}
