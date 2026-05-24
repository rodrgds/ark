import { Arky } from '@/components/brand/ark-logo';
import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { NAV_COLORS } from '@/constants/theme';
import { hexToRgba } from '@/lib/colors';
import { RssService } from '@/services/rss/rss.service';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import { Link, type Href, useFocusEffect } from 'expo-router';
import {
  CheckSquare,
  Compass,
  Crosshair,
  Gauge,
  Lightbulb,
  Newspaper,
  Ruler,
  SunMedium,
  Timer,
  type LucideIcon,
} from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

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
      }}>
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
  const [rssUnreadCount, setRssUnreadCount] = React.useState(0);

  useFocusEffect(
    React.useCallback(() => {
      let active = true;
      const load = async () => {
        const overview = await RssService.getOverview();
        if (active) setRssUnreadCount(overview.unreadCount);
      };
      void load();
      const interval = setInterval(() => void load(), 10_000);
      return () => {
        active = false;
        clearInterval(interval);
      };
    }, [])
  );

  const tools = [
    {
      href: '/tools/compass' as Href,
      icon: Compass,
      title: 'Compass',
      description: 'Heading and cardinal direction.',
      drain: 'medium' as Drain,
      reading: heading == null ? 'No fix' : `${Math.round(heading)} deg`,
    },
    {
      href: '/tools/barometer' as Href,
      icon: Gauge,
      title: 'Barometer',
      description: 'Pressure and trend snapshots.',
      drain: 'low' as Drain,
      reading: pressure == null ? 'No reading' : `${Math.round(pressure)} hPa`,
    },
    {
      href: '/tools/level' as Href,
      icon: Ruler,
      title: 'Level',
      description: 'Pitch and roll bubble level.',
      drain: 'low' as Drain,
      reading:
        pitch == null || roll == null ? 'No reading' : `${pitch.toFixed(1)} / ${roll.toFixed(1)}`,
    },
    {
      href: '/tools/chronometer' as Href,
      icon: Timer,
      title: 'Chronometer',
      description: 'Stopwatch with lap times.',
      drain: 'low' as Drain,
      reading: 'Offline',
    },
    {
      href: '/tools/light' as Href,
      icon: Lightbulb,
      title: 'Light meter',
      description: 'Ambient lux on supported devices.',
      drain: 'low' as Drain,
      reading: lux == null ? 'No reading' : `${Math.round(lux)} lux`,
    },
    {
      href: TOOL_ROUTES.coordinates,
      icon: Crosshair,
      title: 'Coordinates',
      description: 'GPS fix and saved map spots.',
      drain: 'medium' as Drain,
      reading: 'Location',
    },
    {
      href: TOOL_ROUTES.weather,
      icon: SunMedium,
      title: 'Meteorology',
      description: 'Cached forecast and confidence.',
      drain: 'low' as Drain,
      reading: 'Cached',
    },
    {
      href: '/tools/news' as Href,
      icon: Newspaper,
      title: 'News',
      description: 'Emergency feeds for offline reading.',
      drain: 'low' as Drain,
      reading: 'Feeds',
      badge: rssUnreadCount,
    },
    {
      href: TOOL_ROUTES.checklist,
      icon: CheckSquare,
      title: 'Checklist',
      description: 'Readiness tasks before leaving service.',
      drain: 'low' as Drain,
      reading: 'Local',
    },
  ];

  return (
    <Screen>
      <View className="flex-row items-center justify-between gap-3">
        <View className="flex-1 gap-2">
          <Text variant="h1">Tools</Text>
        </View>
        <Arky pose="resourceful" size={80} />
      </View>

      <View className="flex-row flex-wrap gap-3">
        {tools.map((tool) => (
          <ToolTile key={tool.title} {...tool} />
        ))}
      </View>
    </Screen>
  );
}

function ToolTile({
  href,
  icon,
  title,
  description,
  drain,
  reading,
  badge,
}: {
  href: Href;
  icon: LucideIcon;
  title: string;
  description: string;
  drain: Drain;
  reading: string;
  badge?: number;
}) {
  return (
    <Link href={href} asChild>
      <Pressable className="w-[48%] min-w-[156px] flex-1">
        <Card className="min-h-[154px] justify-between gap-3 p-3">
          <View className="gap-3">
            <View className="flex-row items-start justify-between gap-2">
              <View className="bg-primary/12 relative size-10 items-center justify-center rounded-lg">
                <Icon as={icon} className="text-primary size-5" />
                {badge ? (
                  <View className="bg-destructive absolute -right-2 -top-2 min-w-5 items-center rounded-full px-1.5 py-0.5">
                    <Text className="text-[10px] font-bold text-white" numberOfLines={1}>
                      {badge > 99 ? '99+' : badge}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View className="items-end gap-1">
                <DrainBadge level={drain} />
              </View>
            </View>
            <View className="gap-1">
              <Text className="font-semibold" numberOfLines={1}>
                {title}
              </Text>
              <Text variant="muted" className="text-xs leading-4" numberOfLines={2}>
                {description}
              </Text>
            </View>
          </View>
          <Text variant="small" className="text-muted-foreground font-mono">
            {reading}
          </Text>
        </Card>
      </Pressable>
    </Link>
  );
}
