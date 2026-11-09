'use strict';

/**
 * caro.test.js — kiểm tra luật Caro/Gomoku 15×15.
 */

const { test, assert, eq } = require('./harness');
const caro = require('../games/board/caro');

function playAll(moves) {
    let state = caro.createState();
    let last = null;
    for (const [move, side] of moves) {
        last = caro.apply(state, move, { side });
        assert(last.ok, `nước ${move} phải hợp lệ: ${last.error}`);
        if (last.finished) return last;
        state = last.state;
    }
    return last;
}

test('parse tọa độ H8 → hàng 8, cột H', () => {
    eq(caro.parseInput('H8'), { r: 7, c: 7 });
});

test('parse tọa độ sai trả null', () => {
    eq(caro.parseInput('Z99'), null);
    eq(caro.parseInput('H16'), null);
    eq(caro.parseInput(''), null);
});

test('thắng hàng ngang 5 quân', () => {
    const out = playAll([
        ['H8', 'p1'], ['A1', 'p2'],
        ['I8', 'p1'], ['A2', 'p2'],
        ['J8', 'p1'], ['A3', 'p2'],
        ['K8', 'p1'], ['A4', 'p2'],
        ['L8', 'p1'],
    ]);
    eq(out.finished, true, 'phải kết thúc');
    eq(out.winner, 'p1', 'người 1 thắng');
});

test('thắng hàng dọc 5 quân', () => {
    const out = playAll([
        ['D1', 'p1'], ['A1', 'p2'],
        ['D2', 'p1'], ['A2', 'p2'],
        ['D3', 'p1'], ['A3', 'p2'],
        ['D4', 'p1'], ['A4', 'p2'],
        ['D5', 'p1'],
    ]);
    eq(out.finished, true, 'phải kết thúc');
    eq(out.winner, 'p1', 'người 1 thắng');
});

test('thắng chéo 5 quân', () => {
    const out = playAll([
        ['A1', 'p1'], ['O15', 'p2'],
        ['B2', 'p1'], ['O14', 'p2'],
        ['C3', 'p1'], ['O13', 'p2'],
        ['D4', 'p1'], ['O12', 'p2'],
        ['E5', 'p1'],
    ]);
    eq(out.finished, true, 'phải kết thúc');
    eq(out.winner, 'p1', 'người 1 thắng');
});

test('4 quân chưa thắng', () => {
    const out = playAll([
        ['H8', 'p1'], ['A1', 'p2'],
        ['I8', 'p1'], ['A2', 'p2'],
        ['J8', 'p1'], ['A3', 'p2'],
        ['K8', 'p1'],
    ]);
    assert(!out.finished, 'chưa được kết thúc');
});

test('từ chối tọa độ sai', () => {
    const out = caro.apply(caro.createState(), 'Z99', { side: 'p1' });
    eq(out.ok, false, 'phải từ chối');
});

test('từ chối đánh vào ô đã có quân', () => {
    const first = caro.apply(caro.createState(), 'H8', { side: 'p1' });
    assert(first.ok, 'nước đầu phải hợp lệ');
    const out = caro.apply(first.state, 'H8', { side: 'p2' });
    eq(out.ok, false, 'ô đã có quân phải bị từ chối');
});

test('chặn đi sai lượt', () => {
    const out = caro.apply(caro.createState(), 'H8', { side: 'p2' });
    eq(out.ok, false, 'người 2 đi khi đang lượt người 1 phải bị chặn');
});
