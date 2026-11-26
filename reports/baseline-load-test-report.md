# FoodieBite — Baseline / Load Testing Benchmark Report

**Target Origin:** `http://127.0.0.1:5000/health`  
**Execution Timestamp:** 2026-11-26T08:22:38.265Z  
**Virtual Users (Concurrency):** **100 Concurrent Users**  
**Continuous Duration:** **10 Seconds**  
**Testing Mode:** Single Endpoint  
**Overall Verdict:** **PASS**

---

## 1. Executive Summary

This baseline load test evaluates the FoodieBite backend system under expected normal peak concurrency (**100 virtual users running continuously for 10s**). 

The primary objective is to verify that API response times stay fast, throughput remains stable, and zero errors or dropped connections occur under sustained traffic.

### Performance Scorecard:

| Performance Metric | Measured Value | Threshold Target | Status |
| :--- | :---: | :---: | :---: |
| **Total Requests Handled** | **18,392 reqs** | > 1,000 reqs | ✅ **PASS** |
| **Successful Requests** | **18,392 reqs** | High | ✅ **PASS** |
| **Failed Requests** | **0 reqs** | 0 Target | ✅ **PASS** |
| **Average RPS** | **1825.3 req/sec** | > 100 req/sec | ✅ **PASS (High Throughput)** |
| **Peak RPS** | **2744 req/sec** | Peak Capacity | ✅ **PASS** |
| **Average Response Time** | **54.5 ms** | < 500 ms | ✅ **PASS (Fast)** |
| **Fastest Response (Min)** | **0.2 ms** | < 100 ms | ✅ **PASS** |
| **Median Response (P50)** | **52.2 ms** | < 250 ms | ✅ **PASS** |
| **95th Percentile (P95)** | **93.1 ms** | < 1000 ms | ✅ **PASS** |
| **99th Percentile (P99)** | **110.3 ms** | < 2000 ms | ✅ **PASS** |
| **Slowest Response (Max)** | **188.4 ms** | < 2,000 ms | ✅ **PASS** |
| **Error Rate** | **0.00%** | < 1% | ✅ **PASS (Clean)** |
| **Network Throughput** | **274.5 KB/sec** | Stable | ✅ **PASS** |
| **OVERALL VERDICT** | **PASS** | PASS Required | **GRADE A+** |

---

## 2. Endpoint-by-Endpoint Breakdown

| Endpoint | Requests | Successful | Failed | Average Latency | P95 Latency |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `/health` | 18,392 | 18,392 | 0 | 54.5 ms | 93.1 ms |

---

## 3. Core Metrics Explained

### 3.1 Requests Per Second (RPS)
* **Average RPS:** `1825.3 req/sec`
* **Peak RPS:** `2744 req/sec`
* **Meaning:** The FoodieBite backend processed an average of **1825.3 requests every single second** during the test window.

### 3.2 Response Time (Latency Breakdown)
* **Average (54.5 ms):** Mean round-trip latency across all 100 users.
* **P95 (93.1 ms):** 95% of users experienced sub-93.1ms response times.
* **P99 (110.3 ms):** Top 1% tail latency.

---

## 4. Latency Distribution Histogram

| Response Time Range | Request Count | Percentage | Distribution Bar |
| :--- | :---: | :---: | :--- |
| **< 25ms** | 1,872 | 10.2% | `███` |
| **25 - 50ms** | 6,713 | 36.5% | `███████████` |
| **50 - 100ms** | 9,342 | 50.8% | `███████████████` |
| **100 - 250ms** | 465 | 2.5% | `█` |
| **250 - 500ms** | 0 | 0.0% | `` |
| **500 - 1000ms** | 0 | 0.0% | `` |
| **> 1000ms** | 0 | 0.0% | `` |
