import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { DevPreviewScreen } from '@screens/DevPreviewScreen';
import { Icon, IconName } from '@components/Icon';
import { colors, type } from '@theme/index';

export type MainTabsParamList = {
  Home: undefined;
};

const Tabs = createBottomTabNavigator<MainTabsParamList>();

const tabIcon =
  (name: IconName) =>
  ({ color }: { color: string }) => <Icon name={name} size={22} color={color} />;

/**
 * Phase A: a single tab pointing at the design-system preview so we can
 * walk through tokens and components on a real device. Phase C will add
 * Listings / Chat / Orders / Account tabs and replace the preview with the
 * Home feed.
 */
export function MainTabs() {
  return (
    <Tabs.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: colors.paper,
          borderTopColor: colors.hairline,
        },
        tabBarActiveTintColor: colors.mashia[600],
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { ...type.caption, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="Home"
        component={DevPreviewScreen}
        options={{ tabBarIcon: tabIcon('shoppingBag'), title: 'Preview' }}
      />
    </Tabs.Navigator>
  );
}
