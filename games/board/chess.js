'use strict';

/**
 * chess.js — engine cờ vua thuần JS.
 *
 * Hỗ trợ đầy đủ: nhập thành, bắt tốt qua đường (en passant),
 * phong cấp, chiếu, chiếu hết, hết nước (stalemate), luật 50 nước,
 * lặp lại 3 lần và các trường hợp hoà do thiếu quân.
 *
 * Bàn cờ 64 ô, index 0 = a8 … 63 = h1.
 * Quân trắng viết hoa: K Q R B N P; đen viết thường: k q r b n p.
 */

const START = 'rnbqkbnr'
    + 'pppppppp'
    + '........'
    + '........'
    + '........'
    + '........'
    + 'PPPPPPPP'
    + 'RNBQKBNR';

const FILES = 'abcdefgh';
const PIECE_EMOJI = {
    K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
    k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const KNIGHT_OFFSETS = [
    [-2, -1], [-2, 1], [-1, -2], [-1, 2],
    [1, -2], [1, 2], [2, -1], [2, 1],
];
const KING_OFFSETS = [
    [-1, -1], [-1, 0], [-1, 1], [0, -1],
    [0, 1], [1, -1], [1, 0], [1, 1],
];
const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];

const rowOf = (idx) => idx >> 3;
const colOf = (idx) => idx & 7;
const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
const idxOf = (r, c) => r * 8 + c;
const isWhite = (ch) => ch !== '.' && ch === ch.toUpperCase();
const colorOf = (ch) => {
    if (!ch || ch === '.') return null;
    return isWhite(ch) ? 'w' : 'b';
};
const other = (color) => (color === 'w' ? 'b' : 'w');

function squareToIdx(square) {
    if (!/^[a-h][1-8]$/i.test(square || '')) return -1;
    const c = FILES.indexOf(square[0].toLowerCase());
    const r = 8 - Number(square[1]);
    return idxOf(r, c);
}

function idxToSquare(idx) {
    return `${FILES[colOf(idx)]}${8 - rowOf(idx)}`;
}

function createState() {
    return {
        board: START,
        turn: 'w',
        castling: { wK: true, wQ: true, bK: true, bQ: true },
        ep: null,
        halfmove: 0,
        fullmove: 1,
        last: null,
        moveLog: [],
        repetitions: { [positionKey({ board: START, turn: 'w', castling: { wK: true, wQ: true, bK: true, bQ: true }, ep: null })]: 1 },
    };
}

function positionKey(state) {
    const c = state.castling || {};
    return `${state.board}|${state.turn}|${c.wK ? 1 : 0}${c.wQ ? 1 : 0}${c.bK ? 1 : 0}${c.bQ ? 1 : 0}|${state.ep ?? '-'}`;
}

function get(board, idx) {
    if (idx < 0 || idx > 63) return '.';
    return board[idx] || '.';
}

function set(board, idx, ch) {
    const arr = board.split('');
    arr[idx] = ch;
    return arr.join('');
}

function findKing(board, color) {
    const target = color === 'w' ? 'K' : 'k';
    for (let i = 0; i < 64; i++) if (board[i] === target) return i;
    return -1;
}

function isSquareAttacked(board, idx, byColor) {
    if (idx < 0) return false;
    const r = rowOf(idx);
    const c = colOf(idx);

    // Tốt
    if (byColor === 'w') {
        if (c < 7 && get(board, idx + 9) === 'P') return true;
        if (c > 0 && get(board, idx + 7) === 'P') return true;
    } else {
        if (c > 0 && get(board, idx - 9) === 'p') return true;
        if (c < 7 && get(board, idx - 7) === 'p') return true;
    }

    // Mã
    for (const [dr, dc] of KNIGHT_OFFSETS) {
        const rr = r + dr;
        const cc = c + dc;
        if (!onBoard(rr, cc)) continue;
        const piece = get(board, idxOf(rr, cc));
        if (piece === (byColor === 'w' ? 'N' : 'n')) return true;
    }

    // Vua
    for (const [dr, dc] of KING_OFFSETS) {
        const rr = r + dr;
        const cc = c + dc;
        if (!onBoard(rr, cc)) continue;
        const piece = get(board, idxOf(rr, cc));
        if (piece === (byColor === 'w' ? 'K' : 'k')) return true;
    }

    // Xe / Hậu
    for (const [dr, dc] of ROOK_DIRS) {
        let rr = r + dr;
        let cc = c + dc;
        while (onBoard(rr, cc)) {
            const piece = get(board, idxOf(rr, cc));
            if (piece !== '.') {
                if (colorOf(piece) === byColor && (piece === (byColor === 'w' ? 'R' : 'r') || piece === (byColor === 'w' ? 'Q' : 'q'))) {
                    return true;
                }
                break;
            }
            rr += dr;
            cc += dc;
        }
    }

    // Tượng / Hậu
    for (const [dr, dc] of BISHOP_DIRS) {
        let rr = r + dr;
        let cc = c + dc;
        while (onBoard(rr, cc)) {
            const piece = get(board, idxOf(rr, cc));
            if (piece !== '.') {
                if (colorOf(piece) === byColor && (piece === (byColor === 'w' ? 'B' : 'b') || piece === (byColor === 'w' ? 'Q' : 'q'))) {
                    return true;
                }
                break;
            }
            rr += dr;
            cc += dc;
        }
    }

    return false;
}

