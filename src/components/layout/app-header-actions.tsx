import * as React from 'react';
import { useFocusEffect } from 'expo-router';

type AppHeaderActionsContextValue = {
  actions: React.ReactNode;
  setActions: (actions: React.ReactNode) => void;
};

const AppHeaderActionsContext = React.createContext<AppHeaderActionsContextValue | null>(null);

export function AppHeaderActionsProvider({ children }: React.PropsWithChildren) {
  const [actions, setActions] = React.useState<React.ReactNode>(null);
  const value = React.useMemo(() => ({ actions, setActions }), [actions]);
  return (
    <AppHeaderActionsContext.Provider value={value}>{children}</AppHeaderActionsContext.Provider>
  );
}

export function AppHeaderActionsSlot() {
  const context = React.useContext(AppHeaderActionsContext);
  return <>{context?.actions ?? null}</>;
}

export function useAppHeaderActions(actions: React.ReactNode, deps: React.DependencyList) {
  const context = React.useContext(AppHeaderActionsContext);
  useFocusEffect(
    React.useCallback(() => {
      if (!context) return undefined;
      context.setActions(actions);
      return () => context.setActions(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps)
  );
}
