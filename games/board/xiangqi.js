'use strict';

/**
 * xiangqi.js — cờ tướng (9 cột × 10 hàng).
 *
 * Quân đỏ viết hoa: K A E H R C P; quân đen viết thường.
 * Bàn cờ index 0 = góc trên trái (phía Đen), index 89 = góc dưới phải (phía Đỏ).
 * Đỏ đi lên (row - 1), Đen đi xuống (row + 1).
 */

const START = [
    'rheakaehr',
    '.........',
    '.c.....c.',
    'p.p.p.p.p',
    '.........',
    '.........',
    'P.P.P.P.P',
    '.C.....C.',
    '.........',
    'RHEAKAEHR',
].join('');

const COLS = 'abcdefghi';
const PIECE_LABEL = {
    K: '帥', A: '仕', E: '相', H: '傌', R: '俥', C: '炮', P: '兵',
    k: '將', a: '士', e: '象', h: '馬', r: '車', c: '砲', p: '卒',
};

const rowOf = (idx) => Math.floor(idx / 9);
const colOf = (idx) => idx % 9;
const onBoard = (r, c) => r >= 0 && r < 10 && c >= 0 && c < 9;
const idxOf = (r, c) => r * 9 + c;
const isRed = (ch) => ch !== '.' && ch === ch.toUpperCase();
const colorOf = (ch) => {
    if (!ch || ch === '.') return null;
    return isRed(ch) ? 'r' : 'b';
};
const other = (color) => (color === 'r' ? 'b' : 'r');

function inPalace(color, r, c) {
    if (c < 3 || c > 5) return false;
    return color === 'r' ? r >= 7 && r <= 9 : r >= 0 && r <= 2;
}

function createState() {
    return {
        board: START,
        turn: 'r',
        halfmove: 0,
        last: null,
        moveLog: [],
    };
}

function get(board, idx) {
    if (idx < 0 || idx >= 90) return '.';
    return board[idx] || '.';
}

function findGeneral(board, color) {
    const target = color === 'r' ? 'K' : 'k';
    for (let i = 0; i < 90; i++) if (board[i] === target) return i;
    return -1;
}