function inCheck(state, color = state.turn) {
    const king = findKing(state.board, color);
    if (king === -1) return false;
    return isSquareAttacked(state.board, king, other(color));
}

function pushPawnMove(moves, from, to, color, extra = {}) {
    const promoRow = color === 'w' ? 0 : 7;
    if (rowOf(to) === promoRow) {
        for (const p of ['q', 'r', 'b', 'n']) {
            moves.push({ from, to, promotion: p, ...extra });
        }
    } else {
        moves.push({ from, to, ...extra });
    }
}

function pseudoMoves(state, color = state.turn) {
    const board = state.board;
    const moves = [];

    for (let from = 0; from < 64; from++) {
        const piece = get(board, from);
        if (colorOf(piece) !== color) continue;
        const type = piece.toLowerCase();
        const r = rowOf(from);
        const c = colOf(from);

        if (type === 'p') {
            const dir = color === 'w' ? -1 : 1;
            const startRow = color === 'w' ? 6 : 1;
            const oneR = r + dir;
            if (onBoard(oneR, c)) {
                const one = idxOf(oneR, c);
                if (get(board, one) === '.') {
                    pushPawnMove(moves, from, one, color);
                    const twoR = r + dir * 2;
                    if (r === startRow && onBoard(twoR, c)) {
                        const two = idxOf(twoR, c);
                        if (get(board, two) === '.') {
                            moves.push({ from, to: two, double: true });
                        }
                    }
                }
            }
            for (const dc of [-1, 1]) {
                const rr = r + dir;
                const cc = c + dc;
                if (!onBoard(rr, cc)) continue;
                const to = idxOf(rr, cc);
                const target = get(board, to);
                if (target !== '.' && colorOf(target) !== color) {
                    pushPawnMove(moves, from, to, color, { capture: true });
                } else if (state.ep === to) {
                    moves.push({ from, to, ep: true, capture: true });
                }
            }
            continue;
        }

        if (type === 'n') {
            for (const [dr, dc] of KNIGHT_OFFSETS) {
                const rr = r + dr;
                const cc = c + dc;
                if (!onBoard(rr, cc)) continue;
                const to = idxOf(rr, cc);
                const target = get(board, to);
                if (target === '.' || colorOf(target) !== color) moves.push({ from, to, capture: target !== '.' });
            }
            continue;
        }

        if (type === 'k') {
            for (const [dr, dc] of KING_OFFSETS) {
                const rr = r + dr;
                const cc = c + dc;
                if (!onBoard(rr, cc)) continue;
                const to = idxOf(rr, cc);
                const target = get(board, to);
                if (target === '.' || colorOf(target) !== color) moves.push({ from, to, capture: target !== '.' });
            }
            // Nhập thành
            const home = color === 'w' ? 60 : 4;
            if (from === home && !isSquareAttacked(board, home, other(color))) {
                const kingRight = color === 'w' ? state.castling?.wK : state.castling?.bK;
                const queenRight = color === 'w' ? state.castling?.wQ : state.castling?.bQ;
                const rookK = color === 'w' ? 'R' : 'r';
                if (kingRight) {
                    const f = home + 1;
                    const g = home + 2;
                    if (get(board, f) === '.' && get(board, g) === '.'
                        && get(board, home + 3) === rookK
                        && !isSquareAttacked(board, f, other(color))
                        && !isSquareAttacked(board, g, other(color))) {
                        moves.push({ from, to: g, castle: 'K', capture: false });
                    }
                }
                if (queenRight) {
                    const b = home - 3;
                    const cc2 = home - 2;
                    const d = home - 1;
                    if (get(board, b) === '.' && get(board, cc2) === '.' && get(board, d) === '.'
                        && get(board, home - 4) === rookK
                        && !isSquareAttacked(board, d, other(color))
                        && !isSquareAttacked(board, cc2, other(color))) {
                        moves.push({ from, to: cc2, castle: 'Q', capture: false });
                    }
                }
            }
            continue;
        }

        const dirs = type === 'r' ? ROOK_DIRS : type === 'b' ? BISHOP_DIRS : [...ROOK_DIRS, ...BISHOP_DIRS];
        for (const [dr, dc] of dirs) {
            let rr = r + dr;
            let cc = c + dc;
            while (onBoard(rr, cc)) {
                const to = idxOf(rr, cc);
                const target = get(board, to);
                if (target === '.') {
                    moves.push({ from, to, capture: false });
                } else {
                    if (colorOf(target) !== color) moves.push({ from, to, capture: true });
                    break;
                }
                rr += dr;
                cc += dc;
            }
        }
    }

    return moves;
}

