// ─────────────────────────────────────────────────────────────
//  backend/src/services/ollamaService.js
//  FoodieBite Local Ollama AI Integration Service
//  Connects to locally running Ollama (default: http://localhost:11434)
//  Zero Cloud AI & Zero External API Dependencies
// ─────────────────────────────────────────────────────────────

'use strict';

const http = require('http');
const https = require('https');

const DEFAULT_OLLAMA_HOST = 'http://localhost:11434';
const DEFAULT_TIMEOUT_MS = 30000;
const PROBE_TIMEOUT_MS = 3500;

class OllamaService {
  constructor() {
    this.baseUrl = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_HOST).replace(/\/+$/, '');
    this.selectedModel = process.env.OLLAMA_MODEL || 'qwen2.5:0.5b';
    this.timeoutMs = parseInt(process.env.OLLAMA_TIMEOUT_MS, 10) || DEFAULT_TIMEOUT_MS;
    this.lastKnownStatus = {
      status: 'Ollama Offline',
      connected: false,
      modelAvailable: false,
      installedModels: [],
      checkedAt: null,
      error: null
    };
  }

  /**
   * Get current base URL
   */
  getBaseUrl() {
    return (process.env.OLLAMA_BASE_URL || this.baseUrl || DEFAULT_OLLAMA_HOST).replace(/\/+$/, '');
  }

  /**
   * Set base URL dynamically
   */
  setBaseUrl(url) {
    if (url && typeof url === 'string') {
      this.baseUrl = url.replace(/\/+$/, '');
    }
  }

  /**
   * Get currently selected model
   */
  getSelectedModel() {
    return this.selectedModel;
  }

  /**
   * Set currently selected model
   */
  setSelectedModel(modelName) {
    if (modelName && typeof modelName === 'string') {
      this.selectedModel = modelName.trim();
      return true;
    }
    return false;
  }

  /**
   * Performs an HTTP request with timeout to local Ollama API
   */
  _request({ path, method = 'GET', body = null, timeout = this.timeoutMs }) {
    return new Promise((resolve, reject) => {
      try {
        const fullUrl = new URL(path, this.getBaseUrl());
        const isHttps = fullUrl.protocol === 'https:';
        const client = isHttps ? https : http;

        const headers = {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        const postData = body ? JSON.stringify(body) : null;
        if (postData) {
          headers['Content-Length'] = Buffer.byteLength(postData);
        }

        const options = {
          hostname: fullUrl.hostname,
          port: fullUrl.port || (isHttps ? 443 : 80),
          path: fullUrl.pathname + fullUrl.search,
          method,
          headers,
          timeout
        };

        const req = client.request(options, (res) => {
          let rawData = '';
          res.setEncoding('utf8');

          res.on('data', (chunk) => {
            rawData += chunk;
          });

          res.on('end', () => {
            try {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const parsed = rawData ? JSON.parse(rawData) : {};
                resolve({ statusCode: res.statusCode, data: parsed });
              } else {
                let errMessage = `Ollama HTTP Error ${res.statusCode}`;
                try {
                  const errJson = JSON.parse(rawData);
                  if (errJson.error) errMessage = errJson.error;
                } catch (_) {
                  if (rawData) errMessage = rawData.substring(0, 200);
                }
                const err = new Error(errMessage);
                err.statusCode = res.statusCode;
                reject(err);
              }
            } catch (parseErr) {
              reject(new Error(`Failed to parse Ollama response: ${parseErr.message}`));
            }
          });
        });

        req.on('timeout', () => {
          req.destroy();
          const err = new Error(`Ollama request timed out after ${timeout}ms`);
          err.code = 'ETIMEDOUT';
          reject(err);
        });

        req.on('error', (err) => {
          reject(err);
        });

        if (postData) {
          req.write(postData);
        }
        req.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  /**
   * Health and connectivity check to local Ollama API
   * Retrieves installed models and determines status:
   * - 'Ollama Connected'
   * - 'Model Available'
   * - 'Model Not Installed'
   * - 'Ollama Offline'
   */
  async checkConnection(timeout = PROBE_TIMEOUT_MS) {
    try {
      const res = await this._request({
        path: '/api/tags',
        method: 'GET',
        timeout
      });

      const models = Array.isArray(res.data?.models) ? res.data.models : [];
      const modelNames = models.map(m => m.name || m.model || '');
      
      // Check if selected model or base model name is installed
      const selected = (this.selectedModel || '').toLowerCase();
      const selectedBase = selected.split(':')[0];

      const isModelInstalled = modelNames.some(name => {
        const lower = name.toLowerCase();
        return lower === selected || lower.startsWith(selectedBase + ':') || lower === selectedBase;
      });

      // Auto-fallback: if selected model not found but other models are installed, note available models
      let statusStr = 'Ollama Connected';
      if (models.length === 0) {
        statusStr = 'Model Not Installed';
      } else if (isModelInstalled) {
        statusStr = 'Model Available';
      } else {
        statusStr = 'Model Not Installed';
      }

      this.lastKnownStatus = {
        status: statusStr,
        connected: true,
        modelAvailable: isModelInstalled,
        selectedModel: this.selectedModel,
        installedModels: models,
        modelNames,
        host: this.getBaseUrl(),
        checkedAt: new Date().toISOString(),
        error: null
      };

      return this.lastKnownStatus;
    } catch (err) {
      let statusStr = 'Ollama Offline';
      if (err.code === 'ECONNREFUSED') {
        statusStr = 'Ollama Offline';
      } else if (err.code === 'ETIMEDOUT') {
        statusStr = 'AI Service Unavailable';
      }

      this.lastKnownStatus = {
        status: statusStr,
        connected: false,
        modelAvailable: false,
        selectedModel: this.selectedModel,
        installedModels: [],
        modelNames: [],
        host: this.getBaseUrl(),
        checkedAt: new Date().toISOString(),
        error: err.message
      };

      return this.lastKnownStatus;
    }
  }

  /**
   * Retrieve list of installed models from local Ollama
   */
  async getInstalledModels() {
    try {
      const res = await this._request({ path: '/api/tags', method: 'GET', timeout: PROBE_TIMEOUT_MS });
      return Array.isArray(res.data?.models) ? res.data.models : [];
    } catch (err) {
      console.warn('⚠️ [OllamaService] Could not retrieve installed models:', err.message);
      return [];
    }
  }

  /**
   * Pulls a model into local Ollama via /api/pull
   */
  async pullModel(modelName) {
    if (!modelName || typeof modelName !== 'string') {
      throw new Error('Valid model name is required to pull (e.g., qwen2.5:0.5b)');
    }
    const cleanName = modelName.trim();
    return await this._request({
      path: '/api/pull',
      method: 'POST',
      body: { name: cleanName, stream: false },
      timeout: 180000 // 3 minutes timeout for pulling
    });
  }

  /**
   * Dispatches chat completion to local Ollama model
   * Uses POST /api/chat with conversation history, system prompt, and optional JSON format.
   *
   * @param {Object} params
   * @param {string} params.model - Optional model override
   * @param {Array<Object>} params.messages - [{ role: 'system'|'user'|'assistant', content: string }]
   * @param {string} params.system - System prompt (injected as first message if not present)
   * @param {boolean} params.jsonMode - Whether to request structured JSON output from Ollama
   * @param {Object} params.options - Model options (temperature, num_predict, etc.)
   * @param {number} params.timeout - Custom timeout in ms
   * @returns {Promise<Object>}
   */
  async chat({
    model,
    messages = [],
    system = null,
    jsonMode = false,
    options = {},
    timeout = this.timeoutMs
  }) {
    const targetModel = model || this.selectedModel;
    const formattedMessages = [];

    // Inject system prompt if provided
    if (system && typeof system === 'string' && system.trim()) {
      formattedMessages.push({
        role: 'system',
        content: system.trim()
      });
    }

    // Append conversation messages
    if (Array.isArray(messages)) {
      for (const m of messages) {
        if (m && typeof m.content === 'string') {
          const role = (m.role === 'coach' || m.role === 'bot') ? 'assistant' : (m.role || 'user');
          formattedMessages.push({
            role: role === 'assistant' ? 'assistant' : (role === 'system' ? 'system' : 'user'),
            content: m.content
          });
        }
      }
    }

    const payload = {
      model: targetModel,
      messages: formattedMessages,
      stream: false,
      options: {
        temperature: typeof options.temperature === 'number' ? options.temperature : 0.4,
        top_p: typeof options.top_p === 'number' ? options.top_p : 0.9,
        num_predict: typeof options.num_predict === 'number' ? options.num_predict : 1024,
        ...options
      }
    };

    if (jsonMode) {
      payload.format = 'json';
    }

    const t0 = Date.now();
    try {
      const res = await this._request({
        path: '/api/chat',
        method: 'POST',
        body: payload,
        timeout
      });

      const latencyMs = Date.now() - t0;
      const data = res.data || {};
      const assistantMessage = data.message || {};
      const content = (assistantMessage.content || '').trim();

      return {
        success: true,
        source: 'ollama',
        model: data.model || targetModel,
        reply: content,
        content,
        latencyMs,
        totalDuration: data.total_duration,
        promptEvalCount: data.prompt_eval_count,
        evalCount: data.eval_count,
        createdAt: data.created_at || new Date().toISOString()
      };
    } catch (err) {
      const latencyMs = Date.now() - t0;
      console.warn(`⚠️ [OllamaService] Chat completion error with model "${targetModel}" (${latencyMs}ms):`, err.message);

      // Distinguish error categories
      let errorCode = 'OLLAMA_ERROR';
      if (err.code === 'ECONNREFUSED') errorCode = 'OLLAMA_OFFLINE';
      if (err.code === 'ETIMEDOUT') errorCode = 'OLLAMA_TIMEOUT';
      if (err.statusCode === 404) errorCode = 'MODEL_NOT_FOUND';

      const errorObj = new Error(err.message || 'Ollama chat completion failed');
      errorObj.code = errorCode;
      errorObj.statusCode = err.statusCode || 500;
      errorObj.latencyMs = latencyMs;
      errorObj.model = targetModel;
      throw errorObj;
    }
  }
}

// Export singleton instance + class
const ollamaService = new OllamaService();
module.exports = ollamaService;
module.exports.OllamaService = OllamaService;
