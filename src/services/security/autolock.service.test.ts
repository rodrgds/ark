import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { getAuthStateForService, setAuthStateForTests } from '@/stores/auth-store';

let autoLockMinutes = 1;
let now = 0;

const realDateNow = Date.now;
const getVaultState = mock(async () => ({ autoLockMinutes }));

mock.module('react-native', () => ({
  AppState: {
    currentState: 'active',
    addEventListener: mock(() => ({ remove: mock(() => undefined) })),
  },
}));

async function flushAsync() {
  await Promise.resolve();
  await Promise.resolve();
}

async function loadService() {
  const { AutoLockService } = await import('@/services/security/autolock.service');
  AutoLockService.setVaultStateLoaderForTests(getVaultState);
  return AutoLockService;
}

function setUnlocked() {
  setAuthStateForTests({
    unlocked: true,
    lastActivityAt: Date.now(),
  });
}

describe('AutoLockService', () => {
  beforeEach(() => {
    autoLockMinutes = 1;
    now = 0;
    Date.now = () => now;
    getVaultState.mockClear();
    setAuthStateForTests({
      unlocked: false,
      lastActivityAt: Date.now(),
    });
  });

  afterEach(async () => {
    const AutoLockService = await loadService();
    AutoLockService.resetForTests();
    Date.now = realDateNow;
  });

  test('locks when the app returns after the background threshold', async () => {
    const AutoLockService = await loadService();
    setUnlocked();

    AutoLockService.onAppStateChange('background');
    now = 61_000;
    AutoLockService.onAppStateChange('active');
    await flushAsync();

    expect(getAuthStateForService().unlocked).toBe(false);
  });

  test('keeps the vault unlocked when background time is below the threshold', async () => {
    const AutoLockService = await loadService();
    setUnlocked();

    AutoLockService.onAppStateChange('background');
    now = 30_000;
    AutoLockService.onAppStateChange('active');
    await flushAsync();

    expect(getAuthStateForService().unlocked).toBe(true);
    expect(AutoLockService.backgroundedAtForTests).toBeNull();
  });

  test('touch updates active-use activity while unlocked', async () => {
    const AutoLockService = await loadService();
    setUnlocked();

    now = 45_000;
    AutoLockService.touch();
    now = 70_000;
    await AutoLockService.enforce();

    expect(getAuthStateForService().unlocked).toBe(true);
  });

  test('uses the latest auto-lock setting on each enforcement', async () => {
    const AutoLockService = await loadService();
    setUnlocked();

    autoLockMinutes = 5;
    await AutoLockService.enforce();

    autoLockMinutes = 1;
    now = 61_000;
    await AutoLockService.enforce();

    expect(getAuthStateForService().unlocked).toBe(false);
  });
});
