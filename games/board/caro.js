'use strict';

/**
 * caro.js — Caro/Gomoku 15×15, thắng khi có 5 quân liên tiếp.
 *
 * State: { cells: number[225], turn: 'p1'|'p2', last: {r,c}|null, moves: number }
 * Ô: 0 trống, 1 người 1, 2 người 2.
 */

const SIZE = 15;
const WIN = 5;
const COLS = 'ABCDEFGHIJKLMNO';
const DIRS = [
    [0, 1], [1, 0], [1, 1], [1, -1],
];

function createState() {
    return {
        cells: new Array(SIZE * SIZE).fill(0),
        turn: 'p1',
        last: null,
        moves: 0,
    };
}

function sideLabel(state) {
    return state.turn === 'p1' ? 'người 1 (⚫)' : 'người 2 (⚪)';
}

function playerSide(state) {
    return state.turn === 'p1' ? 'p1' : 'p2';
}

function parseInput(input) {
    if (!input || typeof input !== 'string') return null;
    const raw = input.trim().toUpperCase().replace(/[\s,;]+/g, '');
    let m = raw.match(/^([A-O])(\d{1,2})$/);
    if (m) {
        const c = COLS.indexOf(m[1]);
        const r = Number(m[2]) - 1;
        if (r >= 0 && r < SIZE && c >= 0) return { r, c };
        return null;
    }
    m = raw.match(/^(\d{1,2})[x/](\d{1,2})$/);
    if (m) {
        const r = Number(m[1]) - 1;
        const c = Number(m[2]) - 1;
        if (r >= 0 && r < SIZE && c >= 0 && c < SIZE) return { r, c };
    }
    return null;
}

function checkWin(cells, r, c, value) {
    for (const [dr, dc] of DIRS) {
        let count = 1;
        for (const sign of [1, -1]) {
            let rr = r + dr * sign;
            let cc = c + dc * sign;
            while (rr >= 0 && rr < SIZE && cc >= 0 && cc < SIZE && cells[rr * SIZE + cc] === value) {
                count++;
                rr += dr * sign;
                cc += dc * sign;
            }
        }
        if (count >= WIN) return true;
    }
    return false;
}

function apply(state, input, { side }) {
    if (!state || !Array.isArray(state.cells) || state.cells.length !== SIZE * SIZE) {
        return { ok: false, error: 'Trạng thái ván không hợp lệ.' };
    }
    if (state.turn !== side) {
        return { ok: false, error: 'Chưa tới lượt bạn.' };
    }
    const pos = parseInput(input);
    if (!pos) {
        return {
            ok: false,
            error: 'Nước đi không hợp lệ. Nhập kiểu **H8** (cột A–O, hàng 1–15).',
        };
    }
    const { r, c } = pos;
    const idx = r * SIZE + c;
    if (state.cells[idx] !== 0) {
        return { ok: false, error: 'Ô này đã có quân rồi!' };
    }

    const value = side === 'p1' ? 1 : 2;
    const next = {
        ...state,
        cells: state.cells.slice(),
        last: { r, c },
        moves: (state.moves || 0) + 1,
    };
    next.cells[idx] = value;

    const won = checkWin(next.cells, r, c, value);
    if (won) {
        return {
            ok: true,
            state: next,
            finished: true,
            winner: side,
            reason: `${side === 'p1' ? 'Người 1' : 'Người 2'} nối được 5 quân liên tiếp!`,
        };
    }
    if (next.moves >= SIZE * SIZE) {
        return {
            ok: true,
            state: next,
            finished: true,
            winner: null,
            reason: 'Bàn cờ đã đầy — hoà.',
        };
    }

    next.turn = side === 'p1' ? 'p2' : 'p1';
    return { ok: true, state: next };
}

function resignResult(state, side) {
    const winner = side === 'p1' ? 'p2' : 'p1';
    return {
        state: { ...state, turn: state.turn },
        finished: true,
        winner,
        reason: `${side === 'p1' ? 'Người 1' : 'Người 2'} đã xin thua.`,
    };
}

function renderBoard(state) {
    const lines = [];
    lines.push(`    ${COLS.split('').join(' ')}`);
    for (let r = 0; r < SIZE; r++) {
        const cells = [];
        for (let c = 0; c < SIZE; c++) {
            const v = state.cells[r * SIZE + c];
            cells.push(v === 1 ? '⚫' : v === 2 ? '⚪' : '·');
        }
        lines.push(`${String(r + 1).padStart(2, ' ')}  ${cells.join(' ')}`);
    }
    return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

function renderStatus(state) {
    const lines = [];
    if (state.last) {
        lines.push(`Nước cuối: **${COLS[state.last.c]}${state.last.r + 1}**`);
    }
    lines.push(`Lượt: **${sideLabel(state)}**`);
    return lines.join('\n');
}

function hint() {
    return 'Nhập tọa độ như H8 (cột A–O, hàng 1–15).';
}

module.exports = {
    type: 'caro',
    label: 'Caro/Gomoku 15×15',
    SIZE,
    WIN,
    COLS,
    createState,
    apply,
    resignResult,
    renderBoard,
    renderStatus,
    sideLabel,
    playerSide,
    hint,
    parseInput,
    checkWin,
};
