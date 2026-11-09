'use strict';

/** components/blackjack.js — Hit / Stand / Double. */

const { register } = require('../utils/components');
const blackjack = require('../games/blackjack');

register('blackjack', async (interaction, args) => {
    const [action, sessionId] = args;
    if (!action || !sessionId) return;
    await blackjack.handleButton(interaction, action, sessionId);
});
