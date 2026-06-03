import { Text } from '@/components/ui/text';
import { NAV_COLORS } from '@/constants/theme';
import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { hexToRgba } from '@/lib/colors';
import { CompassService } from '@/services/sensors/compass.service';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { useEffect, useRef, useMemo } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, View } from 'react-native';
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

type ToolPalette = (typeof NAV_COLORS)[keyof typeof NAV_COLORS];

const W = Dimensions.get('window').width;
const SIZE = W - 48;
const BEZEL_R = SIZE / 2;
const DIAL_R = BEZEL_R - 20;
const TICK_OR = DIAL_R - 2;
const LABEL_R = DIAL_R - 38;
const CARD_R = DIAL_R - 68;
const ICARD_R = DIAL_R - 88;
const ARC_R = BEZEL_R - 8;
const CX = BEZEL_R;
const CY = BEZEL_R;

const TICKS = Array.from({ length: 72 }, (_, i) => {
  const deg = i * 5;
  const rad = (deg - 90) * (Math.PI / 180);
  const isMaj = deg % 90 === 0;
  const isMid = deg % 45 === 0 && !isMaj;
  const is10 = deg % 10 === 0 && !isMaj && !isMid;
  const len = isMaj ? 20 : isMid ? 14 : is10 ? 10 : 5;
  const sw = isMaj ? 2.5 : isMid ? 1.8 : is10 ? 1.2 : 0.7;
  const r1 = TICK_OR;
  const r2 = TICK_OR - len;
  return {
    deg,
    x1: CX + r1 * Math.cos(rad),
    y1: CY + r1 * Math.sin(rad),
    x2: CX + r2 * Math.cos(rad),
    y2: CY + r2 * Math.sin(rad),
    sw,
  };
});

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

const CARDINALS = [
  { label: 'N', deg: 0, size: 20 },
  { label: 'S', deg: 180, size: 20 },
  { label: 'E', deg: 90, size: 20 },
  { label: 'W', deg: 270, size: 20 },
].map(({ label, deg, size }) => {
  const rad = (deg - 90) * (Math.PI / 180);
  return {
    label,
    size,
    x: CX + CARD_R * Math.cos(rad),
    y: CY + CARD_R * Math.sin(rad) + size * 0.36,
  };
});

const INTERCARDINALS = [
  { label: 'NE', deg: 45 },
  { label: 'SE', deg: 135 },
  { label: 'SW', deg: 225 },
  { label: 'NW', deg: 315 },
].map(({ label, deg }) => {
  const rad = (deg - 90) * (Math.PI / 180);
  return { label, x: CX + ICARD_R * Math.cos(rad), y: CY + ICARD_R * Math.sin(rad) + 5 };
});

const DIR_NAMES = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
];
function getCardinal(h: number) {
  return DIR_NAMES[Math.round(h / 22.5) % 16];
}

function arcPath(heading: number): string {
  const startAngle = -Math.PI / 2;
  const endAngle = (heading - 90) * (Math.PI / 180);
  let sweep = endAngle - startAngle;
  if (sweep < 0) sweep += 2 * Math.PI;
  if (sweep > 2 * Math.PI) sweep = 2 * Math.PI;
  const largeArc = sweep > Math.PI ? 1 : 0;
  const r = ARC_R;
  const x1 = CX + r * Math.cos(startAngle);
  const y1 = CY + r * Math.sin(startAngle);
  const x2 = CX + r * Math.cos(endAngle);
  const y2 = CY + r * Math.sin(endAngle);
  return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
}

const ARROW_TIP_Y = CY - ARC_R + 2;
const ARROW = `${CX},${ARROW_TIP_Y + 12} ${CX - 7},${ARROW_TIP_Y + 22} ${CX + 7},${ARROW_TIP_Y + 22}`;

const Bezel = React.memo(function Bezel({ palette }: { palette: ToolPalette }) {
  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={StyleSheet.absoluteFillObject}>
      <Circle
        cx={CX}
        cy={CY}
        r={BEZEL_R - 1}
        fill={palette.card}
        stroke={palette.border}
        strokeWidth={1}
      />
      <Circle cx={CX} cy={CY} r={DIAL_R} fill={hexToRgba(palette.background, 0.62)} />
      <Line
        x1={CX - 36}
        y1={CY}
        x2={CX + 36}
        y2={CY}
        stroke={hexToRgba(palette.foreground, 0.18)}
        strokeWidth={1}
      />
      <Line
        x1={CX}
        y1={CY - 36}
        x2={CX}
        y2={CY + 36}
        stroke={hexToRgba(palette.foreground, 0.18)}
        strokeWidth={1}
      />
    </Svg>
  );
});

