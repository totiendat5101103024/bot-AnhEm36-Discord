'use strict';

/**
 * poker.test.js — kiểm tra evaluator poker (5 lá và 7 lá).
 */

const { test, assert, eq, throws } = require('./harness');
const { evaluate5, evaluate, compare, handName } = require('../games/poker/evaluator');

const c = (r, s) => ({ r, s });

test('high card: A-J-8-5-2', () => {
    const r = evaluate5([c(14, 0), c(11, 1), c(8, 2), c(5, 1), c(2, 3)]);
    eq(r.cat, 0, 'hạng');
    eq(r.tie, [14, 11, 8, 5, 2], 'tie');
    eq(handName(r), 'Mậu thầu (High Card)');
});

test('pair: 10-10-A-7-3', () => {
    const r = evaluate5([c(10, 0), c(10, 1), c(14, 2), c(7, 3), c(3, 0)]);
    eq(r.cat, 1, 'hạng');
    eq(r.tie, [10, 14, 7, 3], 'tie');
});

test('two pair: J-J-4-4-A', () => {
    const r = evaluate5([c(11, 0), c(11, 1), c(4, 2), c(4, 3), c(14, 0)]);
    eq(r.cat, 2, 'hạng');
    eq(r.tie, [11, 4, 14], 'tie');
});

test('three of a kind: 7-7-7-K-2', () => {
    const r = evaluate5([c(7, 0), c(7, 1), c(7, 2), c(13, 3), c(2, 0)]);
    eq(r.cat, 3, 'hạng');
    eq(r.tie, [7, 13, 2], 'tie');
});

test('straight: 5-6-7-8-9', () => {
    const r = evaluate5([c(5, 0), c(6, 1), c(7, 2), c(8, 3), c(9, 0)]);
    eq(r.cat, 4, 'hạng');
    eq(r.tie, [9], 'tie');
});

test('straight wheel A-2-3-4-5', () => {
    const r = evaluate5([c(14, 0), c(2, 1), c(3, 2), c(4, 3), c(5, 0)]);
    eq(r.cat, 4, 'hạng');
    eq(r.tie, [5], 'tie');
});

test('flush: A-J-8-5-2 cùng chất', () => {
    const r = evaluate5([c(14, 2), c(11, 2), c(8, 2), c(5, 2), c(2, 2)]);
    eq(r.cat, 5, 'hạng');
    eq(r.tie, [14, 11, 8, 5, 2], 'tie');
});

test('full house: K-K-K-2-2', () => {
    const r = evaluate5([c(13, 0), c(13, 1), c(13, 2), c(2, 3), c(2, 0)]);
    eq(r.cat, 6, 'hạng');
    eq(r.tie, [13, 2], 'tie');
});

test('four of a kind: A-A-A-A-K', () => {
    const r = evaluate5([c(14, 0), c(14, 1), c(14, 2), c(14, 3), c(13, 0)]);
    eq(r.cat, 7, 'hạng');
    eq(r.tie, [14, 13], 'tie');
});

test('straight flush: 9-10-J-Q-K', () => {
    const r = evaluate5([c(9, 1), c(10, 1), c(11, 1), c(12, 1), c(13, 1)]);
    eq(r.cat, 8, 'hạng');
    eq(r.tie, [13], 'tie');
});

test('so sánh: thùng phá sảnh > tứ quý > cù lũ', () => {
    const sf = evaluate5([c(9, 1), c(10, 1), c(11, 1), c(12, 1), c(13, 1)]);
    const quads = evaluate5([c(14, 0), c(14, 1), c(14, 2), c(14, 3), c(13, 0)]);
    const full = evaluate5([c(13, 0), c(13, 1), c(13, 2), c(2, 3), c(2, 0)]);
    assert(compare(sf, quads) > 0, 'SF phải > quads');
    assert(compare(quads, full) > 0, 'quads phải > full house');
    assert(compare(full, sf) < 0, 'full house phải < SF');
});

test('so sánh: đôi A > đôi K, cùng hạng bằng nhau', () => {
    const aces = evaluate5([c(14, 0), c(14, 1), c(7, 2), c(5, 3), c(2, 0)]);
    const kings = evaluate5([c(13, 0), c(13, 1), c(7, 2), c(5, 3), c(2, 0)]);
    assert(compare(aces, kings) > 0, 'đôi A phải > đôi K');
    eq(compare(aces, aces), 0, 'cùng tay phải hoà');
});

test('7 lá chọn được thùng', () => {
    const r = evaluate([c(14, 0), c(13, 0), c(12, 0), c(11, 0), c(9, 0), c(2, 1), c(2, 2)]);
    eq(r.cat, 5, 'hạng');
    eq(r.tie, [14, 13, 12, 11, 9], 'tie');
});

test('7 lá chọn được cù lũ', () => {
    const r = evaluate([c(14, 0), c(14, 1), c(14, 2), c(13, 3), c(13, 0), c(2, 1), c(3, 2)]);
    eq(r.cat, 6, 'hạng');
    eq(r.tie, [14, 13], 'tie');
});

test('7 lá chọn được thùng phá sảnh wheel', () => {
    const r = evaluate([c(14, 1), c(2, 1), c(3, 1), c(4, 1), c(5, 1), c(13, 0), c(12, 2)]);
    eq(r.cat, 8, 'hạng');
    eq(r.tie, [5], 'tie');
});

test('7 lá ưu tiên tay mạnh nhất (sảnh thường vs đôi)', () => {
    const r = evaluate([c(5, 0), c(6, 1), c(7, 2), c(8, 3), c(9, 0), c(9, 1), c(2, 2)]);
    eq(r.cat, 4, 'phải chọn sảnh chứ không phải đôi');
    eq(r.tie, [9], 'tie');
});

test('ném lỗi khi dưới 5 lá', () => {
    throws(() => evaluate([c(2, 0), c(3, 1), c(4, 2), c(5, 3)]), 'phải ném lỗi');
});
