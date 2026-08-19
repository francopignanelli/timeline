/**
 * Stage lane assignment: greedy interval partitioning. Overlapping stages get
 * different lanes; the lowest free lane (closest to the axis) wins. Stages
 * that share a boundary day are treated as overlapping — both paint that day.
 * Deterministic: sorted by start, then longer first, then id.
 */

export interface LaneInterval {
  id: string;
  startDay: number;
  endDay: number;
}

export function assignLanes(intervals: LaneInterval[]): Map<string, number> {
  const sorted = [...intervals].sort(
    (a, b) => a.startDay - b.startDay || b.endDay - a.endDay || a.id.localeCompare(b.id),
  );
  const laneEnds: number[] = [];
  const lanes = new Map<string, number>();
  for (const interval of sorted) {
    let lane = laneEnds.findIndex((laneEnd) => laneEnd < interval.startDay);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(interval.endDay);
    } else {
      laneEnds[lane] = interval.endDay;
    }
    lanes.set(interval.id, lane);
  }
  return lanes;
}

export function laneCount(lanes: Map<string, number>): number {
  let max = -1;
  for (const lane of lanes.values()) max = Math.max(max, lane);
  return max + 1;
}
