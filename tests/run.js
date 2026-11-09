'use strict';

/**
 * run.js — chạy toàn bộ test logic thuần.
 *
 *   npm test
 *   node tests/run.js
 */

const harness = require('./harness');

console.log('▶ Poker evaluator');
require('./poker.test');

console.log('▶ Cờ vua');
require('./chess.test');

console.log('▶ Caro/Gomoku');
require('./caro.test');

console.log('▶ Bầu Cua');
require('./baucua.test');

console.log('▶ Trivia');
require('./trivia.test');

const ok = harness.report();
process.exit(ok ? 0 : 1);
