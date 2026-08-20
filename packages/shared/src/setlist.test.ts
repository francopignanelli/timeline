import { describe, expect, it } from 'vitest';
import { parseSetlistId } from './setlist';

const URL_ = 'https://www.setlist.fm/setlist/gorillaz/2017/tecnopolis-villa-martelli-argentina-1be1a1b8.html';

describe('parseSetlistId', () => {
  it('extracts the id from a full setlist URL', () => {
    expect(parseSetlistId(URL_)).toBe('1be1a1b8');
  });

  it('tolerates a missing scheme, www, mobile host and surrounding spaces', () => {
    expect(parseSetlistId('  setlist.fm/setlist/a/2017/b-1be1a1b8.html  ')).toBe('1be1a1b8');
    expect(parseSetlistId('https://m.setlist.fm/setlist/a/2017/b-1be1a1b8.html')).toBe('1be1a1b8');
  });

  it('ignores query strings and fragments', () => {
    expect(parseSetlistId(`${URL_}?utm_source=x#songs`)).toBe('1be1a1b8');
  });

  it('accepts a bare id', () => {
    expect(parseSetlistId('1be1a1b8')).toBe('1be1a1b8');
  });

  it('rejects non-setlist.fm hosts even when the path shape matches', () => {
    expect(parseSetlistId('https://evil.example.com/setlist/a/2017/b-1be1a1b8.html')).toBeNull();
    // A lookalike suffix must not pass.
    expect(parseSetlistId('https://setlist.fm.evil.example/setlist/a/b-1be1a1b8.html')).toBeNull();
    expect(parseSetlistId('https://notsetlist.fm/setlist/a/b-1be1a1b8.html')).toBeNull();
  });

  it('rejects junk and malformed ids', () => {
    expect(parseSetlistId('')).toBeNull();
    expect(parseSetlistId('   ')).toBeNull();
    expect(parseSetlistId('javascript:alert(1)')).toBeNull();
    expect(parseSetlistId('https://www.setlist.fm/')).toBeNull();
    // Non-hex characters are not setlist ids.
    expect(parseSetlistId('https://www.setlist.fm/setlist/a/2017/b-zzzzzzzz.html')).toBeNull();
  });
});
