import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { SQLCIPHER_NOTE } from '@/services/db/schema';
import { DiagnosticsService } from '@/services/sensors/diagnostics.service';
import type { DiagnosticReport } from '@/types/sensors';
import * as React from 'react';

export default function DiagnosticsTool() {
  const [report, setReport] = React.useState<DiagnosticReport | null>(null);

  React.useEffect(() => {
    DiagnosticsService.getReport().then(setReport);
  }, []);

  return (
    <Screen>
      <Card className="gap-2">
        <Text variant="large">Diagnostics</Text>
        <Text variant="muted">Native capabilities active in this runtime.</Text>
      </Card>
      {report ? (
        <>
          <Card className="gap-1">
            <Text variant="large">Sensors</Text>
            {Object.entries(report.sensors).map(([key, value]) => (
              <Text key={key}>
                {key}: {value ? 'available' : 'not available'}
              </Text>
            ))}
          </Card>
          <Card className="gap-1">
            <Text variant="large">Runtime</Text>
            <Text>Network: {report.network}</Text>
            <Text>FTS: {report.ftsAvailable ? 'available' : 'not available'}</Text>
            <Text>
              SQLCipher/vault encryption: {report.sqlCipherActive ? 'active' : 'not active'}
            </Text>
            <Text variant="muted">{SQLCIPHER_NOTE}</Text>
            <Text variant="muted">
              Database key: {report.databaseEncryption.keyStored ? 'stored' : 'not created yet'} ·{' '}
              {report.databaseEncryption.keyStrategy}
            </Text>
            <Text variant="muted">{report.databaseEncryption.migrationStatus}</Text>
            <Text>AI adapter: {report.aiAdapter}</Text>
            <Text variant="muted">{report.aiStatusMessage}</Text>
          </Card>
          <Card className="gap-1">
            <Text variant="large">Storage directories</Text>
            {Object.entries(report.directories).map(([key, value]) => (
              <Text key={key} selectable variant="muted">
                {key}: {value}
              </Text>
            ))}
          </Card>
        </>
      ) : (
        <Text>Loading diagnostics...</Text>
      )}
    </Screen>
  );
}
