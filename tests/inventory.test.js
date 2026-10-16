import { test, expect } from 'bun:test';
import { addItem, useItem, addCard, MAX_ITEMS } from '../src/game/inventory.js';

test('inventory holds 28 items', () => {
  const inv = [];
  for (let i = 0; i < 30; i++) addItem(inv, 'berry');
  expect(inv.length).toBe(MAX_ITEMS);
});

test('using items changes form or grants a star', () => {
  const inv = ['berry', 'leaf', 'star', 'blossom'];
  expect(useItem(inv, 0, { form: 'big' })).toBe(null);
  expect(inv.length).toBe(4);
  expect(useItem(inv, 0, { form: 'small' })).toEqual({ form: 'big' });
  expect(useItem(inv, 0, { form: 'big' })).toEqual({ form: 'leaf' });
  expect(useItem(inv, 0, { form: 'leaf' })).toEqual({ star: true });
  expect(useItem(inv, 0, { form: 'small' })).toEqual({ form: 'fire' });
  expect(inv).toEqual([]);
});

test('three goal cards pay out lives and reset', () => {
  let r = addCard([], 2); r = addCard(r.cards, 2); r = addCard(r.cards, 2);
  expect(r).toEqual({ cards: [], lives: 5 });
  r = addCard([0, 1], 2);
  expect(r).toEqual({ cards: [], lives: 1 });
  r = addCard([0], -1);
  expect(r).toEqual({ cards: [0], lives: 0 });
  r = addCard([0, 0], 0);
  expect(r.lives).toBe(2);
  r = addCard([1, 1], 1);
  expect(r.lives).toBe(3);
});
