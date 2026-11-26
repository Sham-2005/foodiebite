/**
 * tests/shared/helpers/httpClient.js
 * Resilient HTTP client for API, Integration, and Security test suites
 */
const http = require('http');
const https = require('https');
const url = require('url');

class HttpClient {
  constructor(baseUrl = 'http://127.0.0.1:5000', defaultTimeout = 15000) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
    this.defaultTimeout = defaultTimeout;
    this.headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'FoodieBite-QA-TestSuite/2.0'
    };
  }

  setAuthToken(token) {
    if (token) {
      this.headers['Authorization'] = `Bearer ${token}`;
    } else {
      delete this.headers['Authorization'];
    }
  }

  setAdminKey(key) {
    if (key) {
      this.headers['x-admin-key'] = key;
    } else {
      delete this.headers['x-admin-key'];
    }
  }

  async request(method, endpoint, body = null, customHeaders = {}) {
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
    const parsed = new URL(fullUrl);
    const isHttps = parsed.protocol === 'https:';
    const client = isHttps ? https : http;

    const requestHeaders = {
      ...this.headers,
      ...customHeaders
    };

    let payload = null;
    if (body !== null && typeof body === 'object') {
      payload = JSON.stringify(body);
      requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    } else if (typeof body === 'string') {
      payload = body;
      requestHeaders['Content-Length'] = Buffer.byteLength(payload);
    }

    const startTime = process.hrtime.bigint();

    return new Promise((resolve) => {
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (isHttps ? 443 : 80),
        path: `${parsed.pathname}${parsed.search}`,
        method: method.toUpperCase(),
        headers: requestHeaders,
        timeout: this.defaultTimeout
      };

      const req = client.request(options, (res) => {
        let rawData = '';
        res.on('data', (chunk) => { rawData += chunk; });
        res.on('end', () => {
          const endTime = process.hrtime.bigint();
          const durationMs = Number((endTime - startTime) / 1000000n);

          let parsedData = null;
          try {
            parsedData = JSON.parse(rawData);
          } catch (e) {
            parsedData = rawData;
          }

          resolve({
            status: res.statusCode,
            statusText: res.statusMessage,
            headers: res.headers,
            data: parsedData,
            rawBody: rawData,
            durationMs,
            success: res.statusCode >= 200 && res.statusCode < 300
          });
        });
      });

      req.on('timeout', () => {
        req.destroy();
        const endTime = process.hrtime.bigint();
        resolve({
          status: 408,
          statusText: 'Request Timeout',
          headers: {},
          data: { error: 'Request Timeout' },
          rawBody: '',
          durationMs: Number((endTime - startTime) / 1000000n),
          success: false
        });
      });

      req.on('error', (err) => {
        const endTime = process.hrtime.bigint();
        resolve({
          status: 0,
          statusText: 'Connection Failed',
          headers: {},
          data: { error: err.message },
          rawBody: '',
          durationMs: Number((endTime - startTime) / 1000000n),
          success: false,
          error: err
        });
      });

      if (payload) {
        req.write(payload);
      }
      req.end();
    });
  }

  get(endpoint, headers = {}) {
    return this.request('GET', endpoint, null, headers);
  }

  post(endpoint, body, headers = {}) {
    return this.request('POST', endpoint, body, headers);
  }

  put(endpoint, body, headers = {}) {
    return this.request('PUT', endpoint, body, headers);
  }

  delete(endpoint, headers = {}) {
    return this.request('DELETE', endpoint, null, headers);
  }
}

module.exports = HttpClient;
