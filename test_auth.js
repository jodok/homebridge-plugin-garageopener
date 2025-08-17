#!/usr/bin/env node

/**
 * Test script for verifying HMAC-SHA256 authentication with Raspberry Pi relay module
 * Usage: node test_auth.js <secret> <ip_address> <port> <gpio_pin>
 */

const http = require('http');
const crypto = require('crypto');

// Get command line arguments
const args = process.argv.slice(2);
if (args.length < 4) {
  console.error('Usage: node test_auth.js <secret> <ip_address> <port> <gpio_pin>');
  console.error('Example: node test_auth.js your_secret_here 192.168.1.251 8080 23');
  process.exit(1);
}

const [secret, ipAddress, port, gpioPin] = args;

// Generate HMAC-SHA256 hash
function generateAuthHash(body, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(body)
    .digest('hex');
}

// Test the relay trigger endpoint
function testRelayTrigger() {
  const requestBody = JSON.stringify({
    gpio_pin: parseInt(gpioPin)
  });

  const authHash = generateAuthHash(requestBody, secret);

  console.log(`Testing relay trigger at http://${ipAddress}:${port}/relay/trigger`);
  console.log(`Request body: ${requestBody}`);
  console.log(`Auth hash: ${authHash}`);

  const options = {
    hostname: ipAddress,
    port: port,
    path: '/relay/trigger',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authHash}`,
      'Content-Length': Buffer.byteLength(requestBody)
    }
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk.toString();
    });

    res.on('end', () => {
      console.log(`Response status: ${res.statusCode}`);
      console.log(`Response body: ${data}`);

      if (res.statusCode === 200) {
        console.log('✅ Success! Relay triggered successfully.');
      } else {
        console.log('❌ Failed to trigger relay.');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Request error:', error.message);
  });

  req.on('timeout', () => {
    console.error('❌ Request timeout');
    req.destroy();
  });

  req.write(requestBody);
  req.end();
}

// Test health endpoint (no auth required)
function testHealthCheck() {
  console.log(`\nTesting health check at http://${ipAddress}:${port}/system/health`);

  const options = {
    hostname: ipAddress,
    port: port,
    path: '/system/health',
    method: 'GET'
  };

  const req = http.request(options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk.toString();
    });

    res.on('end', () => {
      console.log(`Health check status: ${res.statusCode}`);
      console.log(`Health check response: ${data}`);

      if (res.statusCode === 200) {
        console.log('✅ Health check successful - relay module is running.');
      } else {
        console.log('❌ Health check failed.');
      }
    });
  });

  req.on('error', (error) => {
    console.error('❌ Health check error:', error.message);
  });

  req.end();
}

// Run tests
console.log('🧪 Testing Raspberry Pi Relay Module Authentication\n');
testHealthCheck();
setTimeout(testRelayTrigger, 1000); // Wait 1 second between tests