function moveToLan(move) {
    return `${idxToSquare(move.from)}${idxToSquare(move.to)}${move.promotion || ''}`;
}

function makeMove(state, move) {
    const board = state.board.split('');
    const piece = board[move.from];
    const color = colorOf(piece);
    const type = piece.toLowerCase();
    const captured = board[move.to];
    const castling = { ...state.castling };
    let ep = null;

    board[move.from] = '.';

    if (move.ep) {
        const capturedIdx = move.to + (color === 'w' ? 8 : -8);
        board[capturedIdx] = '.';
    }

    if (move.castle === 'K') {
        board[move.to - 1] = board[move.to + 1];
        board[move.to + 1] = '.';
    } else if (move.castle === 'Q') {
        board[move.to + 1] = board[move.to - 2];
        board[move.to - 2] = '.';
    }

    board[move.to] = move.promotion
        ? (color === 'w' ? move.promotion.toUpperCase() : move.promotion)
        : piece;

    // Mất quyền nhập thành khi vua hoặc xe di chuyển / xe bị bắt.
    if (type === 'k') {
        if (color === 'w') { castling.wK = false; castling.wQ = false; }
        else { castling.bK = false; castling.bQ = false; }
    }
    if (type === 'r') {
        if (move.from === 63) castling.wK = false;
        if (move.from === 56) castling.wQ = false;
        if (move.from === 7) castling.bK = false;
        if (move.from === 0) castling.bQ = false;
    }
    if (move.to === 63) castling.wK = false;
    if (move.to === 56) castling.wQ = false;
    if (move.to === 7) castling.bK = false;
    if (move.to === 0) castling.bQ = false;

    if (type === 'p' && move.double) {
        ep = move.from + (color === 'w' ? -8 : 8);
    }

    const nextBoard = board.join('');
    const next = {
        ...state,
        board: nextBoard,
        turn: other(color),
        castling,
        ep,
        halfmove: type === 'p' || captured !== '.' || move.ep ? 0 : (state.halfmove || 0) + 1,
        fullmove: (state.fullmove || 1) + (color === 'b' ? 1 : 0),
        last: { ...move, lan: moveToLan(move), piece, captured: captured === '.' ? null : captured },
        moveLog: [...(state.moveLog || []), moveToLan(move)],
        repetitions: { ...(state.repetitions || {}) },
    };
    const key = positionKey(next);
    next.repetitions[key] = (next.repetitions[key] || 0) + 1;
    return next;
}

function legalMoves(state, color = state.turn) {
    const out = [];
    for (const move of pseudoMoves(state, color)) {
        const next = makeMove(state, move);
        if (!inCheck(next, color)) out.push(move);
    }
    return out;
}

function insufficientMaterial(board) {
    const pieces = board.replace(/[.]/g, '').split('');
    if (pieces.length <= 2) return true;
    if (pieces.length === 3) {
        return pieces.some((p) => 'BNbn'.includes(p));
    }
    if (pieces.length === 4 && pieces.every((p) => 'Bb'.includes(p))) {
        // Hai tượng cùng màu ô → hoà.
        const squares = [];
        for (let i = 0; i < 64; i++) if ('Bb'.includes(board[i])) squares.push(i);
        if (squares.length === 2) {
            return ((rowOf(squares[0]) + colOf(squares[0])) % 2) === ((rowOf(squares[1]) + colOf(squares[1])) % 2);
        }
    }
    return false;
}

function parseMoveInput(input) {
    if (!input || typeof input !== 'string') return null;
    const raw = input.trim().toLowerCase().replace(/[\s\-–—]+/g, '');
    const m = raw.match(/^([a-h][1-8])([a-h][1-8])([qrbn])?$/);
    if (!m) return null;
    return { from: m[1], to: m[2], promotion: m[3] || null };
}

