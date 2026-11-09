'use strict';

/**
 * trivia.js — đố vui tiếng Việt.
 *
 * Câu hỏi: data/trivia.json (có bộ dự phòng trong triviaFallback.js).
 * Cấu hình: data/trivia-config.json.
 * Thưởng trong ngày: 500 → 300 → 100 → 50 → 0, reset 00:00 giờ Việt Nam.
 * Cooldown: 30 giây sau khi trả lời đúng, riêng từng người.
 */

const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../utils/economy');
const triviaStore = require('../utils/triviaStore');
const { baseEmbed, COLORS, truncate } = require('../utils/ui');
const logger = require('../utils/logger');
const {
    DEFAULT_REWARDS,
    DEFAULT_COOLDOWN_SECONDS,
    DEFAULT_TIMEOUT_SECONDS,
    dateKey,
    rewardFor,
    cooldownRemainingMs,
} = require('./triviaRewards');
const FALLBACK_QUESTIONS = require('./triviaFallback');

const DATA_DIR = path.join(__dirname, '..', 'data');
const QUESTIONS_FILE = path.join(DATA_DIR, 'trivia.json');
const CONFIG_FILE = path.join(DATA_DIR, 'trivia-config.json');

const sessions = new Map();
const LABELS = ['A', 'B', 'C', 'D'];

let questions = [];
let config = {
    rewards: [...DEFAULT_REWARDS],
    cooldown_seconds: DEFAULT_COOLDOWN_SECONDS,
    timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
};

function isValidQuestion(q) {
    return Boolean(q)
        && typeof q.q === 'string' && q.q.trim().length > 0
        && Array.isArray(q.choices) && q.choices.length === 4
        && q.choices.every((c) => typeof c === 'string' && c.trim().length > 0)
        && Number.isInteger(q.answer) && q.answer >= 0 && q.answer < 4;
}

function loadQuestions() {
    try {
        const raw = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
        if (!Array.isArray(raw)) throw new Error('file phải là một mảng câu hỏi');

        const valid = raw.filter(isValidQuestion);
        const skipped = raw.length - valid.length;
        if (skipped > 0) {
            logger.warn(`[trivia] Bỏ qua ${skipped} câu hỏi không hợp lệ trong ${QUESTIONS_FILE}`);
        }
        if (valid.length === 0) throw new Error('không có câu hỏi hợp lệ');

        return valid;
    } catch (err) {
        logger.warn(`[trivia] Không nạp được ${QUESTIONS_FILE}: ${err.message}. Dùng bộ câu hỏi dự phòng.`);
        return FALLBACK_QUESTIONS;
    }
}

function normalizeRewards(value) {
    if (!Array.isArray(value)) return [...DEFAULT_REWARDS];
    const list = value
        .map((v) => Number(v))
        .filter((v) => Number.isInteger(v) && v >= 0 && v <= 100_000);
    return list.length > 0 ? list : [...DEFAULT_REWARDS];
}

function loadConfig() {
    const next = {
        rewards: [...DEFAULT_REWARDS],
        cooldown_seconds: DEFAULT_COOLDOWN_SECONDS,
        timeout_seconds: DEFAULT_TIMEOUT_SECONDS,
    };

    try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
            throw new Error('file phải là một object');
        }

        if (raw.rewards !== undefined) next.rewards = normalizeRewards(raw.rewards);
        if (Number.isInteger(raw.cooldown_seconds) && raw.cooldown_seconds >= 0) {
            next.cooldown_seconds = Math.min(raw.cooldown_seconds, 3600);
        }
        if (Number.isInteger(raw.timeout_seconds) && raw.timeout_seconds >= 5) {
            next.timeout_seconds = Math.min(raw.timeout_seconds, 300);
        }
    } catch (err) {
        logger.warn(`[trivia] Không nạp được ${CONFIG_FILE}: ${err.message}. Dùng cấu hình mặc định.`);
    }

    return next;
}

/** Nạp lại câu hỏi + cấu hình từ đĩa. Dùng cho /trivia-reload. */
function reload() {
    questions = loadQuestions();
    config = loadConfig();
    return {
        questions: questions.length,
        rewards: [...config.rewards],
        cooldownSeconds: config.cooldown_seconds,
        timeoutSeconds: config.timeout_seconds,
    };
}

function rewardScheduleText() {
    const schedule = config.rewards.map((r) => r.toLocaleString()).join(' → ');
    return `${schedule} → 0 xu`;
}

