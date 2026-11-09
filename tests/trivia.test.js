'use strict';

/**
 * trivia.test.js — kiểm tra logic thưởng/cooldown và dữ liệu trivia.
 */

const fs = require('fs');
const path = require('path');
const { test, assert, eq } = require('./harness');
const rewards = require('../games/triviaRewards');

test('thưởng đúng thứ tự 500 → 300 → 100 → 50 → 0', () => {
    eq(rewards.rewardFor(0), 500);
    eq(rewards.rewardFor(1), 300);
    eq(rewards.rewardFor(2), 100);
    eq(rewards.rewardFor(3), 50);
    eq(rewards.rewardFor(4), 0);
    eq(rewards.rewardFor(99), 0);
});

test('thưởng theo danh sách tùy chỉnh', () => {
    eq(rewards.rewardFor(0, [10, 5]), 10);
    eq(rewards.rewardFor(1, [10, 5]), 5);
    eq(rewards.rewardFor(2, [10, 5]), 0);
    eq(rewards.rewardFor(0, []), 500, 'danh sách rỗng dùng mặc định');
});

test('cooldown 30 phút', () => {
    const last = 1_000_000;
    eq(rewards.cooldownRemainingMs(last, last, 1800), 1_800_000);
    eq(rewards.cooldownRemainingMs(last, last + 10_000, 1800), 1_790_000);
    eq(rewards.cooldownRemainingMs(last, last + 1_800_000, 1800), 0);
    eq(rewards.cooldownRemainingMs(0, last, 1800), 0);
    eq(rewards.cooldownRemainingMs(last, last, 0), 0);
});

test('hiển thị cooldown thân thiện', () => {
    eq(rewards.formatCooldown(1_800_000), '30 phút');
    eq(rewards.formatCooldown(90_000), '1 phút 30 giây');
    eq(rewards.formatCooldown(45_000), '45 giây');
    eq(rewards.formatCooldown(3_600_000), '1 giờ');
    eq(rewards.formatCooldown(5_400_000), '1 giờ 30 phút');
});

test('reset ngày theo giờ Việt Nam', () => {
    eq(rewards.dateKey(new Date('2026-11-09T16:59:00Z')), '2026-11-09');
    eq(rewards.dateKey(new Date('2026-11-09T17:00:00Z')), '2026-11-10');
});

test('data/trivia.json hợp lệ', () => {
    const file = path.join(__dirname, '..', 'data', 'trivia.json');
    const questions = JSON.parse(fs.readFileSync(file, 'utf-8'));
    assert(Array.isArray(questions) && questions.length > 0, 'phải có câu hỏi');
    for (const q of questions) {
        assert(typeof q.q === 'string' && q.q.trim(), 'câu hỏi không được rỗng');
        assert(Array.isArray(q.choices) && q.choices.length === 4, `câu "${q.q}" phải có 4 đáp án`);
        assert(q.choices.every((c) => typeof c === 'string' && c.trim()), `câu "${q.q}" có đáp án rỗng`);
        assert(Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4, `câu "${q.q}" có answer sai`);
    }
});

test('data/trivia-config.json hợp lệ', () => {
    const file = path.join(__dirname, '..', 'data', 'trivia-config.json');
    const config = JSON.parse(fs.readFileSync(file, 'utf-8'));
    eq(config.rewards, [500, 300, 100, 50]);
    eq(config.cooldown_seconds, 1800);
    assert(Number.isInteger(config.timeout_seconds) && config.timeout_seconds >= 5, 'timeout phải >= 5');
});
