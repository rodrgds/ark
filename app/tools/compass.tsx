import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { CompassService } from '@/services/sensors/compass.service';
import { useSensorStore } from '@/stores/sensor-store';
import * as React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import { Animated, Dimensions, StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  Path,
  Polygon,
  Stop,
  LinearGradient,
  Text as SvgText,
} from 'react-native-svg';

// ─── Layout constants ─────────────────────────────────────────────────────────
const W         = Dimensions.get('window').width;
const SIZE      = W - 48;           // outer bezel diameter
const BEZEL_R   = SIZE / 2;
const DIAL_R    = BEZEL_R - 20;    // rotating inner dial
const TICK_OR   = DIAL_R - 2;      // outer edge of ticks
const LABEL_R   = DIAL_R - 38;    // degree number radius
const CARD_R    = DIAL_R - 68;    // cardinal letter radius
const ICARD_R   = DIAL_R - 88;   // intercardinal radius
const ARC_R     = BEZEL_R - 8;    // orange arc radius (on outer bezel, fixed)
const CX        = BEZEL_R;
const CY        = BEZEL_R;

// ─── Precompute tick geometry ─────────────────────────────────────────────────
const TICKS = Array.from({ length: 72 }, (_, i) => {
  const deg    = i * 5;
  const rad    = (deg - 90) * (Math.PI / 180);
  const isMaj  = deg % 90 === 0;
  const isMid  = deg % 45 === 0 && !isMaj;
  const is10   = deg % 10 === 0 && !isMaj && !isMid;
  const len    = isMaj ? 20 : isMid ? 14 : is10 ? 10 : 5;
  const sw     = isMaj ? 2.5 : isMid ? 1.8 : is10 ? 1.2 : 0.7;
  const color  = isMaj ? '#ffffff' : isMid ? '#cccccc' : is10 ? '#888888' : '#444444';
  const r1     = TICK_OR;
  const r2     = TICK_OR - len;
  return {
    deg,
    x1: CX + r1 * Math.cos(rad), y1: CY + r1 * Math.sin(rad),
    x2: CX + r2 * Math.cos(rad), y2: CY + r2 * Math.sin(rad),
    sw, color,
  };
});

// Degree labels every 30°
const DEG_LABELS = Array.from({ length: 12 }, (_, i) => {
  const deg = i * 30;
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    deg,
    label: String(deg),
    x: CX + LABEL_R * Math.cos(rad),
    y: CY + LABEL_R * Math.sin(rad),
  };
});

// Cardinals on the rotating dial
const CARDINALS = [
  { label: 'N', deg: 0,   color: '#ff6b30', size: 20 },
  { label: 'S', deg: 180, color: '#ffffff', size: 20 },
  { label: 'E', deg: 90,  color: '#ffffff', size: 20 },
  { label: 'W', deg: 270, color: '#ffffff', size: 20 },
].map(({ label, deg, color, size }) => {
  const rad = (deg - 90) * (Math.PI / 180);
  return { label, color, size, x: CX + CARD_R * Math.cos(rad), y: CY + CARD_R * Math.sin(rad) + size * 0.36 };
});

const INTERCARDINALS = [
  { label: 'NE', deg: 45 }, { label: 'SE', deg: 135 },
  { label: 'SW', deg: 225 }, { label: 'NW', deg: 315 },
].map(({ label, deg }) => {
  const rad = (deg - 90) * (Math.PI / 180);
  return { label, x: CX + ICARD_R * Math.cos(rad), y: CY + ICARD_R * Math.sin(rad) + 5 };
});

// ─── Helper: cardinal name ────────────────────────────────────────────────────
const DIR_NAMES = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
function getCardinal(h: number) { return DIR_NAMES[Math.round(h / 22.5) % 16]; }

// ─── Helper: SVG arc path (fixed, drawn on the bezel layer) ──────────────────
function arcPath(heading: number): string {
  // Arc from top (N = -90° in SVG coords) clockwise to current heading
  const startAngle = -Math.PI / 2;
  const endAngle   = (heading - 90) * (Math.PI / 180);
  let sweep        = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep = 2 * Math.PI;
  const largeArc   = sweep > Math.PI ? 1 : 0;
  const r          = ARC_R;
  const x1 = CX + r * Math.cos(startAngle);
  const y1 = CY + r * Math.sin(startAngle);
  const x2 = CX + r * Math.cos(endAngle);
  const y2 = CY + r * Math.sin(endAngle);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

// Arrow tip at top of bezel pointing inward (fixed, marks N)
const ARROW_TIP_Y = CY - ARC_R + 2;
const ARROW = `${CX},${ARROW_TIP_Y + 12} ${CX - 7},${ARROW_TIP_Y + 22} ${CX + 7},${ARROW_TIP_Y + 22}`;

// ─── Static bezel (outer fixed ring with degree marks) ───────────────────────
const Bezel = React.memo(() => (
  <Svg
    width={SIZE} height={SIZE}
    viewBox={`0 0 ${SIZE} ${SIZE}`}
    style={StyleSheet.absoluteFillObject}
  >
    {/* Outer ring */}
    <Circle cx={CX} cy={CY} r={BEZEL_R - 1} fill="#1a1a1a" stroke="#333333" strokeWidth={1} />
    {/* Inner dial background */}
    <Circle cx={CX} cy={CY} r={DIAL_R} fill="#111111" />
    {/* Crosshair lines (fixed) */}
    <Line x1={CX - 36} y1={CY} x2={CX + 36} y2={CY} stroke="#444" strokeWidth={1} />
    <Line x1={CX} y1={CY - 36} x2={CX} y2={CY + 36} stroke="#444" strokeWidth={1} />
  </Svg>
));

// ─── Rotating dial (ticks + labels + cardinals) ───────────────────────────────
const RotatingDial = React.memo(({ rotate }: { rotate: Animated.AnimatedInterpolation<string> }) => (
  <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate }] }]}>
    <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
      <Defs>
        <LinearGradient id="needleRed" x1="0.5" y1="0" x2="0.5" y2="1">
          <Stop offset="0%" stopColor="#ff8855" />
          <Stop offset="100%" stopColor="#cc3300" />
        </LinearGradient>
      </Defs>

      {/* Tick marks */}
      {TICKS.map(({ deg, x1, y1, x2, y2, sw, color }) => (
        <Line key={deg} x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={sw} strokeLinecap="round" />
      ))}

      {/* Degree numbers */}
      {DEG_LABELS.map(({ deg, label, x, y }) => (
        <SvgText
          key={deg} x={x} y={y + 5}
          textAnchor="middle" fill={deg === 0 ? '#ff6b30' : '#aaaaaa'}
          fontSize={deg % 90 === 0 ? 14 : 11}
          fontWeight={deg % 90 === 0 ? '700' : '400'}
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif"
        >
          {label}
        </SvgText>
      ))}

      {/* Cardinals */}
      {CARDINALS.map(({ label, x, y, color, size }) => (
        <SvgText key={label} x={x} y={y} textAnchor="middle" fill={color}
          fontSize={size} fontWeight="700"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
          {label}
        </SvgText>
      ))}

      {/* Intercardinals */}
      {INTERCARDINALS.map(({ label, x, y }) => (
        <SvgText key={label} x={x} y={y} textAnchor="middle" fill="#666666"
          fontSize={12} fontWeight="500"
          fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
          {label}
        </SvgText>
      ))}
    </Svg>
  </Animated.View>
));

