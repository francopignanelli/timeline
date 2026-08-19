import { describe, it, expect } from 'vitest';
import { assignLanes, laneCount } from './lane-layout';

describe('assignLanes', () => {
  it('keeps non-overlapping stages in lane 0', () => {
    const lanes = assignLanes([
      { id: 'a', startDay: 0, endDay: 10 },
      { id: 'b', startDay: 11, endDay: 20 },
      { id: 'c', startDay: 21, endDay: 30 },
    ]);
    expect([...lanes.values()]).toEqual([0, 0, 0]);
  });

  it('separates overlapping stages and reuses freed lanes', () => {
    const lanes = assignLanes([
      { id: 'cursada', startDay: 0, endDay: 100 },
      { id: 'pasantia', startDay: 40, endDay: 60 }, // overlaps cursada → lane 1
      { id: 'tesis', startDay: 80, endDay: 120 }, // overlaps cursada; pasantía ended → lane 1 again
    ]);
    expect(lanes.get('cursada')).toBe(0);
    expect(lanes.get('pasantia')).toBe(1);
    expect(lanes.get('tesis')).toBe(1);
    expect(laneCount(lanes)).toBe(2);
  });

  it('treats a shared boundary day as an overlap', () => {
    const lanes = assignLanes([
      { id: 'a', startDay: 0, endDay: 10 },
      { id: 'b', startDay: 10, endDay: 20 }, // both paint day 10
    ]);
    expect(lanes.get('a')).not.toBe(lanes.get('b'));
  });

  it('stacks fully concurrent stages in distinct lanes', () => {
    const lanes = assignLanes([
      { id: 'a', startDay: 0, endDay: 50 },
      { id: 'b', startDay: 0, endDay: 50 },
      { id: 'c', startDay: 0, endDay: 50 },
    ]);
    expect(new Set(lanes.values()).size).toBe(3);
    expect(laneCount(lanes)).toBe(3);
  });

  it('prefers the lane closest to the axis and is deterministic', () => {
    const intervals = [
      { id: 'long', startDay: 0, endDay: 100 },
      { id: 'early', startDay: 10, endDay: 20 },
      { id: 'late', startDay: 30, endDay: 40 },
    ];
    const first = assignLanes(intervals);
    const second = assignLanes([...intervals].reverse());
    expect(first).toEqual(second);
    expect(first.get('early')).toBe(1);
    expect(first.get('late')).toBe(1);
  });

  it('gives longer stages the lower lane on identical starts', () => {
    const lanes = assignLanes([
      { id: 'short', startDay: 0, endDay: 10 },
      { id: 'long', startDay: 0, endDay: 100 },
    ]);
    expect(lanes.get('long')).toBe(0);
    expect(lanes.get('short')).toBe(1);
  });
});
