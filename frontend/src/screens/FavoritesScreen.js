import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import AppLayout from '../components/AppLayout';
import { FoodCardRow } from '../components/UI';
import { useApp } from '../context/AppContext';

export default function FavoritesScreen() {
  const { savedFoodObjects } = useApp();

  return (
    <AppLayout>
      <View style={styles.header}>
        <Text style={styles.title}>My Favourites</Text>
      </View>

      <ScrollView style={styles.container} contentContainerStyle={{ paddingBottom: 24 }}>
        {savedFoodObjects.length === 0 ? (
          <EmptyState 
            emoji="🍽️" 
            msg="No saved foods yet" 
            sub="Tap the heart on any food to save it here" 
          />
        ) : (
          <View>
            <Text style={styles.countText}>
              {savedFoodObjects.length} saved food{savedFoodObjects.length !== 1 ? 's' : ''}
            </Text>
            {savedFoodObjects.map(f => (
              <FoodCardRow key={f.id || f.foodId} food={{ ...f, id: f.id || f.foodId }} />
            ))}
          </View>
        )}
      </ScrollView>
    </AppLayout>
  );
}

function EmptyState({ emoji, msg, sub }) {
  return (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{msg}</Text>
      <Text style={styles.emptySubtitle}>{sub}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 4,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 12,
  },
  container: {
    flex: 1,
    paddingHorizontal: 16,
    maxWidth: 960,
    width: '100%',
    alignSelf: 'center',
  },
  countText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  emptyEmoji: {
    fontSize: 52,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 6,
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
  },
});
