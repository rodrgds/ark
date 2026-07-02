import { Card } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Text } from '@/components/ui/text';
import type { ModelManagerService } from '@/services/ai/model-manager.service';
import { View } from 'react-native';

export function EmbeddingIndexCard({
  status,
}: {
  status: Awaited<ReturnType<typeof ModelManagerService.getEmbeddingIndexStatus>> | null;
}) {
  if (!status) return null;
  const activeModel = status.find((model) => model.active) ?? status[0] ?? null;

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">Search index coverage</Text>
        {activeModel ? (
          <Text variant="muted">
            {activeModel.complete >= 1
              ? `${activeModel.title} is ready for local source search.`
              : `${activeModel.title} is rebuilding: ${Math.round(
                  activeModel.complete * 100
                )}% ready.`}
          </Text>
        ) : null}
      </View>
      <View className="gap-3">
        {status.map((model) => (
          <View key={model.id} className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1}>{model.title}</Text>
                <Text variant="small" className="text-muted-foreground">
                  {indexStatusLabel(model)} · {Math.round(model.complete * 100)}%
                </Text>
              </View>
              <Text variant="small" className="text-muted-foreground">
                {model.embedded}/{model.total}
              </Text>
            </View>
            <Progress value={model.complete} />
            <View className="flex-row flex-wrap gap-2">
              {model.domains.map((domain) => (
                <Text key={domain.domain} variant="small" className="text-muted-foreground">
                  {domain.domain}: {domain.embedded}/{domain.total}
                </Text>
              ))}
            </View>
          </View>
        ))}
      </View>
    </Card>
  );
}

function indexStatusLabel(model: {
  active: boolean;
  installed: boolean;
  total: number;
  complete: number;
}) {
  if (model.total === 0) return model.active ? 'Active' : 'No sources';
  if (model.complete < 1) return model.active ? 'Rebuilding' : 'Partial';
  if (model.active) return 'Active';
  return model.installed ? 'Ready' : 'Indexed';
}
