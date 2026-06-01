import React from 'react';
import AppLayout from '../components/AppLayout';
import { FoodCardRow } from '../components/UI';
import { useApp } from '../context/AppContext';

export default function FavoritesScreen() {
  const { savedFoodObjects } = useApp();

  return (
    <AppLayout>
      <div style={{ padding: '20px 16px 0' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 16 }}>My Favourites</h1>
      </div>

      <div style={{ padding: '0 16px' }}>
        {savedFoodObjects.length === 0
          ? <EmptyState emoji="🍽️" msg="No saved foods yet" sub="Tap the heart on any food to save it here" />
          : (
            <>
              <p style={{ fontSize: 13, color: '#666', marginBottom: 14 }}>{savedFoodObjects.length} saved food{savedFoodObjects.length !== 1 ? 's' : ''}</p>
              <div style={{maxHeight: '750px', overflowY: 'auto',paddingRight: '5px',}}>
                {savedFoodObjects.map(f => (
                  <FoodCardRow key={f.id || f.foodId} food={{ ...f, id: f.id || f.foodId }} />
                ))}
              </div>
            </>
          )}
      </div>
    </AppLayout>
  );
}

function EmptyState({ emoji, msg, sub }) {
  return (
    <div style={{ textAlign: 'center', padding: '60px 20px' }}>
      <div style={{ fontSize: 52, marginBottom: 16 }}>{emoji}</div>
      <p style={{ fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{msg}</p>
      <p style={{ fontSize: 13, color: '#555' }}>{sub}</p>
    </div>
  );
}
