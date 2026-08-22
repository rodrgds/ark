import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Screen } from '@/components/layout/screen';
import { Text } from '@/components/ui/text';
import { Link, Stack } from 'expo-router';

export default function NotFoundScreen() {
  return (
    <Screen className="justify-center">
      <Stack.Screen options={{ title: 'Screen not found' }} />
      <Card className="gap-3">
        <Text variant="large">This screen does not exist.</Text>
        <Text variant="muted">The link may be outdated or the page was removed.</Text>
        <Link href="/(tabs)/chat" asChild>
          <Button>
            <Text>Go to chat</Text>
          </Button>
        </Link>
      </Card>
    </Screen>
  );
}
