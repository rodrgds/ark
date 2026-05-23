import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { OfflineMapService } from '@/services/maps/offline-map.service';
import * as Location from 'expo-location';
import * as React from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';

type Fix = Location.LocationObjectCoords & { capturedAt: number };

export default function CoordinatesTool() {
  const [fix, setFix] = React.useState<Fix | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);

  async function capture() {
    setBusy(true);
    setMessage(null);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        setMessage('Location permission is required to capture coordinates.');
        return;
      }
      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setFix({ ...current.coords, capturedAt: current.timestamp });
    } catch {
      setMessage('Unable to read location from this device.');
    } finally {
      setBusy(false);
    }
  }

  async function saveSpot() {
    if (!fix) return;
    await OfflineMapService.createMarker({
      title: `Captured position ${new Date(fix.capturedAt).toLocaleTimeString()}`,
      description: `Accuracy ${formatMeters(fix.accuracy)}. Saved from Coordinates tool.`,
      latitude: fix.latitude,
      longitude: fix.longitude,
    });
    Alert.alert('Spot saved', 'This position is now available in Map.');
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text variant="large">Coordinates</Text>
        <Text variant="muted">
          Capture your current position, copy it by selecting the text, or save it as a map spot.
        </Text>
        <Button onPress={capture} disabled={busy}>
          {busy ? <ActivityIndicator /> : null}
          <Text>{fix ? 'Refresh Position' : 'Get Position'}</Text>
        </Button>
      </Card>

      {fix ? (
        <Card className="gap-3">
          <View className="gap-1">
            <Text variant="muted">Decimal</Text>
            <Text selectable className="font-mono text-lg">
              {fix.latitude.toFixed(6)}, {fix.longitude.toFixed(6)}
            </Text>
          </View>
          <View className="gap-1">
            <Text variant="muted">Degrees, minutes, seconds</Text>
            <Text selectable className="font-mono">
              {toDms(fix.latitude, 'lat')} {toDms(fix.longitude, 'lon')}
            </Text>
          </View>
          <View className="flex-row flex-wrap gap-x-4 gap-y-2">
            <Text variant="muted">Accuracy: {formatMeters(fix.accuracy)}</Text>
            <Text variant="muted">Altitude: {formatMeters(fix.altitude)}</Text>
            <Text variant="muted">Speed: {formatSpeed(fix.speed)}</Text>
          </View>
          <Button variant="outline" onPress={saveSpot}>
            <Text>Save to Map Spots</Text>
          </Button>
        </Card>
      ) : null}

      {message ? <Text className="text-destructive">{message}</Text> : null}
    </Screen>
  );
}

function toDms(value: number, axis: 'lat' | 'lon') {
  const absolute = Math.abs(value);
  const degrees = Math.floor(absolute);
  const minutesFloat = (absolute - degrees) * 60;
  const minutes = Math.floor(minutesFloat);
  const seconds = (minutesFloat - minutes) * 60;
  const direction = axis === 'lat' ? (value >= 0 ? 'N' : 'S') : value >= 0 ? 'E' : 'W';
  return `${degrees}°${minutes}'${seconds.toFixed(1)}"${direction}`;
}

function formatMeters(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  return `${Math.round(value)} m`;
}

function formatSpeed(value: number | null) {
  if (value === null || !Number.isFinite(value)) return 'unknown';
  return `${(value * 3.6).toFixed(1)} km/h`;
}
