import { ActionCard } from '@/components/cards/action-card';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { APP_SLOGAN, APP_TAGLINE } from '@/constants/app';
import { NetworkService } from '@/services/connectivity/network.service';
import { DownloadManagerService } from '@/services/files/download-manager.service';
import { WeatherCacheService } from '@/services/weather/weather-cache.service';
import { useAuthStore } from '@/stores/auth-store';
import { Link } from 'expo-router';
import {
  Bot,
  CloudSun,
  Compass,
  Download,
  Lock,
  Map,
  Network,
  NotebookPen,
} from 'lucide-react-native';
import * as React from 'react';

export default function HomeScreen() {
  const unlocked = useAuthStore((state) => state.unlocked);
  const [network, setNetwork] = React.useState('Checking');
  const [downloads, setDownloads] = React.useState(0);
  const [weather, setWeather] = React.useState<string>('Loading');

  React.useEffect(() => {
    NetworkService.getState().then((state) => setNetwork(NetworkService.label(state)));
    const unsubscribe = NetworkService.subscribe((state) =>
      setNetwork(NetworkService.label(state))
    );
    DownloadManagerService.listDownloads().then((rows) =>
      setDownloads(rows.filter((row) => row.status === 'completed').length)
    );
    WeatherCacheService.getLatestOrSeed().then((row) =>
      setWeather(row ? `${row.location}, ${row.freshness}` : 'No cache')
    );
    return unsubscribe;
  }, []);

  return (
    <Screen>
      <Card className="gap-2">
        <Text variant="h1" className="text-left">
          Ark
        </Text>
        <Text variant="lead">{APP_SLOGAN}</Text>
        <Text className="text-primary text-lg font-semibold">{APP_TAGLINE}</Text>
      </Card>
      <Card className="gap-3">
        <Text variant="large">Status</Text>
        <Text>Network: {network}</Text>
        <Text>Vault: {unlocked ? 'Unlocked' : 'Locked'}</Text>
        <Text>Completed downloads: {downloads}</Text>
        <Text>Weather cache: {weather}</Text>
      </Card>
      <Link href="/(tabs)/chat" asChild>
        <ActionCard
          icon={Bot}
          title="Ask Ark"
          description="Mock local AI with offline source shape."
        />
      </Link>
      <Link href="/(tabs)/map" asChild>
        <ActionCard
          icon={Map}
          title="Open Map"
          description="Map shell with offline region model."
        />
      </Link>
      <Link href="/(tabs)/notes" asChild>
        <ActionCard
          icon={NotebookPen}
          title="New Secure Note"
          description="Unlock vault to create and search notes."
        />
      </Link>
      <Link href="/tools/compass" asChild>
        <ActionCard
          icon={Compass}
          title="Compass"
          description="Sensor-backed heading where available."
        />
      </Link>
      <Link href="/(tabs)/library" asChild>
        <ActionCard
          icon={Download}
          title="Download Pack"
          description="Starter packs and mock install state."
        />
      </Link>
      <Card className="gap-2">
        <Text variant="large">Native capability notes</Text>
        <Text variant="muted">
          MapLibre and local LLMs require a native development build. Expo Go stays stable with
          placeholders.
        </Text>
        <Link href="/tools/diagnostics" asChild>
          <Button variant="outline">
            <Text>Diagnostics</Text>
          </Button>
        </Link>
      </Card>
    </Screen>
  );
}
