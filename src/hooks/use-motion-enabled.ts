import { PreferencesService } from '@/services/preferences/preferences.service';
import * as React from 'react';

export function useMotionEnabled() {
  const [motionEnabled, setMotionEnabled] = React.useState(true);

  React.useEffect(() => {
    let mounted = true;

    PreferencesService.getMotionEnabled().then((enabled) => {
      if (mounted) setMotionEnabled(enabled);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return motionEnabled;
}
