'use strict';

/**
 * evaluator.js — đánh giá bài poker 5 lá và 7 lá (Texas Hold'em).
 *
 * Kết quả: { cat: 0..8, tie: number[] }
 *   cat: 0 High Card, 1 Pair, 2 Two Pair, 3 Trips, 4 Straight,
 *        5 Flush, 6 Full House, 7 Four of a Kind, 8 Straight Flush.
 * tie: các giá trị so sánh giảm dần (đã sắp xếp đúng luật).
 */

const CATEGORY_NAMES = [
    'Mậu thầu (High Card)',
    'Một đôi (Pair)',
    'Hai đôi (Two Pair)',
    'Sám cô (Three of a Kind)',
    'Sảnh (Straight)',
    'Thùng (Flush)',
    'Cù lũ (Full House)',
    'Tứ quý (Four of a Kind)',
    'Thùng phá sảnh (Straight Flush)',
];

function evaluate5(cards) {
    const ranks = cards.map((c) => c.r).sort((a, b) => b - a);
    const suits = cards.map((c) => c.s);
    const flush = suits.every((s) => s === suits[0]);
    const uniq = [...new Set(ranks)];

    let straightHigh = 0;
    if (uniq.length === 5) {
        if (ranks[0] - ranks[4] === 4) straightHigh = ranks[0];
        // A-2-3-4-5 (wheel)
        else if (ranks[0] === 14 && ranks[1] === 5 && ranks[4] === 2) straightHigh = 5;
    }

    const counts = new Map();
    for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
    const groups = [...counts.entries()].sort((a, b) => b[1] - a[1] || b[0] - a[0]);

    if (flush && straightHigh) return { cat: 8, tie: [straightHigh] };
    if (groups[0][1] === 4) return { cat: 7, tie: [groups[0][0], groups[1][0]] };
    if (groups[0][1] === 3 && groups[1][1] === 2) {
        return { cat: 6, tie: [groups[0][0], groups[1][0]] };
    }
    if (flush) return { cat: 5, tie: ranks };
    if (straightHigh) return { cat: 4, tie: [straightHigh] };
    if (groups[0][1] === 3) {
        return { cat: 3, tie: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
    }
    if (groups[0][1] === 2 && groups[1][1] === 2) {
        return {
            cat: 2,
            tie: [groups[0][0], groups[1][0], groups[2][0]],
        };
    }
    if (groups[0][1] === 2) {
        return { cat: 1, tie: [groups[0][0], ...groups.slice(1).map((g) => g[0])] };
    }
    return { cat: 0, tie: ranks };
}

/** So sánh 2 kết quả: >0 nếu a mạnh hơn, <0 nếu yếu hơn, 0 hoà. */
function compare(a, b) {
    if (a.cat !== b.cat) return a.cat - b.cat;
    const n = Math.max(a.tie.length, b.tie.length);
    for (let i = 0; i < n; i++) {
        const x = a.tie[i] ?? 0;
        const y = b.tie[i] ?? 0;
        if (x !== y) return x - y;
    }
    return 0;
}

/** Sinh mọi tổ hợp chập k của mảng. */
function combinations(arr, k) {
    const out = [];
    const pick = (start, cur) => {
        if (cur.length === k) {
            out.push(cur.slice());
            return;
        }
        for (let i = start; i < arr.length; i++) {
            cur.push(arr[i]);
            pick(i + 1, cur);
            cur.pop();
        }
    };
    pick(0, []);
    return out;
}

/** Đánh giá 5–7 lá, trả về tay mạnh nhất. */
function evaluate(cards) {
    if (!Array.isArray(cards) || cards.length < 5) {
        throw new Error('Cần ít nhất 5 lá bài để đánh giá.');
    }
    if (cards.length === 5) return evaluate5(cards);

    let best = null;
    for (const combo of combinations(cards, 5)) {
        const result = evaluate5(combo);
        if (!best || compare(result, best) > 0) best = result;
    }
    return best;
}

function handName(result) {
    return CATEGORY_NAMES[result?.cat ?? 0];
}

module.exports = {
    CATEGORY_NAMES,
    evaluate5,
    evaluate,
    compare,
    handName,
    combinations,
};
