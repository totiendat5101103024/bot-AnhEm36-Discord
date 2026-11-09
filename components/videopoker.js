'use strict';

/** components/videopoker.js — giữ bài / đổi bài. */

const { register } = require('../utils/components');
const videopoker = require('../games/videopoker');

register('vp', async (interaction, args) => {
    const [action, sessionId, index] = args;
    if (!action || !sessionId) return;
    await videopoker.handleButton(interaction, action, sessionId, index);
});
