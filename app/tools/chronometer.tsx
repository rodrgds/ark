import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { NAV_COLORS } from '@/constants/theme';
import { hexToRgba } from '@/lib/colors';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Dimensions, FlatList, StyleSheet, TouchableOpacity, View } from 'react-native';

const { width: SW, height: SH } = Dimensions.get('window');
const RING_SIZE  = SW - 24;
const RING_R     = RING_SIZE / 2;
const INNER_SIZE = RING_SIZE - 28;

function pad(n: number, len = 2) {
  return String(n).padStart(len, '0');
}

function formatTime(ms: number) {
  const h  = Math.floor(ms / 3_600_000);
  const m  = Math.floor((ms % 3_600_000) / 60_000);
  const s  = Math.floor((ms % 60_000) / 1_000);
  const cs = Math.floor((ms % 1_000) / 10);
  const base = h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
  return { base, cs: pad(cs) };
}

type Lap = { index: number; split: number; total: number };

export default function ChronometerTool() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = NAV_COLORS[theme];
  const [running, setRunning] = React.useState(false);
  const [elapsed, setElapsed] = React.useState(0);
  const [laps, setLaps]       = React.useState<Lap[]>([]);

  const startRef   = React.useRef(0);
  const baseRef    = React.useRef(0);
  const frameRef   = React.useRef(0);
  const lapBaseRef = React.useRef(0);

  const tick = React.useCallback(() => {
    setElapsed(baseRef.current + (Date.now() - startRef.current));
    frameRef.current = requestAnimationFrame(tick);
  }, []);

  const start = React.useCallback(() => {
    startRef.current = Date.now();
    setRunning(true);
    frameRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const pause = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    baseRef.current += Date.now() - startRef.current;
    setRunning(false);
  }, []);

  const reset = React.useCallback(() => {
    cancelAnimationFrame(frameRef.current);
    baseRef.current    = 0;
    lapBaseRef.current = 0;
    setRunning(false);
    setElapsed(0);
    setLaps([]);
  }, []);

  const lap = React.useCallback(() => {
    const now   = baseRef.current + (Date.now() - startRef.current);
    const split = now - lapBaseRef.current;
    lapBaseRef.current = now;
    setLaps(prev => [{ index: prev.length + 1, split, total: now }, ...prev]);
  }, []);

  React.useEffect(() => () => cancelAnimationFrame(frameRef.current), []);

  const fastestMs = laps.length > 1 ? Math.min(...laps.map(l => l.split)) : -1;
  const slowestMs = laps.length > 1 ? Math.max(...laps.map(l => l.split)) : -1;

  const { base, cs } = formatTime(elapsed);
  const success = '#22c55e';
  const danger = palette.destructive;

  const lapFormatted = (ms: number) => {
    const { base, cs } = formatTime(ms);
    return `${base}.${cs}`;
  };

  return (
    <Screen style={[styles.screen, { backgroundColor: palette.background }]}>

      <View
        style={[
          styles.ring,
          {
            width: RING_SIZE,
            height: RING_SIZE,
            borderRadius: RING_R,
            backgroundColor: palette.card,
            borderColor: palette.border,
          },
        ]}>
        <View
          style={[
            styles.ringInner,
            {
              width: INNER_SIZE,
              height: INNER_SIZE,
              borderRadius: INNER_SIZE / 2,
              borderColor: hexToRgba(palette.foreground, 0.12),
            },
          ]}>
          <View style={styles.timeRow}>
            <Text style={[styles.timeBase, { color: palette.foreground }]}>{base}</Text>
            <Text style={[styles.timeCs, { color: palette.mutedForeground }]}>.{cs}</Text>
          </View>
          {laps.length > 0 && (
            <Text style={[styles.lapHint, { color: palette.mutedForeground }]}>
              Lap {laps[0].index}  {lapFormatted(laps[0].split)}
            </Text>
          )}
        </View>
      </View>

      <View style={styles.controls}>
        <View style={styles.btnSlot}>
          <TouchableOpacity
            style={[
              styles.btn,
              styles.btnGray,
              {
                backgroundColor: palette.card,
                borderColor: palette.border,
              },
              (!running && elapsed === 0) && styles.btnDisabled,
            ]}
            onPress={running ? lap : reset}
            disabled={!running && elapsed === 0}
            activeOpacity={0.75}
          >
            <Text style={[styles.btnGrayText, { color: palette.mutedForeground }]}>
              {running ? 'Lap' : 'Reset'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.btnSlot}>
          <TouchableOpacity
            style={[
              styles.btn,
              running ? styles.btnRed : styles.btnGreen,
              {
                backgroundColor: hexToRgba(running ? danger : success, theme === 'light' ? 0.12 : 0.18),
                borderColor: running ? danger : success,
              },
            ]}
            onPress={running ? pause : start}
            activeOpacity={0.75}
          >
            <Text style={[running ? styles.btnRedText : styles.btnGreenText, { color: running ? danger : success }]}>
              {running ? 'Stop' : elapsed === 0 ? 'Start' : 'Resume'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {laps.length > 0 && (
        <View
          style={[
            styles.lapList,
            {
              width: SW - 32,
              height: SH * 0.34,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}>
          <View style={[styles.lapHeader, { borderBottomColor: palette.border }]}>
            <Text style={[styles.lapColNarrow, styles.lapHeadText, { color: palette.mutedForeground }]}>LAP</Text>
            <Text style={[styles.lapColWide, styles.lapHeadText, { color: palette.mutedForeground }]}>SPLIT</Text>
            <Text style={[styles.lapColWide, styles.lapHeadText, { color: palette.mutedForeground }]}>TOTAL</Text>
          </View>
          <FlatList
            data={laps}
            keyExtractor={l => String(l.index)}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={[styles.lapRow, { borderBottomColor: hexToRgba(palette.foreground, 0.08) }]}>
                <Text style={[styles.lapColNarrow, styles.lapRowText, { color: palette.foreground }]}>{item.index}</Text>
                <Text style={[
                  styles.lapColWide,
                  styles.lapRowText,
                  { color: palette.foreground },
                  item.split === fastestMs && { color: success },
                  item.split === slowestMs && { color: danger },
                ]}>
                  {lapFormatted(item.split)}
                </Text>
                <Text style={[styles.lapColWide, styles.lapRowText, { color: palette.mutedForeground }]}>
                  {lapFormatted(item.total)}
                </Text>
              </View>
            )}
          />
        </View>
      )}

    </Screen>
  );
}

