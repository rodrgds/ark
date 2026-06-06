import { Card } from '@/components/ui/card';
import { Text } from '@/components/ui/text';
import { Pressable } from 'react-native';

type AboutSectionProps = {
  version: string;
  onBuildTap: () => void;
};

export function AboutSection({ version, onBuildTap }: AboutSectionProps) {
  return (
    <Pressable onPress={onBuildTap}>
      <Card className="gap-2">
        <Text variant="large">Build</Text>
        <Text variant="muted">Version {version}</Text>
        <Text variant="small" className="text-muted-foreground">
          Tap build number five times for test utilities.
        </Text>
      </Card>
    </Pressable>
  );
}