function apply(state, input, { side }) {
    if (!state || typeof state.board !== 'string' || state.board.length !== 64) {
        return { ok: false, error: 'Trạng thái ván không hợp lệ.' };
    }
    const color = side === 'p1' ? 'w' : 'b';
    if (state.turn !== color) return { ok: false, error: 'Chưa tới lượt bạn.' };

    const parsed = parseMoveInput(input);
    if (!parsed) {
        return {
            ok: false,
            error: 'Nước đi không hợp lệ. Nhập kiểu **e2e4**, phong cấp **e7e8q**, nhập thành **e1g1**.',
        };
    }

    const from = squareToIdx(parsed.from);
    const to = squareToIdx(parsed.to);
    if (from < 0 || to < 0) return { ok: false, error: 'Ô cờ không hợp lệ.' };

    const legal = legalMoves(state, color);
    let candidates = legal.filter((m) => m.from === from && m.to === to);
    if (parsed.promotion) {
        candidates = candidates.filter((m) => m.promotion === parsed.promotion);
    } else if (candidates.some((m) => m.promotion)) {
        candidates = candidates.filter((m) => m.promotion === 'q');
    }

    if (!candidates.length) {
        const piece = state.board[from];
        if (!piece || piece === '.') return { ok: false, error: 'Ô xuất phát trống.' };
        if (colorOf(piece) !== color) return { ok: false, error: 'Đó không phải quân của bạn.' };
        if (inCheck(state, color)) {
            return { ok: false, error: 'Bạn đang bị chiếu — phải giải chiếu trước!' };
        }
        return { ok: false, error: 'Nước đi này không hợp lệ.' };
    }

    let next = makeMove(state, candidates[0]);
    const nextColor = next.turn;
    const replies = legalMoves(next, nextColor);
    const checked = inCheck(next, nextColor);

    let finished = false;
    let winner = null;
    let reason = '';

    if (!replies.length) {
        finished = true;
        if (checked) {
            winner = side;
            reason = `Chiếu hết! ${side === 'p1' ? 'Trắng' : 'Đen'} thắng.`;
        } else {
            winner = null;
            reason = 'Hết nước đi hợp lệ — hoà (stalemate).';
        }
    } else if (next.halfmove >= 100) {
        finished = true;
        reason = 'Luật 50 nước — hoà.';
    } else if ((next.repetitions[positionKey(next)] || 0) >= 3) {
        finished = true;
        reason = 'Lặp lại thế cờ 3 lần — hoà.';
    } else if (insufficientMaterial(next.board)) {
        finished = true;
        reason = 'Thiếu quân để chiếu hết — hoà.';
    }

    if (finished) {
        next = { ...next, result: { winner, reason } };
        return { ok: true, state: next, finished, winner, reason };
    }

    return { ok: true, state: next };
}

function resignResult(state, side) {
    const winner = side === 'p1' ? 'p2' : 'p1';
    const reason = `${side === 'p1' ? 'Trắng' : 'Đen'} đã xin thua.`;
    return {
        state: { ...state, turn: state.turn, result: { winner, reason } },
        finished: true,
        winner,
        reason,
    };
}

function renderBoard(state) {
    const lines = [];
    for (let r = 0; r < 8; r++) {
        const cells = [];
        for (let c = 0; c < 8; c++) {
            const p = state.board[idxOf(r, c)];
            cells.push(p === '.' ? '·' : PIECE_EMOJI[p] || p);
        }
        lines.push(`${8 - r}  ${cells.join(' ')}`);
    }
    lines.push(`   ${FILES.split('').join(' ')}`);
    return `\`\`\`\n${lines.join('\n')}\n\`\`\``;
}

function renderStatus(state) {
    const lines = [];
    lines.push(`Lượt: **${state.turn === 'w' ? 'Trắng (người 1)' : 'Đen (người 2)'}**`);
    if (inCheck(state, state.turn)) lines.push('⚠️ **Đang bị chiếu!**');
    if (state.last?.lan) lines.push(`Nước cuối: **${state.last.lan}**`);
    if (state.moveLog?.length) {
        lines.push(`Lịch sử: ${state.moveLog.slice(-8).join(' ')}`);
    }
    return lines.join('\n');
}

function sideLabel(state) {
    return state.turn === 'w' ? 'Trắng (người 1)' : 'Đen (người 2)';
}

function playerSide(state) {
    return state.turn === 'w' ? 'p1' : 'p2';
}

function hint() {
    return 'Nhập nước đi UCI: e2e4 · phong cấp e7e8q · nhập thành e1g1.';
}

module.exports = {
    type: 'chess',
    label: 'Cờ vua',
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
    isSquareAttacked,
    indexToSquare: idxToSquare,
    squareToIndex: squareToIdx,
};
