'use strict';

/** components/poker.js — nút bấm ván Texas Hold'em. */

const { register } = require('../utils/components');
const manager = require('../games/poker/manager');

register('poker', async (interaction, args) => {
    const [action, gameId] = args;
    if (!action || !gameId) return;
    await manager.handleButton(interaction, action, gameId);
});
