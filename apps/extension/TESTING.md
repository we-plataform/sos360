# Extension Performance Testing Guide

This guide provides step-by-step instructions for testing the Lia360 extension's performance across all supported platforms.

## Testing Prerequisites

1. **Chrome Browser**: Latest stable version
2. **Chrome DevTools**: Familiarity with Performance, Memory, and Network panels
3. **Test Accounts**: Access to LinkedIn, Instagram, and Facebook
4. **Chrome Task Manager**: Enable via `Shift + Esc` or Menu → More Tools → Task Manager
5. **Clean Environment**: Close unnecessary tabs and extensions

## Performance Targets

- **Load Time**: < 500ms on all platforms
- **Memory Usage**: < 50MB during normal operation
- **Scroll Performance**: 60fps (no jank or stuttering)
- **API Efficiency**: Batched requests, connection reuse

## Test Setup

### 1. Build and Load Extension

```bash
# Build minified extension
cd apps/extension
npm run build

# Load in Chrome
# 1. Navigate to chrome://extensions
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select apps/extension/dist directory
```

### 2. Open DevTools

- Open Chrome DevTools (F12 or Cmd+Option+I)
- Pin DevTools to a separate window for better visibility
- Enable these panels:
  - **Performance**: For frame rate and load time analysis
  - **Memory**: For heap size and memory profiling
  - **Network**: For API call monitoring
  - **Console**: For bootstrap and performance logs

### 3. Open Chrome Task Manager

- Press `Shift + Esc` to open Task Manager
- Add columns: "Memory footprint", "JavaScript memory", "CPU"
- Keep visible during testing

## Platform-Specific Tests

### LinkedIn Tests

#### Test 1.1: Profile Page Load Time

**Objective**: Verify LinkedIn profile pages load in < 500ms

**Steps**:
1. Open Chrome DevTools → Performance tab
2. Click "Record" (circle icon)
3. Navigate to any LinkedIn profile: `https://www.linkedin.com/in/[profile]/`
4. Wait for page to fully load
5. Click "Stop" after 2 seconds
6. Analyze recording

**Expected Results**:
- Bootstrap load time: < 100ms
- Total content script load: < 500ms
- Check Console for: `[Lia Bootstrap] Platform detected: linkedin`

**Screenshots Required**:
- Performance recording showing load time
- Console logs showing bootstrap completion

---

#### Test 1.2: Connections Page Scroll Performance

**Objective**: Verify smooth 60fps scrolling on connections page

**Steps**:
1. Navigate to LinkedIn connections page: `https://www.linkedin.com/feed/connected/`
2. Open DevTools → Performance tab
3. Click "Record"
4. Scroll down steadily for 10-15 seconds
5. Click "Stop"
6. Look at FPS chart in performance recording

**Expected Results**:
- Consistent 60fps (or close to screen refresh rate)
- No long tasks (> 50ms) blocking main thread
- No jank or stuttering visible
- Frames chart shows green (good) throughout

**Screenshots Required**:
- Performance recording showing FPS
- Frames chart (should be mostly green)

---

#### Test 1.3: Lead Import Memory Usage

**Objective**: Verify memory stays < 50MB during lead import

**Steps**:
1. Open Chrome Task Manager (`Shift + Esc`)
2. Note baseline memory for "Lia 360" extension
3. Navigate to LinkedIn connections page
4. Open extension popup and start lead import
5. Import 20-30 leads (or let auto-scroll run for 2-3 minutes)
6. Monitor memory in Task Manager during import
7. Stop import and observe memory after cleanup

**Expected Results**:
- Baseline memory: < 20MB
- During import: < 50MB
- After import/cleanup: Returns to near baseline
- No continuous memory growth

**Screenshots Required**:
- Task Manager before/during/after import
- Memory profiler timeline (if available)

---

#### Test 1.4: API Call Batching

**Objective**: Verify API calls are batched properly

**Steps**:
1. Open DevTools → Network tab
2. Filter by "Fetch/XHR"
3. Navigate to LinkedIn connections page
4. Start lead import with 10+ leads
5. Monitor Network tab for API calls

