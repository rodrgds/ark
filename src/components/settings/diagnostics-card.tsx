import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DiagnosticReport } from '@/types/sensors';
import { Smartphone } from 'lucide-react-native';
import { View } from 'react-native';

export function DiagnosticsCard({ report }: { report: DiagnosticReport | null }) {
  if (!report) {
    return (
      <Card>
        <Text variant="muted">Loading diagnostics...</Text>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Icon as={Smartphone} className="text-primary size-5" />
        <Text variant="large">Diagnostics</Text>
      </View>
      <View className="gap-1">
        <Text>Network: {report.network}</Text>
        <Text>Search index: {report.ftsAvailable ? 'available' : 'not available'}</Text>
        <Text>Vault protection: {report.sqlCipherActive ? 'active' : 'limited'}</Text>
        <Text>AI engine: {report.aiAdapter}</Text>
        <Text variant="muted">{report.aiStatusMessage}</Text>
        <Text variant="muted">{report.databaseEncryption.migrationStatus}</Text>
        <Text>Routing engine: {report.routingEngine.available ? 'active' : 'not linked'}</Text>
        {report.routingEngine.reason ? (
          <Text variant="muted">{report.routingEngine.reason}</Text>
        ) : null}
      </View>
      <View className="border-border overflow-hidden rounded-md border">
        {Object.entries(report.sensors).map(([name, available]) => (
          <View
            key={name}
            className="border-border flex-row justify-between border-b px-3 py-2 last:border-b-0">
            <Text className="capitalize">{name}</Text>
            <Text variant="muted">{available ? 'available' : 'not available'}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}
