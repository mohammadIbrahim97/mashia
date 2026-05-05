import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Icon, IconName } from '@components/Icon';
import { colors, type } from '@theme/index';
import { HomeStack } from './HomeStack';
import { OrdersStack } from './OrdersStack';
import { ChatStack } from './ChatStack';
import { ProfileStack } from './ProfileStack';

export type MainTabsParamList = {
  HomeTab: undefined;
  OrdersTab: undefined;
  ChatTab: undefined;
  ProfileTab: undefined;
};

const Tabs = createBottomTabNavigator<MainTabsParamList>();

const tabIcon =
  (name: IconName) =>
  ({ color }: { color: string }) => <Icon name={name} size={22} color={color} />;

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
        name="HomeTab"
        component={HomeStack}
        options={{ tabBarIcon: tabIcon('home'), title: 'Home' }}
      />
      <Tabs.Screen
        name="OrdersTab"
        component={OrdersStack}
        options={{ tabBarIcon: tabIcon('shoppingBag'), title: 'Orders' }}
      />
      <Tabs.Screen
        name="ChatTab"
        component={ChatStack}
        options={{ tabBarIcon: tabIcon('message'), title: 'Chat' }}
      />
      <Tabs.Screen
        name="ProfileTab"
        component={ProfileStack}
        options={{ tabBarIcon: tabIcon('user'), title: 'Account' }}
      />
    </Tabs.Navigator>
  );
}
