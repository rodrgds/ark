import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Text } from '@/components/ui/text';
import { ARK_TABS, type ArkTabDefinition, type ArkTabId } from '@/constants/tabs';
import {
  TabPreferencesService,
  type TabPreferences,
} from '@/services/preferences/tab-preferences.service';
import { GripVertical, LockKeyhole } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { router } from 'expo-router';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

const ROW_HEIGHT = 66;
const defaultPreferences: TabPreferences = {
  order: ARK_TABS.map((tab) => tab.id),
  enabled: ARK_TABS.map((tab) => tab.id),
};

const tabById = new Map(ARK_TABS.map((tab) => [tab.id, tab]));

export function TabPreferencesCard() {
  const [dbPreferences, setDbPreferences] = React.useState<TabPreferences | null>(null);
  const [preferences, setPreferences] = React.useState<TabPreferences>(defaultPreferences);
  const [loading, setLoading] = React.useState(true);
  const [applying, setApplying] = React.useState(false);
  const enabled = React.useMemo(() => new Set(preferences.enabled), [preferences.enabled]);
  const orderedTabs = preferences.order
    .map((tabId) => tabById.get(tabId))
    .filter((tab): tab is ArkTabDefinition => !!tab);

  const load = React.useCallback(() => {
    void TabPreferencesService.getPreferences()
      .then((prefs) => {
        setDbPreferences(prefs);
        setPreferences(prefs);
      })
      .finally(() => setLoading(false));
  }, []);

  React.useEffect(() => {
    load();
    return TabPreferencesService.subscribe(load);
  }, [load]);

  function toggleTab(tabId: ArkTabId) {
    if (TabPreferencesService.isLocked(tabId)) return;
    const isEnabling = !enabled.has(tabId);
    if (Platform.OS === 'ios' && isEnabling && enabled.size >= 5) return;

    const nextEnabled = new Set(preferences.enabled);
    if (nextEnabled.has(tabId)) {
      nextEnabled.delete(tabId);
    } else {
      nextEnabled.add(tabId);
    }
    setPreferences((current) => ({ ...current, enabled: Array.from(nextEnabled) }));
  }

  function moveTab(tabId: ArkTabId, targetIndex: number) {
    setPreferences((current) => {
      const index = current.order.indexOf(tabId);
      if (
        index < 0 ||
        targetIndex < 0 ||
        targetIndex >= current.order.length ||
        index === targetIndex
      ) {
        return current;
      }

      const nextOrder = [...current.order];
      nextOrder.splice(index, 1);
      nextOrder.splice(targetIndex, 0, tabId);
      return { ...current, order: nextOrder };
    });
  }

  const hasChanges = React.useMemo(() => {
    if (!dbPreferences) return false;
    const orderChanged = JSON.stringify(preferences.order) !== JSON.stringify(dbPreferences.order);
    const enabledChanged =
      JSON.stringify([...preferences.enabled].sort()) !==
      JSON.stringify([...dbPreferences.enabled].sort());
    return orderChanged || enabledChanged;
  }, [preferences, dbPreferences]);

  async function applyChanges() {
    setApplying(true);
    router.replace('/(tabs)/chat');
    // Wait for the transition to complete to prevent RNScreens crash during route remounts
    await new Promise((resolve) => setTimeout(resolve, 300));
    try {
      const saved = await TabPreferencesService.savePreferences(preferences);
      setDbPreferences(saved);
      setPreferences(saved);
    } catch {
      // ignore
    } finally {
      setApplying(false);
    }
  }

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">Tabs</Text>
        <Text variant="muted">Choose which sections appear in the native tab bar.</Text>
      </View>

      {loading ? (
        <View className="h-20 items-center justify-center">
          <ActivityIndicator />
        </View>
      ) : (
        <View className="gap-2">
          {orderedTabs.map((tab, index) => (
            <TabPreferenceRow
              key={tab.id}
              count={orderedTabs.length}
              enabled={enabled.has(tab.id)}
              index={index}
              locked={TabPreferencesService.isLocked(tab.id)}
              moving={false}
              tab={tab}
              working={false}
              toggleDisabled={Platform.OS === 'ios' && !enabled.has(tab.id) && enabled.size >= 5}
              onMoveToIndex={moveTab}
              onToggle={toggleTab}
            />
          ))}
          {hasChanges ? (
            <Button
              className="mt-2 flex-row items-center justify-center gap-2"
              disabled={applying}
              onPress={applyChanges}>
              {applying ? <ActivityIndicator size="small" color="#fff" /> : null}
              <Text>{applying ? 'Applying...' : 'Apply Changes'}</Text>
            </Button>
          ) : null}
        </View>
      )}
    </Card>
  );
}

