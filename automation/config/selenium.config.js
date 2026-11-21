/**
 * Enterprise Selenium Configuration for Live GitHub Pages E2E Testing
 *
 * MANDATORY POLICY:
 * - Never run Selenium against localhost.
 * - Never run Selenium against local development servers.
 * - Must run against LIVE GitHub Pages deployment URL.
 * - Configurable via BASE_URL environment variable.
 */
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const resolveBaseUrl = () => {
  let url = process.env.BASE_URL || 'https://sham-2005.github.io/foodiebite/';
  url = url.trim();
  if (!url.endsWith('/')) {
    url += '/';
  }

  // Strict enforcement: Disallow localhost/local servers
  if (url.includes('localhost') || url.includes('127.0.0.1') || url.includes('0.0.0.0')) {
    throw new Error(
      `[SECURITY & QUALITY GATE VIOLATION] Target URL (${url}) is a local server. ` +
      `MANDATORY REQUIREMENT: Selenium must NEVER run against localhost or local dev servers. ` +
      `Selenium must always execute against the LIVE GitHub Pages deployment! ` +
      `Set BASE_URL=https://<github-username>.github.io/<repository-name>/`
    );
  }

  return url;
};

const projectRoot = path.resolve(__dirname, '../..');
const resultsRoot = path.resolve(projectRoot, 'Test Results');

module.exports = {
  baseUrl: resolveBaseUrl(),
  timeouts: {
    implicitWaitMs: 5000,
    pageLoadTimeoutMs: 30000,
    scriptTimeoutMs: 20000,
    explicitTimeoutMs: 15000
  },
  chromeOptions: [
    '--headless=new',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--disable-extensions',
    '--ignore-certificate-errors',
    '--allow-running-insecure-content',
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FoodieBite-Live-E2E'
  ],
  paths: {
    projectRoot: projectRoot,
    resultsRoot: resultsRoot,
    excelDir: path.join(resultsRoot, 'Excel'),
    htmlDir: path.join(resultsRoot, 'HTML'),
    jsonDir: path.join(resultsRoot, 'JSON'),
    screenshotsDir: path.join(resultsRoot, 'Screenshots'),
    logsDir: path.join(resultsRoot, 'Logs'),
    summaryDir: path.join(resultsRoot, 'Summary'),
    pagesDir: path.join(projectRoot, 'reports')
  },
  buildMetadata: {
    appName: 'FoodieBite Web Application',
    version: '1.0.0',
    deploymentTarget: 'GitHub Pages',
    buildNumber: process.env.GITHUB_RUN_NUMBER || '42',
    gitCommit: (process.env.GITHUB_SHA || 'd3a9b1c').substring(0, 7),
    branch: process.env.GITHUB_REF_NAME || 'main'
  }
};
