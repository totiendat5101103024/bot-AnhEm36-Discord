'use strict';

/**
 * trivia.js — đố vui tiếng Việt, phần thưởng xu cho người trả lời đúng đầu tiên.
 */

const fs = require('fs');
const path = require('path');
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const economy = require('../utils/economy');
const { baseEmbed, COLORS, truncate } = require('../utils/ui');
const logger = require('../utils/logger');

const QUESTIONS = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'data', 'trivia.json'), 'utf-8'),
);

const sessions = new Map();
const REWARD = 150;
const TIMEOUT_MS = 25_000;
const LABELS = ['A', 'B', 'C', 'D'];

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
            extra || `Trả lời đúng đầu tiên nhận **${REWARD} xu** • còn 25 giây`,
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
    const question = QUESTIONS[Math.floor(Math.random() * QUESTIONS.length)];
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

    session.timer = setTimeout(() => timeout(session), TIMEOUT_MS);
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

    const index = Number(rawIndex);
    if (index !== session.question.answer) {
        return interaction.reply({ content: '❌ Sai rồi, thử lại nhé!', ephemeral: true });
    }

    session.answered = true;
    clearTimeout(session.timer);

    economy.credit(interaction.user.id, REWARD, {
        type: 'trivia',
        game: 'trivia',
        guildId: interaction.guildId,
    });
    economy.recordGame(interaction.user.id, interaction.guildId, 'trivia', 'win', REWARD);

    const answer = session.question.choices[session.question.answer];
    await interaction.update({
        embeds: [buildEmbed(session, `🎉 **${interaction.user.username}** trả lời đúng: **${LABELS[session.question.answer]}. ${answer}**\n➕ **${REWARD} xu**`)],
        components: [],
    }).catch((err) => logger.debug('[trivia] update:', err.message));

    const cleanup = setTimeout(() => sessions.delete(session.id), 60_000);
    cleanup.unref?.();
}

module.exports = { start, handleButton, sessions, REWARD, QUESTIONS };
