import { useEffect, useState } from 'react';
import { getEntries, isPaused, setPaused, subscribe, type NetworkEntry } from 'react-native-netlog';

// Entries are mutated in place as requests progress; copy them so React sees new objects.
const snapshot = (): NetworkEntry[] => getEntries().map((e) => ({ ...e }));

/**
 * Live list of captured requests (oldest first). Updates are batched to at most
 * one render per `throttleMs`, so a burst of requests doesn't re-render per event.
 */
export function useEntries(throttleMs = 250): NetworkEntry[] {
  const [entries, setEntries] = useState<NetworkEntry[]>(snapshot);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const unsubscribe = subscribe(() => {
      if (timer) return;
      timer = setTimeout(() => {
        timer = null;
        setEntries(snapshot());
      }, throttleMs);
    });
    setEntries(snapshot());
    return () => {
      unsubscribe();
      if (timer) clearTimeout(timer);
    };
  }, [throttleMs]);
  return entries;
}

/** Capture pause state, mirrored in React state. */
export function usePaused(): [boolean, (paused: boolean) => void] {
  const [paused, setLocal] = useState<boolean>(isPaused);
  const set = (p: boolean) => {
    setPaused(p);
    setLocal(p);
  };
  return [paused, set];
}
