import { useBatteryReduceMode } from '@/hooks/use-battery-reduce-mode';

export function useMotionEnabled() {
  return !useBatteryReduceMode();
}
