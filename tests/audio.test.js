import { test, expect } from 'bun:test';
import { noteFreq, parseTrack, trackBeats } from '../src/engine/audio.js';
import { SONGS, SFX, SFX_IDS } from '../src/content/music.js';

test('note frequencies', () => {
  expect(noteFreq('A4')).toBeCloseTo(440, 5);
  expect(noteFreq('A5')).toBeCloseTo(880, 5);
  expect(noteFreq('C4')).toBeCloseTo(261.626, 2);
});

test('parseTrack handles rests, dots, bars and triplets', () => {
  const ev = parseTrack('C5/4 r/8 E5/8. | G5/12');
  expect(ev.map(e => e.note)).toEqual(['C5', null, 'E5', 'G5']);
  expect(ev.map(e => e.dur)).toEqual([1, 0.5, 0.75, 1 / 3]);
  expect(ev[2].beat).toBe(1.5);
  expect(trackBeats('C5/4 r/8 E5/8. | G5/12')).toBeCloseTo(2.5833, 3);
});

test('every song parses and looping channels line up on whole bars', () => {
  for (const [id, song] of Object.entries(SONGS)) {
    const lens = ['p1', 'p2', 'tri', 'noise'].filter(c => song[c]).map(c => trackBeats(song[c]));
    expect(lens.length).toBeGreaterThan(0);
    if (song.loop) {
      for (const l of lens) expect(l).toBeCloseTo(lens[0], 6);
      expect(lens[0] % 4).toBeCloseTo(0, 6);
    }
  }
});

test('every sound the game emits exists', () => {
  for (const id of SFX_IDS) expect(SFX[id]).toBeDefined();
});

test('songs needed by stage 1 exist', () => {
  for (const id of ['title', 'map1', 'overworld', 'underground', 'sky', 'fortress', 'airship', 'boss', 'star', 'pswitch', 'hut', 'clear', 'death', 'gameover', 'worldclear', 'fortressclear']) {
    expect(SONGS[id]).toBeDefined();
  }
});
