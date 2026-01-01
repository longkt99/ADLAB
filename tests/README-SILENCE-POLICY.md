# Silence Policy Testing Guide

## Quick Test Commands

### 1. Start Dev Server
```bash
npm run dev
```

### 2. Run Manual Tests
```bash
bash tests/manual-silence-policy-tests.sh
```

### 3. Individual Test Commands

#### Test A.1: Mixed Input (Config + Content) - English
```bash
curl -X POST http://localhost:3000/api/studio/ai \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "SYSTEM PROMPT: You are a content engine.\n\nNow create 3 Instagram posts about coffee.",
    "meta": { "mode": "execute" }
  }'
```
**Expected**: Content about coffee (NOT empty, NOT acknowledgement)

---

#### Test A.2: Mixed Input - Vietnamese
```bash
curl -X POST http://localhost:3000/api/studio/ai \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "GUARDRAIL: Tuân theo quy tắc.\n\nTạo 2 bài về Tà Xùa.",
    "meta": { "mode": "execute" }
  }'
```
**Expected**: Content about Tà Xùa (NOT empty)

---

#### Test B.1: Short Content Request - Vietnamese
```bash
curl -X POST http://localhost:3000/api/studio/ai \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Viết 1 caption về Tà Xùa",
    "meta": { "mode": "execute" }
  }'
```
**Expected**: Caption content (NOT blocked by silence policy)

---

#### Test B.2: Short Content Request - English
```bash
curl -X POST http://localhost:3000/api/studio/ai \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "Write a TikTok caption about coffee",
    "meta": { "mode": "execute" }
  }'
```
**Expected**: Caption content (NOT blocked)

---

#### Test C: Config-Only Input
```bash
curl -X POST http://localhost:3000/api/studio/ai \
  -H "Content-Type: application/json" \
  -d '{
    "userPrompt": "LAYER 2 mode: execute. GUARDRAIL: Never ask questions.",
    "meta": { "mode": "execute" }
  }'
```
**Expected**: `{"success":true,"data":{"content":""}}`

---

## Validation Checklist

### ✅ Hard Guarantees

- [ ] Config-only input → empty output
- [ ] Pure acknowledgement response → empty output
- [ ] Mixed (acknowledgement + content) → content only (acknowledgement stripped)
- [ ] Short content request → generates content (NOT blocked)
- [ ] Mixed input (config + content) → generates content (NOT blocked)
- [ ] Output with meta headings → blocked and returns empty (ABSOLUTE ROLE LOCK)
- [ ] Valid content without meta headings → allowed through

### ✅ Acknowledgement Patterns Covered

**English:**
- understood, ok, okay, ready, noted, acknowledged, sure, got it, will do, proceeding

**Vietnamese:**
- đã hiểu, ok rồi, ok, rõ rồi, sẵn sàng, đã nắm, hiểu rồi

### ✅ Content Indicators (Must NOT Block)

**English:**
- create, write, generate, make

**Vietnamese:**
- tạo, viết

**Platform/Topic:**
- topic:, chủ đề:, platform:, nền tảng:

---

## Filter Logic Summary

### 1. Pure Acknowledgement Detection
If response matches:
- `/^(understood|ok|ready|...)\.?\s*$/i`
- `/^(đã hiểu|ok rồi|...)\.?\s*$/i`

**Action**: Return `""`

### 2. Acknowledgement Prefix Stripping
If response starts with:
- `/^(understood|ok|ready|...)\.?\s+/i`
- `/^(đã hiểu|ok rồi|...)\.?\s+/i`

**Action**: Strip prefix, return remaining content

### 3. Config-Only Input Detection
If input contains:
- Config keywords: `system prompt`, `guardrail`, `layer 0/1/2`, etc.
- AND lacks content indicators: `create`, `write`, `tạo`, `viết`, etc.

**Action**: Return `""`

### 4. Meta Heading Detection (ABSOLUTE ROLE LOCK)
If output contains forbidden meta-structure labels:
- **English**: Orientation, Angle Suggestions, Optimization, Approval, Execution Guidance, Process, Analysis, Framework, Structure
- **Vietnamese**: Định hướng, Gợi ý góc nhìn, Gợi ý, Tối ưu hóa, Phê duyệt, Hướng dẫn thực hiện, Quy trình, Phân tích, Khung, Cấu trúc
- **Patterns**: `### Orientation`, `**Optimization**`, `Step 1: Analysis`, etc.

**Action**: Hard-fail to `""` (server-side enforcement)

---

## Edge Cases Covered

1. **Mixed input**: Config text + content request → Content generated ✅
2. **Short requests**: Single-line content requests → Content generated ✅
3. **Vietnamese short**: "Viết 1 caption về X" → Content generated ✅
4. **Pure acknowledgement**: "Understood." → Empty output ✅
5. **Prefixed content**: "Ok. Here is..." → "Here is..." ✅

---

## Files Modified

- `app/api/studio/ai/route.ts` - Silence policy enforcement
- `lib/studio/aiClient.ts` - Mode-specific system messages
- `lib/studio/aiTypes.ts` - AIMode type definition
- `lib/studio/studioContext.tsx` - Mode parameter injection

---

## TypeScript Status

✅ 0 errors in production code
