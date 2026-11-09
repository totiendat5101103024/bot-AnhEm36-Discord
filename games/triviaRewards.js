'use strict';

/**
 * triviaRewards.js — logic thuần cho thưởng/cooldown của trivia.
 * Không import DB để test được độc lập.
 */

const VN_TZ = 'Asia/Ho_Chi_Minh';

const DEFAULT_REWARDS = [500, 300, 100, 50];
const DEFAULT_COOLDOWN_SECONDS = 30;
const DEFAULT_TIMEOUT_SECONDS = 25;

/** Ngày theo giờ Việt Nam, dạng YYYY-MM-DD. */
function dateKey(date = new Date()) {
    return date.toLocaleDateString('en-CA', { timeZone: VN_TZ });
}

/** Thưởng cho lượt đúng thứ `count` (0-based); hết danh sách thì 0. */
function rewardFor(count, rewards = DEFAULT_REWARDS) {
    const list = Array.isArray(rewards) && rewards.length > 0 ? rewards : DEFAULT_REWARDS;
    const value = list[count];
    return Number.isInteger(value) && value > 0 ? value : 0;
}

/** Số mili-giây còn phải chờ; 0 nếu đã hết cooldown. */
function cooldownRemainingMs(lastCorrectAt, nowMs, cooldownSeconds) {
    if (!lastCorrectAt || cooldownSeconds <= 0) return 0;
    const remaining = lastCorrectAt + cooldownSeconds * 1000 - nowMs;
    return remaining > 0 ? remaining : 0;
}

module.exports = {
    VN_TZ,
    DEFAULT_REWARDS,
    DEFAULT_COOLDOWN_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    dateKey,
    rewardFor,
    cooldownRemainingMs,
};
