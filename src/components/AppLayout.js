import React from 'react';
import BottomNav from './BottomNav';

export default function AppLayout({ children, noPadding }) {
  return (
    <div
      className="phone-frame"
      style={{
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <main style={{ flex: 1, paddingBottom: noPadding ? 0 : 12 }}>{children}</main>
      <BottomNav />
    </div>
  );
}