const RotatingDial = React.memo(function RotatingDial({
    rotate,
    palette,
  }: {
    rotate: Animated.AnimatedInterpolation<string>;
    palette: ToolPalette;
  }) {
  return (
    <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ rotate }] }]}>
      <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Defs>
          <LinearGradient id="needleRed" x1="0.5" y1="0" x2="0.5" y2="1">
            <Stop offset="0%" stopColor="#ff8855" />
            <Stop offset="100%" stopColor="#cc3300" />
          </LinearGradient>
        </Defs>

        {TICKS.map(({ deg, x1, y1, x2, y2, sw }) => (
          <Line
            key={deg}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke={
              deg % 90 === 0
                ? palette.foreground
                : deg % 45 === 0
                  ? hexToRgba(palette.foreground, 0.74)
                  : deg % 10 === 0
                    ? hexToRgba(palette.foreground, 0.48)
                    : hexToRgba(palette.foreground, 0.24)
            }
            strokeWidth={sw}
            strokeLinecap="round"
          />
        ))}

        {DEG_LABELS.map(({ deg, label, x, y }) => (
          <SvgText
            key={deg}
            x={x}
            y={y + 5}
            textAnchor="middle"
            fill={deg === 0 ? palette.primary : palette.mutedForeground}
            fontSize={deg % 90 === 0 ? 14 : 11}
            fontWeight={deg % 90 === 0 ? '700' : '400'}
            fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
            {label}
          </SvgText>
        ))}

        {CARDINALS.map(({ label, x, y, size }) => (
          <SvgText
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            fill={label === 'N' ? palette.primary : palette.foreground}
            fontSize={size}
            fontWeight="700"
            fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
            {label}
          </SvgText>
        ))}

        {INTERCARDINALS.map(({ label, x, y }) => (
          <SvgText
            key={label}
            x={x}
            y={y}
            textAnchor="middle"
            fill={hexToRgba(palette.foreground, 0.42)}
            fontSize={12}
            fontWeight="500"
            fontFamily="Helvetica Neue, Helvetica, Arial, sans-serif">
            {label}
          </SvgText>
        ))}
      </Svg>
    </Animated.View>
  );
});

const ArcOverlay = React.memo(function ArcOverlay({
  heading,
  palette,
}: {
  heading: number;
  palette: ToolPalette;
}) {
  const d = arcPath(heading);
  const endRad = (heading - 90) * (Math.PI / 180);
  const tipX = CX + ARC_R * Math.cos(endRad);
  const tipY = CY + ARC_R * Math.sin(endRad);
  const arrowPts = `${tipX},${tipY} ${tipX - 6},${tipY - 13} ${tipX + 6},${tipY - 13}`;

  return (
    <Svg
      width={SIZE}
      height={SIZE}
      viewBox={`0 0 ${SIZE} ${SIZE}`}
      style={StyleSheet.absoluteFillObject}
      pointerEvents="none">
      <Path d={d} fill="none" stroke={palette.primary} strokeWidth={4} strokeLinecap="round" />

      <Line
        x1={CX}
        y1={CY - ARC_R + 4}
        x2={CX}
        y2={CY - ARC_R + 16}
        stroke={palette.foreground}
        strokeWidth={2.5}
        strokeLinecap="round"
      />

      <Polygon points={arrowPts} fill={palette.primary} />

      <Circle
        cx={CX}
        cy={CY}
        r={12}
        fill={palette.card}
        stroke={palette.border}
        strokeWidth={1.5}
      />
      <Circle cx={CX} cy={CY} r={4} fill={palette.mutedForeground} />
    </Svg>
  );
});

export default function CompassTool() {
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = NAV_COLORS[theme];
  const setStoreHeading = useSensorStore((state) => state.setHeading);
  const reduceModeEnabled = useBatteryReduceMode();
  const motionEnabled = useMotionEnabled();

  const rotateAnim = useRef(new Animated.Value(0)).current;
  const lastHeading = useRef(0);
  const [available, setAvailable] = React.useState<boolean | null>(null);
  const [heading, setHeading] = React.useState<number | null>(null);
  const [liveHeading, setLiveHeading] = React.useState(0);

  useEffect(() => {
    let stop: (() => void) | undefined;
    let mounted = true;
    CompassService.isAvailable().then((ok) => {
      if (!mounted) return;
      setAvailable(ok);
      if (ok) {
        stop = CompassService.startReading(
          (next) => {
            setHeading(next.heading);
            setStoreHeading(next.heading);
          },
          { reduceModeEnabled }
        );
      }
    });
    return () => {
      mounted = false;
      stop?.();
      setStoreHeading(null);
    };
  }, [reduceModeEnabled, setStoreHeading]);

  useEffect(() => {
    if (heading === null) return;
    setLiveHeading(((heading % 360) + 360) % 360);

    let delta = heading - lastHeading.current;
    if (delta > 180) delta -= 360;
    if (delta < -180) delta += 360;
    const next = lastHeading.current + delta;
    lastHeading.current = next;

    Animated.timing(rotateAnim, {
      toValue: -next,
      duration: motionEnabled ? 80 : 0,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, [heading, motionEnabled, rotateAnim]);

  const rotate = useMemo(
    () =>
      rotateAnim.interpolate({
        inputRange: [-1440, -720, 0, 720, 1440],
        outputRange: ['-1440deg', '-720deg', '0deg', '720deg', '1440deg'],
      }),
    [rotateAnim]
  );

  const displayDeg = heading === null ? '--°' : `${Math.round(liveHeading)}°`;
  const cardinal = heading === null ? '---' : getCardinal(liveHeading);

  return (
    <View style={[styles.screen, { backgroundColor: palette.background }]}>
      <View style={styles.readoutRow}>
        <Text style={[styles.degText, { color: palette.foreground }]}>{displayDeg}</Text>
        <Text style={[styles.cardText, { color: palette.primary }]}>{cardinal}</Text>
      </View>

      <View style={[styles.compassWrap, { width: SIZE, height: SIZE }]}>
        <Bezel palette={palette} />
        <RotatingDial rotate={rotate} palette={palette} />
        <ArcOverlay heading={liveHeading} palette={palette} />
      </View>

      <Text style={[styles.hint, { color: palette.mutedForeground }]}>
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
    letterSpacing: 0,
    lineHeight: 76,
  },
  cardText: {
    fontSize: 28,
    fontWeight: '600',
    letterSpacing: 3,
    paddingBottom: 8,
  },
  compassWrap: {
    position: 'relative',
  },
  hint: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 19,
  },
});
