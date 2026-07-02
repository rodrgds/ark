import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import type { ThemeColors } from '@/constants/theme';
import { useSensorSubscription } from '@/hooks/use-sensor-subscription';
import { hexToRgba } from '@/lib/colors';
import { LevelService } from '@/services/sensors/level.service';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import * as React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Circle, Line, Rect } from 'react-native-svg';

type LevelValue = {
  pitch: number;
  roll: number;
  mode: 'flat' | 'upright';
  tubeAngle: number;
  tubeAxis: 'portrait' | 'landscape';
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export default function LevelTool() {
  const { width } = useWindowDimensions();
  const theme = useThemeStore((state) => state.effectiveTheme);
  const palette = useThemeStore((state) => state.colors);
  const setStoreLevel = useSensorStore((state) => state.setLevel);
  const publishLevel = React.useCallback(
    (value: LevelValue | null) =>
      value ? setStoreLevel(value.pitch, value.roll) : setStoreLevel(null, null),
    [setStoreLevel]
  );
  const { available, value: level } = useSensorSubscription<LevelValue>(LevelService, publishLevel);

  const size = Math.min(width - 48, 360);
  const radius = size / 2;
  const bubbleRadius = Math.max(22, size * 0.085);
  const travel = radius - bubbleRadius - 18;
  const pitch = level?.pitch ?? 0;
  const roll = level?.roll ?? 0;
  const mode = level?.mode ?? 'flat';
  const tubeAngle = level?.tubeAngle ?? 0;
  const tubeAxis = level?.tubeAxis ?? 'portrait';
  const bubbleX = clamp(roll / 18, -1, 1) * travel;
  const bubbleY = clamp(-pitch / 18, -1, 1) * travel;
  const error = Math.hypot(pitch, roll);
  const tubeWidth = Math.min(width - 48, 360);
  const tubeInset = 14;
  const tubeCenter = tubeWidth / 2;
  const tubeTickOffset = tubeWidth / 6;
  const tubeBubbleSize = bubbleRadius * 1.8;
  const tubeTravel = tubeWidth / 2 - tubeBubbleSize / 2 - 26;
  const tubeOffset = clamp(tubeAngle / 12, -1, 1) * tubeTravel;
  const centered = error <= 1.5;
  const near = error <= 4;
  const tubeCentered = Math.abs(tubeAngle) <= 1;
  const tubeNear = Math.abs(tubeAngle) <= 3;
  const signal = centered ? '#22c55e' : near ? '#f59e0b' : palette.primary;
  const tubeSignal = tubeCentered ? '#22c55e' : tubeNear ? '#f59e0b' : palette.primary;
  const centerText =
    mode === 'upright'
      ? tubeCentered
        ? 'Level'
        : `${Math.abs(tubeAngle).toFixed(1)}°`
      : centered
        ? 'Level'
        : `${Math.round(error)}°`;
  const centerLabel =
    mode === 'upright'
      ? `${tubeAxis === 'portrait' ? 'upright' : 'sideways'} ruler mode`
      : centered
        ? 'centered'
        : 'off level';

  return (
    <Screen className="bg-background" contentContainerStyle={styles.content}>
      <View style={styles.readout}>
        <Text variant="h1" className="font-mono">
          {centerText}
        </Text>
        <Text variant="muted">{centerLabel}</Text>
      </View>

      {mode === 'flat' ? (
        <View
          style={[
            styles.disc,
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}>
          <Svg width={size} height={size} style={StyleSheet.absoluteFillObject}>
            {[0.25, 0.5, 0.75, 1].map((scale) => (
              <Circle
                key={scale}
                cx={radius}
                cy={radius}
                r={(radius - 12) * scale}
                fill="none"
                stroke={
                  scale === 0.5 ? hexToRgba(signal, 0.48) : hexToRgba(palette.foreground, 0.12)
                }
                strokeWidth={scale === 0.5 ? 2 : 1}
              />
            ))}
            <Line
              x1={radius}
              y1={18}
              x2={radius}
              y2={size - 18}
              stroke={hexToRgba(palette.foreground, 0.14)}
              strokeWidth={1}
            />
            <Line
              x1={18}
              y1={radius}
              x2={size - 18}
              y2={radius}
              stroke={hexToRgba(palette.foreground, 0.14)}
              strokeWidth={1}
            />
            <Circle cx={radius} cy={radius} r={5} fill={hexToRgba(palette.foreground, 0.34)} />
          </Svg>

          <View
            style={[
              styles.bubble,
              {
                width: bubbleRadius * 2,
                height: bubbleRadius * 2,
                borderRadius: bubbleRadius,
                borderColor: signal,
                backgroundColor: hexToRgba(signal, theme === 'light' ? 0.16 : 0.22),
                transform: [{ translateX: bubbleX }, { translateY: bubbleY }],
              },
            ]}>
            <View style={[styles.bubbleCore, { backgroundColor: signal }]} />
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.tube,
            {
              width: tubeWidth,
              backgroundColor: palette.card,
              borderColor: palette.border,
            },
          ]}>
          <Svg width={tubeWidth} height={120} style={StyleSheet.absoluteFillObject}>
            <Rect
              x={tubeInset}
              y={34}
              width={tubeWidth - tubeInset * 2}
              height={52}
              rx={26}
              fill={hexToRgba(palette.background, theme === 'light' ? 0.55 : 0.72)}
              stroke={hexToRgba(palette.foreground, 0.1)}
            />
            <Line
              x1={tubeCenter}
              y1={28}
              x2={tubeCenter}
              y2={92}
              stroke={hexToRgba(tubeSignal, 0.8)}
              strokeWidth={2}
            />
            <Line
              x1={tubeCenter - tubeTickOffset}
              y1={40}
              x2={tubeCenter - tubeTickOffset}
              y2={80}
              stroke={hexToRgba(palette.foreground, 0.2)}
              strokeWidth={1}
            />
            <Line
              x1={tubeCenter + tubeTickOffset}
              y1={40}
              x2={tubeCenter + tubeTickOffset}
              y2={80}
              stroke={hexToRgba(palette.foreground, 0.2)}
              strokeWidth={1}
            />
          </Svg>
          <View
            style={[
              styles.tubeBubble,
              {
                width: tubeBubbleSize,
                height: tubeBubbleSize,
                borderRadius: bubbleRadius,
                borderColor: tubeSignal,
                backgroundColor: hexToRgba(tubeSignal, theme === 'light' ? 0.16 : 0.22),
                left: tubeWidth / 2 - tubeBubbleSize / 2,
                top: 60 - tubeBubbleSize / 2,
                transform: [{ translateX: tubeOffset }],
              },
            ]}>
            <View style={[styles.bubbleCore, { backgroundColor: tubeSignal }]} />
          </View>
        </View>
      )}

      <View style={styles.metrics}>
        <Metric label="Pitch" value={pitch} palette={palette} />
        <Metric label="Roll" value={roll} palette={palette} />
      </View>

      <Text variant="muted" className="text-center">
        {available === false
          ? 'Accelerometer is not available on this device.'
          : mode === 'upright'
            ? 'Stand the phone upright and use it like a ruler level.'
            : 'Place the phone flat. The bubble moves toward the high side.'}
      </Text>
    </Screen>
  );
}

function Metric({
  label,
  value,
  palette,
}: {
  label: string;
  value: number;
  palette: ThemeColors;
}) {
  return (
    <View style={[styles.metric, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <Text variant="muted">{label}</Text>
      <Text className="font-mono text-xl font-semibold">{value.toFixed(1)}°</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  readout: {
    alignItems: 'center',
    gap: 4,
  },
  disc: {
    alignItems: 'center',
    borderWidth: 1,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tube: {
    alignItems: 'center',
    borderRadius: 24,
    borderWidth: 1,
    height: 120,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bubble: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
  },
  tubeBubble: {
    alignItems: 'center',
    borderWidth: 2,
    justifyContent: 'center',
    position: 'absolute',
  },
  bubbleCore: {
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  metrics: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  metric: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    padding: 14,
  },
});
