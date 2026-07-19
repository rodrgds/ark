import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { useMotionEnabled } from '@/hooks/use-motion-enabled';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { hexToRgba } from '@/lib/colors';
import { LightMeterService } from '@/services/sensors/light.service';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

// Lux reference points for labelling
const LUX_ZONES = [
  { max: 1, label: 'Pitch dark', color: '#1a1a2e' },
  { max: 10, label: 'Candlelight', color: '#2d1b00' },
  { max: 50, label: 'Dim room', color: '#3d2800' },
  { max: 200, label: 'Room light', color: '#5c3d00' },
  { max: 500, label: 'Office light', color: '#7a5200' },
  { max: 1000, label: 'Overcast day', color: '#8B6914' },
  { max: 5000, label: 'Daylight', color: '#B8860B' },
  { max: 20000, label: 'Bright sun', color: '#DAA520' },
  { max: Infinity, label: 'Direct sun', color: '#FFD700' },
];

function getZone(lux: number) {
  return LUX_ZONES.find((z) => lux <= z.max) ?? LUX_ZONES[LUX_ZONES.length - 1];
}

// Map lux to 0–1 on a log scale so low values are readable
function luxToProgress(lux: number): number {
  if (lux <= 0) return 0;
  const MIN_LOG = Math.log10(1);
  const MAX_LOG = Math.log10(30000);
  return Math.min((Math.log10(lux) - MIN_LOG) / (MAX_LOG - MIN_LOG), 1);
}

// Ray count and sizing
const RAY_COUNT = 16;
const RAY_ANGLES = Array.from({ length: RAY_COUNT }, (_, i) => (i * 360) / RAY_COUNT);

