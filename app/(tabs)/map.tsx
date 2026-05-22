import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { MapService } from '@/services/maps/map.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import type { MapRegion } from '@/types/maps';
import * as React from 'react';

export default function MapScreen() {
  const [regions, setRegions] = React.useState<MapRegion[]>([]);
  const status = MapService.getRuntimeStatus();

  async function load() {
    setRegions(await OfflineMapService.listRegions());
  }

  React.useEffect(() => {
    load();
  }, []);

  async function createRegion() {
    await OfflineMapService.createRegionDownload({
      name: 'Local area placeholder',
      bounds: { north: 38.85, south: 38.65, east: -9.05, west: -9.35 },
      minZoom: 8,
      maxZoom: 14,
    });
    await load();
  }

  return (
    <Screen>
      <Card className="gap-2">
        <Text variant="large">Offline map shell</Text>
        <Text variant="muted">{status.available ? 'MapLibre is available.' : status.reason}</Text>
      </Card>
      <Button onPress={createRegion}>
        <Text>Create mock region</Text>
      </Button>
      {regions.map((region) => (
        <Card key={region.id} className="gap-1">
          <Text variant="large">{region.name}</Text>
          <Text variant="muted">
            {region.provider} · {region.status} · {Math.round(region.progress * 100)}%
          </Text>
          <Text variant="muted">
            Zoom {region.minZoom ?? '-'} to {region.maxZoom ?? '-'}
          </Text>
        </Card>
      ))}
    </Screen>
  );
}
