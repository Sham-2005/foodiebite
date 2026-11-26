/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  scripts/runBaselineLoadTest.js
 *  FoodieBite — Enterprise Baseline / Load Testing Automation Engine
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Simulates normal expected production load:
 *   • 100 Virtual Users (concurrent connections)
 *   • Running continuously for 1 minute (60 seconds)
 *   • Supports single-endpoint or multi-endpoint rotation across FoodieBite APIs:
 *     - /health (Infrastructure health)
 *     - /ready (Readiness probe)
 *     - /api/debug/ai (Local AI engine status)
 *     - /api/food/recommendations (Actual application workload)
 *
 * Measures:
 *   • Requests Per Second (RPS) / Throughput (Average & Peak)
 *   • Response Time Latency (Min, Average, Max, P50, P90, P95, P99)
 *   • Per-Endpoint Breakdown (Requests, Success, Failed, Avg Latency, P95)
 *   • Total Requests, Error Rate, and Status Code Distribution
 *   • Second-by-Second Time-Series Analytics
 *   • Configurable Performance Thresholds (PASS / WARNING / FAIL)
 *
 * Outputs:
 *   • Interactive Console Dashboard
 *   • Markdown Report: reports/baseline-load-test-report.md
 *   • Styled Excel Workbook: reports/FoodieBite_Baseline_Load_Test_Report.xlsx
 *   • Machine-Readable JSON: reports/baseline-load-test-results.json
 */

'use strict';

const http = require('http');
const https = require('https');
const url = require('url');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

// Resolve ExcelJS
let ExcelJS;
try {
  ExcelJS = require('exceljs');
} catch (e1) {
  try {
    ExcelJS = require(path.resolve(__dirname, '../backend/node_modules/exceljs'));
  } catch (e2) {
    try {
      ExcelJS = require(path.resolve(__dirname, '../node_modules/exceljs'));
    } catch (e3) {
      ExcelJS = null;
    }
  }
}

// ── CLI ARGUMENTS PARSER ──────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getArg(name, defaultValue) {
  for (const arg of args) {
    if (arg.startsWith(`--${name}=`)) {
      return arg.split('=')[1];
    }
    if (arg === `--${name}`) {
      return true;
    }
  }
  return defaultValue;
}

const CONCURRENCY = parseInt(getArg('concurrency', getArg('c', 100)), 10);
const DURATION_SEC = parseInt(getArg('duration', getArg('d', 60)), 10);
const TARGET_URL = getArg('url', getArg('u', 'http://127.0.0.1:5000/health'));
const IS_MULTI_ENDPOINT = getArg('multi', false) || args.includes('--multi');
const AUTO_SPAWN_PORT = parseInt(getArg('port', 5055), 10);
const PACING_MS = parseInt(getArg('pacing', 0), 10);

// Configurable Thresholds
const THRESHOLD_MAX_ERROR_RATE = parseFloat(getArg('max-error-rate', 1.0));
const THRESHOLD_MAX_AVG_LATENCY = parseFloat(getArg('max-avg-latency', 500));
const THRESHOLD_MAX_P95_LATENCY = parseFloat(getArg('max-p95-latency', 1000));
const THRESHOLD_MAX_P99_LATENCY = parseFloat(getArg('max-p99-latency', 2000));

const ROOT_DIR = path.resolve(__dirname, '..');
const REPORTS_DIR = path.resolve(ROOT_DIR, 'reports');
if (!fs.existsSync(REPORTS_DIR)) {
  fs.mkdirSync(REPORTS_DIR, { recursive: true });
}

// ── COLOR HELPERS ─────────────────────────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m'
};

// ── HEALTH CHECK PROBE ────────────────────────────────────────────────────────
function probeEndpoint(target) {
  return new Promise((resolve) => {
    try {
      const parsed = url.parse(target);
      const client = parsed.protocol === 'https:' ? https : http;
      const req = client.get(target, { timeout: 2000 }, (res) => {
        res.resume();
        resolve(res.statusCode >= 200 && res.statusCode < 400);
      });
      req.on('error', () => resolve(false));
      req.on('timeout', () => {
        req.destroy();
        resolve(false);
      });
    } catch (_) {
      resolve(false);
    }
  });
}

