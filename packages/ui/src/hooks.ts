import { useSyncExternalStore } from 'react';
import {
  getPairingStatus,
  isFeatureEnabled,
  subscribeConfig,
  subscribePairing,
  type NetLogFeatures,
  type PairingStatus,
} from 'react-native-netlog';

/** Re-renders when `configure()` changes the feature. Use it to hide entry points, e.g. a "Connect to desktop" row. */
export function useNetLogFeature(name: keyof NetLogFeatures): boolean {
  return useSyncExternalStore(
    subscribeConfig,
    () => isFeatureEnabled(name),
    () => isFeatureEnabled(name),
  );
}

export function usePairingStatus(): PairingStatus {
  return useSyncExternalStore(subscribePairing, getPairingStatus, getPairingStatus);
}
