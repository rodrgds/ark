import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { CompassService } from '@/services/sensors/compass.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  Line,
  LinearGradient,
  Polygon,
  Stop,
  Text as SvgText,
} from 'react-native-svg';

// ─── constants (computed once at module level, never inside render) ───────────
const SCREEN_WIDTH = Dimensions.get('window').width;
const SIZE    = SCREEN_WIDTH - 32;
const INNER   = SIZE - 24;
const CX      = INNER / 2;
const CY      = INNER / 2;
const TICK_R  = INNER / 2 - 6;   // ticks hug the inner edge
const LABEL_R = INNER / 2 - 52;  // ++ pushed further inward so ticks never overlap letters
const INTER_R = INNER / 2 - 50;  // intercardinals same zone

// Needle proportions
const N_TIP   = CY - INNER * 0.34;
const S_TIP   = CY + INNER * 0.28;
const N_WIDE  = INNER * 0.055;
const WAIST_Y = CY + INNER * 0.03;

// Pre-build tick data array once — avoids recalculating 72 sin/cos on every render
const TICK_DATA = Array.from({ length: 72 }, (_, i) => {
  const deg = i * 5;
  const rad = (deg - 90) * (Math.PI / 180);
  const isMaj  = deg % 90 === 0;
  const isMid  = deg % 45 === 0 && !isMaj;
  const is15   = deg % 15 === 0 && !isMid && !isMaj;
  const len    = isMaj ? 22 : isMid ? 15 : is15 ? 10 : 5;
  const sw     = isMaj ? 2.5 : isMid ? 1.5 : is15 ? 1.2 : 0.8;
  const color  = isMaj ? '#ffffff' : isMid ? '#aaaaaa' : is15 ? '#666666' : '#3a3a3a';
  const x1 = CX + TICK_R * Math.cos(rad);
  const y1 = CY + TICK_R * Math.sin(rad);
  const x2 = CX + (TICK_R - len) * Math.cos(rad);
  const y2 = CY + (TICK_R - len) * Math.sin(rad);
  return { deg, x1, y1, x2, y2, sw, color };
});

// Pre-build cardinal label positions once
const CARDINAL_DATA = [
  { label: 'N', angle: 0,   color: '#ff3b30', size: 22 },
  { label: 'S', angle: 180, color: '#ffffff', size: 22 },
  { label: 'E', angle: 90,  color: '#ffffff', size: 22 },
  { label: 'W', angle: 270, color: '#ffffff', size: 22 },
].map(({ label, angle, color, size }) => {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
    label, color, size,
    x: CX + LABEL_R * Math.cos(rad),
    y: CY + LABEL_R * Math.sin(rad) + size * 0.36,
  };
});

const INTERCARDINAL_DATA = [
  { label: 'NE', angle: 45  },
  { label: 'SE', angle: 135 },
  { label: 'SW', angle: 225 },
  { label: 'NW', angle: 315 },
].map(({ label, angle }) => {
  const rad = (angle - 90) * (Math.PI / 180);
  return {
    label,
    x: CX + INTER_R * Math.cos(rad),
    y: CY + INTER_R * Math.sin(rad) + 5,
  };
});

const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function getCardinal(h: number): string {
  return DIRS[Math.round(h / 22.5) % 16];
}

// ─── Static dial — pure component, renders exactly once ──────────────────────
const Dial = React.memo(() => (
  <Svg
    width={INNER}
    height={INNER}
    viewBox={`0 0 ${INNER} ${INNER}`}
    style={StyleSheet.absoluteFillObject}
  >
    <Defs>
      <LinearGradient id="redG" x1="0.5" y1="0" x2="0.5" y2="1">
        <Stop offset="0%"   stopColor="#ff6b6b" />
        <Stop offset="100%" stopColor="#cc0000" />
      </LinearGradient>
      <LinearGradient id="whtG" x1="0.5" y1="0" x2="0.5" y2="1">
        <Stop offset="0%"   stopColor="#ffffff" />
        <Stop offset="100%" stopColor="#999999" />
      </LinearGradient>
    </Defs>

    {TICK_DATA.map(({ deg, x1, y1, x2, y2, sw, color }) => (
      <Line key={deg}
        x1={x1} y1={y1} x2={x2} y2={y2}
        stroke={color} strokeWidth={sw} strokeLinecap="round"
      />
    ))}

    {CARDINAL_DATA.map(({ label, x, y, color, size }) => (
      <SvgText key={label}
        x={x} y={y}
        textAnchor="middle"
        fill={color}
        fontSize={size}
        fontWeight="700"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
      >
        {label}
      </SvgText>
    ))}

    {INTERCARDINAL_DATA.map(({ label, x, y }) => (
      <SvgText key={label}
        x={x} y={y}
        textAnchor="middle"
        fill="#666666"
        fontSize={13}
        fontWeight="600"
        fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
      >
        {label}
      </SvgText>
    ))}
  </Svg>
));