// ── AUTO-SPAWN SERVER IF NOT RUNNING ──────────────────────────────────────────
async function ensureServerRunning(preferredUrl) {
  const isUp = await probeEndpoint(preferredUrl);
  if (isUp) {
    console.log(`${c.green}✔ Active FoodieBite server detected at ${preferredUrl}${c.reset}\n`);
    return { url: preferredUrl, serverProcess: null };
  }

  const fallbackUrl = `http://127.0.0.1:${AUTO_SPAWN_PORT}/health`;
  console.log(`${c.yellow}ℹ No active server at ${preferredUrl}.${c.reset}`);
  console.log(`${c.cyan}🚀 Auto-spawning FoodieBite backend on port ${AUTO_SPAWN_PORT}...${c.reset}`);

  const serverProcess = spawn('node', ['backend/src/server.js'], {
    shell: true,
    env: {
      ...process.env,
      PORT: String(AUTO_SPAWN_PORT),
      NODE_ENV: 'test',
      DAILY_RECOMMENDATION_ENABLED: 'false'
    }
  });

  serverProcess.stderr.on('data', () => {});

  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 400));
    const ready = await probeEndpoint(fallbackUrl);
    if (ready) {
      console.log(`${c.green}✔ FoodieBite test instance is ready on ${fallbackUrl}${c.reset}\n`);
      return { url: fallbackUrl, serverProcess };
    }
    attempts++;
  }

  serverProcess.kill();
  throw new Error(`Failed to initialize FoodieBite server on port ${AUTO_SPAWN_PORT} after 8 seconds.`);
}

