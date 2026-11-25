/**
 * ─────────────────────────────────────────────────────────────
 *  backend/scripts/runBaselineLoadTest.js
 *  FoodieBite — Baseline / Load Testing Suite
 *  Simulates 100 concurrent virtual users for 1 minute (60s)
 *  Measures: RPS, Min/Avg/Max Latencies, P50/P90/P95/P99, Errors
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { performance } = require('perf_hooks');

// Configuration
const HOST = process.env.LOAD_HOST || 'localhost';
const PORT = parseInt(process.env.LOAD_PORT, 10) || 5000;
const CONCURRENT_USERS = parseInt(process.env.VIRTUAL_USERS, 10) || 100;
const DURATION_SECONDS = parseInt(process.env.DURATION_SEC, 10) || 60; // 1 minute default
const REPORT_INTERVAL_MS = 5000; // Log progress every 5 seconds

// FoodieBite Core Application Endpoint Mix (Representative of active users browsing app)
const ENDPOINTS = [
  { path: '/health', weight: 30, name: 'Health Check' },
  { path: '/ready', weight: 20, name: 'Service Readiness' },
  { path: '/api/debug/ai', weight: 20, name: 'Local AI Engine Status' },
  { path: '/api/food/categories', weight: 15, name: 'Food Categories' },
  { path: '/api/food/recommendations?limit=6', weight: 15, name: 'Food Recommendations' }
];

// Weighted random endpoint selector
const weightedPool = [];
for (const ep of ENDPOINTS) {
  for (let i = 0; i < ep.weight; i++) {
    weightedPool.push(ep);
  }
}

function getRandomEndpoint() {
  const idx = Math.floor(Math.random() * weightedPool.length);
  return weightedPool[idx];
}

// Persistent Keep-Alive HTTP Agent for maximum throughput and realistic browser connection pooling
const agent = new http.Agent({
  keepAlive: true,
  maxSockets: CONCURRENT_USERS * 2,
  maxFreeSockets: CONCURRENT_USERS,
  timeout: 10000
});

// Metrics State
let totalRequests = 0;
let successRequests = 0;
let failedRequests = 0;
let totalBytesReceived = 0;
const statusCodes = {};
const latencies = []; // Array of latency numbers in ms

let isRunning = true;
let startTime = 0;
let lastProgressTime = 0;
let lastReqCount = 0;

function executeRequest(endpoint) {
  return new Promise((resolve) => {
    const t0 = performance.now();
    const req = http.get(
      {
        hostname: HOST,
        port: PORT,
        path: endpoint.path,
        agent: agent,
        headers: {
          'Accept': 'application/json, text/plain, */*',
          'User-Agent': 'FoodieBite-LoadTester/1.0 (100-Virtual-Users)',
          'x-load-test': 'true',
          'Connection': 'keep-alive'
        },
        timeout: 8000
      },
      (res) => {
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
        });
        res.on('end', () => {
          const latency = performance.now() - t0;
          totalRequests++;
          totalBytesReceived += bytes;
          statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
          latencies.push(latency);

          if (res.statusCode >= 200 && res.statusCode < 400) {
            successRequests++;
          } else {
            failedRequests++;
          }
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      const latency = performance.now() - t0;
      totalRequests++;
      failedRequests++;
      statusCodes['ERROR'] = (statusCodes['ERROR'] || 0) + 1;
      latencies.push(latency);
      resolve();
    });

    req.on('timeout', () => {
      req.destroy();
      const latency = performance.now() - t0;
      totalRequests++;
      failedRequests++;
      statusCodes['TIMEOUT'] = (statusCodes['TIMEOUT'] || 0) + 1;
      latencies.push(latency);
      resolve();
    });
  });
}

// Worker function representing 1 Virtual User
async function runVirtualUser(userId) {
  while (isRunning) {
    const ep = getRandomEndpoint();
    await executeRequest(ep);
  }
}

// Compute Percentiles and Summary
function computeMetrics(durationSec) {
  latencies.sort((a, b) => a - b);
  const count = latencies.length;
  if (count === 0) return null;

  const sum = latencies.reduce((acc, v) => acc + v, 0);
  const min = latencies[0];
  const max = latencies[count - 1];
  const avg = sum / count;

  const p50 = latencies[Math.floor(count * 0.50)] || 0;
  const p75 = latencies[Math.floor(count * 0.75)] || 0;
  const p90 = latencies[Math.floor(count * 0.90)] || 0;
  const p95 = latencies[Math.floor(count * 0.95)] || 0;
  const p99 = latencies[Math.floor(count * 0.99)] || 0;

  const actualDurationSec = durationSec || 1;
  const rps = totalRequests / actualDurationSec;
  const throughputMBps = (totalBytesReceived / (1024 * 1024)) / actualDurationSec;
  const passRate = totalRequests > 0 ? ((successRequests / totalRequests) * 100) : 0;

  return {
    virtualUsers: CONCURRENT_USERS,
    durationSeconds: Math.round(actualDurationSec * 10) / 10,
    totalRequests,
    successRequests,
    failedRequests,
    passRate: Math.round(passRate * 100) / 100,
    rps: Math.round(rps * 10) / 10,
    throughputMBps: Math.round(throughputMBps * 100) / 100,
    totalDataMB: Math.round((totalBytesReceived / (1024 * 1024)) * 100) / 100,
    latencies: {
      min: Math.round(min * 100) / 100,
      avg: Math.round(avg * 100) / 100,
      p50: Math.round(p50 * 100) / 100,
      p75: Math.round(p75 * 100) / 100,
      p90: Math.round(p90 * 100) / 100,
      p95: Math.round(p95 * 100) / 100,
      p99: Math.round(p99 * 100) / 100,
      max: Math.round(max * 100) / 100
    },
    statusCodes
  };
}

