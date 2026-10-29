import { useState, useRef, useCallback } from 'react';

export interface HistoryEntry {
  id: string;
  fieldId: string;
  fieldName: string;
  fieldCaption: string;
  prevValue: string;
  nextValue: string;
  timestamp: number;
  label?: string;
}

export const MAX_HISTORY_STEPS = 10;

interface UseFormHistoryOptions {
  onApplyValue: (fieldId: string, value: string) => void;
  onNotify?: (message: string) => void;
}

export function useFormHistory({ onApplyValue, onNotify }: UseFormHistoryOptions) {
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [currentIndex, setCurrentIndex] = useState<number>(-1);
  const isInternalUpdate = useRef(false);
  const lastEditTime = useRef<number>(0);
  const lastFieldId = useRef<string | null>(null);

  const canUndo = currentIndex >= 0;
  const canRedo = currentIndex < history.length - 1;

  /**
   * Record a new change in history (capped at last 10 entries)
   */
  const recordChange = useCallback(
    (
      fieldId: string,
      fieldName: string,
      fieldCaption: string,
      prevValue: string,
      nextValue: string,
      forceNewEntry: boolean = false
    ) => {
      // Ignore if called as a result of an internal undo/redo action
      if (isInternalUpdate.current) return;
      if (prevValue === nextValue) return;

      const now = Date.now();
      const isCoalesceable =
        !forceNewEntry &&
        lastFieldId.current === fieldId &&
        now - lastEditTime.current < 1200 &&
        currentIndex >= 0;

      lastFieldId.current = fieldId;
      lastEditTime.current = now;

      setHistory(prevHistory => {
        // Slice off any redo branches beyond currentIndex
        const base = prevHistory.slice(0, currentIndex + 1);

        if (isCoalesceable && base.length > 0) {
          const lastIndex = base.length - 1;
          const updatedEntry: HistoryEntry = {
            ...base[lastIndex],
            nextValue,
            timestamp: now,
          };
          const next = [...base];
          next[lastIndex] = updatedEntry;
          return next;
        }

        const newEntry: HistoryEntry = {
          id: `hist_${now}_${Math.random().toString(36).substr(2, 6)}`,
          fieldId,
          fieldName,
          fieldCaption: fieldCaption || fieldName,
          prevValue,
          nextValue,
          timestamp: now,
        };

        const next = [...base, newEntry];
        if (next.length > MAX_HISTORY_STEPS) {
          // Keep only the most recent 10 changes
          return next.slice(next.length - MAX_HISTORY_STEPS);
        }
        return next;
      });

      setCurrentIndex(prev => {
        const nextLen = Math.min(prev + 2, MAX_HISTORY_STEPS);
        return isCoalesceable ? prev : nextLen - 1;
      });
    },
    [currentIndex]
  );

  /**
   * Undo the last change
   */
  const undo = useCallback((): HistoryEntry | null => {
    if (currentIndex < 0 || history.length === 0) return null;

    const entryToUndo = history[currentIndex];
    if (!entryToUndo) return null;

    isInternalUpdate.current = true;
    try {
      onApplyValue(entryToUndo.fieldId, entryToUndo.prevValue);
      setCurrentIndex(prev => prev - 1);
      const displayLabel = entryToUndo.fieldCaption || entryToUndo.fieldName;
      onNotify?.(`Undone: ${displayLabel} reverted to previous value`);
      return entryToUndo;
    } finally {
      // Small timeout to prevent immediate race conditions
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 50);
    }
  }, [currentIndex, history, onApplyValue, onNotify]);

  /**
   * Redo the next change
   */
  const redo = useCallback((): HistoryEntry | null => {
    if (currentIndex >= history.length - 1 || history.length === 0) return null;

    const entryToRedo = history[currentIndex + 1];
    if (!entryToRedo) return null;

    isInternalUpdate.current = true;
    try {
      onApplyValue(entryToRedo.fieldId, entryToRedo.nextValue);
      setCurrentIndex(prev => prev + 1);
      const displayLabel = entryToRedo.fieldCaption || entryToRedo.fieldName;
      onNotify?.(`Redone: ${displayLabel} re-applied`);
      return entryToRedo;
    } finally {
      setTimeout(() => {
        isInternalUpdate.current = false;
      }, 50);
    }
  }, [currentIndex, history, onApplyValue, onNotify]);

  /**
   * Jump directly to a specific point in the 10-step history
   */
  const jumpToHistoryIndex = useCallback(
    (targetIndex: number) => {
      if (targetIndex === currentIndex || targetIndex < -1 || targetIndex >= history.length) {
        return;
      }

      isInternalUpdate.current = true;
      try {
        if (targetIndex < currentIndex) {
          // Revert backwards from currentIndex down to targetIndex + 1
          for (let i = currentIndex; i > targetIndex; i--) {
            const entry = history[i];
            onApplyValue(entry.fieldId, entry.prevValue);
          }
        } else {
          // Apply forwards from currentIndex + 1 up to targetIndex
          for (let i = currentIndex + 1; i <= targetIndex; i++) {
            const entry = history[i];
            onApplyValue(entry.fieldId, entry.nextValue);
          }
        }
        setCurrentIndex(targetIndex);
        onNotify?.(`Jumped to history state ${targetIndex + 1} of ${history.length}`);
      } finally {
        setTimeout(() => {
          isInternalUpdate.current = false;
        }, 50);
      }
    },
    [currentIndex, history, onApplyValue, onNotify]
  );

  const clearHistory = useCallback(() => {
    setHistory([]);
    setCurrentIndex(-1);
    lastFieldId.current = null;
  }, []);

  return {
    history,
    currentIndex,
    canUndo,
    canRedo,
    recordChange,
    undo,
    redo,
    jumpToHistoryIndex,
    clearHistory,
    maxSteps: MAX_HISTORY_STEPS,
  };
}