const BTN = 84;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ring: {
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  timeBase: {
    fontSize: 68,
    fontWeight: '700',
    letterSpacing: 0,
    lineHeight: 72,
    includeFontPadding: false,
  },
  timeCs: {
    fontSize: 36,
    fontWeight: '400',
    letterSpacing: 0,
    lineHeight: 44,
    includeFontPadding: false,
    marginBottom: 4,
  },
  lapHint: {
    fontSize: 18,
    fontWeight: '500',
    letterSpacing: 0.5,
  },

  controls: {
    flexDirection: 'row',
    width: SW - 32, 
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSlot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btn: {
    width: BTN,
    height: BTN,
    borderRadius: BTN / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGreen: {
    borderWidth: 2.5,
  },
  btnRed: {
    borderWidth: 2.5,
  },
  btnGray: {
    borderWidth: 1.5,
  },
  btnDisabled: {
    opacity: 0.2,
  },
  btnGreenText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnRedText: {
    fontSize: 16,
    fontWeight: '700',
  },
  btnGrayText: {
    fontSize: 16,
    fontWeight: '600',
  },

  lapList: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  lapHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapHeadText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.2,
  },
  lapRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lapRowText: {
    fontSize: 17,
    fontWeight: '500',
  },
  lapColNarrow: { width: 44 },
  lapColWide:   { flex: 1 },
});
