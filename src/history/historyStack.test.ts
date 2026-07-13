import { describe, expect, test } from 'bun:test';
import {
  canRedo,
  canUndo,
  clearHistory,
  createEmptyHistory,
  MAX_HISTORY,
  popRedo,
  popUndo,
  pushHistory,
  type HistoryCommand,
} from './historyStack.ts';

function sampleCommand(id: string): HistoryCommand {
  return {
    type: 'addNode',
    topologyId: 'topology-1',
    node: { id, type: 'subnet', label: id },
  };
}

describe('historyStack', () => {
  test('push enables undo and clears future', () => {
    let state = createEmptyHistory();
    state = pushHistory(state, sampleCommand('a'));
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);

    const undone = popUndo(state);
    expect(undone).not.toBeNull();
    state = undone!.state;
    expect(canRedo(state)).toBe(true);

    state = pushHistory(state, sampleCommand('b'));
    expect(canRedo(state)).toBe(false);
    expect(state.past.map(c => (c.type === 'addNode' ? c.node.id : ''))).toEqual(['b']);
  });

  test('undo then redo restores stack', () => {
    let state = createEmptyHistory();
    state = pushHistory(state, sampleCommand('a'));
    state = pushHistory(state, sampleCommand('b'));

    const u1 = popUndo(state)!;
    expect(u1.command.type === 'addNode' && u1.command.node.id).toBe('b');
    state = u1.state;

    const r1 = popRedo(state)!;
    expect(r1.command.type === 'addNode' && r1.command.node.id).toBe('b');
    state = r1.state;
    expect(canUndo(state)).toBe(true);
    expect(canRedo(state)).toBe(false);
  });

  test('clearHistory empties both stacks', () => {
    let state = pushHistory(createEmptyHistory(), sampleCommand('a'));
    const undone = popUndo(state)!;
    state = undone.state;
    state = clearHistory();
    expect(canUndo(state)).toBe(false);
    expect(canRedo(state)).toBe(false);
  });

  test('caps history length at MAX_HISTORY', () => {
    let state = createEmptyHistory();
    for (let i = 0; i < MAX_HISTORY + 5; i++) {
      state = pushHistory(state, sampleCommand(`n-${i}`));
    }
    expect(state.past.length).toBe(MAX_HISTORY);
    expect(state.past[0]?.type === 'addNode' && state.past[0].node.id).toBe('n-5');
  });

  test('popUndo/popRedo return null on empty stacks', () => {
    expect(popUndo(createEmptyHistory())).toBeNull();
    expect(popRedo(createEmptyHistory())).toBeNull();
  });
});
