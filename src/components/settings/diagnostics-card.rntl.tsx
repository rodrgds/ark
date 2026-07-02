import { describe, expect, mock, test } from 'bun:test';
import * as React from 'react';
import { installCommonRntlMocks } from '@/test/rntl-mocks';
import type { DiagnosticReport } from '@/types/sensors';

installCommonRntlMocks(mock);

const { fireEvent, render } = await import('@testing-library/react-native');
const { DiagnosticsCard } = await import('@/components/settings/diagnostics-card');

const report: DiagnosticReport = {
  sensors: {
    compass: true,
    barometer: true,
    level: true,
    pedometer: true,
    light: false,
    location: true,
  },
  network: 'offline',
  directories: {},
  sqlCipherActive: true,
  databaseEncryption: {
    active: true,
    runtimeActive: true,
    databaseState: 'encrypted',
    stateLabel: 'Encrypted database',
    encryptionEnabled: true,
    keyStored: true,
    keyStrategy: 'SecureStore device root key with SQLCipher purpose derivation',
    migrationStatus: 'Database encryption is available as an opt-in SQLCipher export.',
    existingDataStatus: 'Ark uses a fresh pre-release database baseline.',
    passphraseRekeyStatus:
      'SQLCipher is optional. When enabled, it uses a purpose-derived device root key and rotates that root during vault passphrase changes.',
    plaintextMigrationImplemented: true,
    vaultPassphraseRekeyImplemented: true,
    note: 'SQLCipher runtime active.',
  },
  ftsAvailable: true,
  aiAdapter: 'llama',
  aiStatusMessage: 'Gemma is ready for offline answers.',
  routingEngine: {
    available: true,
    engine: 'valhalla',
  },
  routingData: {
    readyCount: 0,
    readyRegionNames: [],
    downloadingCount: 0,
    failedCount: 0,
    missingGraphCount: 1,
    message:
      'Navigation data was marked ready but the graph file is missing. Retry the navigation download.',
  },
};

describe('DiagnosticsCard', () => {
  test('shows the database key strategy and optional SQLCipher status', async () => {
    const view = await render(<DiagnosticsCard report={report} />);

    expect(view.getByText('Database encryption: active')).toBeOnTheScreen();
    expect(view.getByText('Database state: Encrypted database')).toBeOnTheScreen();
    expect(view.getByText('SQLCipher runtime: available')).toBeOnTheScreen();
    expect(
      view.getByText('DB key: SecureStore device root key with SQLCipher purpose derivation')
    ).toBeOnTheScreen();
    expect(
      view.getByText('Database encryption is available as an opt-in SQLCipher export.')
    ).toBeOnTheScreen();
    expect(view.getByText(/fresh pre-release database baseline/)).toBeOnTheScreen();
    expect(view.getByText(/SQLCipher is optional/)).toBeOnTheScreen();
    expect(view.getByText('Routing data: not ready')).toBeOnTheScreen();
    expect(view.getByText(/graph file is missing/)).toBeOnTheScreen();
  });

  test('shows the encryption action for plaintext installs', async () => {
    const onMigrate = mock();
    const plaintextReport: DiagnosticReport = {
      ...report,
      databaseEncryption: {
        ...report.databaseEncryption,
        active: false,
        databaseState: 'plaintext',
        stateLabel: 'Plaintext database',
      },
    };

    const view = await render(
      <DiagnosticsCard report={plaintextReport} onMigratePlaintextDatabase={onMigrate} />
    );

    fireEvent.press(view.getByText('Encrypt DB'));

    expect(onMigrate).toHaveBeenCalledTimes(1);
  });
});
