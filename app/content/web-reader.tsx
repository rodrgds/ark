import { Arky } from '@/components/brand/ark-logo';
import { Button } from '@/components/ui/button';
import { Icon } from '@/components/ui/icon';
import { MarkdownText } from '@/components/ui/markdown-text';
import { Text } from '@/components/ui/text';
import { useArkTextToSpeech } from '@/hooks/use-ark-text-to-speech';
import { WebReaderService, type WebArticle } from '@/services/content/web-reader.service';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { ChevronLeft, ExternalLink, Share2, Volume2, VolumeX } from 'lucide-react-native';
import * as React from 'react';
import { ActivityIndicator, Linking, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Sharing from 'expo-sharing';

export default function WebReaderScreen() {
  const { url } = useLocalSearchParams<{ url: string }>();
  const insets = useSafeAreaInsets();
  const speechPlayback = useArkTextToSpeech();
  const [article, setArticle] = React.useState<WebArticle | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [speaking, setSpeaking] = React.useState(false);
  const speechPreparing = speaking && speechPlayback.isPreparing && !speechPlayback.isPlaying;

  async function load() {
    if (!url) return;
    setLoading(true);
    setError(null);
    try {
      const result = await WebReaderService.fetchAndParse(url);
      setArticle(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load article.');
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    void load();
  }, [url]);

  async function handleShare() {
    if (!url) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(url);
      }
    } catch {
      // Ignore share errors
    }
  }

  async function handleSpeak() {
    if (!article) return;
    if (speaking) {
      speechPlayback.stop();
      setSpeaking(false);
      return;
    }
    const text = [article.title, article.content]
      .filter(Boolean)
      .join('. ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 4000);

    setSpeaking(true);
    try {
      await speechPlayback.speak(text);
    } catch {
      // Ignore speech errors
    } finally {
      setSpeaking(false);
    }
  }

  if (loading) {
    return (
      <View className="bg-background flex-1 items-center justify-center p-6">
        <Stack.Screen options={{ title: 'Loading...' }} />
        <ActivityIndicator size="large" />
        <Text variant="muted" className="mt-4">
          Defuddling page...
        </Text>
      </View>
    );
  }

  if (error || !article) {
    return (
      <View className="bg-background flex-1 items-center justify-center gap-4 p-6">
        <Stack.Screen options={{ title: 'Error' }} />
        <Arky pose="thinking" size={120} />
        <Text variant="large" className="text-destructive text-center">
          {error || 'Page not found'}
        </Text>
        <Button variant="outline" onPress={() => void load()}>
          <Text>Retry</Text>
        </Button>
        <Button variant="ghost" onPress={() => void Linking.openURL(url!)}>
          <Icon as={ExternalLink} className="size-4" />
          <Text>Open in Browser</Text>
        </Button>
      </View>
    );
  }

  return (
    <View className="bg-background flex-1">
      <Stack.Screen
        options={{
          headerShown: true,
          title: article.siteName || 'Web Reader',
          headerLeft: () => (
            <Button variant="ghost" size="icon" onPress={() => router.back()}>
              <Icon as={ChevronLeft} className="text-foreground" />
            </Button>
          ),
          headerRight: () => (
            <View className="flex-row gap-1">
              <Button
                variant="ghost"
                size="icon"
                disabled={!article && !speaking}
                onPress={() => void handleSpeak()}>
                {speechPreparing ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Icon as={speaking ? VolumeX : Volume2} className="text-foreground" />
                )}
              </Button>
              <Button variant="ghost" size="icon" onPress={() => void handleShare()}>
                <Icon as={Share2} className="text-foreground" />
              </Button>
            </View>
          ),
        }}
      />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{
          padding: 20,
          paddingBottom: Math.max(40, insets.bottom + 20),
        }}>
        <View className="mb-6 gap-2">
          <Text variant="h1" className="text-foreground text-3xl font-extrabold tracking-tight">
            {article.title}
          </Text>
          {article.author || article.published ? (
            <Text variant="muted" className="text-sm">
              {[article.author, article.published].filter(Boolean).join(' • ')}
            </Text>
          ) : null}
        </View>

        <MarkdownText>{article.content}</MarkdownText>
      </ScrollView>
    </View>
  );
}
