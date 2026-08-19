import type { DatePrecision, TimeUnit, Visibility, Locale, ContentBlockType } from './constants';

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

export interface ContentBlock {
  id: string;
  type: ContentBlockType; // MVP: 'TEXT'; future types add their own fields
  order: number;
  text: string;
}

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

/** Link entity: per-Timeline presentation of a shared Milestone. */
export interface TimelineMilestoneRef {
  timelineId: string;
  milestoneId: string;
  displayOrder: number;
  isHighlighted: boolean;
  isHidden: boolean;
  addedAt: string;
}

/** Link entity: per-Timeline presentation of a shared Stage. */
export interface TimelineStageRef {
  timelineId: string;
  stageId: string;
  displayStyle?: string;
  isHighlighted: boolean;
  addedAt: string;
}