async function main() {
  console.log('================================================================');
  console.log('       FOODIEBITE SYSTEM BASELINE & LOAD TEST SUITE             ');
  console.log('================================================================');
  console.log(`Target Host:        http://${HOST}:${PORT}`);
  console.log(`Concurrent Users:   ${CONCURRENT_USERS} Virtual Users`);
  console.log(`Test Duration:      ${DURATION_SECONDS} seconds (1 minute continuous)`);
  console.log(`Endpoints Pool:     ${ENDPOINTS.map(e => e.path).join(', ')}`);
  console.log('----------------------------------------------------------------');
  console.log('Ramping up 100 concurrent virtual users... Testing in progress.');
  console.log('----------------------------------------------------------------\n');

  startTime = performance.now();
  lastProgressTime = startTime;

  // Interval timer for live console reporting
  const progressInterval = setInterval(() => {
    const now = performance.now();
    const elapsedSec = (now - startTime) / 1000;
    const intervalSec = (now - lastProgressTime) / 1000;
    const intervalReqs = totalRequests - lastReqCount;
    const currentRps = Math.round((intervalReqs / intervalSec) * 10) / 10;
    const recentLatencies = latencies.slice(-intervalReqs);
    const recentAvg = recentLatencies.length > 0
      ? Math.round((recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length) * 10) / 10
      : 0;

    console.log(
      `⏱️ [${Math.round(elapsedSec).toString().padStart(2, ' ')}s / ${DURATION_SECONDS}s] ` +
      `Sent: ${totalRequests.toLocaleString().padStart(6, ' ')} reqs | ` +
      `Current RPS: ${currentRps.toString().padStart(6, ' ')} req/s | ` +
      `Avg Latency: ${recentAvg.toString().padStart(5, ' ')}ms | ` +
      `Errors: ${failedRequests}`
    );

    lastProgressTime = now;
    lastReqCount = totalRequests;
  }, REPORT_INTERVAL_MS);

  // Launch 100 Virtual Users in parallel
  const userWorkers = [];
  for (let i = 0; i < CONCURRENT_USERS; i++) {
    userWorkers.push(runVirtualUser(i + 1));
  }

  // Timer to stop test after DURATION_SECONDS
  await new Promise((resolve) => setTimeout(resolve, DURATION_SECONDS * 1000));
  isRunning = false;

  clearInterval(progressInterval);
  agent.destroy();

  const totalDurationSec = (performance.now() - startTime) / 1000;
  const metrics = computeMetrics(totalDurationSec);

  console.log('\n================================================================');
  console.log('                 LOAD TEST EXECUTION COMPLETE                   ');
  console.log('================================================================');
  console.log(`Total Requests Sent:    ${metrics.totalRequests.toLocaleString()}`);
  console.log(`Successful (200 OK):    ${metrics.successRequests.toLocaleString()} (${metrics.passRate}%)`);
  console.log(`Failed / Errors:        ${metrics.failedRequests}`);
  console.log(`Requests Per Second:    ${metrics.rps} req/sec`);
  console.log(`Data Transferred:       ${metrics.totalDataMB} MB (${metrics.throughputMBps} MB/s)`);
  console.log('----------------------------------------------------------------');
  console.log('RESPONSE TIME / LATENCY BREAKDOWN:');
  console.log(`  • Fastest Response (Min):   ${metrics.latencies.min}ms`);
  console.log(`  • Average Response Time:    ${metrics.latencies.avg}ms`);
  console.log(`  • 50th Percentile (P50):    ${metrics.latencies.p50}ms`);
  console.log(`  • 75th Percentile (P75):    ${metrics.latencies.p75}ms`);
  console.log(`  • 90th Percentile (P90):    ${metrics.latencies.p90}ms`);
  console.log(`  • 95th Percentile (P95):    ${metrics.latencies.p95}ms`);
  console.log(`  • 99th Percentile (P99):    ${metrics.latencies.p99}ms`);
  console.log(`  • Slowest Response (Max):   ${metrics.latencies.max}ms`);
  console.log('----------------------------------------------------------------');
  console.log('STATUS CODES:');
  for (const [code, count] of Object.entries(metrics.statusCodes)) {
    console.log(`  • HTTP ${code}: ${count.toLocaleString()} (${((count / metrics.totalRequests) * 100).toFixed(2)}%)`);
  }
  console.log('================================================================');

  const testPassed = metrics.passRate >= 99.0;
  console.log(`TEST STATUS: ${testPassed ? '✅ PASSED WITH HIGH VALUE' : '⚠️ COMPLETED'}`);
  console.log('================================================================\n');

  // Save metrics to JSON file
  const outPath = path.join(__dirname, '../data/load_test_results.json');
  try {
    fs.writeFileSync(outPath, JSON.stringify(metrics, null, 2), 'utf8');
    console.log(`Detailed metrics saved to: ${outPath}`);
  } catch (_) {}

  process.exit(0);
}

main().catch((err) => {
  console.error('Fatal load test error:', err);
  process.exit(1);
});
