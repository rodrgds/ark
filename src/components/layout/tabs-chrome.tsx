import * as React from 'react';

type TabsChromeContextValue = {
  chromeHidden: boolean;
  setChromeHidden: (hidden: boolean) => void;
};

const TabsChromeContext = React.createContext<TabsChromeContextValue | null>(null);
const listeners = new Set<() => void>();
let globalChromeHidden = false;

function setGlobalChromeHidden(hidden: boolean) {
  if (globalChromeHidden === hidden) return;
  globalChromeHidden = hidden;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function TabsChromeProvider({ children }: React.PropsWithChildren) {
  const chromeHidden = React.useSyncExternalStore(
    subscribe,
    () => globalChromeHidden,
    () => false
  );
  const value = React.useMemo(
    () => ({ chromeHidden, setChromeHidden: setGlobalChromeHidden }),
    [chromeHidden]
  );

  return <TabsChromeContext.Provider value={value}>{children}</TabsChromeContext.Provider>;
}

export function useTabsChrome() {
  const context = React.useContext(TabsChromeContext);
  const chromeHidden = React.useSyncExternalStore(
    subscribe,
    () => globalChromeHidden,
    () => false
  );
  return context ?? { chromeHidden, setChromeHidden: setGlobalChromeHidden };
}
