import { PreferencesService } from '@/services/preferences/preferences.service';
import * as React from 'react';

export function useBatteryReduceMode() {
  const [reduceModeEnabled, setReduceModeEnabled] = React.useState(false);

  React.useEffect(() => {
    let mounted = true;

    PreferencesService.getBatteryReduceModeEnabled().then((enabled) => {
      if (mounted) setReduceModeEnabled(enabled);
    });

    return () => {
      mounted = false;
    };
  }, []);

  return reduceModeEnabled;
}
