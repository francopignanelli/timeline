import type { Milestone, Stage, TimelineMilestoneRef, TimelineStageRef } from '@timeline/shared';

/**
 * Phase 2 mock content store (milestones, stages, and their timeline links).
 * Mirrors GET /timelines/{id}/content from docs/API.md; Phase 5/6 swap this
 * for the real API client. Seeds intentionally exercise the canvas layout:
 * a same-day + adjacent-day milestone cluster, overlapping stages with lane
 * reuse, and one milestone shared by two timelines.
 */

const MILESTONES_KEY = 'timeline.mock.milestones';
const STAGES_KEY = 'timeline.mock.stages';
const TM_LINKS_KEY = 'timeline.mock.timelineMilestones';
const TS_LINKS_KEY = 'timeline.mock.timelineStages';

const OWNER = 'mock-user';
const T0 = '2026-08-19T12:00:00.000Z';

const milestoneSeeds: Milestone[] = [
  {
    id: 'm-primer-recital',
    ownerId: OWNER,
    title: 'Primer recital — La Renga',
    date: { date: '15/06/2016', precision: 'APPROXIMATE' },
    blocks: [
      { id: 'b1', type: 'TEXT', order: 0, text: 'No recuerdo la fecha exacta, pero fue en 2016.' },
    ],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-cerati',
    ownerId: OWNER,
    title: 'Tributo a Cerati',
    date: { date: '01/09/2019', precision: 'MONTH' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-lolla-previa',
    ownerId: OWNER,
    title: 'Lollapalooza — Previa',
    date: { date: '18/03/2022', precision: 'DAY' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-lolla-1',
    ownerId: OWNER,
    title: 'Lollapalooza — Día 1',
    date: { date: '18/03/2022', precision: 'DAY' },
    blocks: [{ id: 'b1', type: 'TEXT', order: 0, text: 'Día 1: Miley Cyrus, Doja Cat.' }],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-lolla-2',
    ownerId: OWNER,
    title: 'Lollapalooza — Día 2',
    date: { date: '19/03/2022', precision: 'DAY' },
    blocks: [{ id: 'b1', type: 'TEXT', order: 0, text: 'Día 2: Foo Fighters. Último show de Taylor Hawkins en Argentina.' }],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-coldplay',
    ownerId: OWNER,
    title: 'Coldplay — River Plate',
    date: { date: '28/10/2022', precision: 'DAY' },
    blocks: [
      { id: 'b1', type: 'TEXT', order: 0, text: 'Primera vez viendo a Coldplay. Inolvidable.' },
      { id: 'b2', type: 'TEXT', order: 1, text: 'Fueron diez River seguidos — nosotros estuvimos en el segundo.' },
    ],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-piojos',
    ownerId: OWNER,
    title: 'Los Piojos — Regreso',
    date: { date: '01/12/2024', precision: 'MONTH' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-ingreso',
    ownerId: OWNER,
    title: 'Ingreso a la facultad',
    date: { date: '02/03/2020', precision: 'DAY' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-primer-final',
    ownerId: OWNER,
    title: 'Primer final aprobado',
    date: { date: '01/07/2021', precision: 'MONTH' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-mitad',
    ownerId: OWNER,
    title: 'Mitad de la carrera',
    date: { date: '01/06/2023', precision: 'APPROXIMATE' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-primer-trabajo',
    ownerId: OWNER,
    title: 'Primer trabajo',
    date: { date: '01/07/2022', precision: 'MONTH' },
    blocks: [
      { id: 'b1', type: 'TEXT', order: 0, text: 'Primer trabajo en tecnología, todavía cursando.' },
    ],
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'm-ascenso',
    ownerId: OWNER,
    title: 'Ascenso',
    date: { date: '01/03/2025', precision: 'MONTH' },
    blocks: [],
    createdAt: T0,
    updatedAt: T0,
  },
];

const stageSeeds: Stage[] = [
  {
    id: 'st-cursada',
    ownerId: OWNER,
    title: 'Cursada',
    start: { date: '01/03/2020', precision: 'MONTH' },
    end: { date: '01/12/2025', precision: 'MONTH' },
    ongoing: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'st-pasantia',
    ownerId: OWNER,
    title: 'Pasantía',
    start: { date: '01/07/2023', precision: 'MONTH' },
    end: { date: '01/07/2024', precision: 'MONTH' },
    ongoing: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'st-tesis',
    ownerId: OWNER,
    title: 'Tesis',
    start: { date: '01/03/2025', precision: 'MONTH' },
    end: { date: '01/03/2026', precision: 'MONTH' },
    ongoing: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'st-freelance',
    ownerId: OWNER,
    title: 'Freelance',
    start: { date: '01/07/2022', precision: 'MONTH' },
    end: { date: '01/03/2025', precision: 'MONTH' },
    ongoing: false,
    createdAt: T0,
    updatedAt: T0,
  },
  {
    id: 'st-gcba',
    ownerId: OWNER,
    title: 'GCBA',
    start: { date: '01/07/2024', precision: 'MONTH' },
    ongoing: true,
    createdAt: T0,
    updatedAt: T0,
  },
];

const tmRef = (
  timelineId: string,
  milestoneId: string,
  displayOrder: number,
  isHighlighted = false,
): TimelineMilestoneRef => ({
  timelineId,
  milestoneId,
  displayOrder,
  isHighlighted,
  isHidden: false,
  addedAt: T0,
});

const tsRef = (timelineId: string, stageId: string): TimelineStageRef => ({
  timelineId,
  stageId,
  isHighlighted: false,
  addedAt: T0,
});

const tmLinkSeeds: TimelineMilestoneRef[] = [
  tmRef('seed-recitales', 'm-primer-recital', 0),
  tmRef('seed-recitales', 'm-cerati', 1),
  tmRef('seed-recitales', 'm-lolla-previa', 2),
  tmRef('seed-recitales', 'm-lolla-1', 3),
  tmRef('seed-recitales', 'm-lolla-2', 4),
  tmRef('seed-recitales', 'm-coldplay', 5, true),
  tmRef('seed-recitales', 'm-piojos', 6),
  tmRef('seed-universidad', 'm-ingreso', 0),
  tmRef('seed-universidad', 'm-primer-final', 1),
  tmRef('seed-universidad', 'm-mitad', 2),
  // Shared milestone: appears in both Universidad and Carrera.
  tmRef('seed-universidad', 'm-primer-trabajo', 3),
  tmRef('seed-carrera', 'm-primer-trabajo', 0),
  tmRef('seed-carrera', 'm-ascenso', 1),
];

const tsLinkSeeds: TimelineStageRef[] = [
  tsRef('seed-universidad', 'st-cursada'),
  tsRef('seed-universidad', 'st-pasantia'),
  tsRef('seed-universidad', 'st-tesis'),
  tsRef('seed-carrera', 'st-freelance'),
  tsRef('seed-carrera', 'st-gcba'),
];

function loadOrSeed<T>(key: string, seeds: T[]): T[] {
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T[];
  } catch {
    // fall through to reseed
  }
  localStorage.setItem(key, JSON.stringify(seeds));
  return seeds;
}

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export interface TimelineContent {
  milestones: { ref: TimelineMilestoneRef; milestone: Milestone }[];
  stages: { ref: TimelineStageRef; stage: Stage }[];
}

export async function getTimelineContent(timelineId: string): Promise<TimelineContent> {
  await delay(250);
  const milestones = loadOrSeed(MILESTONES_KEY, milestoneSeeds);
  const stages = loadOrSeed(STAGES_KEY, stageSeeds);
  const tmLinks = loadOrSeed(TM_LINKS_KEY, tmLinkSeeds);
  const tsLinks = loadOrSeed(TS_LINKS_KEY, tsLinkSeeds);

  const milestoneById = new Map(milestones.map((m) => [m.id, m]));
  const stageById = new Map(stages.map((s) => [s.id, s]));

  return {
    milestones: tmLinks
      .filter((ref) => ref.timelineId === timelineId)
      .flatMap((ref) => {
        const milestone = milestoneById.get(ref.milestoneId);
        return milestone ? [{ ref, milestone }] : [];
      }),
    stages: tsLinks
      .filter((ref) => ref.timelineId === timelineId)
      .flatMap((ref) => {
        const stage = stageById.get(ref.stageId);
        return stage ? [{ ref, stage }] : [];
      }),
  };
}

/** AP10 equivalent: how many timelines reference this milestone. */
export async function countTimelinesReferencing(milestoneId: string): Promise<number> {
  await delay(120);
  const tmLinks = loadOrSeed(TM_LINKS_KEY, tmLinkSeeds);
  return tmLinks.filter((ref) => ref.milestoneId === milestoneId).length;
}
