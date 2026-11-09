'use strict';

/**
 * baucua.test.js — kiểm tra engine Bầu Cua nhiều cửa.
 */

const { test, eq, assert } = require('./harness');
const baucua = require('../games/baucua');

test('lắc 3 xúc xắc theo rng', () => {
    const values = [0.0, 0.5, 0.99];
    let i = 0;
    const dice = baucua.rollDice(() => values[i++]);
    eq(dice, [0, 3, 5]);
});

test('một cửa trúng 1 viên: lời đúng 1 lần cược', () => {
    const result = baucua.evaluate([{ key: 'bau', amount: 100 }], [0, 1, 2]);
    eq(result.lines[0].matches, 1);
    eq(result.lines[0].profit, 100);
    eq(result.lines[0].payout, 200);
    eq(result.net, 100);
});

test('một cửa trúng 2 viên: lời gấp đôi', () => {
    const result = baucua.evaluate([{ key: 'cua', amount: 300 }], [1, 1, 2]);
    eq(result.lines[0].matches, 2);
    eq(result.lines[0].profit, 600);
    eq(result.lines[0].payout, 900);
    eq(result.net, 600);
});

test('nhiều cửa, nhiều mức tiền khác nhau', () => {
    // xúc xắc: Bầu, Bầu, Cua
    const result = baucua.evaluate([
        { key: 'bau', amount: 100 },
        { key: 'cua', amount: 200 },
        { key: 'tom', amount: 50 },
    ], [0, 0, 1]);

    eq(result.totalStake, 350);
    eq(result.lines[0].matches, 2);
    eq(result.lines[0].profit, 200);
    eq(result.lines[1].matches, 1);
    eq(result.lines[1].profit, 200);
    eq(result.lines[2].matches, 0);
    eq(result.lines[2].profit, -50);
    eq(result.totalPayout, 700);
    eq(result.net, 350);
});

test('trượt hết: lỗ đúng tổng cược', () => {
    const result = baucua.evaluate([
        { key: 'ga', amount: 500 },
        { key: 'nai', amount: 250 },
    ], [0, 1, 2]);
    eq(result.totalPayout, 0);
    eq(result.net, -750);
});

test('lấy đúng ký hiệu theo key', () => {
    eq(baucua.getSymbol('tom').name, 'Tôm');
    assert(!baucua.getSymbol('khong_co'), 'key lạ phải trả undefined');
});
