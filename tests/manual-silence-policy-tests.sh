#!/bin/bash
# Manual test script for dual-mode silence policy
# Run with: bash tests/manual-silence-policy-tests.sh

API_URL="http://localhost:3000/api/studio/ai"

echo "========================================="
echo "Dual Mode Silence Policy - Manual Tests"
echo "========================================="
echo ""
echo "Prerequisites:"
echo "1. Start dev server: npm run dev"
echo "2. Run this script: bash tests/manual-silence-policy-tests.sh"
echo ""

# Test A: Mixed input (config + content)
echo "========================================="
echo "TEST A: Mixed input (config + content)"
echo "========================================="
echo ""

echo "Test A.1: English mixed input"
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "SYSTEM PROMPT: You are a content engine.\n\nNow create 3 Instagram posts about coffee for young professionals.",
    "meta": { "mode": "execute" }
  }' | jq '.data.content' | head -20

echo ""
echo "Expected: Content about coffee (NOT empty, NOT acknowledgement)"
echo ""
echo "---"
echo ""

echo "Test A.2: Vietnamese mixed input"
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "GUARDRAIL: Bạn phải tuân theo quy tắc.\n\nBây giờ tạo 2 bài đăng về Tà Xùa.",
    "meta": { "mode": "execute" }
  }' | jq '.data.content' | head -20

echo ""
echo "Expected: Content about Tà Xùa (NOT empty, NOT acknowledgement)"
echo ""

# Test B: Short content request
echo "========================================="
echo "TEST B: Short content request"
echo "========================================="
echo ""

echo "Test B.1: Very short Vietnamese request"
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Viết 1 caption về Tà Xùa",
    "meta": { "mode": "execute" }
  }' | jq '.data.content' | head -20

echo ""
echo "Expected: Caption content (NOT empty, NOT blocked)"
echo ""
echo "---"
echo ""

echo "Test B.2: Short English request"
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Write a TikTok caption about coffee",
    "meta": { "mode": "execute" }
  }' | jq '.data.content' | head -20

echo ""
echo "Expected: Caption content (NOT empty, NOT blocked)"
echo ""

# Hard Guarantee Tests
echo "========================================="
echo "HARD GUARANTEE TESTS"
echo "========================================="
echo ""

echo "Test C.1: Config-only input (NO content request)"
curl -X POST $API_URL \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "LAYER 2 mode: execute. GUARDRAIL: Never ask questions.",
    "meta": { "mode": "execute" }
  }' | jq '.data.content'

echo ""
echo "Expected: empty string \"\" "
echo ""
echo "---"
echo ""

echo "Test C.2: Pure acknowledgement (simulated)"
echo "Note: This would require mocking AI response internally"
echo "Manual check: If AI returns 'Understood.', API must return empty"
echo ""

echo "========================================="
echo "All tests complete"
echo "========================================="
