import { Icon } from '@/components/ui/icon';
import { getMapPinMeta, type MapPinType } from '@/constants/map-pins';
import { hexToRgba } from '@/lib/colors';
import { useSensorStore } from '@/stores/sensor-store';
import { useThemeStore } from '@/stores/theme-store';
import type { MapMarker } from '@/types/maps';
import { Home, MapPin, Users } from 'lucide-react-native';
import * as React from 'react';
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

export const MapPinMarker = React.memo(function MapPinMarker({
  marker,
  selected,
}: {
  marker: MapMarker;
  selected: boolean;
}) {
  const colors = useThemeStore((state) => state.colors);
  const color = marker.color || colors.primary || getMapPinMeta(marker.pinType).color;
  const PinIcon = iconForPinType(marker.pinType);
  return (
    <View
      style={{
        width: selected || marker.isEmergencyPin ? 26 : 20,
        height: selected || marker.isEmergencyPin ? 26 : 20,
        borderRadius: 999,
        backgroundColor: colors.background,
        borderColor: marker.isEmergencyPin ? colors.foreground : color,
        borderWidth: marker.isEmergencyPin ? 3 : selected ? 3 : 2,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <View
        className="items-center justify-center rounded-full"
        style={{
          width: selected || marker.isEmergencyPin ? 15 : 12,
          height: selected || marker.isEmergencyPin ? 15 : 12,
          backgroundColor: color,
        }}>
        <Icon as={PinIcon} className="text-background size-3.5" />
      </View>
    </View>
  );
});

export function UserLocationDot({ mapBearing }: { mapBearing: number }) {
  const heading = useSensorStore((state) => state.heading);
  const colors = useThemeStore((state) => state.colors);

  return (
    <View className="items-center justify-center">
      {heading !== null ? (
        <View
          className="absolute"
          style={{ transform: [{ rotate: `${heading - mapBearing}deg` }] }}>
          <Svg width={104} height={104} viewBox="0 0 104 104">
            <Path d="M52 52 L82 8 Q52 -6 22 8 Z" fill={hexToRgba(colors.primary, 0.45)} />
          </Svg>
        </View>
      ) : null}
      <View className="bg-primary/20 size-9 items-center justify-center rounded-full">
        <View className="border-background bg-primary size-5 rounded-full border-4" />
      </View>
    </View>
  );
}

export function iconForPinType(type: MapPinType) {
  if (type === 'home') return Home;
  if (type === 'meeting_point') return Users;
  return MapPin;
}
