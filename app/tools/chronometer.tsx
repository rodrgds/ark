import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
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

  const lapFormatted = (ms: number) => {
    const { base, cs } = formatTime(ms);
    return `${base}.${cs}`;
  };

  return (
    <Screen style={styles.screen}>

      {/* ── Ring ── */}
      <View style={[styles.ring, { width: RING_SIZE, height: RING_SIZE, borderRadius: RING_R }]}>
        <View style={[styles.ringInner, { width: INNER_SIZE, height: INNER_SIZE, borderRadius: INNER_SIZE / 2 }]}>
          <View style={styles.timeRow}>
            <Text style={styles.timeBase}>{base}</Text>
            <Text style={styles.timeCs}>.{cs}</Text>
          </View>
          {laps.length > 0 && (
            <Text style={styles.lapHint}>
              Lap {laps[0].index}  {lapFormatted(laps[0].split)}
            </Text>
          )}
        </View>
      </View>

      {/* ── Controls — full width row so buttons sit symmetrically ── */}
      <View style={styles.controls}>
        <View style={styles.btnSlot}>
          <TouchableOpacity
            style={[styles.btn, styles.btnGray, (!running && elapsed === 0) && styles.btnDisabled]}
            onPress={running ? lap : reset}
            disabled={!running && elapsed === 0}
            activeOpacity={0.75}
          >
            <Text style={styles.btnGrayText}>{running ? 'Lap' : 'Reset'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.btnSlot}>
          <TouchableOpacity
            style={[styles.btn, running ? styles.btnRed : styles.btnGreen]}
            onPress={running ? pause : start}
            activeOpacity={0.75}
          >
            <Text style={running ? styles.btnRedText : styles.btnGreenText}>
              {running ? 'Stop' : elapsed === 0 ? 'Start' : 'Resume'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Lap list ── */}
      {laps.length > 0 && (
        <View style={[styles.lapList, { width: SW - 32, height: SH * 0.34 }]}>
          <View style={styles.lapHeader}>
            <Text style={[styles.lapColNarrow, styles.lapHeadText]}>LAP</Text>
            <Text style={[styles.lapColWide,   styles.lapHeadText]}>SPLIT</Text>
            <Text style={[styles.lapColWide,   styles.lapHeadText]}>TOTAL</Text>
          </View>
          <FlatList
            data={laps}
            keyExtractor={l => String(l.index)}
            style={{ flex: 1 }}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <View style={styles.lapRow}>
                <Text style={[styles.lapColNarrow, styles.lapRowText]}>{item.index}</Text>
                <Text style={[
                  styles.lapColWide,
                  styles.lapRowText,
                  item.split === fastestMs && styles.colorGreen,
                  item.split === slowestMs && styles.colorRed,
                ]}>
                  {lapFormatted(item.split)}
                </Text>
                <Text style={[styles.lapColWide, styles.lapRowText, styles.colorDim]}>
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
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  ring: {
    backgroundColor: '#0d0d0d',
    borderWidth: 1.5,
    borderColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringInner: {
    borderWidth: 1,
    borderColor: '#1c1c1c',
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
    color: '#ffffff',
    letterSpacing: -1,
    lineHeight: 72,
    includeFontPadding: false,
  },
  timeCs: {
    fontSize: 36,
    fontWeight: '400',
    color: '#666666',
    letterSpacing: 0,
    lineHeight: 44,
    includeFontPadding: false,
    marginBottom: 4,
  },
  lapHint: {
    fontSize: 18,
    fontWeight: '500',
    color: '#555555',
    letterSpacing: 0.5,
  },

  // ── Buttons — each in an equal flex slot so they're always centered ────────
  controls: {
    flexDirection: 'row',
    width: SW - 32,         // same width as the lap list
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnSlot: {
    flex: 1,
    alignItems: 'center',   // centers the button within its half
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
    backgroundColor: '#0d2a0d',
    borderWidth: 2.5,
    borderColor: '#30d158',
  },
  btnRed: {
    backgroundColor: '#2a0d0d',
    borderWidth: 2.5,
    borderColor: '#ff453a',
  },
  btnGray: {
    backgroundColor: '#1c1c1e',
    borderWidth: 1.5,
    borderColor: '#3a3a3c',
  },
  btnDisabled: {
    opacity: 0.2,
  },
  btnGreenText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#30d158',
  },
  btnRedText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ff453a',
  },
  btnGrayText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#8e8e93',
  },

  // ── Laps ──────────────────────────────────────────────────────────────────
  lapList: {
    backgroundColor: '#1c1c1e',
    borderRadius: 16,
    overflow: 'hidden',
  },
  lapHeader: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#3a3a3c',
  },
  lapHeadText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#555555',
    letterSpacing: 1.2,
  },
  lapRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#222222',
  },
  lapRowText: {
    fontSize: 17,
    fontWeight: '500',
    color: '#ffffff',
  },
  lapColNarrow: { width: 44 },
  lapColWide:   { flex: 1 },
  colorGreen:   { color: '#30d158' },
  colorRed:     { color: '#ff453a' },
  colorDim:     { color: '#555555' },
});