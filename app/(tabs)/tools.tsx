import { ActionCard } from '@/components/cards/action-card';
import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { useSensorStore } from '@/stores/sensor-store';
import { Link, type Href } from 'expo-router';
import {
  Activity,
  CheckSquare,
  Compass,
  Crosshair,
  Gauge,
  Lightbulb,
  Ruler,
  Settings2,
  SunMedium,
} from 'lucide-react-native';
import { View } from 'react-native';

const TOOL_ROUTES = {
  coordinates: '/tools/coordinates' as Href,
  weather: '/tools/weather' as Href,
  checklist: '/tools/checklist' as Href,
};

export default function ToolsScreen() {
  const { heading, pressure, pitch, roll, steps, lux } = useSensorStore();

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-2">
          <Text variant="h1">Tools</Text>
          <Text variant="muted">Field tools that still make sense when service drops.</Text>
        </View>
        <Arky pose="resourceful" size={80} />
      </View>
      <Card className="gap-2">
        <Text variant="large">Last live readings</Text>
        <View className="flex-row flex-wrap gap-x-4 gap-y-2">
          <Text variant="muted">
            Heading: {heading === null ? '--' : `${Math.round(heading)}°`}
          </Text>
          <Text variant="muted">
            Pressure: {pressure === null ? '--' : `${pressure.toFixed(1)} hPa`}
          </Text>
          <Text variant="muted">
            Level:{' '}
            {pitch === null || roll === null ? '--' : `${pitch.toFixed(1)}° / ${roll.toFixed(1)}°`}
          </Text>
          <Text variant="muted">Steps: {steps === null ? '--' : steps}</Text>
          <Text variant="muted">Light: {lux === null ? '--' : `${Math.round(lux)} lux`}</Text>
        </View>
      </Card>
      <Link href="/tools/compass" asChild>
        <ActionCard
          icon={Compass}
          title="Compass"
          description="Magnetometer heading and cardinal direction."
        />
      </Link>
      <Link href="/tools/barometer" asChild>
        <ActionCard
          icon={Gauge}
          title="Barometer"
          description="hPa readings and pressure trend snapshots."
        />
      </Link>
      <Link href="/tools/level" asChild>
        <ActionCard icon={Ruler} title="Level" description="Pitch and roll from accelerometer." />
      </Link>
      <Link href="/tools/pedometer" asChild>
        <ActionCard
          icon={Activity}
          title="Pedometer"
          description="Today/session steps if supported."
        />
      </Link>
      <Link href="/tools/light" asChild>
        <ActionCard
          icon={Lightbulb}
          title="Light meter"
          description="Lux readings on supported devices."
        />
      </Link>
      <Link href={TOOL_ROUTES.coordinates} asChild>
        <ActionCard
          icon={Crosshair}
          title="Coordinates"
          description="Capture a GPS fix and save it to Map spots."
        />
      </Link>
      <Link href={TOOL_ROUTES.weather} asChild>
        <ActionCard
          icon={SunMedium}
          title="Meteorology"
          description="Cached local forecast, confidence, and trend charts."
        />
      </Link>
      <Link href={TOOL_ROUTES.checklist} asChild>
        <ActionCard
          icon={CheckSquare}
          title="Readiness checklist"
          description="A compact local checklist before leaving service."
        />
      </Link>
      <Link href="/tools/diagnostics" asChild>
        <ActionCard
          icon={Settings2}
          title="Diagnostics"
          description="Native capability and storage report."
        />
      </Link>
    </Screen>
  );
}