function pseudoMoves(state, color = state.turn) {
    const board = state.board;
    const moves = [];

    for (let from = 0; from < 90; from++) {
        const piece = get(board, from);
        if (colorOf(piece) !== color) continue;
        const type = piece.toLowerCase();
        const r = rowOf(from);
        const c = colOf(from);

        const push = (rr, cc) => {
            if (!onBoard(rr, cc)) return false;
            const to = idxOf(rr, cc);
            const target = board[to];
            if (target === '.') {
                moves.push({ from, to, capture: false });
                return true;
            }
            if (colorOf(target) !== color) moves.push({ from, to, capture: true });
            return false;
        };

        if (type === 'k') {
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                const rr = r + dr;
                const cc = c + dc;
                if (inPalace(color, rr, cc)) push(rr, cc);
            }
            // Tướng đối mặt (bay tướng)
            const enemyGeneral = findGeneral(board, other(color));
            if (enemyGeneral >= 0 && colOf(enemyGeneral) === c) {
                const step = enemyGeneral > from ? 1 : -1;
                let clear = true;
                for (let i = from + 9 * step; i !== enemyGeneral; i += 9 * step) {
                    if (board[i] !== '.') { clear = false; break; }
                }
                if (clear) moves.push({ from, to: enemyGeneral, capture: true, flying: true });
            }
            continue;
        }

        if (type === 'a') {
            for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
                const rr = r + dr;
                const cc = c + dc;
                if (inPalace(color, rr, cc)) push(rr, cc);
            }
            continue;
        }

        if (type === 'e') {
            for (const [dr, dc] of [[-2, -2], [-2, 2], [2, -2], [2, 2]]) {
                const rr = r + dr;
                const cc = c + dc;
                if (!onBoard(rr, cc)) continue;
                if (color === 'r' && rr < 5) continue;
                if (color === 'b' && rr > 4) continue;
                const eye = idxOf(r + dr / 2, c + dc / 2);
                if (board[eye] !== '.') continue;
                push(rr, cc);
            }
            continue;
        }

        if (type === 'h') {
            for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
                const rr = r + dr;
                const cc = c + dc;
                if (!onBoard(rr, cc)) continue;
                const leg = Math.abs(dr) === 2 ? idxOf(r + dr / 2, c) : idxOf(r, c + dc / 2);
                if (board[leg] !== '.') continue;
                push(rr, cc);
            }
            continue;
        }

        if (type === 'r') {
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                let rr = r + dr;
                let cc = c + dc;
                while (onBoard(rr, cc)) {
                    if (!push(rr, cc)) break;
                    rr += dr;
                    cc += dc;
                }
            }
            continue;
        }

        if (type === 'c') {
            for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
                let rr = r + dr;
                let cc = c + dc;
                let screen = false;
                while (onBoard(rr, cc)) {
                    const to = idxOf(rr, cc);
                    const target = board[to];
                    if (!screen) {
                        if (target === '.') moves.push({ from, to, capture: false });
                        else screen = true;
                    } else if (target !== '.') {
                        if (colorOf(target) !== color) moves.push({ from, to, capture: true });
                        break;
                    }
                    rr += dr;
                    cc += dc;
                }
            }
            continue;
        }

        if (type === 'p') {
            const dir = color === 'r' ? -1 : 1;
            push(r + dir, c);
            const crossed = color === 'r' ? r <= 4 : r >= 5;
            if (crossed) {
                push(r, c - 1);
                push(r, c + 1);
            }
        }
    }

    return moves;
}

function inCheck(state, color = state.turn) {
    const general = findGeneral(state.board, color);
    if (general === -1) return false;
    return pseudoMoves(state, other(color)).some((m) => m.to === general);
}

function makeMove(state, move) {
    const board = state.board.split('');
    const piece = board[move.from];
    const color = colorOf(piece);
    const captured = board[move.to];
    board[move.from] = '.';
    board[move.to] = piece;

    const lan = `${squareOf(move.from)}${squareOf(move.to)}`;
    return {
        ...state,
        board: board.join(''),
        turn: other(color),
        halfmove: (piece.toLowerCase() === 'p' || captured !== '.') ? 0 : (state.halfmove || 0) + 1,
        last: { ...move, lan, piece, captured: captured === '.' ? null : captured },
        moveLog: [...(state.moveLog || []), lan],
    };
}

function legalMoves(state, color = state.turn) {
    return pseudoMoves(state, color).filter((move) => {
        const next = makeMove(state, move);
        return !inCheck(next, color);
    });
}

function squareOf(idx) {
    return `${COLS[colOf(idx)]}${rowOf(idx) + 1}`;
}

function parseSquare(str) {
    const m = /^([a-i])([1-9]|10)$/i.exec(str || '');
    if (!m) return -1;
    const c = COLS.indexOf(m[1].toLowerCase());
    const r = Number(m[2]) - 1;
    if (c < 0 || r < 0 || r > 9) return -1;
    return idxOf(r, c);
}

function parseMoveInput(input) {
    if (!input || typeof input !== 'string') return null;
    const raw = input.trim().toLowerCase().replace(/[\s\-–—]+/g, '');
    const m = raw.match(/^([a-i](?:10|[1-9]))([a-i](?:10|[1-9]))$/);
    if (!m) return null;
    const from = parseSquare(m[1]);
    const to = parseSquare(m[2]);
    if (from < 0 || to < 0) return null;
    return { from, to };
}

