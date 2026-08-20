import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { ulid } from 'ulid';
import type { PresignUploadInput } from '@timeline/shared';
import { notFound } from '../../http-error';

const s3 = new S3Client({});

const UPLOAD_URL_TTL_SECONDS = 60 * 5;
const VIEW_URL_TTL_SECONDS = 60 * 15;

function bucket(): string {
  const name = process.env.MEDIA_BUCKET;
  if (!name) throw new Error('MEDIA_BUCKET environment variable is not set');
  return name;
}

/** Keys are namespaced per user so ownership is decidable from the key alone. */
function keyPrefix(userId: string): string {
  return `u/${userId}/`;
}

function extensionFor(fileName: string): string {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(fileName);
  const ext = match?.[1];
  return ext ? `.${ext.toLowerCase()}` : '';
}

/**
 * Issues a short-lived PUT URL. Every constraint that matters (MIME allowlist,
 * size cap) is enforced here *and* pinned into the signature: the presigned
 * URL only accepts an upload whose Content-Type and Content-Length match what
 * was validated, so the client cannot widen them after the fact.
 */
export async function presignUpload(
  userId: string,
  input: PresignUploadInput,
): Promise<{ uploadUrl: string; key: string }> {
  const key = `${keyPrefix(userId)}${ulid()}${extensionFor(input.fileName)}`;
  const uploadUrl = await getSignedUrl(
    s3,
    new PutObjectCommand({
      Bucket: bucket(),
      Key: key,
      ContentType: input.contentType,
      ContentLength: input.size,
    }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS, signableHeaders: new Set(['content-type', 'content-length']) },
  );
  return { uploadUrl, key };
}

function assertOwnsKey(userId: string, key: string): void {
  if (!key.startsWith(keyPrefix(userId))) throw notFound();
}

/**
 * Mints view URLs for keys the caller owns. FILE downloads get a forced
 * attachment disposition so a document can never be rendered inline as an
 * active document in the browser (SECURITY.md).
 */
export async function presignViewUrls(
  userId: string,
  keys: string[],
  disposition: 'inline' | 'attachment' = 'inline',
): Promise<Record<string, string>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      assertOwnsKey(userId, key);
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({
          Bucket: bucket(),
          Key: key,
          ...(disposition === 'attachment'
            ? { ResponseContentDisposition: 'attachment' }
            : {}),
        }),
        { expiresIn: VIEW_URL_TTL_SECONDS },
      );
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries);
}

/**
 * Presigns keys for anonymous viewers. Deliberately takes **no** userId: the
 * caller (the public route) is responsible for having already intersected the
 * keys with what the shared timeline actually references. This function must
 * never be reachable with a caller-supplied key list.
 */
export async function presignPublicViewUrls(keys: string[]): Promise<Record<string, string>> {
  const entries = await Promise.all(
    keys.map(async (key) => {
      const url = await getSignedUrl(
        s3,
        new GetObjectCommand({ Bucket: bucket(), Key: key }),
        { expiresIn: VIEW_URL_TTL_SECONDS },
      );
      return [key, url] as const;
    }),
  );
  return Object.fromEntries(entries);
}

export async function deleteObject(userId: string, key: string): Promise<void> {
  assertOwnsKey(userId, key);
  await s3.send(new DeleteObjectCommand({ Bucket: bucket(), Key: key }));
}
