import { describe, expect, mock, test } from 'bun:test';
import type { NetInfoState } from '@react-native-community/netinfo';

mock.module('@react-native-community/netinfo', () => ({
  default: {
    fetch: async () => ({ isConnected: true, isInternetReachable: true }),
    addEventListener: () => () => undefined,
  },
}));

function netState(patch: Partial<NetInfoState>): NetInfoState {
  return {
    type: 'unknown',
    isConnected: null,
    isInternetReachable: null,
    details: null,
    ...patch,
  } as NetInfoState;
}

describe('NetworkService', () => {
  test('does not treat a VPN tunnel as online without confirmed reachability', async () => {
    const { NetworkService } = await import('@/services/connectivity/network.service');

    expect(
      NetworkService.isOnline(
        netState({ type: 'vpn' as NetInfoState['type'], isConnected: true })
      )
    ).toBe(false);
  });

  test('allows VPN connections only when the internet is reachable', async () => {
    const { NetworkService } = await import('@/services/connectivity/network.service');

    expect(
      NetworkService.isOnline(
        netState({
          type: 'vpn' as NetInfoState['type'],
          isConnected: true,
          isInternetReachable: true,
        })
      )
    ).toBe(true);
  });

  test('falls back to the connection flag for physical links while reachability is pending', async () => {
    const { NetworkService } = await import('@/services/connectivity/network.service');

    expect(NetworkService.isOnline(netState({ type: 'wifi', isConnected: true }))).toBe(true);
    expect(NetworkService.isOnline(netState({ type: 'cellular', isConnected: true }))).toBe(true);
  });
});