// ─── Needle — pure component, only re-renders when rotate changes ─────────────
const Needle = React.memo(({ rotate }: { rotate: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate }] }]}>
    <Svg
      width={INNER}
      height={INNER}
      viewBox={`0 0 ${INNER} ${INNER}`}
    >
      <Defs>
        <LinearGradient id="redG2" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%"   stopColor="#ff6b6b" />
          <Stop offset="100%" stopColor="#cc0000" />
        </LinearGradient>
        <LinearGradient id="whtG2" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%"   stopColor="#ffffff" />
          <Stop offset="100%" stopColor="#999999" />
        </LinearGradient>
      </Defs>

      {/* Red north blade */}
      <Polygon
        points={`${CX},${N_TIP} ${CX - N_WIDE},${WAIST_Y} ${CX},${CY - 4} ${CX + N_WIDE},${WAIST_Y}`}
        fill="url(#redG2)"
        stroke="#cc0000"
        strokeWidth={1}
      />
      {/* White south blade */}
      <Polygon
        points={`${CX},${S_TIP} ${CX - N_WIDE},${WAIST_Y} ${CX},${CY - 4} ${CX + N_WIDE},${WAIST_Y}`}
        fill="url(#whtG2)"
        stroke="#888888"
        strokeWidth={1}
      />
      {/* Pivot */}
      <Circle cx={CX} cy={CY} r={11} fill="#1c1c1e" stroke="#555555" strokeWidth={1.5} />
      <Circle cx={CX} cy={CY} r={4.5} fill="#888888" />
    </Svg>
  </Animated.View>
));

// ─── Main component ───────────────────────────────────────────────────────────
export default function CompassTool() {
  const setStoreHeading = useSensorStore((state) => state.setHeading);
  const { available, value: heading } = useSensorSubscription(CompassService, setStoreHeading);

  const rotateAnim  = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef(0);

  useEffect(() => {
    if (heading === null) return;
    let delta = heading - lastHeading.current;
    if (delta > 180)  delta -= 360;
    if (delta < -180) delta += 360;
    const next = lastHeading.current + delta;
    lastHeading.current = next;
    Animated.timing(rotateAnim, {
      toValue: next,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [heading]);

  const rotate = useMemo(() => rotateAnim.interpolate({
    inputRange: [-720, -360, 0, 360, 720],
    outputRange: ['-720deg', '-360deg', '0deg', '360deg', '720deg'],
  }), [rotateAnim]);

  const displayHeading = heading === null
    ? '--°'
    : `${Math.round(((heading % 360) + 360) % 360)}°`;
  const cardinal = heading === null ? '---' : getCardinal(heading);

  const hintText = available === false
    ? 'Magnetometer is not available on this device.'
    : 'Move in a figure-eight pattern if readings drift.';

  return (
    <View style={styles.screen}>

      {/* Compass */}
      <View style={[styles.outerBezel, { width: SIZE, height: SIZE, borderRadius: SIZE / 2 }]}>
        <View style={[styles.rimRing, { width: SIZE - 6, height: SIZE - 6, borderRadius: (SIZE - 6) / 2 }]}>
          <View style={[styles.innerFace, { width: INNER, height: INNER, borderRadius: INNER / 2 }]}>
            <Dial />
            <Needle rotate={rotate} />
          </View>
        </View>
      </View>

      {/* Readout */}
      <View style={[styles.readout, { width: SIZE }]}>
        <Text style={styles.degText}>{displayHeading}</Text>
        <Text style={styles.cardinalText}>{cardinal}</Text>
        <Text style={styles.hintText}>{hintText}</Text>
      </View>

    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    gap: 28,
  },
  outerBezel: {
    backgroundColor: '#2a2a2a',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#ffffff',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 12,
  },
  rimRing: {
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#444444',
  },
  innerFace: {
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  readout: {
    backgroundColor: '#1c1c1e',
    borderRadius: 18,
    paddingVertical: 22,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  degText: {
    fontSize: 68,
    fontWeight: '700',
    color: '#ffffff',
    lineHeight: 72,
    letterSpacing: -1,
  },
  cardinalText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
    letterSpacing: 8,
  },
  hintText: {
    fontSize: 13,
    color: '#8e8e93',
    marginTop: 6,
    textAlign: 'center',
    lineHeight: 19,
  },
});