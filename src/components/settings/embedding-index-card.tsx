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

  return (
    <Card className="gap-3">
      <View className="gap-1">
        <Text variant="large">Search index coverage</Text>
        <Text variant="muted">
          Coverage shows which indexed chunks have vectors for each search model.
        </Text>
      </View>
      <View className="gap-3">
        {status.map((model) => (
          <View key={model.id} className="bg-muted/30 gap-2 rounded-lg px-3 py-3">
            <View className="flex-row items-start justify-between gap-3">
              <View className="min-w-0 flex-1">
                <Text numberOfLines={1}>{model.title}</Text>
                <Text variant="small" className="text-muted-foreground">
                  {model.active ? 'Active' : model.installed ? 'Installed' : 'Not installed'} ·{' '}
                  {Math.round(model.complete * 100)}%
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