**Expected Results**:
- Requests batched (not 1 per lead)
- `/api/v1/leads/import` calls show batch arrays
- Connection reuse visible (same connection ID)
- Analyze-batch calls debounced during auto-scroll

**Screenshots Required**:
- Network tab showing batched requests
- Request headers showing keep-alive

---

### Instagram Tests

#### Test 2.1: Profile Page Load Time

**Objective**: Verify Instagram profile pages load in < 500ms

**Steps**:
1. Open Chrome DevTools → Performance tab
2. Click "Record"
3. Navigate to Instagram profile: `https://www.instagram.com/[username]/`
4. Wait for page load
5. Click "Stop" after 2 seconds
6. Analyze recording

**Expected Results**:
- Bootstrap load time: < 100ms
- Total content script load: < 500ms
- Console shows: `[Lia Bootstrap] Platform detected: instagram`
- Only Instagram modules loaded (not LinkedIn/Facebook)

**Screenshots Required**:
- Performance recording
- Console logs
- Sources panel (should show bootstrap.js + instagram modules only)

---

#### Test 2.2: Post Navigation Memory Management

**Objective**: Verify memory doesn't leak when navigating between posts

**Steps**:
1. Open Chrome Task Manager and DevTools Memory profiler
2. Navigate to Instagram profile
3. Take heap snapshot (baseline)
4. Navigate to 5 different posts
5. Take heap snapshot after navigation
6. Compare snapshots

**Expected Results**:
- Memory returns to baseline after navigation
- No detached DOM nodes
- No increasing memory trend
- Console shows cleanup messages

**Screenshots Required**:
- Heap snapshot comparison
- Task Manager during navigation

---

#### Test 2.3: Follower/Engagement Import Performance

**Objective**: Verify smooth operation during follower import

**Steps**:
1. Navigate to Instagram profile with followers
2. Open DevTools → Performance tab
3. Click "Record"
4. Start follower import via extension popup
5. Let import run for 2-3 minutes
6. Click "Stop"
7. Analyze performance

**Expected Results**:
- 60fps during scrolling
- No long tasks
- Memory stays < 50MB
- Responsive UI

**Screenshots Required**:
- Performance recording
- Memory timeline

---

### Facebook Tests

#### Test 3.1: Profile Page Load Time

**Objective**: Verify Facebook profile pages load in < 500ms

**Steps**:
1. Open Chrome DevTools → Performance tab
2. Click "Record"
3. Navigate to Facebook profile: `https://www.facebook.com/[profile]`
4. Wait for page load
5. Click "Stop" after 2 seconds
6. Analyze recording

**Expected Results**:
- Bootstrap load time: < 100ms
- Total content script load: < 500ms
- Console shows: `[Lia Bootstrap] Platform detected: facebook`
- Only Facebook module loaded (minimal footprint)

**Screenshots Required**:
- Performance recording
- Console logs

---

#### Test 3.2: Memory Efficiency

**Objective**: Verify Facebook module has minimal memory footprint

**Steps**:
1. Open Chrome Task Manager
2. Navigate to Facebook profile
3. Monitor memory for 5 minutes of normal browsing
4. Navigate between 10 different profiles
5. Check for memory growth

**Expected Results**:
- Memory < 30MB (Facebook is lightweight)
- No memory leaks during navigation
- Cleanup between profiles

**Screenshots Required**:
- Task Manager over time
- Memory profile

---

### Cross-Platform Tests

#### Test 4.1: Platform Isolation

**Objective**: Verify only required scripts load per platform

**Steps**:
1. Open DevTools → Sources panel
2. Navigate to LinkedIn profile
3. Note loaded scripts in "Content scripts" section
4. Navigate to Instagram profile
5. Note loaded scripts
6. Navigate to Facebook profile
7. Note loaded scripts

**Expected Results**:
- LinkedIn: bootstrap.js + linkedin-* modules
- Instagram: bootstrap.js + instagram modules
- Facebook: bootstrap.js + facebook.js only
- No cross-platform script loading

**Screenshots Required**:
- Sources panel for each platform

---

#### Test 4.2: Error Handling

**Objective**: Verify graceful error handling

**Steps**:
1. Disable network (DevTools → Network → Offline)
2. Try importing leads on all platforms
3. Monitor Console for errors
4. Re-enable network
5. Verify extension recovers