// ─── Orange arc + N-arrow overlay (depends on current heading, not animated) ──
const ArcOverlay = React.memo(({ heading }: { heading: number }) => {
  const d     = arcPath(heading);
  const endRad = (heading - 90) * (Math.PI / 180);
  const tipX  = CX + ARC_R * Math.cos(endRad);
  const tipY  = CY + ARC_R * Math.sin(endRad);
  const arrowPts = `${tipX},${tipY} ${tipX - 6},${tipY - 13} ${tipX + 6},${tipY - 13}`;

  return (
    <Svg
      width={SIZE} height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none"
    >
      {/* Orange arc N → heading */}
      <Path d={d} fill="none" stroke="#ff6b30" strokeWidth={4} strokeLinecap="round" />

      {/* Fixed N marker tick (always at top) */}
      <Line
        x1={CX} y1={CY - ARC_R + 4}
        x2={CX} y2={CY - ARC_R + 16}
        stroke="#ffffff" strokeWidth={2.5} strokeLinecap="round"
      />

      {/* Arrowhead at heading end of arc */}
      <Polygon points={arrowPts} fill="#ff6b30" />

      {/* Centre pivot */}
      <Circle cx={CX} cy={CY} r={12} fill="#1c1c1e" stroke="#555" strokeWidth={1.5} />
      <Circle cx={CX} cy={CY} r={4}  fill="#888888" />
    </Svg>
  );
});

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CompassTool() {
  const setStoreHeading = useSensorStore((state) => state.setHeading);
  const { available, value: heading } = useSensorSubscription(CompassService, setStoreHeading);

  const rotateAnim  = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef(0);
  // Live heading value for the arc (no animation — arc follows real heading instantly)
  const [liveHeading, setLiveHeading] = React.useState(0);

  useEffect(() => {
    if (heading === null) return;
    setLiveHeading(((heading % 360) + 360) % 360);

    let delta = heading - lastHeading.current;
    if (delta > 180)  delta -= 360;
    if (delta < -180) delta += 360;
    const next = lastHeading.current + delta;
    lastHeading.current = next;

    Animated.spring(rotateAnim, {
      toValue: -next,   // dial rotates OPPOSITE to heading so N stays at top of dial
      tension: 120,
      friction: 14,
      useNativeDriver: true,
      overshootClamping: true,
    }).start();
  }, [heading]);

  const rotate = useMemo(() => rotateAnim.interpolate({
    inputRange: [-1440, -720, 0, 720, 1440],
    outputRange: ['-1440deg', '-720deg', '0deg', '720deg', '1440deg'],
  }), [rotateAnim]);

  const displayDeg = heading === null
    ? '--°'
    : `${Math.round(liveHeading)}°`;
  const cardinal = heading === null ? '---' : getCardinal(liveHeading);

  return (
    <View style={styles.screen}>
      {/* ── Large readout ── */}
      <View style={styles.readoutRow}>
        <Text style={styles.degText}>{displayDeg}</Text>
        <Text style={styles.cardText}>{cardinal}</Text>
      </View>

      {/* ── Compass face ── */}
      <View style={[styles.compassWrap, { width: SIZE, height: SIZE }]}>
        <Bezel />
        <RotatingDial rotate={rotate} />
        <ArcOverlay heading={liveHeading} />
      </View>

      {/* ── Hint ── */}
      <Text style={styles.hint}>
        {available === false
          ? 'Magnetometer is not available on this device.'
          : 'Move in a figure-eight pattern if readings drift.'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#000000',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 32,
  },
  readoutRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  degText: {
    fontSize: 72,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: -2,
    lineHeight: 76,
  },
  cardText: {
    fontSize: 28,
    fontWeight: '600',
    color: '#ff6b30',
    letterSpacing: 3,
    paddingBottom: 8,
  },
  compassWrap: {
    position: 'relative',
  },
  hint: {
    fontSize: 13,
    color: '#636366',
    textAlign: 'center',
    lineHeight: 19,
  },
});