function apply(state, input, { side }) {
    if (!state || typeof state.board !== 'string' || state.board.length !== 90) {
        return { ok: false, error: 'Trạng thái ván không hợp lệ.' };
    }
    const color = side === 'p1' ? 'r' : 'b';
    if (state.turn !== color) return { ok: false, error: 'Chưa tới lượt bạn.' };

    const parsed = parseMoveInput(input);
    if (!parsed) {
        return {
            ok: false,
            error: 'Nước đi không hợp lệ. Nhập kiểu **a7a4** (cột a–i, hàng 1–10 từ trên xuống).',
        };
    }

    const legal = legalMoves(state, color);
    const move = legal.find((m) => m.from === parsed.from && m.to === parsed.to);
    if (!move) {
        const piece = state.board[parsed.from];
        if (!piece || piece === '.') return { ok: false, error: 'Ô xuất phát trống.' };
        if (colorOf(piece) !== color) return { ok: false, error: 'Đó không phải quân của bạn.' };
        if (inCheck(state, color)) return { ok: false, error: 'Bạn đang bị chiếu — phải giải chiếu trước!' };
        return { ok: false, error: 'Nước đi này không hợp lệ.' };
    }

    let next = makeMove(state, move);
    const replies = legalMoves(next, next.turn);
    const checked = inCheck(next, next.turn);

    if (!replies.length) {
        const reason = checked
            ? `Chiếu hết! ${side === 'p1' ? 'Đỏ' : 'Đen'} thắng.`
            : `Đối phương hết nước đi — ${side === 'p1' ? 'Đỏ' : 'Đen'} thắng (cờ tướng tính là thua).`;
        next = { ...next, result: { winner: side, reason } };
        return { ok: true, state: next, finished: true, winner: side, reason };
    }

    if (next.halfmove >= 120) {
        const reason = '60 nước không ăn quân — hoà.';
        next = { ...next, result: { winner: null, reason } };
        return { ok: true, state: next, finished: true, winner: null, reason };
    }

    return { ok: true, state: next };
}

function resignResult(state, side) {
    const winner = side === 'p1' ? 'p2' : 'p1';
    const reason = `${side === 'p1' ? 'Đỏ' : 'Đen'} đã xin thua.`;
    return {
        state: { ...state, result: { winner, reason } },
        finished: true,
        winner,
        reason,
    };
}

function renderBoard(state) {
    const lines = [];
    for (let r = 0; r < 10; r++) {
        const cells = [];
        for (let c = 0; c < 9; c++) {
            const p = state.board[idxOf(r, c)];
            cells.push(p === '.' ? '·' : PIECE_LABEL[p] || p);
        }
        lines.push(`${String(r + 1).padStart(2, ' ')}  ${cells.join(' ')}`);
    }
    lines.push(`    ${COLS.split('').join(' ')}`);
    return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

function renderStatus(state) {
    const lines = [`Lượt: **${state.turn === 'r' ? 'Đỏ (người 1)' : 'Đen (người 2)'}**`];
    if (inCheck(state, state.turn)) lines.push('⚠️ **Đang bị chiếu!**');
    if (state.last?.lan) lines.push(`Nước cuối: **${state.last.lan}**`);
    if (state.moveLog?.length) lines.push(`Lịch sử: ${state.moveLog.slice(-8).join(' ')}`);
    return lines.join('\n');
}

function sideLabel(state) {
    return state.turn === 'r' ? 'Đỏ (người 1)' : 'Đen (người 2)';
}

function playerSide(state) {
    return state.turn === 'r' ? 'p1' : 'p2';
}

function hint() {
    return 'Nhập nước đi kiểu a7a4 (cột a–i, hàng 1–10 từ trên xuống).';
}

module.exports = {
    type: 'xiangqi',
    label: 'Cờ tướng',
    createState,
    apply,
    resignResult,
    renderBoard,
    renderStatus,
    sideLabel,
    playerSide,
    hint,
    parseMoveInput,
    legalMoves,
    pseudoMoves,
    makeMove,
    inCheck,
};
