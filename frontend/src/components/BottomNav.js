import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useNavigation, useNavigationState } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Search, Heart, User, Bot } from 'lucide-react-native';

const NAV_ITEMS = [
  { name: 'Home',      label: 'Home',      Icon: Home      },
  { name: 'Search',    label: 'Search',    Icon: Search    },
  { name: 'AI',        label: 'AI Coach',  Icon: Bot       },
  { name: 'Favorites', label: 'Favorites', Icon: Heart     },
  { name: 'Profile',   label: 'Profile',   Icon: User      },
];

const C = {
  orange: '#FF6B35',
  muted: '#7f8794',
};

export default function BottomNav() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  
  const activeRouteName = useNavigationState(state => {
    if (!state) return '';
    const route = state.routes[state.index];
    return route ? route.name : '';
  });

  return (
    <View style={[styles.nav, { paddingBottom: Math.max(8, insets.bottom) }]}>
      <View style={styles.innerNav}>
        {NAV_ITEMS.map(({ name, label, Icon }) => {
          const active = activeRouteName === name;
          return (
            <TouchableOpacity
              key={name}
              activeOpacity={0.8}
              onPress={() => navigation.navigate(name)}
              style={[styles.item, active && styles.itemActive]}
              accessibilityRole="button"
              accessibilityLabel={`Navigate to ${label}`}
            >
              <Icon size={22} color={active ? C.orange : C.muted} strokeWidth={active ? 2.5 : 1.8} />
              <Text style={[styles.label, active && styles.labelActive]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  nav: {
    width: '100%',
    backgroundColor: '#171a20',
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  innerNav: {
    width: '100%',
    maxWidth: 640,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  item: {
    flex: 1,
    minWidth: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderRadius: 12,
    gap: 3,
  },
  itemActive: {
    backgroundColor: 'rgba(255,107,53,0.12)',
  },
  label: {
    fontSize: 10,
    fontWeight: '700',
    color: C.muted,
    letterSpacing: 0.1,
  },
  labelActive: {
    color: C.orange,
  },
});
