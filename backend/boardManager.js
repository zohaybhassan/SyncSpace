const { v4: uuidv4 } = require('uuid');

// Default board template for new boards
function createDefaultBoard(boardId, boardName = 'My Board') {
  const col1 = uuidv4();
  const col2 = uuidv4();
  const col3 = uuidv4();
  return {
    id: boardId,
    name: boardName,
    columns: [
      { id: col1, title: 'To Do', order: 0 },
      { id: col2, title: 'In Progress', order: 1 },
      { id: col3, title: 'Done', order: 2 },
    ],
    cards: [
      { id: uuidv4(), columnId: col1, title: 'Design database schema', description: 'Plan out all tables and relations', order: 0, color: '#6366f1', createdAt: Date.now() },
      { id: uuidv4(), columnId: col1, title: 'Set up CI/CD pipeline', description: '', order: 1, color: '#06b6d4', createdAt: Date.now() },
      { id: uuidv4(), columnId: col2, title: 'Build REST API', description: 'Implement all CRUD endpoints', order: 0, color: '#f59e0b', createdAt: Date.now() },
      { id: uuidv4(), columnId: col3, title: 'Project kickoff', description: 'Initial planning meeting done', order: 0, color: '#10b981', createdAt: Date.now() },
    ],
    version: 1,
    updatedAt: Date.now(),
  };
}

// Apply a delta mutation to the board state
// Returns { success, state, error }
function applyMutation(state, mutation) {
  const { type, payload, clientVersion } = mutation;

  // Reject stale mutations (allow up to 10 versions behind)
  if (clientVersion && state.version - clientVersion > 10) {
    return { success: false, error: 'mutation_too_stale', state };
  }

  let newState = deepClone(state);

  switch (type) {
    case 'ADD_CARD': {
      const card = {
        id: payload.id || uuidv4(),
        columnId: payload.columnId,
        title: payload.title || 'New Card',
        description: payload.description || '',
        order: newState.cards.filter(c => c.columnId === payload.columnId).length,
        color: payload.color || '#6366f1',
        createdAt: Date.now(),
      };
      newState.cards.push(card);
      break;
    }

    case 'UPDATE_CARD': {
      const idx = newState.cards.findIndex(c => c.id === payload.id);
      if (idx === -1) return { success: false, error: 'card_not_found', state };
      newState.cards[idx] = { ...newState.cards[idx], ...payload.changes };
      break;
    }

    case 'DELETE_CARD': {
      newState.cards = newState.cards.filter(c => c.id !== payload.id);
      break;
    }

    case 'MOVE_CARD': {
      // payload: { cardId, fromColumnId, toColumnId, newOrder }
      const card = newState.cards.find(c => c.id === payload.cardId);
      if (!card) return { success: false, error: 'card_not_found', state };

      // Remove from old position
      newState.cards = newState.cards.filter(c => c.id !== payload.cardId);

      // Re-order remaining cards in destination column
      const destCards = newState.cards
        .filter(c => c.columnId === payload.toColumnId)
        .sort((a, b) => a.order - b.order);

      // Insert at new position
      destCards.splice(payload.newOrder, 0, {
        ...card,
        columnId: payload.toColumnId,
      });

      // Update orders
      destCards.forEach((c, i) => { c.order = i; });

      // Also fix source column orders if different
      if (payload.fromColumnId !== payload.toColumnId) {
        const srcCards = newState.cards
          .filter(c => c.columnId === payload.fromColumnId)
          .sort((a, b) => a.order - b.order);
        srcCards.forEach((c, i) => { c.order = i; });
      }

      // Rebuild cards array
      const otherCards = newState.cards.filter(
        c => c.columnId !== payload.toColumnId && c.columnId !== payload.fromColumnId
      );
      const srcCards2 = payload.fromColumnId !== payload.toColumnId
        ? newState.cards.filter(c => c.columnId === payload.fromColumnId)
        : [];
      newState.cards = [...otherCards, ...srcCards2, ...destCards];
      break;
    }

    case 'ADD_COLUMN': {
      const col = {
        id: payload.id || uuidv4(),
        title: payload.title || 'New Column',
        order: newState.columns.length,
      };
      newState.columns.push(col);
      break;
    }

    case 'UPDATE_COLUMN': {
      const idx = newState.columns.findIndex(c => c.id === payload.id);
      if (idx === -1) return { success: false, error: 'column_not_found', state };
      newState.columns[idx] = { ...newState.columns[idx], ...payload.changes };
      break;
    }

    case 'DELETE_COLUMN': {
      newState.columns = newState.columns.filter(c => c.id !== payload.id);
      newState.cards = newState.cards.filter(c => c.columnId !== payload.id);
      break;
    }

    case 'UPDATE_BOARD_NAME': {
      newState.name = payload.name;
      break;
    }

    default:
      return { success: false, error: 'unknown_mutation_type', state };
  }

  newState.version = state.version + 1;
  newState.updatedAt = Date.now();
  return { success: true, state: newState };
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

module.exports = { createDefaultBoard, applyMutation };
