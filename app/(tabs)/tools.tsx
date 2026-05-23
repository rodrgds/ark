import { ActionCard } from '@/components/cards/action-card';
import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { useSensorStore } from '@/stores/sensor-store';
import { Link, type Href } from 'expo-router';
import {
  CheckSquare,
  Compass,
  Crosshair,
  Gauge,
  Lightbulb,
  Ruler,
  Settings2,
  SunMedium,
  Timer,
} from 'lucide-react-native';
import { View } from 'react-native';

type Drain = 'low' | 'medium' | 'high';

function DrainBadge({ level }: { level: Drain }) {
  const colors: Record<Drain, { bg: string; text: string; label: string }> = {
    low: { bg: '#0d2a0d', text: '#30d158', label: 'Low' },
    medium: { bg: '#2a1f0d', text: '#f5a623', label: 'Med' },
    high: { bg: '#2a0d0d', text: '#ff453a', label: 'High' },
  };
  const c = colors[level];
  return (
    <View
      style={{
        backgroundColor: c.bg,
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: c.text + '44',
      }}
    >
      <Text style={{ fontSize: 10, fontWeight: '700', color: c.text, letterSpacing: 0.5 }}>
        {c.label} drain
      </Text>
    </View>
  );
}

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
      <Link href="/tools/compass" asChild>
        <ActionCard
          icon={Compass}
          title="Compass"
          description="Magnetometer heading and cardinal direction."
          right={<DrainBadge level="medium" />}
        />
      </Link>
      <Link href="/tools/barometer" asChild>
        <ActionCard
          icon={Gauge}
          title="Barometer"
          description="hPa readings and pressure trend snapshots."
          right={<DrainBadge level="low" />}
        />
      </Link>
      <Link href="/tools/level" asChild>
        <ActionCard
          icon={Ruler}
          title="Level"
          description="Pitch and roll from accelerometer."
          right={<DrainBadge level="low" />}
        />
      </Link>
      <Link href="/tools/chronometer" asChild>
        <ActionCard
          icon={Timer}
          title="Chronometer"
          description="Stopwatch with lap times, works fully offline."
          right={<DrainBadge level="low" />}
        />
      </Link>
      <Link href="/tools/light" asChild>
        <ActionCard
          icon={Lightbulb}
          title="Light meter"
          description="Lux readings on supported devices."
          right={<DrainBadge level="low" />}
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