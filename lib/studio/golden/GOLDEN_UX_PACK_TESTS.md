# Golden UX Pack - Test Checklist

**Components**: GoldenPreviewMini, GoldenIntentBar (upgraded), Sync verification

---

## ✅ Test Checklist (8 Items)

### 1. **GoldenPreviewMini - Renders from Manifest**
- [ ] Open Studio page
- [ ] Click "✍️ Caption MXH" from Golden Intent Bar
- [ ] **Expected**: Compact blue preview card appears below template picker showing:
  - Title: "Social Media Caption"
  - Version: "v1.0.0"
  - Description from manifest
  - 3-5 bullet points of output sections (Hook, Body, CTA, Hashtags)
- [ ] Card has gradient background (blue-50 to indigo-50)
- [ ] Dark mode: Card adjusts colors correctly

### 2. **GoldenPreviewMini - Graceful Null Handling**
- [ ] Start with no template selected (or click clear button in TemplateQuickPicker if visible)
- [ ] **Expected**: No preview card renders (clean empty state)
- [ ] No errors in console
- [ ] Layout remains stable (no jumping)

### 3. **GoldenIntentBar - Auto-Scroll Selected Intent**
- [ ] Resize browser window to narrow (or zoom in) so not all intent buttons are visible
- [ ] Click "📝 Blog SEO" (second intent)
- [ ] **Expected**: Intent button scrolls into view smoothly (centered)
- [ ] No jank or jumping
- [ ] Selected button highlights with blue background

### 4. **GoldenIntentBar - Disabled Intents Visible**
- [ ] Look at Golden Intent Bar
- [ ] **Expected**: See 10 total intents (2 enabled + 8 disabled)
- [ ] Enabled intents (Caption MXH, Blog SEO): Full opacity, clickable
- [ ] Disabled intents (Video Script, Ad Copy, etc.): 50% opacity, grayed out
- [ ] Disabled intents have amber "SOON" badge (not red "HOT")

### 5. **GoldenIntentBar - Disabled Intent Tooltip**
- [ ] Hover over "🎬 Script Video" (disabled intent)
- [ ] **Expected**: Amber tooltip appears showing:
  - "Sắp Ra Mắt"
  - Intent description
  - "Chưa có manifest cho template: video_script_v1"
- [ ] Tooltip styled in amber (not default slate)

### 6. **GoldenIntentBar - Disabled Intent Click Does Nothing**
- [ ] Click "🎯 Quảng Cáo" (disabled intent)
- [ ] **Expected**: Nothing happens
  - No template selection
  - No preview card appears
  - Button remains grayed out
  - Cursor shows "not-allowed"
- [ ] No errors in console

### 7. **Sync - Intent → Preview → Template Badge**
- [ ] Click "✍️ Caption MXH" from Golden Intent Bar
- [ ] **Expected**: Three UI elements sync immediately:
  - Golden Intent Bar: "Caption MXH" button highlighted (blue)
  - GoldenPreviewMini: Shows "Social Media Caption" preview card
  - ChatInterface header: Badge shows "🎬 Social Media Caption"
- [ ] All three show same template
- [ ] No drift or inconsistency

### 8. **Sync - Multiple Template Source Consistency**
- [ ] Click "📝 Blog SEO" from Golden Intent Bar
- [ ] Verify all UI elements show "SEO Blog Article"
- [ ] If TemplateQuickPicker is visible (unhide in code), verify it also shows selected state
- [ ] Click different intent → all UI updates consistently
- [ ] No duplicate state sources (single source: `selectedTemplateId` in context)

---

## ⚠️ Known Issues to Verify

### Issue 1: TemplateQuickPicker Hidden
- File: `TemplateQuickPicker.tsx` line 57 has `className="hidden"`
- This was already in codebase (not changed by this task)
- If user wants to see it, remove the `hidden` class
- Sync should still work (component is controlled via props)

### Issue 2: Auto-Scroll Timing
- Auto-scroll triggers on `selectedTemplateId` change
- If multiple rapid clicks, scroll may queue
- Expected: Last scroll wins (smooth behavior)

---

## 🐛 Debugging Tips

### Preview Card Not Showing
1. Check console for manifest resolution errors
2. Verify `selectedTemplateId` is not null: Open React DevTools → StudioContext
3. Check if manifest exists: `resolveTemplateManifest('social_caption_v1')` in console

### Auto-Scroll Not Working
1. Check browser console for ref errors
2. Verify intent bar is scrollable (resize window to narrow)
3. Check if button ref is set correctly: Inspect button element in DevTools

### Disabled Intents Not Showing
1. Verify `GOLDEN_INTENTS` import (not `listGoldenIntents()` which filters)
2. Check registry has `enabled: false` for planned intents
3. Console log `intents.length` in component (should be 10, not 2)

### Sync Broken
1. Verify `handleTemplateSelect` is called: Add console.log
2. Check `selectedTemplateId` in context state
3. Ensure TemplateQuickPicker receives correct props (controlled component)

---

## 📊 Performance Checks

- [ ] Auto-scroll doesn't cause layout thrashing
- [ ] Hover tooltips render smoothly (no flicker)
- [ ] Disabled button clicks don't trigger re-renders
- [ ] Preview card renders only when template changes (not on every render)

---

## ✨ Edge Cases

1. **Rapid template switching**: Click intents quickly → Preview should update cleanly
2. **Manifest missing**: Select template with no manifest → Preview shows dev warning (dev mode) or nothing (prod)
3. **Viewport resize**: Narrow → wide → Auto-scroll should still work
4. **Dark mode toggle**: All components should adapt colors correctly

---

## Summary

**Minimal changes, maximum UX improvement:**
- ✅ Preview card: 1 new component (118 lines)
- ✅ Auto-scroll: 1 useEffect + refs
- ✅ Disabled intents: Visual styling + tooltip logic
- ✅ Sync: Already working (TemplateQuickPicker controlled)

**Total files modified**: 3
- New: `GoldenPreviewMini.tsx`
- Updated: `ChatInterface.tsx` (mount preview)
- Updated: `GoldenIntentBar.tsx` (auto-scroll + disabled UX)
