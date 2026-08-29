const test = require('node:test');
const assert = require('node:assert/strict');

const { createDefaultBoard, applyMutation } = require('../boardManager');

test('createDefaultBoard creates baseline board shape', () => {
  const board = createDefaultBoard('board123', 'Team Board');

  assert.equal(board.id, 'board123');
  assert.equal(board.name, 'Team Board');
  assert.equal(board.columns.length, 3);
  assert.equal(board.cards.length, 4);
  assert.equal(board.version, 1);
  assert.ok(typeof board.updatedAt === 'number');
});

test('applyMutation ADD_CARD appends card and bumps version', () => {
  const board = createDefaultBoard('b1', 'Test');
  const targetColumn = board.columns[0].id;

  const result = applyMutation(board, {
    type: 'ADD_CARD',
    payload: { id: 'card-new', columnId: targetColumn, title: 'New task' },
    clientVersion: board.version,
  });

  assert.equal(result.success, true);
  assert.equal(result.state.version, board.version + 1);
  const added = result.state.cards.find((card) => card.id === 'card-new');
  assert.ok(added);
  assert.equal(added.columnId, targetColumn);
  assert.equal(added.title, 'New task');
});

test('applyMutation rejects stale mutation more than 10 versions behind', () => {
  const state = {
    id: 'stale-board',
    name: 'Stale',
    columns: [],
    cards: [],
    version: 25,
    updatedAt: Date.now(),
  };

  const result = applyMutation(state, {
    type: 'UPDATE_BOARD_NAME',
    payload: { name: 'Ignored' },
    clientVersion: 14,
  });

  assert.equal(result.success, false);
  assert.equal(result.error, 'mutation_too_stale');
  assert.equal(result.state, state);
});

test('applyMutation MOVE_CARD across columns updates card location and ordering', () => {
  const state = {
    id: 'move-board',
    name: 'Move board',
    columns: [
      { id: 'todo', title: 'To Do', order: 0 },
      { id: 'done', title: 'Done', order: 1 },
    ],
    cards: [
      { id: 'c1', columnId: 'todo', title: 'A', description: '', order: 0, color: '#6366f1', createdAt: 1 },
      { id: 'c2', columnId: 'todo', title: 'B', description: '', order: 1, color: '#6366f1', createdAt: 2 },
      { id: 'c3', columnId: 'done', title: 'C', description: '', order: 0, color: '#6366f1', createdAt: 3 },
    ],
    version: 3,
    updatedAt: Date.now(),
  };

  const result = applyMutation(state, {
    type: 'MOVE_CARD',
    payload: {
      cardId: 'c2',
      fromColumnId: 'todo',
      toColumnId: 'done',
      newOrder: 1,
    },
    clientVersion: state.version,
  });

  assert.equal(result.success, true);
  const moved = result.state.cards.find((card) => card.id === 'c2');
  assert.ok(moved);
  assert.equal(moved.columnId, 'done');

  const todoCards = result.state.cards
    .filter((card) => card.columnId === 'todo')
    .sort((a, b) => a.order - b.order);
  const doneCards = result.state.cards
    .filter((card) => card.columnId === 'done')
    .sort((a, b) => a.order - b.order);

  assert.deepEqual(todoCards.map((card) => card.id), ['c1']);
  assert.deepEqual(doneCards.map((card) => card.id), ['c3', 'c2']);
  assert.deepEqual(doneCards.map((card) => card.order), [0, 1]);
});
