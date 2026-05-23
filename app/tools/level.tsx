import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { LevelService } from '@/services/sensors/level.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, Line, RadialGradient, Stop } from 'react-native-svg';

type LevelValue = { pitch: number; roll: number };

const SCREEN_WIDTH = Dimensions.get('window').width;
const DISC_SIZE    = SCREEN_WIDTH - 48;
const DISC_R       = DISC_SIZE / 2;
const BUBBLE_R     = DISC_SIZE * 0.18;
const MAX_TRAVEL   = DISC_R - BUBBLE_R - 8;
const RING_COUNT   = 8;

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

export default function LevelTool() {
  const setStoreLevel = useSensorStore((state) => state.setLevel);
  const publishLevel  = React.useCallback(
    (v: LevelValue | null) =>
      v ? setStoreLevel(v.pitch, v.roll) : setStoreLevel(null, null),
    [setStoreLevel],
  );
  const { available, value: level } = useSensorSubscription<LevelValue>(LevelService, publishLevel);

  const pitch = level?.pitch ?? 0;
  const roll  = level?.roll  ?? 0;

  // Phone lying flat (horizontal) → |pitch| is small (near 0)
  // Phone standing up (vertical)  → |pitch| is large (near 90)
  const isPhoneVertical = Math.abs(pitch) > 45;

  const isCentered  = Math.abs(pitch) < 3  && Math.abs(roll) < 3;
  const isNearLevel = Math.abs(pitch) < 10 && Math.abs(roll) < 10;

  const bubbleColor = isCentered ? '#22c55e' : isNearLevel ? '#f97316' : '#ef4444';
  const lineColor   = isCentered ? '#22c55e' : isNearLevel ? '#f97316' : '#ef4444';

  const animBx      = React.useRef(new Animated.Value(0)).current;
  const animBy      = React.useRef(new Animated.Value(0)).current;
  const animHorizon = React.useRef(new Animated.Value(0)).current;
  const animRoll    = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const cfg = { duration: 80, easing: Easing.out(Easing.quad), useNativeDriver: true };

    if (!isPhoneVertical) {
      // Flat/horizontal phone → bull's-eye bubble
      const bx = clamp((-roll  / 45) * MAX_TRAVEL, -MAX_TRAVEL, MAX_TRAVEL);
      const by = clamp(( pitch / 45) * MAX_TRAVEL, -MAX_TRAVEL, MAX_TRAVEL);
      Animated.parallel([
        Animated.timing(animBx, { toValue: bx, ...cfg }),
        Animated.timing(animBy, { toValue: by, ...cfg }),
      ]).start();
    } else {
      // Standing phone → horizon line
      const shift = clamp((pitch / 90) * (DISC_R * 0.8), -DISC_R * 0.8, DISC_R * 0.8);
      Animated.parallel([
        Animated.timing(animHorizon, { toValue: shift, ...cfg }),
        Animated.timing(animRoll,    { toValue: roll,  ...cfg }),
      ]).start();
    }
  }, [pitch, roll, isPhoneVertical]);

  const horizonRotate = animRoll.interpolate({
    inputRange: [-90, 90],
    outputRange: ['-90deg', '90deg'],
  });

  const DiscBackground = (
    <Svg width={DISC_SIZE} height={DISC_SIZE} style={StyleSheet.absoluteFillObject}>
      <Defs>
        <RadialGradient id="discGrad" cx="50%" cy="50%" r="50%">
          <Stop offset="0%"   stopColor="#1e1e1e" />
          <Stop offset="100%" stopColor="#0a0a0a" />
        </RadialGradient>
      </Defs>
      <Circle cx={DISC_R} cy={DISC_R} r={DISC_R} fill="url(#discGrad)" />
      {Array.from({ length: RING_COUNT }, (_, i) => {
        const rr      = (DISC_R * (i + 1)) / RING_COUNT;
        const isOuter = i === RING_COUNT - 1;
        return (
          <Circle
            key={i}
            cx={DISC_R} cy={DISC_R} r={rr}
            stroke={isOuter ? '#ffffff22' : '#ffffff0a'}
            strokeWidth={isOuter ? 1.5 : 1}
            fill="none"
          />
        );
      })}
      <Line x1={DISC_R} y1={0}      x2={DISC_R}    y2={DISC_SIZE} stroke="#ffffff0a" strokeWidth={1} />
      <Line x1={0}      y1={DISC_R} x2={DISC_SIZE} y2={DISC_R}    stroke="#ffffff0a" strokeWidth={1} />
      <Circle cx={DISC_R} cy={DISC_R} r={5}   stroke="#ffffff30" strokeWidth={1} fill="none" />
      <Circle cx={DISC_R} cy={DISC_R} r={1.5} fill="#ffffff40" />
    </Svg>
  );

  // ── Phone HORIZONTAL → Bull's-eye bubble view ─────────────────────────────
  if (!isPhoneVertical) {
    return (
      <Screen style={styles.screen}>
        <View style={styles.readout}>
          <Text style={styles.bigDeg}>{Math.round(Math.abs(roll))}°</Text>
          <Text style={styles.axisLabel}>Vertical</Text>
        </View>

        <View style={[styles.disc, { width: DISC_SIZE, height: DISC_SIZE, borderRadius: DISC_R }]}>
          {DiscBackground}

          <Animated.View
            style={[
              StyleSheet.absoluteFillObject,
              { transform: [{ translateX: animBx }, { translateY: animBy }] },
            ]}
          >
            <Svg width={DISC_SIZE} height={DISC_SIZE}>
              <Circle
                cx={DISC_R} cy={DISC_R} r={BUBBLE_R + 5}
                fill="none" stroke={bubbleColor} strokeWidth={1} strokeOpacity={0.2}
              />
              <Circle
                cx={DISC_R} cy={DISC_R} r={BUBBLE_R}
                fill="none" stroke={bubbleColor} strokeWidth={3} strokeOpacity={0.95}
              />
              <Circle
                cx={DISC_R} cy={DISC_R} r={BUBBLE_R - 3}
                fill={bubbleColor} fillOpacity={0.07}
              />
            </Svg>
          </Animated.View>
        </View>

        <View style={styles.readout}>
          <Text style={styles.bigDeg}>{Math.round(Math.abs(pitch))}°</Text>
          <Text style={styles.axisLabel}>Horizontal</Text>
        </View>

        {available === false && (
          <Text style={styles.unavailable}>Accelerometer not available.</Text>
        )}
      </Screen>
    );
  }

  // ── Phone VERTICAL → Horizon line view ───────────────────────────────────
  return (
    <Screen style={styles.screen}>
      <View style={styles.readout}>
        <Text style={styles.bigDeg}>{Math.round(Math.abs(roll))}°</Text>
        <Text style={styles.axisLabel}>Vertical</Text>
      </View>

      <View style={[styles.disc, { width: DISC_SIZE, height: DISC_SIZE, borderRadius: DISC_R }]}>
        {DiscBackground}

        <Animated.View
          style={[
            styles.horizonBand,
            {
              width: DISC_SIZE * 2,
              transform: [
                { translateX: -DISC_SIZE / 2 },
                { rotate: horizonRotate },
                { translateY: animHorizon },
              ],
            },
          ]}
        >
          <View style={[styles.horizonFill, { backgroundColor: isCentered ? '#0d2a0d' : '#1a0d00' }]} />
          <View style={[styles.horizonLine, { backgroundColor: lineColor }]} />
        </Animated.View>

        <View style={styles.crosshairFixed} pointerEvents="none">
          <View style={[styles.crossH, { backgroundColor: '#ffffff20' }]} />
          <View style={[styles.crossV, { backgroundColor: '#ffffff20' }]} />
          <View style={styles.crossDot} />
        </View>
      </View>

      <View style={styles.readout}>
        <Text style={styles.bigDeg}>{Math.round(Math.abs(pitch))}°</Text>
        <Text style={styles.axisLabel}>Horizontal</Text>
      </View>

      {available === false && (
        <Text style={styles.unavailable}>Accelerometer not available.</Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 28,
    paddingHorizontal: 24,
  },
  readout: {
    alignItems: 'center',
    gap: 4,
  },
  bigDeg: {
    fontSize: 52,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 56,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  axisLabel: {
    fontSize: 16,
    color: '#8e8e93',
    fontWeight: '400',
  },
  disc: {
    backgroundColor: '#0a0a0a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  horizonBand: {
    position: 'absolute',
    top: 0,
    bottom: 0,
  },
  horizonFill: {
    flex: 1,
  },
  horizonLine: {
    height: 2.5,
    width: '100%',
  },
  crosshairFixed: {
    position: 'absolute',
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crossH: {
    position: 'absolute',
    width: 48,
    height: 1,
  },
  crossV: {
    position: 'absolute',
    width: 1,
    height: 48,
  },
  crossDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: '#ffffff40',
  },
  unavailable: {
    fontSize: 13,
    color: '#ff453a',
    textAlign: 'center',
  },
});