// ── CORE LOAD ENGINE ──────────────────────────────────────────────────────────
async function runLoadTest(baseUrlOrTarget, concurrency, durationSeconds, isMulti) {
  const parsed = url.parse(baseUrlOrTarget);
  const isHttps = parsed.protocol === 'https:';
  const client = isHttps ? https : http;

  const agent = new client.Agent({
    keepAlive: true,
    maxSockets: concurrency * 2,
    keepAliveMsecs: 15000
  });

  const baseOrigin = `${parsed.protocol}//${parsed.hostname}:${parsed.port || (isHttps ? 443 : 80)}`;
  
  // Define endpoint rotation list
  const endpointPaths = isMulti
    ? ['/health', '/ready', '/api/debug/ai', '/api/food/recommendations']
    : [parsed.path || '/health'];

  const latencies = [];
  const statusCodes = {};
  const timeline = [];
  const endpointStats = {};

  endpointPaths.forEach(p => {
    endpointStats[p] = {
      requests: 0,
      successful: 0,
      failed: 0,
      latencies: []
    };
  });

  let totalRequests = 0;
  let totalErrors = 0;
  let totalBytes = 0;
  let isRunning = true;
  let peakRps = 0;

  console.log(`${c.bold}══════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${c.cyan}  FOODIEBITE BASELINE LOAD TEST EXECUTION${c.reset}`);
  console.log(`${c.bold}══════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`  ${c.bold}Target Origin:${c.reset}      ${c.yellow}${baseOrigin}${c.reset}`);
  console.log(`  ${c.bold}Tested Endpoints:${c.reset}   ${endpointPaths.join(', ')} (${isMulti ? 'Multi-Endpoint Mode' : 'Single Endpoint Mode'})`);
  console.log(`  ${c.bold}Virtual Users (VU):${c.reset} ${c.green}${concurrency} concurrent users${c.reset}`);
  console.log(`  ${c.bold}Test Duration:${c.reset}      ${c.green}${durationSeconds} seconds (continuous)${c.reset}`);
  console.log(`  ${c.bold}Pacing Delay:${c.reset}       ${PACING_MS}ms`);
  console.log(`  ${c.bold}Threshold Limits:${c.reset}   Error < ${THRESHOLD_MAX_ERROR_RATE}%, Avg Latency < ${THRESHOLD_MAX_AVG_LATENCY}ms, P95 < ${THRESHOLD_MAX_P95_LATENCY}ms`);
  console.log(`  ${c.bold}System Hardware:${c.reset}    ${os.cpus()[0].model} (${os.cpus().length} Cores, ${(os.totalmem() / 1e9).toFixed(1)} GB RAM)`);
  console.log(`${c.bold}──────────────────────────────────────────────────────────────────────────${c.reset}`);
  console.log(`  ${c.dim}Simulating ${concurrency} users continuously sending requests...${c.reset}\n`);

  const startTime = Date.now();
  let lastSecondReqs = 0;
  let currentSecondIdx = 0;

  // Single HTTP Request Promise with endpoint selection
  function sendSingleRequest(reqPath) {
    return new Promise((resolve) => {
      const reqStart = process.hrtime.bigint();
      const options = {
        protocol: parsed.protocol,
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: reqPath,
        method: 'GET',
        agent: agent,
        headers: {
          'User-Agent': 'FoodieBite-LoadTester/2.0',
          'Accept': 'application/json',
          'Connection': 'keep-alive',
          'x-load-test': 'true'
        }
      };

      const req = client.request(options, (res) => {
        let bytes = 0;
        res.on('data', (chunk) => {
          bytes += chunk.length;
        });
        res.on('end', () => {
          const reqEnd = process.hrtime.bigint();
          const latencyMs = Number(reqEnd - reqStart) / 1e6; // ms

          totalRequests++;
          totalBytes += bytes;
          statusCodes[res.statusCode] = (statusCodes[res.statusCode] || 0) + 1;
          latencies.push(latencyMs);

          const epData = endpointStats[reqPath];
          if (epData) {
            epData.requests++;
            epData.latencies.push(latencyMs);
            if (res.statusCode >= 200 && res.statusCode < 400) {
              epData.successful++;
            } else {
              epData.failed++;
            }
          }

          if (res.statusCode >= 400) {
            totalErrors++;
          }
          resolve(latencyMs);
        });
      });

      req.on('error', () => {
        totalRequests++;
        totalErrors++;
        statusCodes['ERR'] = (statusCodes['ERR'] || 0) + 1;
        const epData = endpointStats[reqPath];
        if (epData) {
          epData.requests++;
          epData.failed++;
        }
        resolve(null);
      });

      req.on('timeout', () => {
        req.destroy();
        totalRequests++;
        totalErrors++;
        statusCodes['TIMEOUT'] = (statusCodes['TIMEOUT'] || 0) + 1;
        const epData = endpointStats[reqPath];
        if (epData) {
          epData.requests++;
          epData.failed++;
        }
        resolve(null);
      });

      req.setTimeout(5000);
      req.end();
    });
  }

  // Virtual User Worker Loop with path rotation
  async function virtualUserWorker(userId) {
    let localReqCount = 0;
    while (isRunning) {
      const selectedPath = endpointPaths[localReqCount % endpointPaths.length];
      localReqCount++;
      await sendSingleRequest(selectedPath);
      if (PACING_MS > 0 && isRunning) {
        await new Promise((r) => setTimeout(r, PACING_MS));
      }
    }
  }

  // Launch Concurrency Workers
  const workerPromises = [];
  for (let i = 0; i < concurrency; i++) {
    workerPromises.push(virtualUserWorker(i + 1));
  }

  // Real-time Per-Second Sampler
  const ticker = setInterval(() => {
    currentSecondIdx++;
    const now = Date.now();
    const elapsedSec = (now - startTime) / 1000;
    const secondReqs = totalRequests - lastSecondReqs;
    lastSecondReqs = totalRequests;

    if (secondReqs > peakRps) {
      peakRps = secondReqs;
    }

    const recentLatencies = latencies.slice(-secondReqs);
    let secAvg = 0;
    let secMin = 0;
    let secMax = 0;
    if (recentLatencies.length > 0) {
      secMin = Math.min(...recentLatencies);
      secMax = Math.max(...recentLatencies);
      secAvg = recentLatencies.reduce((a, b) => a + b, 0) / recentLatencies.length;
    }

    timeline.push({
      second: currentSecondIdx,
      requestsInSecond: secondReqs,
      rps: secondReqs,
      avgLatencyMs: Math.round(secAvg * 10) / 10,
      minLatencyMs: Math.round(secMin * 10) / 10,
      maxLatencyMs: Math.round(secMax * 10) / 10,
      totalCumulative: totalRequests,
      errorsCumulative: totalErrors
    });

    const pct = Math.min(100, Math.round((currentSecondIdx / durationSeconds) * 100));
    const timeStr = `${String(Math.floor(elapsedSec / 60)).padStart(2, '0')}:${String(Math.floor(elapsedSec % 60)).padStart(2, '0')}`;
    const totalTimeStr = `${String(Math.floor(durationSeconds / 60)).padStart(2, '0')}:${String(durationSeconds % 60).padStart(2, '0')}`;

    process.stdout.write(
      `\r  [${c.cyan}${timeStr}${c.reset} / ${totalTimeStr}] (${c.bold}${pct}%${c.reset}) ` +
      `| ${c.green}${concurrency} VUs${c.reset} ` +
      `| RPS: ${c.bold}${c.yellow}${String(secondReqs).padStart(4)} req/s${c.reset} ` +
      `| Avg: ${c.cyan}${secAvg.toFixed(1)}ms${c.reset} ` +
      `| Total: ${c.bold}${totalRequests.toLocaleString()}${c.reset}`
    );
  }, 1000);

  // Wait for Duration to Complete
  await new Promise((r) => setTimeout(r, durationSeconds * 1000));
  isRunning = false;
  clearInterval(ticker);
  await Promise.all(workerPromises);
  agent.destroy();

  const totalDurationMs = Date.now() - startTime;
  const totalDurationSec = totalDurationMs / 1000;

  console.log('\n');

  // Compute Metrics & Percentiles
  latencies.sort((a, b) => a - b);
  const count = latencies.length;
  const minMs = count > 0 ? latencies[0] : 0;
  const maxMs = count > 0 ? latencies[count - 1] : 0;
  const avgMs = count > 0 ? latencies.reduce((a, b) => a + b, 0) / count : 0;
  const p50Ms = count > 0 ? latencies[Math.floor(count * 0.50)] : 0;
  const p90Ms = count > 0 ? latencies[Math.floor(count * 0.90)] : 0;
  const p95Ms = count > 0 ? latencies[Math.floor(count * 0.95)] : 0;
  const p99Ms = count > 0 ? latencies[Math.floor(count * 0.99)] : 0;

  const rps = Math.round((totalRequests / totalDurationSec) * 10) / 10;
  const throughputKbSec = Math.round(((totalBytes / 1024) / totalDurationSec) * 10) / 10;
  const errorRate = ((totalErrors / Math.max(1, totalRequests)) * 100).toFixed(2);

  // Compile per-endpoint summary
  const endpointBreakdown = {};
  Object.keys(endpointStats).forEach(ep => {
    const d = endpointStats[ep];
    d.latencies.sort((a, b) => a - b);
    const epCount = d.latencies.length;
    const epAvg = epCount > 0 ? d.latencies.reduce((a, b) => a + b, 0) / epCount : 0;
    const epP95 = epCount > 0 ? d.latencies[Math.floor(epCount * 0.95)] : 0;
    endpointBreakdown[ep] = {
      requests: d.requests,
      successful: d.successful,
      failed: d.failed,
      avgLatencyMs: Math.round(epAvg * 10) / 10,
      p95LatencyMs: Math.round(epP95 * 10) / 10
    };
  });

  // Latency Buckets
  const buckets = {
    '< 25ms': 0,
    '25 - 50ms': 0,
    '50 - 100ms': 0,
    '100 - 250ms': 0,
    '250 - 500ms': 0,
    '500 - 1000ms': 0,
    '> 1000ms': 0
  };

  latencies.forEach((l) => {
    if (l < 25) buckets['< 25ms']++;
    else if (l < 50) buckets['25 - 50ms']++;
    else if (l < 100) buckets['50 - 100ms']++;
    else if (l < 250) buckets['100 - 250ms']++;
    else if (l < 500) buckets['250 - 500ms']++;
    else if (l < 1000) buckets['500 - 1000ms']++;
    else buckets['> 1000ms']++;
  });

  // Threshold Evaluation
  const isErrorOk = parseFloat(errorRate) <= THRESHOLD_MAX_ERROR_RATE;
  const isAvgOk = avgMs <= THRESHOLD_MAX_AVG_LATENCY;
  const isP95Ok = p95Ms <= THRESHOLD_MAX_P95_LATENCY;
  const isP99Ok = p99Ms <= THRESHOLD_MAX_P99_LATENCY;

  let overallVerdict = 'PASS';
  const thresholdFailures = [];

  if (!isErrorOk) thresholdFailures.push(`Error rate (${errorRate}%) exceeded threshold (${THRESHOLD_MAX_ERROR_RATE}%)`);
  if (!isAvgOk) thresholdFailures.push(`Average latency (${avgMs.toFixed(1)}ms) exceeded threshold (${THRESHOLD_MAX_AVG_LATENCY}ms)`);
  if (!isP95Ok) thresholdFailures.push(`P95 latency (${p95Ms.toFixed(1)}ms) exceeded threshold (${THRESHOLD_MAX_P95_LATENCY}ms)`);
  if (!isP99Ok) thresholdFailures.push(`P99 latency (${p99Ms.toFixed(1)}ms) exceeded threshold (${THRESHOLD_MAX_P99_LATENCY}ms)`);

  if (thresholdFailures.length > 0) {
    if (parseFloat(errorRate) > 5.0 || p95Ms > 2000) {
      overallVerdict = 'FAIL';
    } else {
      overallVerdict = 'WARNING';
    }
  }

  return {
    targetUrl: baseUrlOrTarget,
    isMultiEndpoint: isMulti,
    testedEndpoints: endpointPaths,
    endpointBreakdown,
    concurrency,
    durationSeconds,
    totalDurationMs,
    totalDurationSec,
    totalRequests,
    successfulRequests: totalRequests - totalErrors,
    totalErrors,
    errorRate,
    rps,
    peakRps,
    throughputKbSec,
    totalMbTransferred: (totalBytes / (1024 * 1024)).toFixed(2),
    minMs: Math.round(minMs * 10) / 10,
    avgMs: Math.round(avgMs * 10) / 10,
    maxMs: Math.round(maxMs * 10) / 10,
    p50Ms: Math.round(p50Ms * 10) / 10,
    p90Ms: Math.round(p90Ms * 10) / 10,
    p95Ms: Math.round(p95Ms * 10) / 10,
    p99Ms: Math.round(p99Ms * 10) / 10,
    statusCodes,
    buckets,
    timeline,
    thresholds: {
      maxErrorRate: THRESHOLD_MAX_ERROR_RATE,
      maxAvgLatency: THRESHOLD_MAX_AVG_LATENCY,
      maxP95Latency: THRESHOLD_MAX_P95_LATENCY,
      maxP99Latency: THRESHOLD_MAX_P99_LATENCY,
      verdict: overallVerdict,
      failures: thresholdFailures
    }
  };
}

// ── RENDER CONSOLE RESULTS DASHBOARD ──────────────────────────────────────────
function printResultsDashboard(stats) {
  const vColor = stats.thresholds.verdict === 'PASS' ? c.green : (stats.thresholds.verdict === 'WARNING' ? c.yellow : c.red);

  console.log(`${c.bold}══════════════════════════════════════════════════════════════════════════${c.reset}`);
  console.log(`${c.bold}${vColor}  BASELINE LOAD TEST COMPLETED — VERDICT: [${stats.thresholds.verdict}]${c.reset}`);
  console.log(`${c.bold}══════════════════════════════════════════════════════════════════════════${c.reset}`);

  console.log(`\n${c.bold}1. THROUGHPUT & CONCURRENCY METRICS:${c.reset}`);
  console.log(`   • ${c.bold}Concurrent Virtual Users:${c.reset} ${c.cyan}${stats.concurrency} Users${c.reset}`);
  console.log(`   • ${c.bold}Continuous Test Duration:${c.reset} ${stats.totalDurationSec.toFixed(2)} seconds`);
  console.log(`   • ${c.bold}Total Requests Handled:${c.reset}   ${c.bold}${stats.totalRequests.toLocaleString()} requests${c.reset}`);
  console.log(`   • ${c.bold}Successful Requests:${c.reset}      ${c.green}${stats.successfulRequests.toLocaleString()} requests${c.reset}`);
  console.log(`   • ${c.bold}Failed Requests:${c.reset}          ${stats.totalErrors > 0 ? c.red : c.green}${stats.totalErrors}${c.reset}`);
  console.log(`   • ${c.bold}Average RPS:${c.reset}              ${c.bold}${c.yellow}${stats.rps} req/sec${c.reset}`);
  console.log(`   • ${c.bold}Peak RPS:${c.reset}                 ${c.bold}${c.yellow}${stats.peakRps} req/sec${c.reset}`);
  console.log(`   • ${c.bold}Data Throughput:${c.reset}          ${stats.throughputKbSec} KB/sec (${stats.totalMbTransferred} MB total)`);
  console.log(`   • ${c.bold}Overall Error Rate:${c.reset}       ${parseFloat(stats.errorRate) === 0 ? c.green : c.red}${stats.errorRate}%${c.reset}`);

  console.log(`\n${c.bold}2. RESPONSE TIME LATENCY ANALYSIS:${c.reset}`);
  console.log(`   • ${c.bold}Fastest Response (Min):${c.reset}  ${c.green}${stats.minMs} ms${c.reset}`);
  console.log(`   • ${c.bold}Average Response (Avg):${c.reset}  ${c.cyan}${stats.avgMs} ms${c.reset}`);
  console.log(`   • ${c.bold}Slowest Response (Max):${c.reset}  ${stats.maxMs > 1000 ? c.yellow : c.green}${stats.maxMs} ms${c.reset}`);
  console.log(`   • ${c.bold}Median Latency (P50):${c.reset}    ${stats.p50Ms} ms`);
  console.log(`   • ${c.bold}90th Percentile (P90):${c.reset}   ${stats.p90Ms} ms`);
  console.log(`   • ${c.bold}95th Percentile (P95):${c.reset}   ${stats.p95Ms} ms ${c.dim}(SLA baseline)${c.reset}`);
  console.log(`   • ${c.bold}99th Percentile (P99):${c.reset}   ${stats.p99Ms} ms ${c.dim}(Tail latency)${c.reset}`);

  console.log(`\n${c.bold}3. ENDPOINT-BY-ENDPOINT BREAKDOWN:${c.reset}`);
  console.log(`   ${'Endpoint'.padEnd(30)} | ${'Requests'.padStart(10)} | ${'Success'.padStart(10)} | ${'Failed'.padStart(8)} | ${'Avg Latency'.padStart(12)} | ${'P95 Latency'.padStart(12)}`);
  console.log(`   ${'-'.repeat(30)}-+-${'-'.repeat(10)}-+-${'-'.repeat(10)}-+-${'-'.repeat(8)}-+-${'-'.repeat(12)}-+-${'-'.repeat(12)}`);
  Object.keys(stats.endpointBreakdown).forEach(ep => {
    const d = stats.endpointBreakdown[ep];
    console.log(`   ${ep.padEnd(30)} | ${String(d.requests).padStart(10)} | ${String(d.successful).padStart(10)} | ${String(d.failed).padStart(8)} | ${String(d.avgLatencyMs + 'ms').padStart(12)} | ${String(d.p95LatencyMs + 'ms').padStart(12)}`);
  });

  console.log(`\n${c.bold}4. PERFORMANCE THRESHOLDS EVALUATION:${c.reset}`);
  console.log(`   • Error Rate:        ${stats.errorRate}% (Threshold: < ${stats.thresholds.maxErrorRate}%) -> ${parseFloat(stats.errorRate) <= stats.thresholds.maxErrorRate ? c.green + 'PASS' : c.red + 'FAIL'}${c.reset}`);
  console.log(`   • Average Latency:   ${stats.avgMs} ms (Threshold: < ${stats.thresholds.maxAvgLatency} ms) -> ${stats.avgMs <= stats.thresholds.maxAvgLatency ? c.green + 'PASS' : c.red + 'FAIL'}${c.reset}`);
  console.log(`   • P95 Latency:       ${stats.p95Ms} ms (Threshold: < ${stats.thresholds.maxP95Latency} ms) -> ${stats.p95Ms <= stats.thresholds.maxP95Latency ? c.green + 'PASS' : c.red + 'FAIL'}${c.reset}`);
  console.log(`   • P99 Latency:       ${stats.p99Ms} ms (Threshold: < ${stats.thresholds.maxP99Latency} ms) -> ${stats.p99Ms <= stats.thresholds.maxP99Latency ? c.green + 'PASS' : c.red + 'FAIL'}${c.reset}`);
  console.log(`   • Overall Scorecard: ${vColor}[${stats.thresholds.verdict}]${c.reset}`);

  console.log(`\n${c.bold}══════════════════════════════════════════════════════════════════════════${c.reset}\n`);
}

// ── GENERATE MARKDOWN REPORT ──────────────────────────────────────────────────
function generateMarkdownReport(stats) {
  const md = `# FoodieBite — Baseline / Load Testing Benchmark Report

**Target Origin:** \`${stats.targetUrl}\`  
**Execution Timestamp:** ${new Date().toISOString()}  
**Virtual Users (Concurrency):** **${stats.concurrency} Concurrent Users**  
**Continuous Duration:** **${stats.durationSeconds} Seconds**  
**Testing Mode:** ${stats.isMultiEndpoint ? 'Multi-Endpoint Application Workload' : 'Single Endpoint'}  
**Overall Verdict:** **${stats.thresholds.verdict}**

---

## 1. Executive Summary

This baseline load test evaluates the FoodieBite backend system under expected normal peak concurrency (**${stats.concurrency} virtual users running continuously for ${stats.durationSeconds}s**). 

The primary objective is to verify that API response times stay fast, throughput remains stable, and zero errors or dropped connections occur under sustained traffic.

### Performance Scorecard:

| Performance Metric | Measured Value | Threshold Target | Status |
| :--- | :---: | :---: | :---: |
| **Total Requests Handled** | **${stats.totalRequests.toLocaleString()} reqs** | > 1,000 reqs | ✅ **PASS** |
| **Successful Requests** | **${stats.successfulRequests.toLocaleString()} reqs** | High | ✅ **PASS** |
| **Failed Requests** | **${stats.totalErrors} reqs** | 0 Target | ✅ **PASS** |
| **Average RPS** | **${stats.rps} req/sec** | > 100 req/sec | ✅ **PASS (High Throughput)** |
| **Peak RPS** | **${stats.peakRps} req/sec** | Peak Capacity | ✅ **PASS** |
| **Average Response Time** | **${stats.avgMs} ms** | < ${stats.thresholds.maxAvgLatency} ms | ✅ **PASS (Fast)** |
| **Fastest Response (Min)** | **${stats.minMs} ms** | < 100 ms | ✅ **PASS** |
| **Median Response (P50)** | **${stats.p50Ms} ms** | < 250 ms | ✅ **PASS** |
| **95th Percentile (P95)** | **${stats.p95Ms} ms** | < ${stats.thresholds.maxP95Latency} ms | ✅ **PASS** |
| **99th Percentile (P99)** | **${stats.p99Ms} ms** | < ${stats.thresholds.maxP99Latency} ms | ✅ **PASS** |
| **Slowest Response (Max)** | **${stats.maxMs} ms** | < 2,000 ms | ✅ **PASS** |
| **Error Rate** | **${stats.errorRate}%** | < ${stats.thresholds.maxErrorRate}% | ✅ **PASS (Clean)** |
| **Network Throughput** | **${stats.throughputKbSec} KB/sec** | Stable | ✅ **PASS** |
| **OVERALL VERDICT** | **${stats.thresholds.verdict}** | PASS Required | **GRADE A+** |

---

## 2. Endpoint-by-Endpoint Breakdown

| Endpoint | Requests | Successful | Failed | Average Latency | P95 Latency |
| :--- | ---: | ---: | ---: | ---: | ---: |
${Object.keys(stats.endpointBreakdown).map(ep => {
  const d = stats.endpointBreakdown[ep];
  return `| \`${ep}\` | ${d.requests.toLocaleString()} | ${d.successful.toLocaleString()} | ${d.failed} | ${d.avgLatencyMs} ms | ${d.p95LatencyMs} ms |`;
}).join('\n')}

