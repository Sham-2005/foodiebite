// ─────────────────────────────────────────────────────────────
//  backend/src/services/feedbackStore.js
//  FoodieBite — Feedback Management Store (Memory & Firestore Sync)
// ─────────────────────────────────────────────────────────────

'use strict';

const { getFirestoreDb } = require('../config/firebase');

// In-memory cache pre-seeded with realistic feedback records
const inMemoryFeedback = [
  {
    id: 'feedback-1740001000000',
    uid: 'usr_sham_admin',
    name: 'Sham',
    email: 'sham111205s@gmail.com',
    category: 'recommendations',
    rating: 5,
    message: 'The daily vegetarian recommendation emails are fantastic! The nutrient breakdown for breakfast oats was spot on.',
    status: 'reviewed',
    reviewedBy: 'admin@foodiebite.com',
    reviewedAt: '2026-10-25T10:00:00.000Z',
    internalNotes: 'User validated breakfast oats recommendation accuracy. Positive feedback on daily emails.',
    createdAt: '2026-10-25T09:15:00.000Z',
    updatedAt: '2026-10-25T10:00:00.000Z'
  },
  {
    id: 'feedback-1740002000000',
    uid: 'usr_sarah_99',
    name: 'Sarah Jenkins',
    email: 'sarah.j@example.com',
    category: 'dietary_safety',
    rating: 4,
    message: 'Could you add more low-sodium lentil soup options in the winter recommendations? Otherwise loving the app!',
    status: 'pending',
    reviewedBy: null,
    reviewedAt: null,
    internalNotes: null,
    createdAt: '2026-10-26T06:30:00.000Z',
    updatedAt: '2026-10-26T06:30:00.000Z'
  },
  {
    id: 'feedback-1740003000000',
    uid: 'usr_rahul_k',
    name: 'Rahul Kumar',
    email: 'rahul.k@example.com',
    category: 'app_experience',
    rating: 5,
    message: 'The nut allergy filtering works seamlessly. I feel safe trying the suggested recipes.',
    status: 'resolved',
    reviewedBy: 'admin@foodiebite.com',
    reviewedAt: '2026-10-26T08:00:00.000Z',
    internalNotes: 'Nut allergy filter verified. User satisfied.',
    replyMessage: 'Thank you Rahul! Allergen safety is our highest priority at FoodieBite.',
    createdAt: '2026-10-26T07:15:00.000Z',
    updatedAt: '2026-10-26T08:00:00.000Z'
  }
];

async function safeFirestore(promise, timeoutMs = 500) {
  let timer;
  try {
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
    });
    return await Promise.race([promise, timeoutPromise]);
  } catch (err) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function addFeedback(feedbackDoc) {
  inMemoryFeedback.unshift(feedbackDoc);
  const db = getFirestoreDb();
  if (db) {
    try {
      await safeFirestore(db.collection('feedback').doc(feedbackDoc.id).set(feedbackDoc), 500);
    } catch (_) {}
  }
  return feedbackDoc;
}

async function getAllFeedback(filters = {}) {
  const list = [...inMemoryFeedback];
  const db = getFirestoreDb();

  if (db) {
    try {
      const snap = await safeFirestore(db.collection('feedback').orderBy('createdAt', 'desc').get(), 600);
      if (snap) {
        snap.forEach(doc => {
          const data = { id: doc.id, ...doc.data() };
          const idx = list.findIndex(f => f.id === data.id);
          if (idx !== -1) {
            list[idx] = { ...list[idx], ...data };
          } else {
            list.push(data);
          }
        });
      }
    } catch (_) {}
  }

  let result = [...list];

  // 1. Filter by category
  if (filters.category && filters.category !== 'all') {
    const cat = filters.category.toLowerCase().trim();
    result = result.filter(f => (f.category || 'general').toLowerCase() === cat);
  }

  // 2. Filter by status
  if (filters.status && filters.status !== 'all') {
    const st = filters.status.toLowerCase().trim();
    result = result.filter(f => (f.status || 'pending').toLowerCase() === st);
  }

  // 3. Filter by rating
  if (filters.rating && filters.rating !== 'all') {
    const r = parseInt(filters.rating, 10);
    if (!isNaN(r)) {
      result = result.filter(f => Number(f.rating) === r);
    }
  }

  // 4. Search query
  if (filters.q && filters.q.trim()) {
    const term = filters.q.trim().toLowerCase();
    result = result.filter(f =>
      (f.message && f.message.toLowerCase().includes(term)) ||
      (f.name && f.name.toLowerCase().includes(term)) ||
      (f.email && f.email.toLowerCase().includes(term)) ||
      (f.id && f.id.toLowerCase().includes(term))
    );
  }

  // 5. Sort by createdAt desc
  result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

  return result;
}

async function getFeedbackById(id) {
  const found = inMemoryFeedback.find(f => f.id === id);
  const db = getFirestoreDb();
  if (db) {
    try {
      const snap = await safeFirestore(db.collection('feedback').doc(id).get(), 400);
      if (snap && snap.exists) {
        return { id: snap.id, ...snap.data() };
      }
    } catch (_) {}
  }
  return found || null;
}

async function updateFeedback(id, updates) {
  const now = new Date().toISOString();
  const allowed = {
    ...updates,
    updatedAt: now
  };

  const idx = inMemoryFeedback.findIndex(f => f.id === id);
  if (idx !== -1) {
    inMemoryFeedback[idx] = {
      ...inMemoryFeedback[idx],
      ...allowed
    };
  }

  const db = getFirestoreDb();
  if (db) {
    try {
      await safeFirestore(db.collection('feedback').doc(id).set(allowed, { merge: true }), 500);
    } catch (_) {}
  }

  return inMemoryFeedback[idx] || allowed;
}

async function deleteFeedback(id) {
  const idx = inMemoryFeedback.findIndex(f => f.id === id);
  if (idx !== -1) {
    inMemoryFeedback.splice(idx, 1);
  }
  const db = getFirestoreDb();
  if (db) {
    try {
      await safeFirestore(db.collection('feedback').doc(id).delete(), 400);
    } catch (_) {}
  }
  return true;
}

module.exports = {
  addFeedback,
  getAllFeedback,
  getFeedbackById,
  updateFeedback,
  deleteFeedback
};
