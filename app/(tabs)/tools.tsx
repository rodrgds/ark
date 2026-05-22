import { ActionCard } from '@/components/cards/action-card';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Link } from 'expo-router';
import {
  Activity,
  Compass,
  Gauge,
  Lightbulb,
  MapPin,
  Ruler,
  Settings2,
  Timer,
  Umbrella,
} from 'lucide-react-native';

export default function ToolsScreen() {
  return (
    <Screen>
      <Card className="gap-2">
        <Text variant="large">Device tools</Text>
        <Text variant="muted">
          Sensor-backed where available, with graceful unavailable states.
        </Text>
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
      <Link href="/tools/diagnostics" asChild>
        <ActionCard
          icon={Settings2}
          title="Diagnostics"
          description="Native capability and storage report."
        />
      </Link>
      <ActionCard
        icon={MapPin}
        title="Coordinates"
        description="Placeholder for location card once permission is granted."
      />
      <ActionCard
        icon={Umbrella}
        title="Offline weather cache"
        description="Freshness and pressure trend context."
      />
      <ActionCard
        icon={Timer}
        title="Emergency checklist"
        description="Placeholder for saved checklists and unit conversion."
      />
    </Screen>
  );
}
