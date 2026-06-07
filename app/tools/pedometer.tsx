import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { NAV_COLORS } from '@/constants/theme';
import { hexToRgba } from '@/lib/colors';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type Status = 'idle' | 'requesting' | 'denied' | 'unavailable' | 'ready';

export default function PedometerTool() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = NAV_COLORS[theme];
  const [status, setStatus]       = React.useState<Status>('idle');
  const [baseSteps, setBaseSteps] = React.useState(0);
  const [session, setSession]     = React.useState(0);
  const setStoreSteps             = useSensorStore((state) => state.setSteps);
  const baseRef                   = React.useRef(0);
  const stopRef                   = React.useRef<(() => void) | null>(null);

  React.useEffect(() => {
    let cancelled = false;

    (async () => {
      setStatus('requesting');

      const granted = await PedometerService.requestPermission();
      if (cancelled) return;
      if (!granted) { setStatus('denied'); return; }

      const available = await PedometerService.isAvailable();
      if (cancelled) return;
      if (!available) { setStatus('unavailable'); return; }

      // iOS: get historical steps since midnight as baseline
      // Android: getTodaySteps now works via getStepCountAsync with date range
      const { steps: base } = await PedometerService.getTodaySteps();
      if (cancelled) return;

      baseRef.current = base;
      setBaseSteps(base);
      setStoreSteps(base);

      stopRef.current = PedometerService.start((sessionSteps: number) => {
        setSession(sessionSteps);
        setStoreSteps(baseRef.current + sessionSteps);
      });

      if (cancelled) {
        stopRef.current?.();
        stopRef.current = null;
        return;
      }
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      stopRef.current?.();
      stopRef.current = null;
      setStoreSteps(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryAfterDenied = React.useCallback(async () => {
    setStatus('requesting');
    stopRef.current?.();
    stopRef.current = null;
    const granted = await PedometerService.requestPermission();
    if (!granted) { setStatus('denied'); return; }
    const available = await PedometerService.isAvailable();
    if (!available) { setStatus('unavailable'); return; }
    const { steps: base } = await PedometerService.getTodaySteps();
    baseRef.current = base;
    setBaseSteps(base);
    setStoreSteps(base);
    stopRef.current = PedometerService.start((sessionSteps: number) => {
      setSession(sessionSteps);
      setStoreSteps(baseRef.current + sessionSteps);
    });
    setStatus('ready');
  }, [setStoreSteps]);

  const total      = baseSteps + session;
  const goal       = 10_000;
  const progress   = Math.min(total / goal, 1);
  const distanceKm = (total * 0.000762).toFixed(2);
  const calories   = Math.round(total * 0.04);
  const success = '#22c55e';
  const cardStyle = [
    styles.card,
    { backgroundColor: palette.card, borderColor: palette.border },
  ];

  if (status === 'denied') {
    return (
      <Screen style={[styles.screen, { backgroundColor: palette.background }]}>
        <Card style={cardStyle}>
          <Text style={[styles.permTitle, { color: palette.foreground }]}>Permission Denied</Text>
          <Text style={[styles.permBody, { color: palette.mutedForeground }]}>
            {Platform.OS === 'android'
              ? 'Go to Settings → Apps → Ark → Permissions and enable Physical Activity.'
              : 'Go to Settings → Privacy → Motion & Fitness and enable access for Ark.'}
          </Text>
          <TouchableOpacity
            style={[styles.btn, { backgroundColor: palette.primary }]}
            onPress={retryAfterDenied}>
            <Text style={[styles.btnText, { color: theme === 'light' ? '#FFFFFF' : '#0A0A0A' }]}>
              Try Again
            </Text>
          </TouchableOpacity>
        </Card>
      </Screen>
    );
  }

  if (status === 'unavailable') {
    return (
      <Screen style={[styles.screen, { backgroundColor: palette.background }]}>
        <Card style={cardStyle}>
          <Text style={[styles.permTitle, { color: palette.foreground }]}>Not Available</Text>
          <Text style={[styles.permBody, { color: palette.mutedForeground }]}>
            This device does not have a pedometer sensor.
          </Text>
        </Card>
      </Screen>
    );
  }

  if (status === 'idle' || status === 'requesting') {
    return (
      <Screen style={[styles.screen, { backgroundColor: palette.background }]}>
        <Card style={cardStyle}>
          <Text style={[styles.muted, { color: palette.mutedForeground }]}>
            {status === 'requesting' ? 'Requesting permission…' : 'Starting…'}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen style={[styles.screen, { backgroundColor: palette.background }]}>
      <Card style={cardStyle}>

        <View style={styles.stepsRow}>
          <Text style={[styles.stepsNum, { color: palette.foreground }]}>
            {total.toLocaleString()}
          </Text>
          <Text style={[styles.stepsLabel, { color: palette.mutedForeground }]}>steps today</Text>
        </View>

        <View style={[styles.progressTrack, { backgroundColor: hexToRgba(palette.foreground, 0.14) }]}>
          <View
            style={[
              styles.progressFill,
              {
                backgroundColor: success,
                width: `${(progress * 100).toFixed(1)}%` as any,
              },
            ]}
          />
        </View>
        <Text style={[styles.goalText, { color: palette.mutedForeground }]}>
          {total.toLocaleString()} / {goal.toLocaleString()} goal
        </Text>

        <View style={[styles.statsRow, { borderTopColor: palette.border }]}>
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: palette.foreground }]}>{distanceKm}</Text>
            <Text style={[styles.statLabel, { color: palette.mutedForeground }]}>km</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: palette.foreground }]}>{calories}</Text>
            <Text style={[styles.statLabel, { color: palette.mutedForeground }]}>kcal</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: palette.border }]} />
          <View style={styles.statBox}>
            <Text style={[styles.statValue, { color: palette.foreground }]}>{session}</Text>
            <Text style={[styles.statLabel, { color: palette.mutedForeground }]}>session</Text>
          </View>
        </View>

      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    borderWidth: 1,
    paddingVertical: 32,
    paddingHorizontal: 28,
    alignItems: 'center',
    gap: 16,
  },
  stepsRow: {
    alignItems: 'center',
    gap: 4,
  },
  stepsNum: {
    fontSize: 72,
    fontWeight: '700',
    lineHeight: 76,
    letterSpacing: 0,
  },
  stepsLabel: {
    fontSize: 16,
    fontWeight: '500',
    letterSpacing: 1,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  goalText: {
    fontSize: 13,
    marginTop: -8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
  },
  muted: {
    fontSize: 13,
    textAlign: 'center',
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
