/**
 * ─────────────────────────────────────────────────────────────
 *  scripts/startApp.js
 *  FoodieBite — Launch Full-Stack Application (Backend & Frontend)
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const { spawn } = require('child_process');
const path = require('path');

const ROOT_DIR = path.resolve(__dirname, '..');

console.log('🚀 Starting FoodieBite Application...\n');

// Start Backend Server
const backend = spawn('node', ['src/server.js'], {
  cwd: path.join(ROOT_DIR, 'backend'),
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, PORT: '5000' }
});

// Start Frontend Dev Server
const frontend = spawn('npx', ['webpack', 'serve', '--mode', 'development'], {
  cwd: path.join(ROOT_DIR, 'frontend'),
  stdio: 'inherit',
  shell: true
});

function handleExit() {
  console.log('\n🛑 Shutting down FoodieBite services...');
  if (backend && backend.pid) {
    try { backend.kill(); } catch (_) {}
  }
  if (frontend && frontend.pid) {
    try { frontend.kill(); } catch (_) {}
  }
  process.exit(0);
}

process.on('SIGINT', handleExit);
process.on('SIGTERM', handleExit);
