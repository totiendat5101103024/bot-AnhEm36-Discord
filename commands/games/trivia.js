'use strict';

const { SlashCommandBuilder } = require('discord.js');
const trivia = require('../../games/trivia');

module.exports = {
    cooldown: 8,
    data: new SlashCommandBuilder()
        .setName('trivia')
        .setDescription('Câu hỏi đố vui — trả lời đúng nhận thưởng theo quỹ ngày'),

    async execute(interaction) {
        await trivia.start(interaction);
    },
};
