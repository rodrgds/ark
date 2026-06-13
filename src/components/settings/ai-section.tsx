import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Icon } from '@/components/ui/icon';
import { Input } from '@/components/ui/input';
import { Text } from '@/components/ui/text';
import { ModelSection } from '@/components/settings/model-section';
import { EmbeddingIndexCard } from '@/components/settings/embedding-index-card';
import type { EmbeddingModelConfig } from '@/services/ai/embedding-models';
import type { ModelManagerService } from '@/services/ai/model-manager.service';
import type { ContentPack } from '@/types/content';
import { Bot, CheckCircle2, Search, Upload } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, View } from 'react-native';

type AiSectionProps = {
  modelStatus: Awaited<ReturnType<typeof ModelManagerService.getStatus>> | null;
  installedModels: ContentPack[];
  activeModel: ContentPack | null;
  activeEmbeddingModel: EmbeddingModelConfig | null;
  embeddingModels: EmbeddingModelConfig[];
  embeddingIndexStatus: Awaited<
    ReturnType<typeof ModelManagerService.getEmbeddingIndexStatus>
  > | null;
  chatModels: ContentPack[];
  busy: string | null;
  aiMessage: string | null;
  importLocalModel: () => Promise<void>;
  addModelUrl: (input: { title: string; url: string; checksum: string }) => Promise<void>;
  selectEmbeddingModel: (model: EmbeddingModelConfig) => Promise<void>;
  runModelAction: (model: ContentPack) => Promise<void>;
  removeModel: (model: ContentPack) => Promise<void>;
};

export function AiSection({
  modelStatus,
  installedModels,
  activeModel,
  activeEmbeddingModel,
  embeddingModels,
  embeddingIndexStatus,
  chatModels,
  busy,
  aiMessage,
  importLocalModel,
  addModelUrl,
  selectEmbeddingModel,
  runModelAction,
  removeModel,
}: AiSectionProps) {
  const [modelTitle, setModelTitle] = React.useState('');
  const [modelUrl, setModelUrl] = React.useState('');
  const [modelChecksum, setModelChecksum] = React.useState('');
  const importBusy = busy === 'model-import';
  const urlBusy = busy === 'model-url';

  async function handleAddModelUrl() {
    await addModelUrl({ title: modelTitle, url: modelUrl, checksum: modelChecksum });
    setModelTitle('');
    setModelUrl('');
    setModelChecksum('');
  }

  return (
    <>
      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="large">Local AI</Text>
          <Text>
            {modelStatus
              ? modelStatus.adapter === 'llama'
                ? 'Offline answers ready'
                : `${modelStatus.installedModels} answer model(s) installed`
              : 'Checking model status...'}
          </Text>
          {modelStatus ? <Text variant="muted">{modelStatus.message}</Text> : null}
        </View>
        <View className="bg-muted/40 gap-1 rounded-md px-3 py-3">
          <Text variant="small">Answer models installed: {installedModels.length}</Text>
          <Text variant="small">
            Source search: {activeEmbeddingModel?.title ?? 'ExecuTorch mobile embeddings'}
          </Text>
          <Text variant="muted">
            Current answer model:{' '}
            {activeModel
              ? activeModel.title
              : modelStatus?.chatModelDisabled
                ? 'Source search only'
                : 'None installed'}
          </Text>
          <Text variant="muted">
            Current source search model:{' '}
            {activeEmbeddingModel?.title ?? 'Built-in mobile embeddings'}
          </Text>
        </View>
      </Card>

      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="large">Add your own model</Text>
          <Text variant="muted">
            Import a GGUF answer model you already have, or save a custom download URL for later.
          </Text>
        </View>
        <Button variant="outline" disabled={importBusy} onPress={() => void importLocalModel()}>
          {importBusy ? <ActivityIndicator /> : <Icon as={Upload} className="size-4" />}
          <Text>Import GGUF file</Text>
        </Button>
        <View className="gap-2">
          <Input value={modelTitle} onChangeText={setModelTitle} placeholder="Model name" />
          <Input
            value={modelUrl}
            onChangeText={setModelUrl}
            placeholder="https://.../model.gguf"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Input
            value={modelChecksum}
            onChangeText={setModelChecksum}
            placeholder="Checksum (optional)"
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Button
            variant="outline"
            disabled={urlBusy || !modelUrl.trim()}
            onPress={() => void handleAddModelUrl()}>
            {urlBusy ? <ActivityIndicator /> : <Icon as={Bot} className="size-4" />}
            <Text>Add answer URL</Text>
          </Button>
        </View>
        <Text variant="small" className="text-muted-foreground">
          Source search uses built-in Ark ExecuTorch embeddings; custom GGUF imports are for Ask
          Arky answer-writing models.
        </Text>
      </Card>

      <ModelSection
        title="Answer models"
        description="These write Ask Arky responses after Ark searches local sources."
        models={chatModels}
        activeModelId={activeModel?.id ?? null}
        busy={busy}
        onPrimaryAction={runModelAction}
        onRemove={removeModel}
      />

      <Card className="gap-3">
        <View className="gap-1">
          <Text variant="large">Source search model</Text>
          <Text variant="muted">
            These ExecuTorch models retrieve local sources. Changing models downloads the selected
            model and rebuilds vectors as sources are indexed.
          </Text>
        </View>
        <View className="gap-2">
          {embeddingModels.map((model) => {
            const active = activeEmbeddingModel?.id === model.id;
            const modelBusy = busy === `embedding-${model.id}`;
            return (
              <Button
                key={model.id}
                className="h-auto min-h-14 justify-start py-3"
                variant={active ? 'default' : 'outline'}
                disabled={!!busy}
                onPress={() => void selectEmbeddingModel(model)}>
                {modelBusy ? <ActivityIndicator /> : <Icon as={Search} className="size-4" />}
                <View className="min-w-0 flex-1 items-start gap-1">
                  <Text>{model.title}</Text>
                  <Text
                    variant="small"
                    className={active ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                    {model.description} {model.dimension} dimensions.
                  </Text>
                </View>
                {active ? <Icon as={CheckCircle2} className="size-4" /> : null}
              </Button>
            );
          })}
        </View>
      </Card>

      <EmbeddingIndexCard status={embeddingIndexStatus} />

      {aiMessage ? <Text className="text-destructive">{aiMessage}</Text> : null}
    </>
  );
}
