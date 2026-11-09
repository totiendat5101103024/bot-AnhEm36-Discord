'use strict';

/** components/trivia.js — chọn đáp án A/B/C/D. */

const { register } = require('../utils/components');
const trivia = require('../games/trivia');

register('trivia', async (interaction, args) => {
    const [action, sessionId, index] = args;
    if (action !== 'answer' || !sessionId) return;
    await trivia.handleButton(interaction, sessionId, index);
});
