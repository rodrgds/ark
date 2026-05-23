import { Screen } from '@/components/layout/screen';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { READINESS_CHECKLIST } from '@/constants/checklists';
import {
  PreferencesService,
  type ReadinessChecklistState,
} from '@/services/preferences/preferences.service';
import { Check, Circle } from 'lucide-react-native';
import * as React from 'react';
import { Pressable, View } from 'react-native';

export default function ChecklistTool() {
  const [checked, setChecked] = React.useState<ReadinessChecklistState>({});

  React.useEffect(() => {
    PreferencesService.getReadinessChecklist().then(setChecked);
  }, []);

  const completed = READINESS_CHECKLIST.filter((item) => checked[item.id]).length;
  const progress = completed / READINESS_CHECKLIST.length;

  async function toggle(id: string) {
    const next = { ...checked, [id]: !checked[id] };
    setChecked(next);
    await PreferencesService.setReadinessChecklist(next);
  }

  async function reset() {
    setChecked({});
    await PreferencesService.setReadinessChecklist({});
  }

  return (
    <Screen>
      <Card className="gap-3">
        <Text variant="large">Readiness Checklist</Text>
        <Text variant="muted">
          A compact offline checklist for leaving service. It is intentionally practical and local,
          not a wall of advice.
        </Text>
        <View className="bg-muted h-2 overflow-hidden rounded-full">
          <View
            className="bg-primary h-full rounded-full"
            style={{ width: `${progress * 100}%` }}
          />
        </View>
        <Text variant="muted">
          {completed} of {READINESS_CHECKLIST.length} ready
        </Text>
      </Card>

      {READINESS_CHECKLIST.map((item) => {
        const isChecked = !!checked[item.id];
        const Icon = isChecked ? Check : Circle;
        return (
          <Pressable key={item.id} onPress={() => toggle(item.id)}>
            <Card className="flex-row items-start gap-3">
              <View className="border-border bg-background mt-0.5 h-8 w-8 items-center justify-center rounded-full border">
                <Icon size={18} color={isChecked ? '#D6A84F' : '#8FAF8A'} />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Text variant="large">{item.title}</Text>
                <Text variant="muted">{item.detail}</Text>
                <Text className="text-primary text-xs uppercase">{item.group}</Text>
              </View>
            </Card>
          </Pressable>
        );
      })}

      <Button variant="outline" onPress={reset}>
        <Text>Reset Checklist</Text>
      </Button>
    </Screen>
  );
}
