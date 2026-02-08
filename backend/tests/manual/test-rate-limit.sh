#!/bin/bash

# Test Rate Limiting
echo "=== Testing Rate Limiting ==="
echo ""

# Test 1: Global Rate Limit (100 requests/min)
echo "Test 1: Sending 5 requests to /health endpoint..."
for i in {1..5}; do
  response=$(curl -s -w "\nHTTP_CODE:%{http_code}" http://localhost:3000/health)
  http_code=$(echo "$response" | grep "HTTP_CODE" | cut -d: -f2)

  if [ "$http_code" == "429" ]; then
    echo "Request $i: ❌ Rate Limited (429)"
  else
    echo "Request $i: ✅ Success ($http_code)"
  fi

  sleep 0.1
done

echo ""
echo "Test 2: Checking rate limit headers..."
curl -I http://localhost:3000/health 2>&1 | grep -i "ratelimit\|retry"

echo ""
echo "=== Testing Complete ==="
echo ""
echo "Note: To properly test rate limiting:"
echo "1. Send 101 requests rapidly to trigger global limit"
echo "2. Check for X-RateLimit-* headers in response"
echo "3. Verify 429 status code when limit exceeded"
