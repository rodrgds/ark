import { beforeEach, describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { DiagnosticReport } from '@/types/sensors';

installCommonRntlMocks(mock);

const showSheetAlert = mock();

mock.module('@/components/ui/sheet-alert', () => ({
  showSheetAlert,
}));

const { fireEvent, render } = await import('@testing-library/react-native');
const { SecuritySection } = await import('@/components/settings/security-section');

beforeEach(() => {
  showSheetAlert.mockClear();
});

function databaseEncryption(
  state: DiagnosticReport['databaseEncryption']['databaseState']
): DiagnosticReport['databaseEncryption'] {
  return {
    active: state === 'encrypted',
    runtimeActive: true,
    databaseState: state,
    stateLabel: state === 'encrypted' ? 'Encrypted database' : 'Plaintext database',
    encryptionEnabled: state === 'encrypted',
    keyStored: state === 'encrypted',
    keyStrategy:
      state === 'encrypted'
        ? 'SecureStore device root key with SQLCipher purpose derivation'
        : 'Encryption disabled by user preference',
    migrationStatus:
      state === 'encrypted'
        ? 'Database encryption is available as an opt-in SQLCipher export.'
        : 'Database encryption is off. Enable it in Security when battery budget allows.',
    existingDataStatus: 'Ark uses a fresh pre-release database baseline.',
    passphraseRekeyStatus:
      'SQLCipher is optional. When enabled, it uses a purpose-derived device root key and rotates that root during vault passphrase changes.',
    plaintextMigrationImplemented: true,
    vaultPassphraseRekeyImplemented: true,
    note: state === 'encrypted' ? 'SQLCipher runtime active.' : 'Database encryption is disabled.',
  };
}

async function renderSecuritySection(
  overrides: Partial<React.ComponentProps<typeof SecuritySection>> = {}
) {
  const props: React.ComponentProps<typeof SecuritySection> = {
    vaultProtectionEnabled: false,
    vaultUnlocked: true,
    autoLockMinutes: 5,
    setLockMinutes: mock(),
    biometricsEnabled: false,
    biometricsBusy: false,
    toggleBiometrics: mock(),
    changePassword: mock(async () => ({ ok: true })),
    enableVaultProtection: mock(async () => ({ ok: true })),
    disableVaultProtection: mock(async () => ({ ok: true })),
    databaseEncryption: databaseEncryption('plaintext'),
    encryptionBusy: false,
    onEnableDatabaseEncryption: mock(),
    onDisableDatabaseEncryption: mock(),
    passwordBusy: false,
    onLockPress: mock(),
    ...overrides,
  };
  return { props, view: await render(<SecuritySection {...props} />) };
}

describe('SecuritySection', () => {
  test('enables passphrase protection after onboarding skips it', async () => {
    const enableVaultProtection = mock(async () => ({ ok: true }));
    const { view } = await renderSecuritySection({ enableVaultProtection });

    expect(view.getByText('Passphrase protection is off for fast access.')).toBeOnTheScreen();
    expect(view.queryByText('Lock')).toBeNull();
    await fireEvent.changeText(view.getByPlaceholderText('New passphrase'), 'correct horse');
    await fireEvent.changeText(view.getByPlaceholderText('Password hint'), 'field words');
    await fireEvent.press(view.getByText('Turn On Passphrase'));

    expect(enableVaultProtection).toHaveBeenCalledWith({
      nextPassword: 'correct horse',
      passwordHint: 'field words',
    });
    expect(showSheetAlert).toHaveBeenCalledWith(
      'Passphrase protection on',
      'Secure notes now require the vault passphrase.'
    );
  });

  test('can disable passphrase protection and encrypted database separately', async () => {
    const disableVaultProtection = mock(async () => ({ ok: true }));
    const onDisableDatabaseEncryption = mock();
    const { view } = await renderSecuritySection({
      vaultProtectionEnabled: true,
      vaultUnlocked: true,
      disableVaultProtection,
      databaseEncryption: databaseEncryption('encrypted'),
      onDisableDatabaseEncryption,
    });

    expect(view.getByText('Secure notes require an unlocked vault.')).toBeOnTheScreen();
    expect(view.getByText('Lock')).toBeOnTheScreen();
    await fireEvent.changeText(view.getByPlaceholderText('Current passphrase'), 'correct horse');
    await fireEvent.press(view.getByText('Turn Off Passphrase'));
    await fireEvent.press(view.getByText('Use Plaintext'));

    expect(disableVaultProtection).toHaveBeenCalledWith('correct horse');
    expect(onDisableDatabaseEncryption).toHaveBeenCalledTimes(1);
  });
});