**Expected Results**:
- No crashes or unhandled errors
- Graceful error messages in console
- Extension recovers when network returns
- No memory leaks from failed requests

**Screenshots Required**:
- Console error logs
- Extension behavior during/after network failure

---

#### Test 4.3: Extended Usage (10-Minute Test)

**Objective**: Verify stability over extended use

**Steps**:
1. Open Chrome Task Manager
2. Open all three platforms in separate tabs
3. Use extension normally for 10 minutes:
   - Import leads from LinkedIn (2-3 minutes)
   - Import from Instagram (2-3 minutes)
   - Import from Facebook (2-3 minutes)
   - Navigate between pages
4. Monitor memory throughout

**Expected Results**:
- Memory stays consistently < 50MB
- No performance degradation over time
- No crashes or freezes
- Smooth operation throughout

**Screenshots Required**:
- Task Manager at start, middle, and end
- Memory graph over 10 minutes

---

## Verification Checklist

Use this checklist to track completion:

### LinkedIn
- [ ] Profile loads < 500ms
- [ ] Scroll at 60fps on connections page
- [ ] Memory < 50MB during import
- [ ] API calls batched properly
- [ ] Connection reuse visible in Network tab

### Instagram
- [ ] Profile loads < 500ms
- [ ] No memory leaks on navigation
- [ ] Smooth performance during follower import
- [ ] Memory < 50MB

### Facebook
- [ ] Profile loads < 500ms
- [ ] Memory < 30MB (lightweight)
- [ ] No issues during profile navigation

### Cross-Platform
- [ ] Only required scripts load per platform
- [ ] Graceful error handling
- [ ] Stable over 10-minute usage
- [ ] No memory leaks across platforms

---

## Performance Metrics Recording Template

Record your results in this format:

```markdown
### Test Results - [Date]

**Environment**:
- Chrome Version: [Version]
- OS: [OS]
- Extension Build: [Commit hash or version]

**LinkedIn**:
- Profile Load Time: [X]ms
- Connections Scroll FPS: [X]fps
- Import Memory Peak: [X]MB
- API Batching: Yes/No

**Instagram**:
- Profile Load Time: [X]ms
- Navigation Memory Leak: Yes/No
- Follower Import Memory: [X]MB

**Facebook**:
- Profile Load Time: [X]ms
- Memory Footprint: [X]MB

**10-Minute Test**:
- Start Memory: [X]MB
- Peak Memory: [X]MB
- End Memory: [X]MB
- Issues: [None / Describe]

**Overall Assessment**: [Pass / Fail]
**Notes**: [Any observations]
```

---

## Troubleshooting

### Load Time > 500ms

**Possible Causes**:
- Slow network (API calls blocking)
- Large DOM on page
- Other extensions interfering

**Solutions**:
- Test in incognito mode (extension only)
- Check Network tab for blocking requests
- Verify minified build is loaded

### Memory > 50MB

**Possible Causes**:
- Memory leak in Maps/caches
- Event listeners not cleaned up
- MutationObservers over-observing

**Solutions**:
- Take heap snapshot to find leaks
- Check for LRU map implementation
- Verify cleanup functions are called
- Check DevTools for detached DOM nodes

### Scroll Jank

**Possible Causes**:
- MutationObserver firing too frequently
- Heavy event handlers
- API calls during scroll

**Solutions**:
- Check Performance tab for long tasks
- Verify passive event listeners
- Check for requestIdleCallback usage

---

## Automated Performance Testing

For automated checks, run the benchmark script:

```bash
cd apps/extension
node scripts/benchmark.js --compare
```

This compares current performance against baseline and generates a report.

---

## Success Criteria

The extension passes performance testing if:

1. ✅ All platforms load in < 500ms
2. ✅ Memory usage stays < 50MB in all tests
3. ✅ Scroll performance is 60fps (no noticeable jank)
4. ✅ No memory leaks across platforms
5. ✅ API calls are properly batched
6. ✅ Stable over extended 10-minute usage
7. ✅ Graceful error handling

If any test fails, document the issue and investigate the root cause before marking the task complete.
