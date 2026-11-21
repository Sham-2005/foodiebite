/**
 * FoodieBite - Baseline Load Testing Script
 * Specification:
 *  - Concurrency: 100 Virtual Users (VUs)
 *  - Duration: 60 seconds continuous
 *  - Metrics: Requests per Second (RPS), Min, Average, Max, P95, P99 Latency
 *
 * Usage:
 *  node backend/scripts/run_baseline_load_test.js [target_url] [concurrency] [duration_seconds]
 * Example:
 *  node backend/scripts/run_baseline_load_test.js http://localhost:5000/health 100 60
 */

const http = require('http');
const https = require('https');
const { URL } = require('url');

const TARGET_URL = process.argv[2] || 'http://localhost:5000/health';
const CONCURRENCY = parseInt(process.argv[3] || '100', 10);
const DURATION_SECONDS = parseInt(process.argv[4] || '60', 10);

console.log('='.repeat(70));
console.log(' FOODIEBITE BASELINE LOAD TEST');
console.log('='.repeat(70));
console.log(` Target Endpoint:     ${TARGET_URL}`);
console.log(` Virtual Users (VUs): ${CONCURRENCY} concurrent connections`);
console.log(` Test Duration:       ${DURATION_SECONDS} seconds continuous`);
console.log(` Start Time:          ${new Date().toISOString()}`);
console.log('='.repeat(70));
console.log('Running test... Please wait...\n');

const urlObj = new URL(TARGET_URL);
const isHttps = urlObj.protocol === 'https:';
const client = isHttps ? https : http;

const agent = new client.Agent({
  keepAlive: true,
  maxSockets: CONCURRENCY * 2,
  maxFreeSockets: CONCURRENCY
});

let totalRequests = 0;
let successRequests = 0;
let errorRequests = 0;
const latencies = [];
let isRunning = true;

function sendRequest() {
  if (!isRunning) return;

  const start = process.hrtime.bigint();
  const options = {
    hostname: urlObj.hostname,
    port: urlObj.port || (isHttps ? 443 : 80),
    path: urlObj.pathname + urlObj.search,
    method: 'GET',
    agent: agent,
    timeout: 5000
  };

  const req = client.request(options, (res) => {
    res.on('data', () => {}); // Consume body
    res.on('end', () => {
      const end = process.hrtime.bigint();
      const latencyMs = Number(end - start) / 1e6;
      latencies.push(latencyMs);
      totalRequests++;

      if (res.statusCode >= 200 && res.statusCode < 400) {
        successRequests++;
      } else {
        errorRequests++;
      }

      if (isRunning) {
        setImmediate(sendRequest);
      }
    });
  });

  req.on('error', () => {
    errorRequests++;
    totalRequests++;
    if (isRunning) {
      setTimeout(sendRequest, 100);
    }
  });

  req.on('timeout', () => {
    req.destroy();
    errorRequests++;
    totalRequests++;
    if (isRunning) {
      setTimeout(sendRequest, 100);
    }
  });

  req.end();
}

// Launch concurrent virtual users
for (let i = 0; i < CONCURRENCY; i++) {
  sendRequest();
}

// Timer for duration
setTimeout(() => {
  isRunning = false;
  setTimeout(() => {
    printResults();
    process.exit(0);
  }, 1000);
}, DURATION_SECONDS * 1000);

function printResults() {
  if (latencies.length === 0) {
    console.log('[ERROR] No successful requests completed. Check if backend server is running at ' + TARGET_URL);
    return;
  }

  latencies.sort((a, b) => a - b);

  const min = latencies[0];
  const max = latencies[latencies.length - 1];
  const sum = latencies.reduce((acc, val) => acc + val, 0);
  const avg = sum / latencies.length;

  const p50 = latencies[Math.floor(latencies.length * 0.50)];
  const p90 = latencies[Math.floor(latencies.length * 0.90)];
  const p95 = latencies[Math.floor(latencies.length * 0.95)];
  const p99 = latencies[Math.floor(latencies.length * 0.99)];

  const rps = (totalRequests / DURATION_SECONDS).toFixed(2);
  const errorRate = ((errorRequests / totalRequests) * 100).toFixed(2);

  console.log('='.repeat(70));
  console.log(' BASELINE LOAD TEST RESULTS SUMMARY');
  console.log('='.repeat(70));
  console.log(` Total Requests Handled:  ${totalRequests.toLocaleString()}`);
  console.log(` Successful Responses:    ${successRequests.toLocaleString()}`);
  console.log(` Failed / Timed Out:      ${errorRequests.toLocaleString()} (${errorRate}%)`);
  console.log(` Throughput (RPS):        ${rps} req/sec`);
  console.log('-'.repeat(70));
  console.log(' RESPONSE TIME METRICS (Latency):');
  console.log(`   Fastest (Min):         ${min.toFixed(2)} ms`);
  console.log(`   Average (Mean):        ${avg.toFixed(2)} ms`);
  console.log(`   Slowest (Max):         ${max.toFixed(2)} ms`);
  console.log(`   Median (P50):          ${p50.toFixed(2)} ms`);
  console.log(`   90th Percentile (P90): ${p90.toFixed(2)} ms`);
  console.log(`   95th Percentile (P95): ${p95.toFixed(2)} ms`);
  console.log(`   99th Percentile (P99): ${p99.toFixed(2)} ms`);
  console.log('='.repeat(70));
  console.log(' VERDICT:');
  if (avg <= 250 && errorRate < 1) {
    console.log(' [PASS] API performs within optimal baseline thresholds (<250ms avg, <1% error).');
  } else if (avg <= 500 && errorRate < 5) {
    console.log(' [ACCEPTABLE] API meets basic SLA criteria but requires optimization under load.');
  } else {
    console.log(' [FAIL] Performance degradation detected. Investigate latency bottlenecks.');
  }
  console.log('='.repeat(70));
}
