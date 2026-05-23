import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { MapService } from '@/services/maps/map.service';
import type { MapLibreModule } from '@/services/maps/map.service';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import type { MapMarker, MapRegion, OfflineMapSearchResult, SavedRoute } from '@/types/maps';
import * as Location from 'expo-location';
import {
  Crosshair,
  Download,
  LocateFixed,
  MapPinned,
  Plus,
  Route,
  Satellite,
  Search,
  Trash2,
} from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

const recommendedRegions = [
  {
    name: 'Lisbon field area',
    description: 'Useful phone-sized starter region for testing offline maps.',
    bounds: { north: 38.9, south: 38.6, east: -9.0, west: -9.4 },
    minZoom: 8,
    maxZoom: 14,
  },
  {
    name: 'Portugal overview',
    description: 'Country-scale planning with roads, towns, and terrain context.',
    bounds: { north: 42.3, south: 36.8, east: -6.1, west: -9.7 },
    minZoom: 5,
    maxZoom: 11,
  },
  {
    name: 'Iberia low-detail',
    description: 'Wide-area navigation fallback for storage-constrained devices.',
    bounds: { north: 44.4, south: 35.5, east: 4.5, west: -10.0 },
    minZoom: 3,
    maxZoom: 8,
  },
];

export default function MapScreen() {
  const [regions, setRegions] = React.useState<MapRegion[]>([]);
  const [markers, setMarkers] = React.useState<MapMarker[]>([]);
  const [routes, setRoutes] = React.useState<SavedRoute[]>([]);
  const [spotTitle, setSpotTitle] = React.useState('');
  const [spotDescription, setSpotDescription] = React.useState('');
  const [spotLatitude, setSpotLatitude] = React.useState('');
  const [spotLongitude, setSpotLongitude] = React.useState('');
  const [spotSearch, setSpotSearch] = React.useState('');
  const [offlineSearch, setOfflineSearch] = React.useState('');
  const [offlineResults, setOfflineResults] = React.useState<OfflineMapSearchResult[]>([]);
  const [customRegionName, setCustomRegionName] = React.useState('');
  const [customNorth, setCustomNorth] = React.useState('');
  const [customSouth, setCustomSouth] = React.useState('');
  const [customEast, setCustomEast] = React.useState('');
  const [customWest, setCustomWest] = React.useState('');
  const [customMinZoom, setCustomMinZoom] = React.useState('6');
  const [customMaxZoom, setCustomMaxZoom] = React.useState('13');
  const [error, setError] = React.useState<string | null>(null);
  const [planningCurrentArea, setPlanningCurrentArea] = React.useState(false);
  const [maplibre, setMaplibre] = React.useState<MapLibreModule | null>(null);
  const [maplibreChecked, setMaplibreChecked] = React.useState(false);
  const status = MapService.getRuntimeStatus(maplibre, maplibreChecked);
  const mapStyleUrl = MapService.getDefaultStyleUrl();

  async function load() {
    const [nextRegions, nextMarkers, nextRoutes] = await Promise.all([
      OfflineMapService.listRegions(),
      OfflineMapService.listMarkers(),
      OfflineMapService.listRoutes(),
    ]);
    setRegions(nextRegions);
    setMarkers(nextMarkers);
    setRoutes(nextRoutes);
  }

  React.useEffect(() => {
    load();
    MapService.loadMapLibre()
      .then(setMaplibre)
      .finally(() => setMaplibreChecked(true));
  }, []);

  async function createRegion(input = recommendedRegions[0]) {
    await OfflineMapService.createRegionDownload({
      name: input.name,
      bounds: input.bounds,
      minZoom: input.minZoom,
      maxZoom: input.maxZoom,
    });
    await load();
  }

  async function createCurrentAreaRegion(radiusKm: number) {
    setPlanningCurrentArea(true);
    setError(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setError('Location permission is required to plan your current area.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const bounds = boundsAround(current.coords.latitude, current.coords.longitude, radiusKm);
      await OfflineMapService.createRegionDownload({
        name: `Current area ${radiusKm} km`,
        bounds,
        minZoom: radiusKm <= 25 ? 9 : 7,
        maxZoom: radiusKm <= 25 ? 15 : 12,
      });
      await load();
    } catch {
      setError('Unable to plan a region from current location.');
    } finally {
      setPlanningCurrentArea(false);
    }
  }

  async function createMarker() {
    const latitude = Number(spotLatitude);
    const longitude = Number(spotLongitude);
    if (!spotTitle.trim() || Number.isNaN(latitude) || Number.isNaN(longitude)) {
      setError('Enter a title plus numeric latitude and longitude.');
      return;
    }
    setError(null);
    await OfflineMapService.createMarker({
      title: spotTitle.trim(),
      description: spotDescription.trim() || null,
      latitude,
      longitude,
    });
    setSpotTitle('');
    setSpotDescription('');
    setSpotLatitude('');
    setSpotLongitude('');
    await load();
  }

  async function createRoute() {
    if (markers.length < 2) {
      setError('Save at least two spots before creating a route draft.');
      return;
    }
    setError(null);
    await OfflineMapService.createRouteFromMarkers(
      `Route draft ${new Date().toLocaleDateString()}`,
      markers.slice().reverse()
    );
    await load();
  }

  async function createRegionFromSpots() {
    if (markers.length < 2) {
      setError('Save at least two spots before planning a map region.');
      return;
    }
    setError(null);
    await OfflineMapService.createRegionFromMarkers({
      name: `Saved spots area ${new Date().toLocaleDateString()}`,
      markers,
      paddingKm: 5,
    });
    await load();
  }

  async function createCustomRegion() {
    try {
      setError(null);
      await OfflineMapService.createRegionFromBounds({
        name: customRegionName,
        north: Number(customNorth),
        south: Number(customSouth),
        east: Number(customEast),
        west: Number(customWest),
        minZoom: Number(customMinZoom),
        maxZoom: Number(customMaxZoom),
      });
      setCustomRegionName('');
      setCustomNorth('');
      setCustomSouth('');
      setCustomEast('');
      setCustomWest('');
      setCustomMinZoom('6');
      setCustomMaxZoom('13');
      await load();
    } catch (customError) {
      setError(customError instanceof Error ? customError.message : 'Unable to plan custom region.');
    }
  }

  const visibleMarkers = markers.filter((marker) => {
    const query = spotSearch.trim().toLowerCase();
    if (!query) return true;
    return `${marker.title} ${marker.description ?? ''}`.toLowerCase().includes(query);
  });

  React.useEffect(() => {
    let canceled = false;
    const timeout = setTimeout(() => {
      OfflineMapService.searchOffline(offlineSearch).then((results) => {
        if (!canceled) setOfflineResults(results);
      });
    }, 120);
    return () => {
      canceled = true;
      clearTimeout(timeout);
    };
  }, [offlineSearch, markers.length, regions.length, routes.length]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-2">
          <Text variant="h1">Map</Text>
          <Text variant="muted">
            Offline regions are planned here now. Native map rendering turns on in the dev build.
          </Text>
        </View>
        <Arky pose="navigator" size={80} />
      </View>

      <Card className="gap-3">
        <View className="flex-row items-start gap-3">
          <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
            <Icon as={Satellite} className="text-primary size-6" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Map engine</Text>
            <Text variant="muted">
              {status.reason}
            </Text>
          </View>
        </View>
      </Card>

      {maplibre ? (
        <Card className="h-80 overflow-hidden p-0">
          <maplibre.Map style={{ flex: 1 }} mapStyle={mapStyleUrl}>
            <maplibre.Camera center={[-9.1393, 38.7223]} zoom={8} />
          </maplibre.Map>
        </Card>
      ) : null}

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Search} className="text-primary size-5" />
          <Text variant="large">Offline search</Text>
        </View>
        <Text variant="muted">
          Search saved spots, planned map regions, and route drafts already stored on this device.
        </Text>
        <Input
          value={offlineSearch}
          onChangeText={setOfflineSearch}
          placeholder="Search offline map data"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {offlineSearch.trim().length >= 2 ? (
          offlineResults.length ? (
            <View className="border-border overflow-hidden rounded-md border">
              {offlineResults.map((result) => (
                <View
                  key={`${result.kind}:${result.id}`}
                  className="border-border gap-1 border-b p-3 last:border-b-0">
                  <View className="flex-row items-center gap-2">
                    <Icon as={iconForSearchResult(result.kind)} className="text-primary size-4" />
                    <Text className="flex-1">{result.title}</Text>
                  </View>
                  <Text variant="small">
                    {labelForSearchResult(result.kind)} · {result.subtitle}
                  </Text>
                  {result.latitude != null && result.longitude != null ? (
                    <Text variant="small">
                      {result.latitude.toFixed(5)}, {result.longitude.toFixed(5)}
                    </Text>
                  ) : null}
                </View>
              ))}
            </View>
          ) : (
            <Text variant="muted">No offline map data matches this search.</Text>
          )
        ) : null}
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={MapPinned} className="text-primary size-5" />
          <Text variant="large">Saved spots</Text>
        </View>
        <Input value={spotTitle} onChangeText={setSpotTitle} placeholder="Spot title" />
        <Input
          value={spotDescription}
          onChangeText={setSpotDescription}
          placeholder="Description"
        />
        <View className="flex-row gap-2">
          <Input
            className="flex-1"
            value={spotLatitude}
            onChangeText={setSpotLatitude}
            placeholder="Latitude"
            keyboardType="numeric"
          />
          <Input
            className="flex-1"
            value={spotLongitude}
            onChangeText={setSpotLongitude}
            placeholder="Longitude"
            keyboardType="numeric"
          />
        </View>
        <Button onPress={createMarker}>
          <Icon as={Plus} className="size-4" />
          <Text>Save Spot</Text>
        </Button>
        <Button variant="outline" disabled={markers.length < 2} onPress={createRegionFromSpots}>
          <Icon as={Download} className="size-4" />
          <Text>Plan Map From Spots</Text>
        </Button>
        {error ? <Text className="text-destructive">{error}</Text> : null}
        <View className="flex-row items-center gap-2">
          <Icon as={Search} className="text-muted-foreground size-4" />
          <Input
            className="flex-1"
            value={spotSearch}
            onChangeText={setSpotSearch}
            placeholder="Search saved spots"
          />
        </View>
        {visibleMarkers.length ? (
          visibleMarkers.map((marker) => (
            <View key={marker.id} className="border-border border-t pt-3">
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1">
                  <Text>{marker.title}</Text>
                  {marker.description ? <Text variant="muted">{marker.description}</Text> : null}
                  <Text variant="small">
                    {marker.latitude.toFixed(5)}, {marker.longitude.toFixed(5)}
                  </Text>
                </View>
                <Button
                  size="icon"
                  variant="outline"
                  onPress={() =>
                    Alert.alert('Delete spot?', marker.title, [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: async () => {
                          await OfflineMapService.deleteMarker(marker.id);
                          await load();
                        },
                      },
                    ])
                  }>
                  <Icon as={Trash2} className="size-4" />
                </Button>
              </View>
            </View>
          ))
        ) : (
          <Text variant="muted">No saved spots match this search.</Text>
        )}
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-2">
          <Icon as={Route} className="text-primary size-5" />
          <Text variant="large">Route drafts</Text>
        </View>
        <Text variant="muted">
          Create a simple offline route from saved spots. Map drawing turns on with native
          rendering.
        </Text>
        <Button variant="outline" disabled={markers.length < 2} onPress={createRoute}>
          <Text>Create From Saved Spots</Text>
        </Button>
        {routes.length ? (
          routes.map((route) => (
            <View
              key={route.id}
              className="border-border flex-row items-center gap-3 border-t pt-3">
              <View className="min-w-0 flex-1">
                <Text>{route.title}</Text>
                <Text variant="small">
                  {route.points.length} points -{' '}
                  {route.distanceMeters
                    ? `${(route.distanceMeters / 1000).toFixed(1)} km`
                    : 'distance unknown'}
                </Text>
              </View>
              <Button
                size="icon"
                variant="outline"
                onPress={() =>
                  Alert.alert('Delete route?', route.title, [
                    { text: 'Cancel', style: 'cancel' },
                    {
                      text: 'Delete',
                      style: 'destructive',
                      onPress: async () => {
                        await OfflineMapService.deleteRoute(route.id);
                        await load();
                      },
                    },
                  ])
                }>
                <Icon as={Trash2} className="size-4" />
              </Button>
            </View>
          ))
        ) : (
          <Text variant="muted">No route drafts yet.</Text>
        )}
      </Card>

      <View className="gap-3">
        <Text variant="large">Recommended regions</Text>
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
              <Icon as={Crosshair} className="text-primary size-6" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large">Download my area</Text>
              <Text variant="muted">
                Plan a map pack around your current location. Native download still requires the
                development build.
              </Text>
            </View>
          </View>
          <View className="flex-row gap-2">
            <Button
              className="flex-1"
              variant="outline"
              disabled={planningCurrentArea}
              onPress={() => createCurrentAreaRegion(25)}>
              {planningCurrentArea ? <ActivityIndicator /> : null}
              <Text>25 km</Text>
            </Button>
            <Button
              className="flex-1"
              variant="outline"
              disabled={planningCurrentArea}
              onPress={() => createCurrentAreaRegion(100)}>
              <Text>100 km</Text>
            </Button>
          </View>
        </Card>
        <Card className="gap-3">
          <View className="flex-row gap-3">
            <View className="bg-muted size-10 items-center justify-center rounded-md">
              <Icon as={MapPinned} className="text-primary size-5" />
            </View>
            <View className="min-w-0 flex-1 gap-1">
              <Text variant="large">Custom bounds</Text>
              <Text variant="muted">
                Use this when you already know the north, south, east, and west edges.
              </Text>
            </View>
          </View>
          <Input
            value={customRegionName}
            onChangeText={setCustomRegionName}
            placeholder="Region name"
          />
          <View className="flex-row gap-2">
            <Input
              className="flex-1"
              value={customNorth}
              onChangeText={setCustomNorth}
              placeholder="North"
              keyboardType="numeric"
            />
            <Input
              className="flex-1"
              value={customSouth}
              onChangeText={setCustomSouth}
              placeholder="South"
              keyboardType="numeric"
            />
          </View>
          <View className="flex-row gap-2">
            <Input
              className="flex-1"
              value={customWest}
              onChangeText={setCustomWest}
              placeholder="West"
              keyboardType="numeric"
            />
            <Input
              className="flex-1"
              value={customEast}
              onChangeText={setCustomEast}
              placeholder="East"
              keyboardType="numeric"
            />
          </View>
          <View className="flex-row gap-2">
            <Input
              className="flex-1"
              value={customMinZoom}
              onChangeText={setCustomMinZoom}
              placeholder="Min zoom"
              keyboardType="numeric"
            />
            <Input
              className="flex-1"
              value={customMaxZoom}
              onChangeText={setCustomMaxZoom}
              placeholder="Max zoom"
              keyboardType="numeric"
            />
          </View>
          <Button variant="outline" onPress={createCustomRegion}>
            <Icon as={Download} className="size-4" />
            <Text>Plan Custom Region</Text>
          </Button>
        </Card>
        {recommendedRegions.map((region) => (
          <Card key={region.name} className="gap-3">
            <View className="flex-row gap-3">
              <View className="bg-muted size-10 items-center justify-center rounded-md">
                <Icon as={MapPinned} className="text-primary size-5" />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">{region.name}</Text>
                <Text variant="muted">{region.description}</Text>
                <Text variant="small">
                  Zoom {region.minZoom}-{region.maxZoom}
                </Text>
              </View>
            </View>
            <Button variant="outline" onPress={() => createRegion(region)}>
              <Icon as={Download} className="size-4" />
              <Text>Plan Region</Text>
            </Button>
          </Card>
        ))}
      </View>

      <Card className="gap-2">
        <View className="flex-row items-center gap-2">
          <Icon as={Route} className="text-primary size-5" />
          <Text variant="large">PMTiles path</Text>
        </View>
        <Text variant="muted">
          Protomaps PMTiles is the right storage model for full-file offline vector maps. The next
          native pass should render local file:// PMTiles through MapLibre and add place search.
        </Text>
        {MapService.isDemoStyle(mapStyleUrl) ? (
          <Text variant="small" className="text-muted-foreground">
            Current preview style uses MapLibre demo tiles. Set EXPO_PUBLIC_ARK_MAP_STYLE_URL for a
            production style before shipping map downloads.
          </Text>
        ) : null}
      </Card>

      {regions.map((region) => (
        <Card key={region.id} className="gap-3">
          <View className="flex-row items-start justify-between gap-3">
            <Text variant="large" className="min-w-0 flex-1">
              {region.name}
            </Text>
            <Button
              size="icon"
              variant="outline"
              onPress={() =>
                Alert.alert('Delete planned region?', region.name, [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                      await OfflineMapService.deleteRegion(region.id);
                      await load();
                    },
                  },
                ])
              }>
              <Icon as={Trash2} className="size-4" />
            </Button>
          </View>
          <Text variant="muted">
            {region.provider} · {region.status}
          </Text>
          <Progress value={region.progress} />
          <Text variant="muted">
            Zoom {region.minZoom ?? '-'} to {region.maxZoom ?? '-'}
          </Text>
          <Button
            variant="outline"
            disabled={!maplibre || region.status === 'downloading'}
            onPress={async () => {
              const result = await OfflineMapService.refreshRegion(region.id);
              if (!result.ok) setError(result.reason ?? 'Unable to download region.');
              await load();
            }}>
            <Icon as={Download} className="size-4" />
            <Text>{maplibre ? 'Download Native Pack' : 'Requires Dev Build'}</Text>
          </Button>
        </Card>
      ))}
    </Screen>
  );
}

function boundsAround(latitude: number, longitude: number, radiusKm: number) {
  const latitudeDelta = radiusKm / 111;
  const longitudeDelta = radiusKm / (111 * Math.max(0.2, Math.cos((latitude * Math.PI) / 180)));
  return {
    north: latitude + latitudeDelta,
    south: latitude - latitudeDelta,
    east: longitude + longitudeDelta,
    west: longitude - longitudeDelta,
  };
}

function iconForSearchResult(kind: OfflineMapSearchResult['kind']) {
  if (kind === 'route') return Route;
  if (kind === 'region') return MapPinned;
  return LocateFixed;
}

function labelForSearchResult(kind: OfflineMapSearchResult['kind']) {
  if (kind === 'route') return 'Route';
  if (kind === 'region') return 'Region';
  return 'Spot';
}
