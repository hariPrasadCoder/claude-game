// Small shared helpers for the hook scripts. Kept dependency-free.
'use strict';

const http = require('http');
const cfg = require('../config');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    // Hooks always receive JSON on stdin, but guard against ever hanging
    // if invoked interactively without a pipe.
    const timer = setTimeout(() => resolve(data), 2000);
    timer.unref();
    process.stdin.on('data', (chunk) => (data += chunk));
    process.stdin.on('end', () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on('error', () => resolve(data));
  });
}

async function readHookPayload() {
  const raw = await readStdin();
  try {
    return JSON.parse(raw);
  } catch (_) {
    return {};
  }
}

function httpRequest(method, urlPath, body, timeoutMs) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        host: cfg.HOST,
        port: cfg.PORT,
        path: urlPath,
        method,
        timeout: timeoutMs,
        headers: payload
          ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
          : undefined,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (_) {
            resolve({});
          }
        });
      }
    );
    req.on('timeout', () => req.destroy(new Error('request timeout')));
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

module.exports = { readHookPayload, httpRequest };
