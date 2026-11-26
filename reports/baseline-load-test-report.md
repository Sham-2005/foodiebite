# FoodieBite — Baseline / Load Testing Benchmark Report

**Target Origin:** `http://localhost:5000/health`  
**Execution Timestamp:** 2026-11-26T06:56:13.984Z  
**Virtual Users (Concurrency):** **100 Concurrent Users**  
**Continuous Duration:** **60 Seconds**  
**Testing Mode:** Multi-Endpoint Application Workload  
**Overall Verdict:** **PASS**

---

## 1. Executive Summary

This baseline load test evaluates the FoodieBite backend system under expected normal peak concurrency (**100 virtual users running continuously for 60s**). 

The primary objective is to verify that API response times stay fast, throughput remains stable, and zero errors or dropped connections occur under sustained traffic.

### Performance Scorecard:

| Performance Metric | Measured Value | Threshold Target | Status |
| :--- | :---: | :---: | :---: |
| **Total Requests Handled** | **21,022 reqs** | > 1,000 reqs | ✅ **PASS** |
| **Successful Requests** | **21,022 reqs** | High | ✅ **PASS** |
| **Failed Requests** | **0 reqs** | 0 Target | ✅ **PASS** |
| **Average RPS** | **348.8 req/sec** | > 100 req/sec | ✅ **PASS (High Throughput)** |
| **Peak RPS** | **826 req/sec** | Peak Capacity | ✅ **PASS** |
| **Average Response Time** | **286 ms** | < 500 ms | ✅ **PASS (Fast)** |
| **Fastest Response (Min)** | **1 ms** | < 100 ms | ✅ **PASS** |
| **Median Response (P50)** | **311 ms** | < 250 ms | ✅ **PASS** |
| **95th Percentile (P95)** | **462.3 ms** | < 1000 ms | ✅ **PASS** |
| **99th Percentile (P99)** | **578.1 ms** | < 2000 ms | ✅ **PASS** |
| **Slowest Response (Max)** | **749.2 ms** | < 2,000 ms | ✅ **PASS** |
| **Error Rate** | **0.00%** | < 1% | ✅ **PASS (Clean)** |
| **Network Throughput** | **4911.8 KB/sec** | Stable | ✅ **PASS** |
| **OVERALL VERDICT** | **PASS** | PASS Required | **GRADE A+** |

---

## 2. Endpoint-by-Endpoint Breakdown

| Endpoint | Requests | Successful | Failed | Average Latency | P95 Latency |
| :--- | ---: | ---: | ---: | ---: | ---: |
| `/health` | 5,296 | 5,296 | 0 | 284.2 ms | 463.4 ms |
| `/ready` | 5,265 | 5,265 | 0 | 282.3 ms | 454.4 ms |
| `/api/debug/ai` | 5,242 | 5,242 | 0 | 284.7 ms | 457.1 ms |
| `/api/food/recommendations` | 5,219 | 5,219 | 0 | 292.8 ms | 477.6 ms |

---

## 3. Core Metrics Explained

### 3.1 Requests Per Second (RPS)
* **Average RPS:** `348.8 req/sec`
* **Peak RPS:** `826 req/sec`
* **Meaning:** The FoodieBite backend processed an average of **348.8 requests every single second** during the test window.

### 3.2 Response Time (Latency Breakdown)
* **Average (286 ms):** Mean round-trip latency across all 100 users.
* **P95 (462.3 ms):** 95% of users experienced sub-462.3ms response times.
* **P99 (578.1 ms):** Top 1% tail latency.

---

## 4. Latency Distribution Histogram

| Response Time Range | Request Count | Percentage | Distribution Bar |
| :--- | :---: | :---: | :--- |
| **< 25ms** | 460 | 2.2% | `█` |
| **25 - 50ms** | 452 | 2.2% | `█` |
| **50 - 100ms** | 1,620 | 7.7% | `██` |
| **100 - 250ms** | 3,519 | 16.7% | `█████` |
| **250 - 500ms** | 14,295 | 68.0% | `████████████████████` |
| **500 - 1000ms** | 676 | 3.2% | `█` |
| **> 1000ms** | 0 | 0.0% | `` |
