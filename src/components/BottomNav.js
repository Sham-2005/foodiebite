import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Home, Search, Heart, User, Bot } from 'lucide-react';

const NAV_ITEMS = [
  { path: '/home',      label: 'Home',      Icon: Home      },
  { path: '/search',    label: 'Search',    Icon: Search    },
  { path: '/ai',        label: 'AI Coach',  Icon: Bot       },
  { path: '/favorites', label: 'Favorites', Icon: Heart     },
  { path: '/profile',   label: 'Profile',   Icon: User      },
];

const styles = {
  nav: {
    position: 'sticky', bottom: 0,
    width: '100%',
    background: 'rgba(23,26,32,0.94)',
    borderTop: '1px solid rgba(255,255,255,0.08)',
    backdropFilter: 'blur(18px)',
    display: 'flex',
    padding: '8px 8px max(8px, env(safe-area-inset-bottom))',
    zIndex: 1000,
  },
  item: (active) => ({
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '8px 0',
    cursor: 'pointer',
    background: active ? 'rgba(255,107,53,0.12)' : 'transparent',
    border: 'none',
    borderRadius: 12,
    color: active ? '#FF6B35' : '#7f8794',
    gap: 3,
    transition: 'color 0.2s, background 0.2s, transform 0.2s',
  }),
  label: { fontSize: 10, fontWeight: 700, letterSpacing: 0.1 },
};

export default function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <nav style={styles.nav}>
      {NAV_ITEMS.map(({ path, label, Icon }) => {
        const active = pathname === path || pathname.startsWith(path + '/');
        return (
          <button key={path} style={styles.item(active)} onClick={() => navigate(path)}>
            <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
            <span style={styles.label}>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
