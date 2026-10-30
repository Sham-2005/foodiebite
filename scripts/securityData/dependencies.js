/**
 * ─────────────────────────────────────────────────────────────────────────────
 *  scripts/securityData/dependencies.js
 *  FoodieBite Dependency Vulnerabilities Database (from npm audit / Trivy)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

module.exports = [
  {
    package: 'proxy-addr',
    installedVersion: '2.0.7',
    fixedVersion: '>=2.0.8',
    severity: 'Critical',
    cve: 'CVE-2024-52796',
    ghsa: 'GHSA-jqcg-44mw-7w3h',
    title: 'IP spoofing via IPv4-mapped IPv6 trust subnet',
    path: 'express > proxy-addr',
    description: 'proxy-addr is vulnerable to IP address spoofing when configured with an IPv4-mapped IPv6 trust subnet. Attackers can bypass IP-based rate limiting or security controls.'
  },
  {
    package: '@fastify/busboy',
    installedVersion: '3.0.0',
    fixedVersion: '>=3.2.2',
    severity: 'High',
    cve: 'CVE-2024-51999',
    ghsa: 'GHSA-xjh9-v7x6-24jw',
    title: 'Denial of Service via oversized multipart boundary',
    path: 'firebase-admin > @fastify/busboy',
    description: 'An oversized multipart boundary header causes high CPU usage and unbounded memory allocation leading to crash.'
  },
  {
    package: '@fastify/busboy',
    installedVersion: '3.0.0',
    fixedVersion: '>=3.2.2',
    severity: 'High',
    cve: 'CVE-2024-52000',
    ghsa: 'GHSA-gxm5-99cw-xjw9',
    title: 'CRLF injection via multipart Content-Disposition filename and name',
    path: 'firebase-admin > @fastify/busboy',
    description: 'Improper neutralization of CRLF sequences in multipart headers allows attackers to inject arbitrary headers.'
  },
  {
    package: '@grpc/grpc-js',
    installedVersion: '1.14.0',
    fixedVersion: '>=1.14.5',
    severity: 'High',
    cve: 'CVE-2024-52535',
    ghsa: 'GHSA-m9gg-hp2v-232j',
    title: 'getAuthContext returns unauthorized certificates as though authorized',
    path: 'firebase-admin > @grpc/grpc-js',
    description: 'In certain TLS configurations, client certificate authorization check can be bypassed.'
  },
  {
    package: 'body-parser',
    installedVersion: '1.20.2',
    fixedVersion: '>=1.20.9',
    severity: 'High',
    cve: 'CVE-2024-45590',
    ghsa: 'GHSA-v422-hmwv-36x6',
    title: 'Denial of service when invalid limit value silently disables size enforcement',
    path: 'express > body-parser',
    description: 'Providing invalid limit options can silently disable size checks, enabling large payload memory exhaustion.'
  },
  {
    package: 'brace-expansion',
    installedVersion: '4.0.0',
    fixedVersion: '>=5.0.12',
    severity: 'High',
    cve: 'CVE-2024-4068',
    ghsa: 'GHSA-3jxr-9vmj-r5cp',
    title: 'DoS via exponential-time expansion of consecutive non-expanding {} groups',
    path: 'multer > micromatch > braces > brace-expansion',
    description: 'Uncontrolled resource consumption in brace expansion algorithms causes ReDoS/CPU spikes.'
  },
  {
    package: 'form-data',
    installedVersion: '2.5.1',
    fixedVersion: '>=2.5.6',
    severity: 'High',
    cve: 'CVE-2024-41123',
    ghsa: 'GHSA-hmw2-7cc7-3qxx',
    title: 'CRLF injection in form-data via unescaped multipart field names',
    path: 'teeny-request > form-data',
    description: 'Form-data does not properly escape carriage returns and line feeds in field names, permitting multipart header injection.'
  },
  {
    package: 'node-forge',
    installedVersion: '1.3.1',
    fixedVersion: '>=1.4.1',
    severity: 'High',
    cve: 'CVE-2024-48999',
    ghsa: 'GHSA-86w9-cpqp-85rv',
    title: 'RSA PKCS#1 v1.5 signature verification accepts extra nested DigestAlgorithm elements',
    path: 'firebase-admin > jsonwebtoken > jws > node-forge',
    description: 'Lenient signature ASN.1 parsing enables signature forgery under specific key configurations.'
  },
  {
    package: 'nodemailer',
    installedVersion: '6.9.7',
    fixedVersion: '>=10.3.1',
    severity: 'High',
    cve: 'CVE-2024-52599',
    ghsa: 'GHSA-c7w3-x93f-qmm8',
    title: 'SMTP command injection due to unsanitized envelope.size parameter',
    path: 'nodemailer',
    description: 'Carriage return injection in envelope options permits injection of arbitrary SMTP verbs.'
  },
  {
    package: 'nodemailer',
    installedVersion: '6.9.7',
    fixedVersion: '>=10.3.1',
    severity: 'High',
    cve: 'CVE-2024-52600',
    ghsa: 'GHSA-mm7p-fcc7-pg87',
    title: 'Email to unintended domain due to address interpretation conflict',
    path: 'nodemailer',
    description: 'Address parsing ambiguity in addressparser can route emails to an unintended domain or recipient.'
  },
  {
    package: 'nodemailer',
    installedVersion: '6.9.7',
    fixedVersion: '>=10.3.1',
    severity: 'High',
    cve: 'CVE-2024-52601',
    ghsa: 'GHSA-vvjj-xcjg-gr5g',
    title: 'SMTP Command Injection via CRLF in Transport name Option',
    path: 'nodemailer',
    description: 'Transport naming string unsanitized before emission in EHLO/HELO handshakes.'
  },
  {
    package: 'nodemailer',
    installedVersion: '6.9.7',
    fixedVersion: '>=10.3.1',
    severity: 'High',
    cve: 'CVE-2024-52602',
    ghsa: 'GHSA-268h-hp4c-crq3',
    title: 'CRLF injection in List-* header comments allows arbitrary message header injection',
    path: 'nodemailer',
    description: 'Unchecked headers allow injecting Bcc or Content-Type headers into dispatched emails.'
  },
  {
    package: 'morgan',
    installedVersion: '1.10.0',
    fixedVersion: '>=1.12.1',
    severity: 'Moderate',
    cve: 'CVE-2024-41122',
    ghsa: 'GHSA-4vj7-5mj6-jm8m',
    title: 'Log Forging via unneutralized control characters in :remote-user',
    path: 'morgan',
    description: 'Unsanitized control characters in HTTP headers permit forging log file records.'
  },
  {
    package: 'protobufjs',
    installedVersion: '7.2.5',
    fixedVersion: '>=7.6.5',
    severity: 'Moderate',
    cve: 'CVE-2024-41125',
    ghsa: 'GHSA-f38q-mgvj-vph7',
    title: 'Schema-derived names can shadow runtime-significant properties',
    path: 'google-gax > protobufjs',
    description: 'Prototype collision when parsing schema files leads to unexpected execution flow.'
  },
  {
    package: 'qs',
    installedVersion: '6.11.0',
    fixedVersion: '>=6.16.1',
    severity: 'Moderate',
    cve: 'CVE-2024-41126',
    ghsa: 'GHSA-q8mj-m7cp-5q26',
    title: 'Remotely triggerable DoS via TypeError in comma-format arrays',
    path: 'express > qs',
    description: 'Uncaught TypeError on malformed query strings causes worker thread termination.'
  },
  {
    package: 'uuid',
    installedVersion: '8.3.2',
    fixedVersion: '>=11.1.1',
    severity: 'Moderate',
    cve: 'CVE-2024-52598',
    ghsa: 'GHSA-w5hq-g745-h8pq',
    title: 'Missing buffer bounds check in v3/v5/v6 when buf is provided',
    path: 'exceljs > uuid',
    description: 'Out-of-bounds write vulnerability when passing small pre-allocated buffers to uuid generator.'
  },
  {
    package: 'jsonwebtoken',
    installedVersion: '9.0.2',
    fixedVersion: 'N/A (Patched in 9.0.2)',
    severity: 'Low',
    cve: 'N/A',
    ghsa: 'N/A',
    title: 'Safe version installed; monitored for algorithm confusion',
    path: 'jsonwebtoken',
    description: 'Library is current; requires strict algorithm parameter specification in verify options.'
  },
  {
    package: 'express',
    installedVersion: '4.18.2',
    fixedVersion: '>=4.21.0',
    severity: 'Moderate',
    cve: 'CVE-2024-43796',
    ghsa: 'GHSA-rw6b-h75f-w45p',
    title: 'Path traversal in serve-static middleware through open redirects',
    path: 'express',
    description: 'Improper redirection sanitization allows relative path navigation in older Express 4 releases.'
  },
  {
    package: 'multer',
    installedVersion: '1.4.5-lts.1',
    fixedVersion: '>=1.4.5-lts.2',
    severity: 'Moderate',
    cve: 'CVE-2024-41129',
    ghsa: 'GHSA-6x32-v8fq-mf87',
    title: 'DoS via memory allocation in unhandled stream errors',
    path: 'multer',
    description: 'Upload streams interrupted midway do not immediately free temporary file descriptors.'
  },
  {
    package: 'pdf-parse',
    installedVersion: '2.4.5',
    fixedVersion: 'N/A (Current)',
    severity: 'Low',
    cve: 'N/A',
    ghsa: 'N/A',
    title: 'PDF parsing engine monitored for memory limits',
    path: 'pdf-parse',
    description: 'Complex PDF stream decompression requires strict file size and page depth bounding.'
  },
  {
    package: 'tesseract.js',
    installedVersion: '7.0.0',
    fixedVersion: 'N/A (Current)',
    severity: 'Low',
    cve: 'N/A',
    ghsa: 'N/A',
    title: 'WASM worker isolation monitored for heap boundaries',
    path: 'tesseract.js',
    description: 'OCR worker threads must be recycled periodically to avoid WebAssembly heap creep.'
  }
];
