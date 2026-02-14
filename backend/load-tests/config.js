// Load Testing Configuration
// This file contains shared configuration and helper functions for k6 tests

export const BASE_URL = __ENV.BASE_URL || 'http://localhost:4000';

// Test user credentials (create these in your test database)
export const TEST_USERS = {
  customer: {
    email: 'load-test-customer@example.com',
    password: 'LoadTest123!',
  },
  admin: {
    email: 'load-test-admin@example.com',
    password: 'LoadTest123!',
  },
};

// Common thresholds for all tests
export const commonThresholds = {
  // HTTP errors should be less than 1%
  http_req_failed: ['rate<0.01'],

  // 95% of requests should be below 500ms
  http_req_duration: ['p(95)<500'],

  // 99% of requests should be below 2000ms
  'http_req_duration{expected_response:true}': ['p(99)<2000'],
};

// Aggressive thresholds for critical endpoints
export const criticalThresholds = {
  // HTTP errors should be less than 0.1%
  http_req_failed: ['rate<0.001'],

  // 95% of requests should be below 300ms
  http_req_duration: ['p(95)<300'],

  // 99% of requests should be below 1000ms
  'http_req_duration{expected_response:true}': ['p(99)<1000'],
};

// Helper function to generate random product data
export function generateProductData() {
  const timestamp = Date.now();
  return {
    name: `Load Test Product ${timestamp}`,
    description: `This is a load test product created at ${timestamp}`,
    price: Math.floor(Math.random() * 100000) + 10000,
    stock: Math.floor(Math.random() * 100) + 1,
    is_published: true,
  };
}

// Helper function to generate random order data
export function generateOrderData(userId) {
  return {
    items: [
      {
        product_id: 1, // Assuming product ID 1 exists
        variant_id: 1, // Assuming variant ID 1 exists
        quantity: Math.floor(Math.random() * 5) + 1,
        price: 50000,
      },
    ],
    shipping_address: `Load Test Address ${Date.now()}`,
    total: 50000,
  };
}

// Helper function to check response
export function checkResponse(response, expectedStatus = 200) {
  if (response.status !== expectedStatus) {
    console.error(`Expected status ${expectedStatus}, got ${response.status}`);
    console.error(`Response body: ${response.body}`);
    return false;
  }
  return true;
}

// Sleep durations (in seconds)
// Phase 1: Reduced delays for realistic performance testing
export const SLEEP = {
  SHORT: 0.1,   // 100ms (was 1s)
  MEDIUM: 0.5,  // 500ms (was 3s)
  LONG: 1.0,    // 1 second (was 5s)
};

// Common headers
// Phase 1: Enable compression in load tests
export const headers = {
  'Content-Type': 'application/json',
  'Accept-Encoding': 'gzip, deflate, br', // Enable compression
};

// Helper to add auth token to headers
export function authHeaders(token) {
  return {
    ...headers,
    'Authorization': `Bearer ${token}`,
  };
}

