import { Screen } from '@/components/layout/screen';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { PedometerService } from '@/services/sensors/pedometer.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

type Status = 'idle' | 'requesting' | 'denied' | 'unavailable' | 'ready';

export default function PedometerTool() {
  const [status, setStatus]       = React.useState<Status>('idle');
  const [baseSteps, setBaseSteps] = React.useState(0);
  const [session, setSession]     = React.useState(0);
  const setStoreSteps             = useSensorStore((state) => state.setSteps);
  const baseRef                   = React.useRef(0);

  React.useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | null = null;

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

      stop = PedometerService.start((sessionSteps: number) => {
        setSession(sessionSteps);
        setStoreSteps(baseRef.current + sessionSteps);
      });

      if (cancelled) { stop?.(); return; }
      setStatus('ready');
    })();

    return () => {
      cancelled = true;
      stop?.();
      setStoreSteps(null);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retryAfterDenied = React.useCallback(async () => {
    setStatus('requesting');
    const granted = await PedometerService.requestPermission();
    if (!granted) { setStatus('denied'); return; }
    const available = await PedometerService.isAvailable();
    if (!available) { setStatus('unavailable'); return; }
    const { steps: base } = await PedometerService.getTodaySteps();
    baseRef.current = base;
    setBaseSteps(base);
    setStoreSteps(base);
    PedometerService.start((sessionSteps: number) => {
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

  if (status === 'denied') {
    return (
      <Screen style={styles.screen}>
        <Card style={styles.card}>
          <Text style={styles.permTitle}>Permission Denied</Text>
          <Text style={styles.permBody}>
            {Platform.OS === 'android'
              ? 'Go to Settings → Apps → Ark → Permissions and enable Physical Activity.'
              : 'Go to Settings → Privacy → Motion & Fitness and enable access for Ark.'}
          </Text>
          <TouchableOpacity style={styles.btn} onPress={retryAfterDenied}>
            <Text style={styles.btnText}>Try Again</Text>
          </TouchableOpacity>
        </Card>
      </Screen>
    );
  }

  if (status === 'unavailable') {
    return (
      <Screen style={styles.screen}>
        <Card style={styles.card}>
          <Text style={styles.permTitle}>Not Available</Text>
          <Text style={styles.permBody}>This device does not have a pedometer sensor.</Text>
        </Card>
      </Screen>
    );
  }

  if (status === 'idle' || status === 'requesting') {
    return (
      <Screen style={styles.screen}>
        <Card style={styles.card}>
          <Text style={styles.muted}>
            {status === 'requesting' ? 'Requesting permission…' : 'Starting…'}
          </Text>
        </Card>
      </Screen>
    );
  }

  return (
    <Screen style={styles.screen}>
      <Card style={styles.card}>

        <View style={styles.stepsRow}>
          <Text style={styles.stepsNum}>{total.toLocaleString()}</Text>
          <Text style={styles.stepsLabel}>steps today</Text>
        </View>

        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${(progress * 100).toFixed(1)}%` as any }]} />
        </View>
        <Text style={styles.goalText}>
          {total.toLocaleString()} / {goal.toLocaleString()} goal
        </Text>

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{distanceKm}</Text>
            <Text style={styles.statLabel}>km</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{calories}</Text>
            <Text style={styles.statLabel}>kcal</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text style={styles.statValue}>{session}</Text>
            <Text style={styles.statLabel}>session</Text>
          </View>
        </View>

      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  card: {
    width: '100%',
    backgroundColor: '#1c1c1e',
    borderRadius: 20,
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
    color: '#ffffff',
    lineHeight: 76,
    letterSpacing: -2,
  },
  stepsLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#8e8e93',
    letterSpacing: 1,
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: '#3a3a3c',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#30d158',
    borderRadius: 3,
  },
  goalText: {
    fontSize: 13,
    color: '#636366',
    marginTop: -8,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 8,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#3a3a3c',
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '600',
    color: '#ffffff',
  },
  statLabel: {
    fontSize: 12,
    color: '#8e8e93',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    height: 36,
    backgroundColor: '#3a3a3c',
  },
  muted: {
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
  },
  permTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  permBody: {
    fontSize: 14,
    color: '#8e8e93',
    textAlign: 'center',
    lineHeight: 20,
  },
  btn: {
    backgroundColor: '#30d158',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginTop: 8,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});