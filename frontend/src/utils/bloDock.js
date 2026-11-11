import { useEffect, useSyncExternalStore } from 'react';

/**
 * B-LO can live in two places: the floating chat bubble (every page) or docked
 * in a page's side panel (the schedule builder). Only one shows at a time:
 * while a docked B-LO is open, the floating bubble hides.
 */
let docked = 0;
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const subscribe = (l) => { listeners.add(l); return () => listeners.delete(l); };
const snapshot = () => docked > 0;

/** True while a docked B-LO panel is open somewhere on the page. */
export const useBloDocked = () => useSyncExternalStore(subscribe, snapshot, snapshot);

/** Call from a docked B-LO panel: hides the floating bubble while `active`. */
export const useDockBlo = (active = true) => {
  useEffect(() => {
    if (!active) return undefined;
    docked += 1;
    emit();
    return () => { docked -= 1; emit(); };
  }, [active]);
};
