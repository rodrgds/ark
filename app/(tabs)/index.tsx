import { ActionCard } from '@/components/cards/action-card';
import { ArkBrandLockup, Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NetworkService } from '@/services/connectivity/network.service';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { FileSystemService } from '@/services/files/filesystem.service';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import { useAuthStore } from '@/stores/auth-store';
import { Link } from 'expo-router';
import { Bot, Lock, Map, Network, NotebookPen, PackageCheck } from 'lucide-react-native';
import * as React from 'react';
import { RefreshControl, View } from 'react-native';

export default function HomeScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [network, setNetwork] = React.useState('Checking');
  const [downloads, setDownloads] = React.useState(0);
  const [weather, setWeather] = React.useState<string>('Loading');
  const [storage, setStorage] = React.useState('Preparing storage');
  const [refreshing, setRefreshing] = React.useState(false);

  async function refreshHome() {
    NetworkService.getState().then((state) => setNetwork(NetworkService.label(state)));
    await Promise.all([
      DownloadManagerService.listDownloads().then((rows) =>
        setDownloads(rows.filter((row) => row.status === 'completed').length)
      ),
      WeatherCacheService.getLatestOrRefresh().then((row) => {
        if (!row) {
          setWeather('No weather cache');
          return;
        }
        setWeather(`${row.forecast.summary}, ${row.freshness}${row.stale ? ' stale' : ''}`);
      }),
      FileSystemService.getStorageSummary().then((summary) => setStorage(summary.label)),
    ]);
  }

  React.useEffect(() => {
    const unsubscribe = NetworkService.subscribe((state) =>
      setNetwork(NetworkService.label(state))
    );
    void refreshHome();
    return unsubscribe;
  }, []);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            try {
              await refreshHome();
            } finally {
              setRefreshing(false);
            }
          }}
        />
      }>
      <ArkBrandLockup compact />

      <View className="items-center py-2">
        <Arky pose="normal" size={140} />
      </View>

      <Card className="gap-3">
        <View className="flex-row flex-wrap gap-x-4 gap-y-3">
          <View className="min-w-[44%] flex-1 flex-row items-center gap-2">
            <Icon as={Network} className="text-primary size-4" />
            <Text>{network}</Text>
          </View>
          <View className="min-w-[44%] flex-1 flex-row items-center gap-2">
            <Icon
              as={Lock}
              className={unlocked ? 'text-primary size-4' : 'text-muted-foreground size-4'}
            />
            <Text>{unlocked ? 'Vault unlocked' : 'Vault locked'}</Text>
          </View>
          <View className="min-w-[44%] flex-1 flex-row items-center gap-2">
            <Icon as={PackageCheck} className="text-primary size-4" />
            <Text>{downloads} installed</Text>
          </View>
          <View className="min-w-[44%] flex-1">
            <Text variant="muted">{weather}</Text>
          </View>
        </View>
        <Text variant="small">{storage}</Text>
      </Card>

      <Link href="/(tabs)/chat" asChild>
        <ActionCard
          icon={Bot}
          title="Ask Arky"
          description="Query local notes and downloaded references."
        />
      </Link>
      <Link href="/(tabs)/map" asChild>
        <ActionCard
          icon={Map}
          title="Open Map"
          description="Plan and manage offline map regions."
        />
      </Link>
      <Link href="/(tabs)/notes" asChild>
        <ActionCard
          icon={NotebookPen}
          title="New Secure Note"
          description="Unlock vault to create and search notes."
        />
      </Link>
      <Card className="gap-3">
        <Text variant="large">Offline readiness</Text>
        <Text variant="muted">
          Download Wikipedia, medical, and survival packs in Library before you need them.
        </Text>
        <Link href="/(tabs)/library" asChild>
          <Button variant="outline">
            <Text>Open Library</Text>
          </Button>
        </Link>
      </Card>
    </Screen>
  );
}