function buildEmbed(session, extra = '') {
    const { question } = session;
    return baseEmbed({
        color: extra ? COLORS.success : COLORS.purple,
        title: '🧠 Trivia',
        description: [
            `**${question.q}**`,
            '',
            ...question.choices.map((c, i) => `**${LABELS[i]}.** ${truncate(c, 90)}`),
            '',
            extra || `Trả lời đúng: **${rewardScheduleText()}** (reset 00:00) • còn ${config.timeout_seconds} giây`,
        ].join('\n'),
        footer: 'Ai cũng có thể bấm đáp án',
    });
}

function buildButtons(session) {
    const row = new ActionRowBuilder();
    session.question.choices.forEach((choice, i) => {
        row.addComponents(new ButtonBuilder()
            .setCustomId(`trivia:answer:${session.id}:${i}`)
            .setLabel(LABELS[i])
            .setStyle(ButtonStyle.Secondary));
    });
    return [row];
}

async function start(interaction) {
    const question = questions[Math.floor(Math.random() * questions.length)];
    const session = {
        id: `tr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
        question,
        answered: false,
        client: interaction.client,
        channelId: interaction.channelId,
        messageId: null,
    };
    sessions.set(session.id, session);

    const msg = await interaction.reply({
        embeds: [buildEmbed(session)],
        components: buildButtons(session),
        fetchReply: true,
    });
    session.messageId = msg.id;

    session.timer = setTimeout(() => timeout(session), config.timeout_seconds * 1000);
    session.timer.unref?.();
}

async function timeout(session) {
    if (session.answered) return;
    session.answered = true;
    try {
        const channel = await session.client.channels.fetch(session.channelId);
        const msg = await channel.messages.fetch(session.messageId);
        await msg.edit({
            embeds: [buildEmbed(session, `⏰ Hết giờ! Đáp án: **${LABELS[session.question.answer]}. ${session.question.choices[session.question.answer]}**`)],
            components: [],
        });
    } catch {
        // bỏ qua
    }
    const cleanup = setTimeout(() => sessions.delete(session.id), 60_000);
    cleanup.unref?.();
}

async function handleButton(interaction, sessionId, rawIndex) {
    const session = sessions.get(sessionId);
    if (!session) return interaction.reply({ content: '⌛ Câu hỏi đã hết hạn.', ephemeral: true });
    if (session.answered) return interaction.reply({ content: 'Câu này đã có đáp án rồi!', ephemeral: true });

    const now = Date.now();
    const remaining = cooldownRemainingMs(
        triviaStore.getLastCorrectAt(interaction.user.id),
        now,
        config.cooldown_seconds,
    );
    if (remaining > 0) {
        const seconds = Math.ceil(remaining / 1000);
        return interaction.reply({
            content: `⏳ Bạn vừa trả lời đúng, chờ **${seconds} giây** nữa mới được trả lời tiếp.`,
            ephemeral: true,
        });
    }

    const index = Number(rawIndex);
    if (index !== session.question.answer) {
        return interaction.reply({ content: '❌ Sai rồi, thử lại nhé!', ephemeral: true });
    }

    session.answered = true;
    clearTimeout(session.timer);

    const slot = triviaStore.consumeRewardSlot(interaction.guildId, dateKey());
    const reward = rewardFor(slot, config.rewards);
    triviaStore.setLastCorrectAt(interaction.user.id, now);

    if (reward > 0) {
        economy.credit(interaction.user.id, reward, {
            type: 'trivia',
            game: 'trivia',
            guildId: interaction.guildId,
        });
    }
    economy.recordGame(interaction.user.id, interaction.guildId, 'trivia', 'win', reward);

    const answer = session.question.choices[session.question.answer];
    const rewardText = reward > 0
        ? `➕ **${reward.toLocaleString()} xu**`
        : '💸 Hết quỹ thưởng hôm nay — **0 xu**';

    await interaction.update({
        embeds: [buildEmbed(session, `🎉 **${interaction.user.username}** trả lời đúng: **${LABELS[session.question.answer]}. ${answer}**\n${rewardText}`)],
        components: [],
    }).catch((err) => logger.debug('[trivia] update:', err.message));

    const cleanup = setTimeout(() => sessions.delete(session.id), 60_000);
    cleanup.unref?.();
}

reload();

module.exports = { start, handleButton, reload, sessions };
