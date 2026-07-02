import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import {
  RATE_MODE_OPTIONS,
  RECORDING_PROFILE_OPTIONS,
  TRACK_ACTIVITIES,
  UNIT_OPTIONS,
} from '@/constants/tracks';
import type { FieldPreferences } from '@/services/preferences/preferences.service';
import { getDeviceDefaultFieldPreferences } from '@/services/preferences/field-preferences-defaults';
import { Compass, Gauge, MapPinned, Route } from 'lucide-react-native';
import { View } from 'react-native';

type FieldSectionProps = {
  preferences: FieldPreferences | null;
  onChange: (patch: Partial<FieldPreferences>) => void | Promise<void>;
};

export function FieldSection({ preferences, onChange }: FieldSectionProps) {
  const defaultPreferences = getDeviceDefaultFieldPreferences();
  const current = preferences ?? defaultPreferences;
  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
            <Icon as={MapPinned} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Units</Text>
            <Text variant="muted">
              Applies to tracks, map distances, saved routes, and navigation readouts.
            </Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {UNIT_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              selected={current?.unitSystem === option.value}
              label={option.label}
              description={option.description}
              onPress={() => onChange({ unitSystem: option.value })}
            />
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
            <Icon as={Gauge} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Speed display</Text>
            <Text variant="muted">Choose whether field movement reads as speed or pace.</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {RATE_MODE_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              selected={current?.rateMode === option.value}
              label={option.label}
              description={option.description}
              onPress={() => onChange({ rateMode: option.value })}
            />
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
            <Icon as={Route} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Default activity</Text>
            <Text variant="muted">Used when the Tracks tab opens with no active recording.</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {TRACK_ACTIVITIES.map((activity) => (
            <OptionButton
              key={activity.id}
              selected={current?.defaultTrackActivity === activity.id}
              label={activity.label}
              description={activity.description}
              onPress={() => onChange({ defaultTrackActivity: activity.id })}
            />
          ))}
        </View>
      </Card>

      <Card className="gap-3">
        <View className="flex-row items-center gap-3">
          <View className="bg-primary/15 size-11 items-center justify-center rounded-md">
            <Icon as={Compass} className="text-primary size-5" />
          </View>
          <View className="min-w-0 flex-1 gap-1">
            <Text variant="large">Recording profile</Text>
            <Text variant="muted">Controls GPS write frequency and background batching.</Text>
          </View>
        </View>
        <View className="flex-row flex-wrap gap-2">
          {RECORDING_PROFILE_OPTIONS.map((option) => (
            <OptionButton
              key={option.value}
              selected={current?.recordingProfile === option.value}
              label={option.label}
              description={option.description}
              onPress={() => onChange({ recordingProfile: option.value })}
            />
          ))}
        </View>
      </Card>
    </>
  );
}

function OptionButton({
  selected,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  label: string;
  description: string;
  onPress: () => void | Promise<void>;
}) {
  return (
    <Button
      className="h-auto min-w-32 flex-1 items-start justify-start py-3"
      variant={selected ? 'default' : 'outline'}
      onPress={() => void onPress()}>
      <View className="min-w-0 flex-1 gap-1">
        <Text>{label}</Text>
        <Text
          variant="small"
          className={selected ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
          {description}
        </Text>
      </View>
    </Button>
  );
}
