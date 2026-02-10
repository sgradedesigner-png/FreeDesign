#!/bin/bash
# Test email script
# Usage: ./test-email.sh YOUR_ADMIN_TOKEN

TOKEN="$1"
EMAIL="mongoldesignner@gmail.com"

if [ -z "$TOKEN" ]; then
  echo "❌ Error: Admin token required"
  echo "Usage: ./test-email.sh YOUR_ADMIN_TOKEN"
  echo ""
  echo "To get your admin token:"
  echo "1. Open Admin Panel (http://localhost:5176)"
  echo "2. Press F12 -> Console"
  echo "3. Run: localStorage.getItem('sb-miqlyriefwqmutlsxytk-auth-token')"
  exit 1
fi

echo "📧 Sending test email to: $EMAIL"
echo "🔑 Using token: ${TOKEN:0:20}..."
echo ""

curl -X POST http://localhost:3000/admin/test-email \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"to\": \"$EMAIL\"}" \
  | jq .

echo ""
echo "✅ Check your email inbox: $EMAIL"
