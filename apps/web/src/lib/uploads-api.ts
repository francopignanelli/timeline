import type { FileMimeType, ImageMimeType, PresignUploadInput, UploadKind } from '@timeline/shared';
import { FILE_MIME_TYPES, IMAGE_MIME_TYPES, LIMITS } from '@timeline/shared';
import { apiClient } from './api-client';

/** Mirrors the server-side allowlist so the picker can filter and fail fast. */
export function acceptFor(kind: UploadKind): string {
  return (kind === 'IMAGE' ? IMAGE_MIME_TYPES : FILE_MIME_TYPES).join(',');
}

export function maxBytesFor(kind: UploadKind): number {
  return kind === 'IMAGE' ? LIMITS.IMAGE_MAX_BYTES : LIMITS.FILE_MAX_BYTES;
}

// Type predicates rather than a boolean check: they narrow `File.type` from
// `string` to the allowlist union, so building a block needs no cast.
export function isImageMime(contentType: string): contentType is ImageMimeType {
  return (IMAGE_MIME_TYPES as readonly string[]).includes(contentType);
}

export function isFileMime(contentType: string): contentType is FileMimeType {
  return (FILE_MIME_TYPES as readonly string[]).includes(contentType);
}

/**
 * Two-step upload: the API validates and signs, then the browser PUTs straight
 * to S3 so file bytes never pass through Lambda. The Content-Type header must
 * match what was signed or S3 rejects the upload.
 */
export async function uploadFile(input: PresignUploadInput, file: File): Promise<string> {
  const { uploadUrl, key } = await apiClient.post<{ uploadUrl: string; key: string }>(
    '/uploads/presign',
    input,
  );

  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': file.type },
    body: file,
  });
  if (!res.ok) throw new Error(`Upload failed with status ${res.status}`);

  return key;
}

export function getViewUrls(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return Promise.resolve({});
  return apiClient
    .post<{ urls: Record<string, string> }>('/uploads/view-urls', { keys })
    .then((r) => r.urls);
}

export function getDownloadUrls(keys: string[]): Promise<Record<string, string>> {
  if (keys.length === 0) return Promise.resolve({});
  return apiClient
    .post<{ urls: Record<string, string> }>('/uploads/download-urls', { keys })
    .then((r) => r.urls);
}
