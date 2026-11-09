'use strict';

/**
 * triviaRewards.js — logic thuần cho thưởng/cooldown của trivia.
 * Không import DB để test được độc lập.
 */

const VN_TZ = 'Asia/Ho_Chi_Minh';

const DEFAULT_REWARDS = [500, 300, 100, 50];
const DEFAULT_COOLDOWN_SECONDS = 1800;
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

/** Hiển thị thời gian chờ thân thiện: "30 phút", "1 phút 30 giây", "45 giây". */
function formatCooldown(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    if (totalSeconds <= 0) return '0 giây';

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) return minutes > 0 ? `${hours} giờ ${minutes} phút` : `${hours} giờ`;
    if (minutes > 0) return seconds > 0 ? `${minutes} phút ${seconds} giây` : `${minutes} phút`;
    return `${seconds} giây`;
}

module.exports = {
    VN_TZ,
    DEFAULT_REWARDS,
    DEFAULT_COOLDOWN_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    dateKey,
    rewardFor,
    cooldownRemainingMs,
    formatCooldown,
};
