import { describe, expect, it } from 'vitest';
import { extractMentionCandidates, extractMentionsFromBlocks, segmentMentions } from './mentions';

describe('extractMentionCandidates', () => {
  it('finds mentions at the start, middle and end of text', () => {
    expect(extractMentionCandidates('@ana said hi')).toEqual(['ana']);
    expect(extractMentionCandidates('thanks @ana for this')).toEqual(['ana']);
    expect(extractMentionCandidates('credit: @ana')).toEqual(['ana']);
  });

  it('de-duplicates repeated mentions', () => {
    expect(extractMentionCandidates('@ana and @ana again')).toEqual(['ana']);
  });

  it('finds several distinct mentions', () => {
    expect(extractMentionCandidates('@ana met @bob18')).toEqual(['ana', 'bob18']);
  });

  it('does not treat an email address as a mention', () => {
    expect(extractMentionCandidates('write to ana@example.com')).toEqual([]);
  });

  it('ignores usernames outside the valid charset or length', () => {
    expect(extractMentionCandidates('@Ana')).toEqual([]); // uppercase
    expect(extractMentionCandidates('@ab')).toEqual([]); // under 3 chars
    expect(extractMentionCandidates('@' + 'a'.repeat(16))).toEqual([]); // over 15
    expect(extractMentionCandidates('@ana_bob')).toEqual([]); // underscore not allowed
  });

  it('caps how many mentions one text can produce', () => {
    const many = Array.from({ length: 40 }, (_, i) => `@user${i}`).join(' ');
    expect(extractMentionCandidates(many).length).toBeLessThanOrEqual(20);
  });
});

describe('extractMentionsFromBlocks', () => {
  it('collects across text blocks and ignores non-text blocks', () => {
    const blocks = [
      { type: 'TEXT', text: 'hey @ana' },
      { type: 'YOUTUBE' },
      { type: 'TEXT', text: 'and @bob18 too' },
    ];
    expect(extractMentionsFromBlocks(blocks)).toEqual(['ana', 'bob18']);
  });
});

describe('segmentMentions', () => {
  it('marks only usernames confirmed to exist', () => {
    expect(segmentMentions('hi @ana and @ghost', ['ana'])).toEqual([
      { type: 'text', value: 'hi ' },
      { type: 'mention', value: 'ana' },
      { type: 'text', value: ' and @ghost' },
    ]);
  });

  it('returns the text untouched when nothing is known', () => {
    expect(segmentMentions('hi @ana', [])).toEqual([{ type: 'text', value: 'hi @ana' }]);
  });

  it('handles a mention at the very start', () => {
    expect(segmentMentions('@ana hi', ['ana'])).toEqual([
      { type: 'mention', value: 'ana' },
      { type: 'text', value: ' hi' },
    ]);
  });

  it('preserves the full text across multiple mentions', () => {
    const text = 'thanks @ana and @bob18 for the help';
    const rebuilt = segmentMentions(text, ['ana', 'bob18'])
      .map((s) => (s.type === 'mention' ? `@${s.value}` : s.value))
      .join('');
    expect(rebuilt).toBe(text);
  });
});
