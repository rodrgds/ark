import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import { getPackIcon, getPackModelRoleLabel } from '@/constants/pack-presentation';
import type { ContentPack } from '@/types/content';
import { Download, Trash2 } from 'lucide-react-native';
import { ActivityIndicator, View } from 'react-native';

type ModelSectionProps = {
  title: string;
  description: string;
  models: ContentPack[];
  activeModelId: string | null;
  busy: string | null;
  onPrimaryAction: (model: ContentPack) => Promise<void>;
  onRemove: (model: ContentPack) => Promise<void>;
};

function primaryLabel(model: ContentPack, isActive: boolean) {
  if (model.installStatus === 'downloading' || model.installStatus === 'queued') {
    return `Cancel ${Math.round((model.progress ?? 0) * 100)}%`;
  }
  if (model.installStatus === 'verifying') return 'Verifying';
  if (model.installStatus === 'paused') return 'Resume';
  if (model.installed && model.modelRole === 'chat') return isActive ? 'In use' : 'Use for chat';
  if (model.installed && model.modelRole === 'embedding') {
    return isActive ? 'In use' : 'Use for search';
  }
  if (model.installed && model.modelRole === 'voice') return isActive ? 'In use' : 'Use for voice';
  if (model.installed) return 'Installed';
  return 'Download';
}

function isModelDownloadVisible(model: ContentPack) {
  return ['queued', 'downloading', 'verifying', 'paused'].includes(model.installStatus);
}

export function ModelSection({
  title,
  description,
  models,
  activeModelId,
  busy,
  onPrimaryAction,
  onRemove,
}: ModelSectionProps) {
  if (!models.length) return null;

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">{title}</Text>
        <Text variant="muted">{description}</Text>
      </View>
      <View className="gap-3">
        {models.map((model) => {
          const roleLabel = getPackModelRoleLabel(model);
          const isActive = activeModelId === model.id;
          const primaryBusy = busy === model.id;
          const removeBusy = busy === `remove-${model.id}`;
          return (
            <View key={model.id} className="bg-muted/30 gap-3 rounded-lg px-3 py-3">
              <View className="flex-row gap-3">
                <View className="bg-primary/12 size-11 items-center justify-center rounded-xl">
                  <Icon as={getPackIcon(model)} className="text-primary size-5" />
                </View>
                <View className="min-w-0 flex-1 gap-1">
                  <View className="flex-row items-start justify-between gap-3">
                    <Text variant="large" className="min-w-0 flex-1">
                      {model.title}
                    </Text>
                    <Text variant="small" className="text-muted-foreground">
                      {model.estimatedSize}
                    </Text>
                  </View>
                  {roleLabel ? (
                    <Text className="text-primary text-xs font-medium">{roleLabel}</Text>
                  ) : null}
                  <Text variant="muted">{model.description}</Text>
                  {model.sourceLabel ? (
                    <Text variant="small" className="text-muted-foreground">
                      {model.sourceLabel}
                    </Text>
                  ) : null}
                  {isModelDownloadVisible(model) ? (
                    <View className="gap-1 pt-1">
                      <Progress value={model.progress ?? 0} />
                      <Text variant="small" className="text-muted-foreground">
                        {model.installStatus === 'verifying'
                          ? 'Verifying download'
                          : `${Math.round((model.progress ?? 0) * 100)}% downloaded`}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              <View className="flex-row gap-2">
                <Button
                  className="flex-1"
                  variant={model.installed && isActive ? 'default' : 'outline'}
                  disabled={primaryBusy}
                  onPress={() => void onPrimaryAction(model)}>
                  {primaryBusy ? <ActivityIndicator /> : <Icon as={Download} className="size-4" />}
                  <Text>{primaryLabel(model, isActive)}</Text>
                </Button>
                {(model.installed ||
                  model.installStatus === 'downloading' ||
                  model.installStatus === 'queued' ||
                  model.installStatus === 'verifying' ||
                  model.installStatus === 'paused') && (
                  <Button
                    accessibilityLabel={`Remove ${model.title}`}
                    size="icon"
                    variant="outline"
                    disabled={removeBusy}
                    onPress={() => void onRemove(model)}>
                    {removeBusy ? <ActivityIndicator /> : <Icon as={Trash2} className="size-4" />}
                  </Button>
                )}
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}
