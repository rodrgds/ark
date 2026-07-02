import { useThemeStore } from '@/stores/theme-store';
import type { RouteCoordinate } from '@/types/maps';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export function TrackRouteSparkline({
  coordinates,
  height = 96,
}: {
  coordinates: RouteCoordinate[];
  height?: number;
}) {
  const colors = useThemeStore((state) => state.colors);
  const path = React.useMemo(() => routePath(coordinates), [coordinates]);
  return (
    <View
      className="bg-muted overflow-hidden rounded-md"
      style={{ height, borderColor: colors.border, borderWidth: 1 }}>
      {path ? (
        <Svg width="100%" height="100%" viewBox="0 0 120 64">
          <Path
            d={path}
            fill="none"
            stroke={colors.background}
            strokeWidth={7}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <Path
            d={path}
            fill="none"
            stroke={colors.primary}
            strokeWidth={3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </Svg>
      ) : (
        <View className="flex-1" />
      )}
    </View>
  );
}

function routePath(coordinates: RouteCoordinate[]) {
  if (coordinates.length < 2) return '';
  const valid = coordinates.filter(
    (point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude)
  );
  if (valid.length < 2) return '';
  const minLat = Math.min(...valid.map((point) => point.latitude));
  const maxLat = Math.max(...valid.map((point) => point.latitude));
  const minLon = Math.min(...valid.map((point) => point.longitude));
  const maxLon = Math.max(...valid.map((point) => point.longitude));
  const latRange = Math.max(maxLat - minLat, 0.000001);
  const lonRange = Math.max(maxLon - minLon, 0.000001);
  return valid
    .map((point, index) => {
      const x = 8 + ((point.longitude - minLon) / lonRange) * 104;
      const y = 56 - ((point.latitude - minLat) / latRange) * 48;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}