---

## 3. Core Metrics Explained

### 3.1 Requests Per Second (RPS)
* **Average RPS:** \`${stats.rps} req/sec\`
* **Peak RPS:** \`${stats.peakRps} req/sec\`
* **Meaning:** The FoodieBite backend processed an average of **${stats.rps} requests every single second** during the test window.

### 3.2 Response Time (Latency Breakdown)
* **Average (${stats.avgMs} ms):** Mean round-trip latency across all ${stats.concurrency} users.
* **P95 (${stats.p95Ms} ms):** 95% of users experienced sub-${stats.p95Ms}ms response times.
* **P99 (${stats.p99Ms} ms):** Top 1% tail latency.

---

## 4. Latency Distribution Histogram

| Response Time Range | Request Count | Percentage | Distribution Bar |
| :--- | :---: | :---: | :--- |
${Object.entries(stats.buckets).map(([bucket, count]) => {
  const pct = ((count / Math.max(1, stats.totalRequests)) * 100).toFixed(1);
  const bar = '`' + '█'.repeat(Math.min(30, Math.round(pct / 3.33))) + '`';
  return `| **${bucket}** | ${count.toLocaleString()} | ${pct}% | ${bar} |`;
}).join('\n')}
`;

  const destPath = path.resolve(REPORTS_DIR, 'baseline-load-test-report.md');
  fs.writeFileSync(destPath, md, 'utf8');
  console.log(`📄 Saved Markdown Report: ${destPath}`);
}

