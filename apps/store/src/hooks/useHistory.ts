/**
 * useHistory<T>
 *
 * Generic undo/redo stack.
 * The initial value is the first entry; push() appends a snapshot.
 * undo()/redo() move the cursor without discarding future entries
 * until the next push().
 *
 * maxDepth caps the number of stored snapshots to avoid memory growth.
 */

import { useCallback, useState } from 'react';

export interface HistoryHandle<T> {
  /** Current state at the cursor position */
  state: T;
  /** Append a new snapshot (truncates any redo tail) */
  push: (newState: T) => void;
  /** Move cursor one step back */
  undo: () => void;
  /** Move cursor one step forward */
  redo: () => void;
  /** Reset to a brand-new single-entry history */
  reset: (newInitial: T) => void;
  canUndo: boolean;
  canRedo: boolean;
}

export function useHistory<T>(initial: T, maxDepth = 50): HistoryHandle<T> {
  const [history, setHistory] = useState<{ stack: T[]; idx: number }>({
    stack: [initial],
    idx: 0,
  });

  const push = useCallback(
    (newState: T) => {
      setHistory((prev) => {
        // Truncate redo tail, append new snapshot
        const truncated = prev.stack.slice(0, prev.idx + 1);
        const next = [...truncated, newState];
        // Cap to maxDepth (drop oldest entries)
        const final = next.length > maxDepth ? next.slice(next.length - maxDepth) : next;
        return { stack: final, idx: final.length - 1 };
      });
    },
    [maxDepth]
  );

  const undo = useCallback(() => {
    setHistory((prev) => ({ stack: prev.stack, idx: Math.max(0, prev.idx - 1) }));
  }, []);

  const redo = useCallback(() => {
    setHistory((prev) => ({
      stack: prev.stack,
      idx: Math.min(prev.stack.length - 1, prev.idx + 1),
    }));
  }, []);

  const reset = useCallback((newInitial: T) => {
    setHistory({ stack: [newInitial], idx: 0 });
  }, []);

  return {
    state: history.stack[history.idx],
    push,
    undo,
    redo,
    reset,
    canUndo: history.idx > 0,
    canRedo: history.idx < history.stack.length - 1,
  };
}
