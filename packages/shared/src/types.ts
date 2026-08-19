import type {
  DatePrecision,
  TimeUnit,
  Visibility,
  Locale,
  EntityColor,
  ImageMimeType,
  FileMimeType,
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
  createdAt: string;
  updatedAt: string;
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

export interface Milestone {
  id: string;
  ownerId: string;
  title: string;
  date: PartialDate;
  blocks: ContentBlock[];
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
