import type { Timeline } from '@timeline/shared';
import { createTimelineSchema, type CreateTimelineInput } from '@timeline/shared';

/**
 * Phase 1 mock timeline store (localStorage-backed). Function signatures mirror
 * the REST contract in docs/API.md so Phase 5 swaps this module for the real
 * API client without touching the query hooks or components.
 */

const KEY = 'timeline.mock.timelines';
const MOCK_OWNER = 'mock-user';

const seeds: Timeline[] = [
  {
    id: 'seed-recitales',
    ownerId: MOCK_OWNER,
    title: 'Recitales',
    description: 'Every concert since the first one.',
    start: { date: '01/01/2016', precision: 'YEAR' },
    ongoing: true,
    unit: 'YEARS',
    rulerVisible: true,
    visibility: 'PRIVATE',
    createdAt: '2026-08-19T12:00:00.000Z',
    updatedAt: '2026-08-19T12:00:00.000Z',
  },
  {
    id: 'seed-carrera',
    ownerId: MOCK_OWNER,
    title: 'Carrera profesional',
    start: { date: '01/07/2022', precision: 'MONTH' },
    ongoing: true,
    unit: 'MONTHS',
    rulerVisible: true,
    visibility: 'PRIVATE',
    createdAt: '2026-08-19T12:01:00.000Z',
    updatedAt: '2026-08-19T12:01:00.000Z',
  },
  {
    id: 'seed-universidad',
    ownerId: MOCK_OWNER,
    title: 'Universidad',
    start: { date: '01/03/2020', precision: 'MONTH' },
    end: { date: '01/03/2026', precision: 'MONTH' },
    ongoing: false,
    unit: 'YEARS',
    rulerVisible: true,
    visibility: 'PRIVATE',
    createdAt: '2026-08-19T12:02:00.000Z',
    updatedAt: '2026-08-19T12:02:00.000Z',
  },
];

function load(): Timeline[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as Timeline[];
  } catch {
    // fall through to reseed
  }
  localStorage.setItem(KEY, JSON.stringify(seeds));
  return seeds;
}

function save(list: Timeline[]): void {
  localStorage.setItem(KEY, JSON.stringify(list));
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function listTimelines(): Promise<Timeline[]> {
  await delay(300);
  return load();
}

export async function getTimeline(id: string): Promise<Timeline | null> {
  await delay(200);
  return load().find((t) => t.id === id) ?? null;
}

export async function createTimeline(input: CreateTimelineInput): Promise<Timeline> {
  await delay(300);
  const data = createTimelineSchema.parse(input); // boundary validation, same as the API will do
  const now = new Date().toISOString();
  const timeline: Timeline = {
    id: crypto.randomUUID(), // real ULIDs arrive with the backend (DECISIONS #12)
    ownerId: MOCK_OWNER,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  save([...load(), timeline]);
  return timeline;
}
