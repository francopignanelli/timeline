import type {
  DatePrecision,
  TimeUnit,
  Visibility,
  Locale,
  EntityColor,
  ImageMimeType,
  FileMimeType,
  Role,
  MemberScope,
  InvitationStatus,
} from './constants';

/**
 * A point or period boundary in domain time.
 * `date` is always a full calendar date and acts as the canonical anchor for
 * ordering and canvas placement; `precision` controls display and semantics.
 */
export interface PartialDate {
  date: string; // Date format: "DD/MM/YYYY", e.g. "28/10/2022"
  precision: DatePrecision;
}

export interface UserProfile {
  id: string; // Cognito sub
  username: string;
  displayName: string;
  bio?: string;
  location?: string;
  website?: string;
  /**
   * S3 object key of the avatar, never a URL — the bucket is private, so a
   * short-lived presigned URL is minted per view (SECURITY.md).
   *
   * Note there is no `email` here on purpose: it lives in Cognito and is read
   * from the ID token, so this record never becomes a second copy of it.
   */
  avatarKey?: string;
  locale: Locale;
  createdAt: string; // ISO 8601 datetime (system timestamp)
}

export interface Timeline {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  start: PartialDate;
  end?: PartialDate;
  ongoing: boolean;
  unit: TimeUnit;
  rulerVisible: boolean;
  visibility: Visibility;
  /**
   * Unguessable public-link token, minted when visibility leaves PRIVATE.
   * Deliberately separate from `id`: ULIDs are timestamp-prefixed and not
   * secret, and a token can be rotated to revoke a leaked link without
   * changing the timeline's identity (DECISIONS #36).
   */
  shareToken?: string;
  createdAt: string;
  updatedAt: string;
}

/** A collaborator on a Timeline or a single Milestone (DECISIONS #35). */
export interface Member {
  scope: MemberScope;
  resourceId: string;
  userId: string;
  /** Denormalized for display; username is immutable so it cannot drift. */
  username: string;
  displayName: string;
  role: Role;
  addedAt: string;
  addedBy: string;
}

export interface Invitation {
  id: string;
  scope: MemberScope;
  resourceId: string;
  /** Denormalized so the invitee can see what they're being invited to. */
  resourceTitle: string;
  inviteeId: string;
  inviterId: string;
  inviterName: string;
  role: Role;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
}

/**
 * What an owner is about to widen access to. Shown before a timeline-scoped
 * invite is sent, so the cross-timeline exposure is disclosed rather than
 * discovered (DECISIONS #35).
 */
export interface ShareImpact {
  milestoneCount: number;
  stageCount: number;
  /** Milestones on this timeline that also appear in other timelines. */
  sharedMilestoneCount: number;
}

interface BlockBase {
  id: string;
  order: number;
}

export interface TextBlock extends BlockBase {
  type: 'TEXT';
  text: string;
}

/**
 * Only the 11-character video id is stored, never a user-supplied URL: the
 * embed src is rebuilt from the id at render time, so a hostile string can
 * never reach the iframe (SECURITY.md — no raw user URLs in embeds).
 */
export interface YouTubeBlock extends BlockBase {
  type: 'YOUTUBE';
  youtubeId: string;
  caption?: string;
}

/**
 * Uploaded media. Only the S3 object key is stored — never a URL: the bucket
 * is private, so a short-lived presigned URL is minted per view and a stale
 * link in old data can never become a public one (SECURITY.md).
 */
interface UploadBlockBase extends BlockBase {
  s3Key: string;
  fileName: string;
  size: number;
}

export interface ImageBlock extends UploadBlockBase {
  type: 'IMAGE';
  // Narrowed to the allowlist so the type mirrors what the schema accepts —
  // an unsupported MIME type is unrepresentable, not just rejected at runtime.
  contentType: ImageMimeType;
  caption?: string;
}

export interface FileBlock extends UploadBlockBase {
  type: 'FILE';
  contentType: FileMimeType;
}

/** Discriminated on `type`; future media blocks (AUDIO/LINK) join this union. */
export type ContentBlock = TextBlock | YouTubeBlock | ImageBlock | FileBlock;

/**
 * A resolved `@username` reference. Resolved once at write time rather than
 * parsed at render: that keeps a stable `userId` (what a future notification
 * consumer needs) and avoids a username lookup per render (DECISIONS #37).
 */
export interface Mention {
  userId: string;
  username: string;
}

export interface Milestone {
  id: string;
  ownerId: string;
  title: string;
  date: PartialDate;
  blocks: ContentBlock[];
  mentions?: Mention[];
  createdAt: string;
  updatedAt: string;
}

export interface Stage {
  id: string;
  ownerId: string;
  title: string;
  description?: string;
  start: PartialDate;
  end?: PartialDate;
  ongoing: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Link entity: per-Timeline presentation of a shared Milestone.
 * `color` lives here, not on the Milestone, because color is presentation —
 * the same shared Milestone may legitimately read differently in two
 * timelines (product principle: presentation metadata lives on the link).
 */
export interface TimelineMilestoneRef {
  timelineId: string;
  milestoneId: string;
  displayOrder: number;
  isHighlighted: boolean;
  isHidden: boolean;
  color?: EntityColor;
  addedAt: string;
}

/** Link entity: per-Timeline presentation of a shared Stage. */
export interface TimelineStageRef {
  timelineId: string;
  stageId: string;
  displayStyle?: string;
  isHighlighted: boolean;
  color?: EntityColor;
  addedAt: string;
}

/**
 * What an anonymous visitor is allowed to see. A deliberate DTO, not the raw
 * item: `ownerId` and every other identifier is stripped so a public link
 * cannot be used to enumerate users (SECURITY.md).
 */
export type PublicTimeline = Omit<Timeline, 'ownerId' | 'shareToken'>;

/**
 * Media blocks drop `s3Key` on the way out: the key path embeds the owner's
 * user id. Anonymous viewers reference media by **block id** instead, which
 * the server maps back to a key it has already allowlisted.
 */
export type PublicContentBlock =
  | TextBlock
  | YouTubeBlock
  | Omit<ImageBlock, 's3Key'>
  | Omit<FileBlock, 's3Key'>;

export type PublicMilestone = Omit<Milestone, 'ownerId' | 'mentions' | 'blocks'> & {
  blocks: PublicContentBlock[];
  /** Usernames only — no user ids leak to anonymous visitors. */
  mentions?: { username: string }[];
};
export type PublicStage = Omit<Stage, 'ownerId'>;
