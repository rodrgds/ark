import { ActionCard } from '@/components/cards/action-card';
import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NAV_COLORS } from '@/constants/theme';
import { hexToRgba } from '@/lib/colors';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import { Link, type Href } from 'expo-router';
import {
  Battery,
  BatteryCharging,
  CheckSquare,
  Compass,
  Crosshair,
  Gauge,
  Lightbulb,
  Newspaper,
  Ruler,
  Settings2,
  SunMedium,
  Timer,
} from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';

type Drain = 'low' | 'medium' | 'high';

function DrainBadge({ level }: { level: Drain }) {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = NAV_COLORS[theme];
  const colors: Record<Drain, { text: string; label: string }> = {
    low: { text: '#22c55e', label: 'Low' },
    medium: { text: '#f59e0b', label: 'Med' },
    high: { text: palette.destructive, label: 'High' },
  };
  const c = colors[level];
  return (
    <View
      style={{
        backgroundColor: hexToRgba(c.text, theme === 'light' ? 0.12 : 0.18),
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: hexToRgba(c.text, 0.36),
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

type BatterySnapshot = {
  available: boolean;
  level: number | null;
  charging: boolean;
  lowPower: boolean;
};

type BatteryModule = {
  BatteryState?: Record<string, number>;
  getPowerStateAsync?: () => Promise<{
    batteryLevel: number;
    batteryState: number;
    lowPowerMode: boolean;
  }>;
  isAvailableAsync?: () => Promise<boolean>;
  getBatteryLevelAsync?: () => Promise<number>;
  getBatteryStateAsync?: () => Promise<number>;
  isLowPowerModeEnabledAsync?: () => Promise<boolean>;
};

function getBatteryModule(): BatteryModule | null {
  try {
    return require('expo-battery') as BatteryModule;
  } catch {
    return null;
  }
}

function estimateBatteryHours(level: number, lowPower: boolean) {
  const fullBatteryHours = lowPower ? 24 : 16;
  return Math.max(1, Math.round(level * fullBatteryHours));
}

function batteryLabel(snapshot: BatterySnapshot) {
  if (!snapshot.available || snapshot.level == null) return 'Battery estimate unavailable';
  const percent = Math.round(snapshot.level * 100);
  if (snapshot.charging) return `Charging - ${percent}%`;
  return `About ${estimateBatteryHours(snapshot.level, snapshot.lowPower)}h battery left - ${percent}%`;
}

function useBatterySnapshot() {
  const [snapshot, setSnapshot] = React.useState<BatterySnapshot>({
    available: true,
    level: null,
    charging: false,
    lowPower: false,
  });

  React.useEffect(() => {
    let active = true;

    async function load() {
      const BatteryModule = getBatteryModule();
      if (!BatteryModule?.getBatteryLevelAsync) {
        if (active) {
          setSnapshot({ available: false, level: null, charging: false, lowPower: false });
        }
        return;
      }

      try {
        const supported = await (BatteryModule.isAvailableAsync?.() ?? Promise.resolve(true));
        if (!supported) {
          if (active) {
            setSnapshot({ available: false, level: null, charging: false, lowPower: false });
          }
          return;
        }

        const powerState = await BatteryModule.getPowerStateAsync?.();
        const [level, state, lowPower] = powerState
          ? [powerState.batteryLevel, powerState.batteryState, powerState.lowPowerMode]
          : await Promise.all([
              BatteryModule.getBatteryLevelAsync(),
              BatteryModule.getBatteryStateAsync?.() ?? Promise.resolve(undefined),
              BatteryModule.isLowPowerModeEnabledAsync?.() ?? Promise.resolve(false),
            ]);
        const chargingState = BatteryModule.BatteryState?.CHARGING;
        const fullState = BatteryModule.BatteryState?.FULL;
        if (active) {
          setSnapshot({
            available: level >= 0,
            level: level >= 0 ? level : null,
            charging: state === chargingState || state === fullState,
            lowPower,
          });
        }
      } catch {
        if (active) {
          setSnapshot({ available: false, level: null, charging: false, lowPower: false });
        }
      }
    }

    void load();
    const interval = setInterval(() => {
      void load();
    }, 60_000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  return snapshot;
}

export default function ToolsScreen() {
  const { heading, pressure, pitch, roll, steps, lux } = useSensorStore();
  const battery = useBatterySnapshot();

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <View className="flex-1 gap-2">
          <Text variant="h1">Tools</Text>
          <View className="flex-row items-center gap-2">
            <Icon
              as={battery.charging ? BatteryCharging : Battery}
              className={battery.available ? 'text-primary size-4' : 'text-muted-foreground size-4'}
            />
            <Text variant="muted">{batteryLabel(battery)}</Text>
          </View>
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
      <Link href={'/tools/chronometer' as Href} asChild>
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
      <Link href={'/tools/news' as Href} asChild>
        <ActionCard
          icon={Newspaper}
          title="News"
          description="Refresh and cache emergency feeds for offline review."
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
