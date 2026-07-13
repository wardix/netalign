import { useCallback, useEffect, useRef, useState, type MutableRefObject } from 'react';
import { message } from 'antd';
import { applyRedoCommand, applyUndoCommand } from '../history/applyHistoryCommand.ts';
import {
  canRedo,
  canUndo,
  clearHistory,
  createEmptyHistory,
  popRedo,
  popUndo,
  pushHistory,
  type HistoryCommand,
  type HistoryState,
} from '../history/historyStack.ts';
import { useI18n } from '../i18n/I18nProvider.tsx';
import { getApiErrorMessage } from '../api/client.ts';
import { translateApiError } from '../i18n/translations.ts';

export interface UseCommandHistoryResult {
  canUndo: boolean;
  canRedo: boolean;
  record: (command: HistoryCommand) => void;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
  clear: () => void;
  /** True while an undo/redo API batch is in flight (mutations should not record). */
  isApplyingRef: MutableRefObject<boolean>;
}

export function useCommandHistory(
  activeTopologyId: string | null,
  onApplied: () => void,
): UseCommandHistoryResult {
  const { t } = useI18n();
  const [history, setHistory] = useState<HistoryState>(createEmptyHistory);
  const isApplyingRef = useRef(false);
  const historyRef = useRef(history);
  historyRef.current = history;

  useEffect(() => {
    setHistory(clearHistory());
  }, [activeTopologyId]);

  const record = useCallback((command: HistoryCommand) => {
    if (isApplyingRef.current) return;
    setHistory(prev => pushHistory(prev, command));
  }, []);

  const clear = useCallback(() => {
    setHistory(clearHistory());
  }, []);

  const undo = useCallback(async () => {
    const popped = popUndo(historyRef.current);
    if (!popped) return;

    isApplyingRef.current = true;
    try {
      await applyUndoCommand(popped.command);
      setHistory(popped.state);
      onApplied();
      message.success(t('history.undone'));
    } catch (err) {
      console.error(err);
      message.error(
        translateApiError(getApiErrorMessage(err, t('history.undoFailed')), t),
      );
    } finally {
      isApplyingRef.current = false;
    }
  }, [onApplied, t]);

  const redo = useCallback(async () => {
    const popped = popRedo(historyRef.current);
    if (!popped) return;

    isApplyingRef.current = true;
    try {
      await applyRedoCommand(popped.command);
      setHistory(popped.state);
      onApplied();
      message.success(t('history.redone'));
    } catch (err) {
      console.error(err);
      message.error(
        translateApiError(getApiErrorMessage(err, t('history.redoFailed')), t),
      );
    } finally {
      isApplyingRef.current = false;
    }
  }, [onApplied, t]);

  return {
    canUndo: canUndo(history),
    canRedo: canRedo(history),
    record,
    undo,
    redo,
    clear,
    isApplyingRef,
  };
}
