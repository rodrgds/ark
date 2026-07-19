import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import type { DiagnosticReport } from '@/types/sensors';
import type { AiEvaluationResult } from '@/services/ai/evaluation';
import { BrainCircuit, ShieldCheck, Smartphone } from 'lucide-react-native';
import { View } from 'react-native';

type DiagnosticsCardProps = {
  report: DiagnosticReport | null;
  migrationBusy?: boolean;
  onMigratePlaintextDatabase?: () => void;
  aiEvaluationBusy?: boolean;
  aiEvaluationResults?: AiEvaluationResult[] | null;
  onRunAiEvaluation?: () => void;
};

export function DiagnosticsCard({
  report,
  migrationBusy = false,
  onMigratePlaintextDatabase,
  aiEvaluationBusy = false,
  aiEvaluationResults,
  onRunAiEvaluation,
}: DiagnosticsCardProps) {
  if (!report) {
    return (
      <Card>
        <Text variant="muted">Loading diagnostics...</Text>
      </Card>
    );
  }
  const canMigratePlaintext =
    report.databaseEncryption.runtimeActive &&
    report.databaseEncryption.databaseState === 'plaintext' &&
    report.databaseEncryption.plaintextMigrationImplemented &&
    Boolean(onMigratePlaintextDatabase);

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-2">
        <Icon as={Smartphone} className="text-primary size-5" />
        <Text variant="large">Diagnostics</Text>
      </View>
      <View className="gap-1">
        <Text>Network: {report.network}</Text>
        <Text>Search index: {report.ftsAvailable ? 'available' : 'not available'}</Text>
        <Text>Database encryption: {report.databaseEncryption.active ? 'active' : 'off'}</Text>
        <Text>Database state: {report.databaseEncryption.stateLabel}</Text>
        <Text>
          SQLCipher runtime: {report.databaseEncryption.runtimeActive ? 'available' : 'not active'}
        </Text>
        <Text>DB key: {report.databaseEncryption.keyStrategy}</Text>
        <Text>AI engine: {report.aiAdapter}</Text>
        <Text variant="muted">{report.aiStatusMessage}</Text>
        <Text variant="muted">{report.databaseEncryption.migrationStatus}</Text>
        <Text variant="muted">{report.databaseEncryption.existingDataStatus}</Text>
        <Text variant="muted">{report.databaseEncryption.passphraseRekeyStatus}</Text>
        {canMigratePlaintext ? (
          <Button
            className="mt-2 self-start"
            disabled={migrationBusy}
            variant="outline"
            onPress={onMigratePlaintextDatabase}>
            <Icon as={ShieldCheck} className="text-primary size-4" />
            <Text>{migrationBusy ? 'Encrypting database...' : 'Encrypt DB'}</Text>
          </Button>
        ) : null}
        <Text>Routing engine: {report.routingEngine.available ? 'active' : 'not linked'}</Text>
        {report.routingEngine.reason ? (
          <Text variant="muted">{report.routingEngine.reason}</Text>
        ) : null}
        <Text>Routing data: {report.routingData.readyCount > 0 ? 'ready' : 'not ready'}</Text>
        <Text variant="muted">{report.routingData.message}</Text>
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
      {onRunAiEvaluation ? (
        <View className="border-border gap-2 border-t pt-3">
          <View className="flex-row items-center gap-2">
            <Icon as={BrainCircuit} className="text-primary size-4" />
            <Text className="font-medium">Offline answer safety check</Text>
          </View>
          <Text variant="muted">
            Checks three offline answers for source mismatch, citation quality, and unsupported
            medical dosing. Ark removes the temporary chats afterward.
          </Text>
          <Button variant="outline" disabled={aiEvaluationBusy} onPress={onRunAiEvaluation}>
            <Text>{aiEvaluationBusy ? 'Running safety check...' : 'Run safety check'}</Text>
          </Button>
          {aiEvaluationResults?.map((result) => (
            <View key={result.caseId} className="flex-row justify-between gap-3">
              <Text className="min-w-0 flex-1" numberOfLines={2}>
                {result.title}
              </Text>
              <Text className={result.pass ? 'text-primary' : 'text-destructive'}>
                {result.pass
                  ? 'Pass'
                  : `${result.failures.length} issue${result.failures.length === 1 ? '' : 's'}`}
              </Text>
            </View>
          ))}
        </View>
      ) : null}
    </Card>
  );
}
