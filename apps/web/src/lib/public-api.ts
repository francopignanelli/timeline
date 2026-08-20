import type {
  PublicMilestone,
  PublicStage,
  PublicTimeline,
  TimelineMilestoneRef,
  TimelineStageRef,
} from '@timeline/shared';

/**
 * Anonymous read client. Deliberately does **not** use `apiClient`: that
 * attaches a Cognito token, and these endpoints must work with no session at
 * all. A signed-in visitor opening a public link goes through this same path.
 */
const BASE_URL = import.meta.env.VITE_API_URL;

export interface PublicContent {
  milestones: { ref: TimelineMilestoneRef; milestone: PublicMilestone }[];
  stages: { ref: TimelineStageRef; stage: PublicStage }[];
}

export class PublicNotFoundError extends Error {}

async function publicRequest<T>(path: string, body?: unknown): Promise<T> {
  if (!BASE_URL) throw new Error('Missing API config: set VITE_API_URL.');
  const res = await fetch(`${BASE_URL}/public${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  // Every failure here is "no such public timeline" — an expired, revoked or
  // never-valid token are intentionally indistinguishable.
  if (!res.ok) throw new PublicNotFoundError(String(res.status));
  return (await res.json()) as T;
}

export function getPublicTimeline(token: string): Promise<PublicTimeline> {
  return publicRequest<PublicTimeline>(`/timelines/${token}`);
}

export function getPublicContent(token: string): Promise<PublicContent> {
  return publicRequest<PublicContent>(`/timelines/${token}/content`);
}

/** Media is addressed by block id; object keys never reach the client. */
export function getPublicMediaUrls(
  token: string,
  blockIds: string[],
): Promise<Record<string, string>> {
  if (blockIds.length === 0) return Promise.resolve({});
  return publicRequest<{ urls: Record<string, string> }>(`/timelines/${token}/media-urls`, {
    blockIds,
  }).then((r) => r.urls);
}
