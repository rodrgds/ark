import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { getMapPinMeta } from '@/constants/map-pins';
import { formatPoint } from '@/lib/geo';
import { formatDistance } from '@/services/tracks/track-format';
import { useThemeStore } from '@/stores/theme-store';
import type { MapMarker, SavedRoute } from '@/types/maps';
import type { UnitSystem } from '@/types/tracks';
import { Pencil, Route, Star, Trash2, X } from 'lucide-react-native';
import * as React from 'react';
import { Image, Pressable, View } from 'react-native';
import { iconForPinType } from './map-pin';

export function SavedDataPanel({
  markers,
  routes,
  search,
  visible,
  onChangeSearch,
  onClose,
  onDeleteMarker,
  onDeleteRoute,
  onEditMarker,
  onFocusMarker,
  onFocusRoute,
  unitSystem = 'metric',
}: {
  markers: MapMarker[];
  routes: SavedRoute[];
  unitSystem?: UnitSystem;
  search: string;
  visible: boolean;
  onChangeSearch: (value: string) => void;
  onClose: () => void;
  onDeleteMarker: (marker: MapMarker) => void;
  onDeleteRoute: (route: SavedRoute) => void;
  onEditMarker: (marker: MapMarker) => void;
  onFocusMarker: (marker: MapMarker) => void;
  onFocusRoute: (route: SavedRoute) => void;
}) {
  const colors = useThemeStore((state) => state.colors);
  return (
    <MapBottomSheetPanel title="Saved spots and routes" visible={visible} onClose={onClose}>
      {({ expand }) => (
        <>
          <Input
            value={search}
            onChangeText={onChangeSearch}
            placeholder="Filter saved spots"
            autoCapitalize="none"
            onFocus={expand}
          />

          <View className="gap-2">
            <Text variant="large">Spots</Text>
            {markers.length ? (
              markers.map((marker) => (
                <SavedRow
                  key={marker.id}
                  color={marker.color || colors.primary || getMapPinMeta(marker.pinType).color}
                  emergency={marker.isEmergencyPin}
                  icon={iconForPinType(marker.pinType)}
                  photoUri={marker.photoUri}
                  title={marker.title}
                  subtitle={`${getMapPinMeta(marker.pinType).label}${
                    marker.isEmergencyPin ? ' · Emergency' : ''
                  } · ${marker.description ?? formatPoint(marker.latitude, marker.longitude)}`}
                  onPress={() => onFocusMarker(marker)}
                  onEdit={() => onEditMarker(marker)}
                  onDelete={() => onDeleteMarker(marker)}
                />
              ))
            ) : (
              <Text variant="muted">No saved spots match this filter.</Text>
            )}
          </View>

          <View className="gap-2">
            <Text variant="large">Routes</Text>
            {routes.length ? (
              routes.map((route) => (
                <SavedRouteRow
                  key={route.id}
                  route={route}
                  unitSystem={unitSystem}
                  onDelete={() => onDeleteRoute(route)}
                  onPress={() => onFocusRoute(route)}
                />
              ))
            ) : (
              <Text variant="muted">No saved routes match this filter.</Text>
            )}
          </View>
        </>
      )}
    </MapBottomSheetPanel>
  );
}

function MapBottomSheetPanel({
  children,
  title,
  visible,
  onClose,
}: {
  children: React.ReactNode | ((controls: { expand: () => void }) => React.ReactNode);
  title: string;
  visible: boolean;
  onClose: () => void;
}) {
  const sheetRef = React.useRef<any>(null);
  const expandPanel = React.useCallback(() => {
    sheetRef.current?.expand?.();
  }, []);
  const renderedChildren =
    typeof children === 'function' ? children({ expand: expandPanel }) : children;

  return (
    <ArkBottomSheet
      visible={visible}
      onDismiss={onClose}
      scrollable
      sheetRef={sheetRef}
      snapPoints={['58%', '92%']}>
      <View className="flex-row items-center justify-between gap-3">
        <Text variant="h3" className="min-w-0 flex-1">
          {title}
        </Text>
        <Button size="icon" variant="outline" onPress={onClose}>
          <Icon as={X} className="size-4" />
        </Button>
      </View>
      {renderedChildren}
    </ArkBottomSheet>
  );
}

function SavedRouteRow({
  route,
  unitSystem,
  onDelete,
  onPress,
}: {
  route: SavedRoute;
  unitSystem: UnitSystem;
  onDelete: () => void;
  onPress: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Pressable className="min-w-0 flex-1 flex-row items-center gap-3" onPress={onPress}>
        <View className="bg-primary/15 size-10 items-center justify-center rounded-md">
          <Icon as={Route} className="text-primary size-5" />
        </View>
        <View className="min-w-0 flex-1">
          <Text className="min-w-0" numberOfLines={1}>
            {route.title}
          </Text>
          <Text variant="muted" numberOfLines={1}>
            {route.points.length} points
            {route.distanceMeters ? ` · ${formatDistance(route.distanceMeters, unitSystem)}` : ''}
          </Text>
        </View>
      </Pressable>
      <Button
        accessibilityLabel={`Delete ${route.title}`}
        size="icon"
        variant="outline"
        onPress={onDelete}>
        <Icon as={Trash2} className="size-4" />
      </Button>
    </Card>
  );
}

function SavedRow({
  color = '#A9C3A0',
  emergency,
  icon,
  photoUri,
  title,
  subtitle,
  onDelete,
  onEdit,
  onPress,
}: {
  color?: string;
  emergency?: boolean;
  icon: React.ComponentProps<typeof Icon>['as'];
  photoUri?: string | null;
  title: string;
  subtitle: string;
  onDelete: () => void;
  onEdit: () => void;
  onPress: () => void;
}) {
  return (
    <Card className="flex-row items-center gap-3 p-3">
      <Pressable className="min-w-0 flex-1 flex-row items-center gap-3" onPress={onPress}>
        {photoUri ? (
          <Image source={{ uri: photoUri }} className="bg-muted size-10 rounded-md" />
        ) : (
          <View
            className="size-10 items-center justify-center rounded-md"
            style={{ backgroundColor: `${color}26` }}>
            <Icon as={icon} className="text-primary size-5" />
          </View>
        )}
        <View className="min-w-0 flex-1">
          <View className="flex-row items-center gap-1">
            <Text className="min-w-0 flex-1" numberOfLines={1}>
              {title}
            </Text>
            {emergency ? <Icon as={Star} className="text-primary size-3.5" /> : null}
          </View>
          <Text variant="muted" numberOfLines={1}>
            {subtitle}
          </Text>
        </View>
      </Pressable>
      <Button accessibilityLabel={`Edit ${title}`} size="icon" variant="outline" onPress={onEdit}>
        <Icon as={Pencil} className="size-4" />
      </Button>
      <Button
        accessibilityLabel={`Delete ${title}`}
        size="icon"
        variant="outline"
        onPress={onDelete}>
        <Icon as={Trash2} className="size-4" />
      </Button>
    </Card>
  );
}