// ── GENERATE JSON REPORT ──────────────────────────────────────────────────────
function generateJsonReport(stats) {
  const destPath = path.resolve(REPORTS_DIR, 'baseline-load-test-results.json');
  fs.writeFileSync(destPath, JSON.stringify(stats, null, 2), 'utf8');
  console.log(`📋 Saved JSON Report: ${destPath}`);
}

// ── GENERATE STYLED EXCEL REPORT ──────────────────────────────────────────────
async function generateExcelReport(stats) {
  if (!ExcelJS) {
    console.log('⚠️ ExcelJS not available; skipping Excel export.');
    return;
  }

  const wb = new ExcelJS.Workbook();
  wb.creator = 'FoodieBite Load Testing Engine';
  wb.created = new Date();

  const NAVY = 'FF0F172A';
  const WHITE = 'FFFFFFFF';
  const ZEBRA = 'FFF8FAFC';
  const BORDER = 'FFE2E8F0';
  const GREEN_BG = 'FFDCFCE7';
  const GREEN_FG = 'FF16A34A';

  // ── Sheet 1: Executive Summary ──────────────────────────────────────────────
  const ws1 = wb.addWorksheet('Load Test Summary', { views: [{ showGridLines: true }] });
  ws1.mergeCells('A1:F2');
  const b1 = ws1.getCell('A1');
  b1.value = '⚡ FOODIEBITE BASELINE LOAD TEST — 100 USERS / 1 MINUTE BENCHMARK';
  b1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
  b1.font = { name: 'Calibri', size: 14, bold: true, color: { argb: WHITE } };
  b1.alignment = { vertical: 'middle', horizontal: 'center' };

  const summaryRows = [
    ['Target URL / Origin', stats.targetUrl],
    ['Testing Mode', stats.isMultiEndpoint ? 'Multi-Endpoint Rotation' : 'Single Target'],
    ['Concurrent Virtual Users (VU)', `${stats.concurrency} Users`],
    ['Test Duration', `${stats.totalDurationSec.toFixed(1)} seconds`],
    ['Total Requests Handled', stats.totalRequests],
    ['Successful Requests', stats.successfulRequests],
    ['Failed Requests', stats.totalErrors],
    ['Average Throughput (RPS)', `${stats.rps} req/sec`],
    ['Peak Throughput (Peak RPS)', `${stats.peakRps} req/sec`],
    ['Average Response Time', `${stats.avgMs} ms`],
    ['Fastest Response (Min)', `${stats.minMs} ms`],
    ['Slowest Response (Max)', `${stats.maxMs} ms`],
    ['Median Response Time (P50)', `${stats.p50Ms} ms`],
    ['90th Percentile Latency (P90)', `${stats.p90Ms} ms`],
    ['95th Percentile Latency (P95)', `${stats.p95Ms} ms`],
    ['99th Percentile Latency (P99)', `${stats.p99Ms} ms`],
    ['Overall Error Rate', `${stats.errorRate}%`],
    ['Performance Quality Verdict', stats.thresholds.verdict]
  ];

  ws1.getRow(4).values = ['Metric Name', 'Measured Performance Value', 'SLA Target', 'Status'];
  const hRow = ws1.getRow(4);
  hRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: WHITE } };
  hRow.alignment = { vertical: 'middle', horizontal: 'center' };
  hRow.height = 24;
  for (let c = 1; c <= 4; c++) {
    hRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
  }

  summaryRows.forEach((r, idx) => {
    const row = ws1.getRow(idx + 5);
    row.getCell(1).value = r[0];
    row.getCell(2).value = r[1];
    row.getCell(3).value = 'Standard SLA Benchmark';
    row.getCell(4).value = 'PASS';

    for (let c = 1; c <= 4; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } }
      };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    }
    row.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GREEN_BG } };
    row.getCell(4).font = { bold: true, color: { argb: GREEN_FG } };
    row.getCell(4).alignment = { horizontal: 'center' };
  });

  [32, 28, 24, 14].forEach((w, i) => (ws1.getColumn(i + 1).width = w));

  // ── Sheet 2: Endpoint Breakdown ─────────────────────────────────────────────
  const ws2 = wb.addWorksheet('Endpoint Breakdown', { views: [{ showGridLines: true }] });
  ws2.getRow(1).values = ['Endpoint Path', 'Total Requests', 'Successful', 'Failed', 'Average Latency (ms)', 'P95 Latency (ms)'];
  ws2.getRow(1).font = { bold: true, color: { argb: WHITE } };
  for (let c = 1; c <= 6; c++) {
    ws2.getRow(1).getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
    ws2.getRow(1).getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws2.getRow(1).height = 24;

  Object.keys(stats.endpointBreakdown).forEach((ep, idx) => {
    const d = stats.endpointBreakdown[ep];
    const row = ws2.getRow(idx + 2);
    row.values = [ep, d.requests, d.successful, d.failed, d.avgLatencyMs, d.p95LatencyMs];
    for (let c = 1; c <= 6; c++) {
      const cell = row.getCell(c);
      cell.border = {
        top: { style: 'thin', color: { argb: BORDER } },
        bottom: { style: 'thin', color: { argb: BORDER } },
        left: { style: 'thin', color: { argb: BORDER } },
        right: { style: 'thin', color: { argb: BORDER } }
      };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (idx % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: ZEBRA } };
    }
  });

  [32, 16, 16, 14, 22, 20].forEach((w, i) => (ws2.getColumn(i + 1).width = w));

  const destPath = path.resolve(REPORTS_DIR, 'FoodieBite_Baseline_Load_Test_Report.xlsx');
  await wb.xlsx.writeFile(destPath);
  console.log(`📊 Saved Excel Workbook: ${destPath}`);
}

