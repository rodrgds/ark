import { Text } from '@/components/ui/text';
import { APP_NAME, APP_SLOGAN } from '@/constants/app';
import { cn } from '@/lib/utils';
import Svg, { Circle, Line, Path, Polyline } from 'react-native-svg';
import { View } from 'react-native';

export function ArkMark({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <View
      className={cn(
        'border-primary/35 bg-primary/10 items-center justify-center rounded-lg border',
        className
      )}
      style={{ width: size, height: size }}>
      <Svg width={size * 0.7} height={size * 0.7} viewBox="0 0 64 64" fill="none">
        <Circle cx="32" cy="32" r="25" stroke="#D6A84F" strokeWidth="3" />
        <Path d="M14 38L27 18L38 18L50 38" stroke="#D6A84F" strokeWidth="3" strokeLinecap="round" />
        <Polyline
          points="18,38 28,48 46,24"
          stroke="#F5E6C8"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Line
          x1="25"
          y1="36"
          x2="46"
          y2="36"
          stroke="#8FAF8A"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </Svg>
    </View>
  );
}

export function ArkBrandLockup({
  subtitle = APP_SLOGAN,
  compact = false,
}: {
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3">
      <ArkMark size={compact ? 38 : 48} />
      <View className="min-w-0 flex-1">
        <Text variant={compact ? 'large' : 'h1'} className={compact ? undefined : 'text-left'}>
          {APP_NAME}
        </Text>
        {subtitle ? <Text variant="muted">{subtitle}</Text> : null}
      </View>
    </View>
  );
}

export function Arky({ size = 88, compact = false }: { size?: number; compact?: boolean }) {
  return (
    <View
      className={cn(
        'border-primary/30 bg-primary/10 items-center justify-center rounded-xl border',
        compact ? 'self-start' : 'self-center'
      )}
      style={{ width: size, height: size, borderCurve: 'continuous' }}>
      <Svg width={size * 0.74} height={size * 0.74} viewBox="0 0 96 96" fill="none">
        <Path
          d="M17 54C23 35 34 22 47 20C61 18 73 32 79 54"
          stroke="#D6A84F"
          strokeWidth="5"
          strokeLinecap="round"
        />
        <Path
          d="M22 55H74C73 67 64 77 48 77C32 77 23 67 22 55Z"
          fill="#18211B"
          stroke="#F5E6C8"
          strokeWidth="4"
          strokeLinejoin="round"
        />
        <Path
          d="M32 57C35 61 39 63 44 63H52C57 63 61 61 64 57"
          stroke="#8FAF8A"
          strokeWidth="4"
          strokeLinecap="round"
        />
        <Circle cx="38" cy="45" r="3.5" fill="#F5E6C8" />
        <Circle cx="58" cy="45" r="3.5" fill="#F5E6C8" />
        <Path d="M42 51C45 53 51 53 54 51" stroke="#F5E6C8" strokeWidth="3" strokeLinecap="round" />
        <Path d="M29 34L20 27" stroke="#8FAF8A" strokeWidth="4" strokeLinecap="round" />
        <Path d="M67 34L76 27" stroke="#8FAF8A" strokeWidth="4" strokeLinecap="round" />
      </Svg>
    </View>
  );
}
