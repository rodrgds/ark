import { Button } from '@/components/ui/button';
import { ArkBottomSheet } from '@/components/ui/bottom-sheet';
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
  const [addModelOpen, setAddModelOpen] = React.useState(false);
  const importBusy = busy === 'model-import';
  const urlBusy = busy === 'model-url';
  const activeEmbeddingLabel = activeEmbeddingModel
    ? sourceSearchLabel(activeEmbeddingModel)
    : 'Built-in source search';

  async function handleAddModelUrl() {
    await addModelUrl({ title: modelTitle, url: modelUrl, checksum: modelChecksum });
    setModelTitle('');
    setModelUrl('');
    setModelChecksum('');
    setAddModelOpen(false);
  }

  return (
    <>
      <Card className="gap-3">
        <View className="flex-row items-start justify-between gap-3">
          <View className="min-w-0 flex-1 gap-1">
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
          <Button size="sm" variant="outline" onPress={() => setAddModelOpen(true)}>
            <Icon as={Upload} className="size-4" />
            <Text>Add</Text>
          </Button>
        </View>

        <View className="border-border overflow-hidden rounded-md border">
          <StatusRow
            label="Answer model"
            value={
              activeModel
                ? activeModel.title
                : modelStatus?.chatModelDisabled
                  ? 'Source search only'
                  : 'None installed'
            }
          />
          <StatusRow label="Source search" value={activeEmbeddingLabel} />
          <StatusRow label="Installed" value={`${installedModels.length} answer model(s)`} />
        </View>
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
            Choose how Ark matches your notes, guides, maps, and documents before answering.
            Switching can take a few minutes while Ark rebuilds the local index.
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
                  <Text>{sourceSearchLabel(model)}</Text>
                  <Text
                    variant="small"
                    className={active ? 'text-primary-foreground/80' : 'text-muted-foreground'}>
                    {sourceSearchDescription(model)}
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

      <ArkBottomSheet
        visible={addModelOpen}
        title="Add answer model"
        description="Import a GGUF answer model you already have, or save a download URL."
        onDismiss={() => setAddModelOpen(false)}
        scrollable
        maxDynamicContentSize={560}>
        <View className="gap-3">
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
            Source search is built in. Custom files only change answer writing.
          </Text>
        </View>
      </ArkBottomSheet>
    </>
  );
}

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="border-border flex-row items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0">
      <Text variant="small" className="text-muted-foreground">
        {label}
      </Text>
      <Text variant="small" className="min-w-0 flex-1 text-right" numberOfLines={2}>
        {value}
      </Text>
    </View>
  );
}

function sourceSearchLabel(model: EmbeddingModelConfig) {
  if (model.id.includes('mpnet')) return 'Thorough search';
  if (model.id.includes('minilm')) return 'Fast search';
  return model.title;
}

function sourceSearchDescription(model: EmbeddingModelConfig) {
  if (model.id.includes('mpnet')) {
    return 'Better matching on newer phones, with slower indexing and more memory use.';
  }
  if (model.id.includes('minilm')) {
    return 'Balanced default for phones. Faster indexing and lower memory use.';
  }
  return model.description;
}
