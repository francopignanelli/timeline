import { describe, expect, it } from 'vitest';
import { parseYouTubeId, youTubeEmbedUrl } from './youtube';

const ID = 'dQw4w9WgXcQ';

describe('parseYouTubeId', () => {
  it('accepts the standard watch URL', () => {
    expect(parseYouTubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID);
  });

  it('accepts short, embed, shorts and live forms', () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID);
    expect(parseYouTubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID);
  });

  it('ignores extra query params and missing scheme', () => {
    expect(parseYouTubeId(`https://youtu.be/${ID}?t=42&si=abc`)).toBe(ID);
    expect(parseYouTubeId(`youtube.com/watch?v=${ID}&list=PL123`)).toBe(ID);
    expect(parseYouTubeId(`  https://m.youtube.com/watch?v=${ID}  `)).toBe(ID);
  });

  it('accepts a bare id', () => {
    expect(parseYouTubeId(ID)).toBe(ID);
  });

  it('rejects non-YouTube hosts even when the URL shape matches', () => {
    expect(parseYouTubeId(`https://evil.example.com/watch?v=${ID}`)).toBeNull();
    // Host must match exactly — a lookalike suffix must not pass.
    expect(parseYouTubeId(`https://notyoutube.com/watch?v=${ID}`)).toBeNull();
    expect(parseYouTubeId(`https://youtube.com.evil.example/watch?v=${ID}`)).toBeNull();
  });

  it('rejects malformed ids and junk', () => {
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId('   ')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/watch?v=tooshort')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/watch?v=way_too_long_to_be_an_id')).toBeNull();
    expect(parseYouTubeId('javascript:alert(1)')).toBeNull();
    expect(parseYouTubeId('https://www.youtube.com/')).toBeNull();
  });

  it('builds the embed URL only from a validated id', () => {
    expect(youTubeEmbedUrl(ID)).toBe(`https://www.youtube-nocookie.com/embed/${ID}`);
  });
});
