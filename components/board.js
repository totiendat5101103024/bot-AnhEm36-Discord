'use strict';

/** components/board.js — nút Đánh / Xin thua + modal nhập nước đi. */

const { register } = require('../utils/components');
const service = require('../games/board/service');

register('board', async (interaction, args) => {
    const [action, gameId] = args;
    if (!action || !gameId) return;
    await service.handleButton(interaction, action, gameId);
});