export default function LightTool() {
  const { width } = useWindowDimensions();
  const discSize = Math.min(width - 64, 420);
  const discRadius = discSize / 2;
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = useThemeStore((state) => state.colors);
  const motionEnabled = useMotionEnabled();
  const setStoreLux = useSensorStore((state) => state.setLux);
  const { available, value: lux } = useSensorSubscription(LightMeterService, setStoreLux);

  const safeLux = lux ?? 0;
  const progress = luxToProgress(safeLux);
  const zone = getZone(safeLux);

  // ── Animated values ───────────────────────────────────────────────────────
  const animProgress = React.useRef(new Animated.Value(0)).current;
  const animRayScale = React.useRef(new Animated.Value(0)).current;
  const animRotate = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!motionEnabled) {
      animProgress.setValue(progress);
      animRayScale.setValue(progress);
      return;
    }
    Animated.parallel([
      Animated.timing(animProgress, {
        toValue: progress,
        duration: 600,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false, // drives SVG stroke — needs JS driver
      }),
      Animated.spring(animRayScale, {
        toValue: progress,
        tension: 60,
        friction: 10,
        useNativeDriver: true,
      }),
    ]).start();
  }, [animProgress, animRayScale, motionEnabled, progress]);

  // Slowly rotate the rays — purely decorative
  React.useEffect(() => {
    if (!motionEnabled) {
      animRotate.stopAnimation();
      animRotate.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(animRotate, {
        toValue: 1,
        duration: 20000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [animRotate, motionEnabled]);

  const rotateDeg = animRotate.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  // Background darkness driven by progress
  const bgOpacity = animProgress.interpolate({
    inputRange: [0, 1],
    outputRange: [0.0, 0.35],
  });

  const displayLux = lux === null ? '--' : Math.round(safeLux).toLocaleString();

  return (
    <Screen style={[styles.screen, { backgroundColor: palette.background }]}>
      {/* ── Sun / glow disc ── */}
      <View style={[styles.discWrap, { width: discSize, height: discSize }]}>
        {/* Ambient glow background */}
        <Animated.View
          style={[
            StyleSheet.absoluteFill,
            {
              borderRadius: discRadius,
              backgroundColor: zone.color,
              opacity: bgOpacity,
            },
          ]}
        />

        {/* Rotating rays */}
        <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: rotateDeg }] }]}>
          {RAY_ANGLES.map((angle, i) => {
            const rayLength =
              discRadius * (0.18 + (i % 2 === 0 ? 0.08 : 0)) * (0.3 + progress * 0.7);
            const rad = (angle * Math.PI) / 180;
            const x = discRadius + discRadius * 0.82 * Math.cos(rad) - 1;
            const y = discRadius + discRadius * 0.82 * Math.sin(rad) - rayLength / 2;
            return (
              <Animated.View
                key={angle}
                style={[
                  styles.ray,
                  {
                    width: i % 2 === 0 ? 2 : 1.5,
                    height: rayLength,
                    backgroundColor: zone.color,
                    opacity: 0.15 + progress * 0.65,
                    left: x,
                    top: y,
                    transform: [
                      { translateX: 0 },
                      { translateY: 0 },
                      { rotate: `${angle + 90}deg` },
                    ],
                  },
                ]}
              />
            );
          })}
        </Animated.View>

        {/* SVG glow core */}
        <Svg width={discSize} height={discSize} style={StyleSheet.absoluteFill}>
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={zone.color} stopOpacity="1" />
              <Stop offset="40%" stopColor={zone.color} stopOpacity="0.6" />
              <Stop offset="100%" stopColor={zone.color} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="core" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor="#FAFAFA" stopOpacity="0.95" />
              <Stop offset="60%" stopColor={zone.color} stopOpacity="0.8" />
              <Stop offset="100%" stopColor={zone.color} stopOpacity="0" />
            </RadialGradient>
          </Defs>

          {/* Outer glow */}
          <Circle
            cx={discRadius}
            cy={discRadius}
            r={discRadius * 0.75}
            fill="url(#glow)"
            opacity={0.12 + progress * 0.55}
          />

          {/* Inner hot core — shrinks/grows with lux */}
          <Circle
            cx={discRadius}
            cy={discRadius}
            r={discRadius * (0.08 + progress * 0.38)}
            fill="url(#core)"
            opacity={0.4 + progress * 0.6}
          />
        </Svg>

        {/* Lux number overlay */}
        <View style={styles.overlay} pointerEvents="none">
          <Text style={[styles.luxNum, { color: palette.foreground }]}>{displayLux}</Text>
          <Text style={[styles.luxUnit, { color: palette.mutedForeground }]}>lux</Text>
        </View>
      </View>

      {/* ── Zone label ── */}
      <View
        style={[
          styles.zonePill,
          {
            backgroundColor: hexToRgba(zone.color, theme === 'light' ? 0.12 : 0.2),
            borderColor: hexToRgba(zone.color, 0.4),
          },
        ]}>
        <Text
          style={[styles.zoneText, { color: zone.color === '#1a1a2e' ? '#aaaacc' : zone.color }]}>
          {zone.label}
        </Text>
      </View>

      {/* ── Reference scale ── */}
      <View style={[styles.scaleCard, { width: discSize }]}>
        <View style={[styles.scaleTrack, { backgroundColor: hexToRgba(palette.foreground, 0.14) }]}>
          <Animated.View
            style={[
              styles.scaleFill,
              {
                width: animProgress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
                backgroundColor: zone.color,
              },
            ]}
          />
        </View>
        <View style={styles.scaleLabels}>
          <Text style={[styles.scaleLabel, { color: palette.mutedForeground }]}>dark</Text>
          <Text style={[styles.scaleLabel, { color: palette.mutedForeground }]}>room</Text>
          <Text style={[styles.scaleLabel, { color: palette.mutedForeground }]}>day</Text>
          <Text style={[styles.scaleLabel, { color: palette.mutedForeground }]}>sun</Text>
        </View>
      </View>

      {available === false && (
        <Text style={[styles.unavailable, { color: palette.destructive }]}>
          Light sensor is not available on this device.
        </Text>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 32,
  },
  discWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  ray: {
    position: 'absolute',
    borderRadius: 2,
  },
  overlay: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  luxNum: {
    fontSize: 52,
    fontWeight: '700',
    lineHeight: 56,
    letterSpacing: 0,
    fontVariant: ['tabular-nums'],
  },
  luxUnit: {
    fontSize: 18,
    fontWeight: '400',
    marginTop: 2,
    letterSpacing: 2,
  },
  zonePill: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 999,
    borderWidth: 1,
  },
  zoneText: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  scaleCard: {
    gap: 6,
  },
  scaleTrack: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  scaleFill: {
    height: '100%',
    borderRadius: 3,
  },
  scaleLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  scaleLabel: {
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  unavailable: {
    fontSize: 13,
    textAlign: 'center',
  },
});