function TabPreferenceRow({
  tab,
  index,
  count,
  enabled,
  locked,
  moving,
  working,
  toggleDisabled,
  onMoveToIndex,
  onToggle,
}: {
  tab: ArkTabDefinition;
  index: number;
  count: number;
  enabled: boolean;
  locked: boolean;
  moving: boolean;
  working: boolean;
  toggleDisabled?: boolean;
  onMoveToIndex: (tabId: ArkTabId, targetIndex: number) => void;
  onToggle: (tabId: ArkTabId) => void;
}) {
  const translateY = useSharedValue(0);
  const dragging = useSharedValue(0);

  const pan = React.useMemo(
    () =>
      Gesture.Pan()
        .onBegin(() => {
          dragging.value = 1;
        })
        .onUpdate((event) => {
          translateY.value = event.translationY;
        })
        .onFinalize((event) => {
          const offset = Math.round(event.translationY / ROW_HEIGHT);
          const targetIndex = Math.max(0, Math.min(count - 1, index + offset));
          translateY.value = withTiming(0, {
            duration: 140,
            easing: Easing.out(Easing.cubic),
          });
          dragging.value = 0;
          if (targetIndex !== index) {
            scheduleOnRN(onMoveToIndex, tab.id, targetIndex);
          }
        }),
    [count, dragging, index, onMoveToIndex, tab.id, translateY]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    elevation: dragging.value ? 8 : 0,
    opacity: moving ? 0.55 : 1,
    transform: [{ translateY: translateY.value }],
    zIndex: dragging.value ? 20 : 0,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View
        className="border-border bg-background flex-row items-center gap-2 rounded-md border px-2 py-2"
        style={{ minHeight: ROW_HEIGHT }}>
        <GestureDetector gesture={pan}>
          <View
            accessibilityLabel={`Drag ${tab.label} to reorder`}
            accessibilityRole="adjustable"
            className="h-10 w-10 items-center justify-center rounded-md">
            <Icon as={GripVertical} className="text-muted-foreground size-5" />
          </View>
        </GestureDetector>
        <View className="min-w-0 flex-1 gap-0.5">
          <View className="flex-row items-center gap-2">
            <Text numberOfLines={1} className={enabled ? undefined : 'text-muted-foreground'}>
              {tab.label}
            </Text>
            {locked ? <Icon as={LockKeyhole} className="text-muted-foreground size-3.5" /> : null}
          </View>
          <Text variant="small" className="text-muted-foreground" numberOfLines={2}>
            {tab.description}
          </Text>
        </View>
        <Button
          accessibilityLabel={`Turn ${tab.label} tab ${enabled ? 'off' : 'on'}`}
          accessibilityState={{ disabled: locked || working || toggleDisabled }}
          size="sm"
          variant={enabled ? 'default' : 'outline'}
          disabled={locked || working || toggleDisabled}
          onPress={() => onToggle(tab.id)}>
          {working ? <ActivityIndicator size="small" /> : null}
          <Text>{enabled ? 'On' : 'Off'}</Text>
        </Button>
      </View>
    </Animated.View>
  );
}