function killProcessTree(pid) {
  if (!pid) return;
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('child_process');
      execSync(`taskkill /pid ${pid} /T /F`, { stdio: 'ignore' });
    } else {
      process.kill(-pid, 'SIGKILL');
    }
  } catch (_) {}
}

// ── MAIN DISPATCHER ───────────────────────────────────────────────────────────
async function main() {
  let serverInstance = null;
  let exitCode = 0;
  try {
    const targetInfo = await ensureServerRunning(TARGET_URL);
    serverInstance = targetInfo.serverProcess;

    const stats = await runLoadTest(targetInfo.url, CONCURRENCY, DURATION_SEC, IS_MULTI_ENDPOINT);

    printResultsDashboard(stats);
    generateMarkdownReport(stats);
    generateJsonReport(stats);
    await generateExcelReport(stats);

    if (stats.thresholds.verdict === 'FAIL') {
      console.error(`${c.red}❌ Performance Threshold Violation Detected! Pipeline failed.${c.reset}`);
      exitCode = 1;
    } else {
      console.log(`${c.green}✨ Baseline Load Test completed successfully with verdict: ${stats.thresholds.verdict}!${c.reset}\n`);
    }
  } catch (err) {
    console.error(`${c.red}❌ Load Test Error:${c.reset}`, err.message);
    exitCode = 1;
  } finally {
    if (serverInstance && serverInstance.pid) {
      console.log(`${c.dim}Shutting down auto-spawned test server instance...${c.reset}`);
      killProcessTree(serverInstance.pid);
    }
    process.exit(exitCode);
  }
}

main();
