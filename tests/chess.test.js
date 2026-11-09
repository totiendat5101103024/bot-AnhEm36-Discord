'use strict';

/**
 * chess.test.js — kiểm tra engine cờ vua: perft, luật đặc biệt, kết thúc ván.
 */

const { test, assert, eq } = require('./harness');
const chess = require('../games/board/chess');

function perft(state, depth) {
    if (depth === 0) return 1;
    const moves = chess.legalMoves(state);
    if (depth === 1) return moves.length;
    let total = 0;
    for (const move of moves) total += perft(chess.makeMove(state, move), depth - 1);
    return total;
}

function playAll(moves) {
    let state = chess.createState();
    for (const move of moves) {
        const side = state.turn === 'w' ? 'p1' : 'p2';
        const out = chess.apply(state, move, { side });
        assert(out.ok, `nước ${move} phải hợp lệ: ${out.error}`);
        state = out.state;
    }
    return state;
}

function customBoard(rows, turn = 'w') {
    return {
        ...chess.createState(),
        board: rows.join(''),
        turn,
        castling: { wK: false, wQ: false, bK: false, bQ: false },
        ep: null,
        halfmove: 0,
        fullmove: 1,
        last: null,
        moveLog: [],
        repetitions: {},
    };
}

test('perft độ sâu 1 = 20', () => eq(perft(chess.createState(), 1), 20));
test('perft độ sâu 2 = 400', () => eq(perft(chess.createState(), 2), 400));
test('perft độ sâu 3 = 8.902', () => eq(perft(chess.createState(), 3), 8902));
test('perft độ sâu 4 = 197.281', () => eq(perft(chess.createState(), 4), 197281));

test('nhập thành cánh vua', () => {
    const state = playAll(['e2e4', 'e7e5', 'g1f3', 'b8c6', 'f1c4', 'f8c5', 'e1g1']);
    eq(state.board[62], 'K', 'vua trắng ở g1');
    eq(state.board[61], 'R', 'xe trắng ở f1');
    eq(state.board[60], '.', 'e1 trống');
    eq(state.board[63], '.', 'h1 trống');
});

test('bắt tốt qua đường (en passant)', () => {
    const state = playAll(['e2e4', 'a7a6', 'e4e5', 'd7d5']);
    const out = chess.apply(state, 'e5d6', { side: 'p1' });
    assert(out.ok, `en passant phải hợp lệ: ${out.error}`);
    eq(out.state.board[27], '.', 'tốt đen d5 bị bắt');
    eq(out.state.board[19], 'P', 'tốt trắng ở d6');
});

test('phong cấp đủ 4 lựa chọn + mặc định hậu', () => {
    const rows = ['........', 'P.......', '........', '........', '........', '........', '........', 'k......K'];
    for (const [promo, expected] of [['q', 'Q'], ['r', 'R'], ['b', 'B'], ['n', 'N']]) {
        const out = chess.apply(customBoard(rows), `a7a8${promo}`, { side: 'p1' });
        assert(out.ok, `phong cấp ${promo} phải hợp lệ: ${out.error}`);
        eq(out.state.board[0], expected, `quân phong cấp ${promo}`);
    }
    const out = chess.apply(customBoard(rows), 'a7a8', { side: 'p1' });
    assert(out.ok, 'phong cấp mặc định phải hợp lệ');
    eq(out.state.board[0], 'Q', 'mặc định thành hậu');
});

test("chiếu hết fool's mate", () => {
    const state = playAll(['f2f3', 'e7e5', 'g2g4', 'd8h4']);
    eq(state.result?.winner, 'p2', 'đen thắng');
    assert(/Chiếu hết/.test(state.result?.reason || ''), 'lý do phải là chiếu hết');
});

test('stalemate: hết nước nhưng không bị chiếu', () => {
    const state = customBoard(['k.......', '..K.....', '.Q......', '........', '........', '........', '........', '........'], 'b');
    eq(chess.legalMoves(state).length, 0, 'không còn nước');
    eq(chess.inCheck(state, 'b'), false, 'không bị chiếu');
});

test('từ chối nước không hợp lệ e2e5', () => {
    const out = chess.apply(chess.createState(), 'e2e5', { side: 'p1' });
    eq(out.ok, false, 'phải từ chối');
});

test('chặn đi sai lượt', () => {
    const out = chess.apply(chess.createState(), 'e7e5', { side: 'p2' });
    eq(out.ok, false, 'đen đi khi đang lượt trắng phải bị chặn');
});
