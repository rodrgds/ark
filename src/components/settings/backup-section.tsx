import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { Download, Upload } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

const MIN_PASSPHRASE_LENGTH = 8;

type BackupSectionProps = {
  exportBusy: boolean;
  importBusy: boolean;
  exportBackup: (passphrase: string) => void | Promise<void>;
  confirmImportBackup: (passphrase: string) => void;
  message: string | null;
};

export function BackupSection({
  exportBusy,
  importBusy,
  exportBackup,
  confirmImportBackup,
  message,
}: BackupSectionProps) {
  const [passphrase, setPassphrase] = React.useState('');
  const trimmed = passphrase.trim();
  const canSubmit = trimmed.length >= MIN_PASSPHRASE_LENGTH;

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">Encrypted Backup</Text>
        <Text variant="muted">
          Exports notes, imported documents, saved spots, routes, feeds, checklist state, and
          selected settings. Models, maps, guide packs, indexes, caches, and download queues stay
          out.
        </Text>
      </View>
      <Input
        value={passphrase}
        onChangeText={setPassphrase}
        placeholder="Backup passphrase"
        secureTextEntry
        autoCapitalize="none"
      />
      <View className="flex-row flex-wrap gap-2">
        <Button
          className="min-w-36 flex-1"
          variant="outline"
          disabled={exportBusy || !canSubmit}
          onPress={() => void exportBackup(trimmed)}>
          {exportBusy ? <ActivityIndicator /> : <Icon as={Download} className="size-4" />}
          <Text>Export .arkbackup</Text>
        </Button>
        <Button
          className="min-w-36 flex-1"
          variant="outline"
          disabled={importBusy || !canSubmit}
          onPress={() => confirmImportBackup(trimmed)}>
          {importBusy ? <ActivityIndicator /> : <Icon as={Upload} className="size-4" />}
          <Text>Import .arkbackup</Text>
        </Button>
      </View>
      {message ? <Text variant="muted">{message}</Text> : null}
    </Card>
  );
}
