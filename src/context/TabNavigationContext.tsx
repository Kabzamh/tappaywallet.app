import React, { createContext, useContext } from 'react';

export type TabRouteName = 'Home' | 'Activity' | 'Tap' | 'Banks' | 'Profile';

export interface TabRouteParams {
  mode?: 'pay' | 'receive';
  ts?: number;
}

interface TabNavigationContextValue {
  activeTab: TabRouteName;
  tapParams: TabRouteParams;
  navigate: (tab: TabRouteName, params?: { mode?: 'pay' | 'receive' }) => void;
}

export const TabNavigationContext = createContext<TabNavigationContextValue>({
  activeTab: 'Home',
  tapParams: {},
  navigate: () => {},
});

export function useTabNavigation() {
  return useContext(TabNavigationContext);
}
