# Quick Performance Test Checklist

**For rapid manual verification during development**

## Setup (2 minutes)

```bash
# Build extension
cd apps/extension && npm run build

# Load in Chrome
# chrome://extensions → Developer mode → Load unpacked → select dist/
```

Open tools:
- [ ] Chrome DevTools (F12)
- [ ] Task Manager (Shift+Esc)

---

## LinkedIn (5 minutes)

### Load Time
1. Open DevTools → Performance
2. Navigate to linkedin.com/in/[profile]
3. Check console: `[Lia Bootstrap] Platform detected: linkedin`
4. ✅ **Loads in < 500ms**

### Scroll Performance
1. Go to linkedin.com/feed/connected/
2. Scroll for 10 seconds
3. ✅ **Smooth 60fps (no stuttering)**

### Memory
1. Check Task Manager
2. Import 20 leads
3. ✅ **Memory < 50MB**

---

## Instagram (3 minutes)

### Load Time
1. Navigate to instagram.com/[username]/
2. Check console: `[Lia Bootstrap] Platform detected: instagram`
3. ✅ **Loads in < 500ms**

### Memory
1. Navigate between 5 posts
2. ✅ **No memory leaks**

---

## Facebook (2 minutes)

### Load Time
1. Navigate to facebook.com/[profile]
2. Check console: `[Lia Bootstrap] Platform detected: facebook`
3. ✅ **Loads in < 500ms**

### Memory
1. Check Task Manager
2. ✅ **Memory < 30MB (lightweight)**

---

## Cross-Platform (2 minutes)

### Script Isolation
1. Check DevTools → Sources on each platform
2. ✅ **Only required scripts load per platform**

---

## Overall (Pass/Fail)

- [ ] LinkedIn load < 500ms
- [ ] LinkedIn memory < 50MB
- [ ] LinkedIn scroll 60fps
- [ ] Instagram load < 500ms
- [ ] Instagram no memory leaks
- [ ] Facebook load < 500ms
- [ ] Facebook memory < 30MB
- [ ] Scripts isolated per platform

**Result**: ✅ PASS (if all checked) / ❌ FAIL

---

## Expected Console Logs

### LinkedIn
```
[Lia Bootstrap] Initializing...
[Lia Bootstrap] Platform detected: linkedin
[Lia Bootstrap] Loading linkedin modules...
[Lia Bootstrap] All scripts loaded in XXXms
```

### Instagram
```
[Lia Bootstrap] Initializing...
[Lia Bootstrap] Platform detected: instagram
[Lia Bootstrap] Loading instagram modules...
[Lia Bootstrap] All scripts loaded in XXXms
```

### Facebook
```
[Lia Bootstrap] Initializing...
[Lia Bootstrap] Platform detected: facebook
[Lia Bootstrap] Loading facebook.js...
[Lia Bootstrap] All scripts loaded in XXXms
```

---

## Quick DevTools Tips

**Measure Load Time**:
- Performance tab → Record → Navigate → Stop (after 2s)
- Look at "Loading" phase at bottom

**Check Memory**:
- Task Manager → Look at "Memory footprint" column
- Or Memory tab → Take heap snapshot

**Check Scroll FPS**:
- Performance tab → Record → Scroll for 10s → Stop
- Look at FPS chart (should be 60fps or near screen refresh rate)

**Check API Batching**:
- Network tab → Filter by "Fetch/XHR"
- Look at request URLs and payloads (should have arrays of leads)

---

## Common Issues

**Extension not loading**:
- Check chrome://extensions for errors
- Verify dist/ directory exists
- Rebuild: `npm run build`

**High memory**:
- Check for memory leaks in Heap Snapshot
- Verify cleanup functions are called
- Restart browser and test again

**Slow load time**:
- Check Network tab for blocking requests
- Verify minified build is loaded (check Sources)
- Disable other extensions (test in incognito)

**Scroll jank**:
- Check Performance tab for long tasks
- Verify passive event listeners are used
- Check MutationObserver isn't firing too frequently

---

## Automated Benchmark

For automated metrics, run:

```bash
cd apps/extension
node scripts/benchmark.js --compare
```

Expected output:
- Total size: ~185 KB (48% reduction from baseline)
- Load time: ~36ms
- Memory: ~18MB
- All targets: ✅ MET

---

## Next Steps

If all tests pass:
1. ✅ Mark subtask-8-2 as complete
2. ✅ Proceed to subtask-8-3 (documentation)

If any test fails:
1. Document the issue in test-results-template.md
2. Investigate root cause
3. Fix and retest
4. Don't mark as complete until all pass

---

**Time Estimate**: 12-15 minutes for full quick test

**For detailed testing**: See TESTING.md
**For results recording**: See test-results-template.md
