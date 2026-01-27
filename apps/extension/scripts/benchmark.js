#!/usr/bin/env node

/**
 * Performance Benchmark Script for Lia 360 Extension
 *
 * This script measures and tracks performance metrics for the Chrome extension,
 * including file sizes, line counts, and estimated load impact.
 *
 * Usage:
 *   node benchmark.js --baseline     # Create baseline measurements
 *   node benchmark.js --compare      # Compare current to baseline
 *   node benchmark.js                # Show current metrics
 */

const fs = require('fs');
const path = require('path');

// Configuration
const EXTENSION_DIR = path.resolve(__dirname, '..');
const RESULTS_FILE = path.resolve(EXTENSION_DIR, 'benchmark-results.json');

// Content script groups to analyze
const SCRIPT_GROUPS = {
  linkedin: [
    'content-scripts/linkedin-utils.js',
    'content-scripts/linkedin-state.js',
    'content-scripts/linkedin-dom.js',
    'content-scripts/linkedin-ui.js',
    'content-scripts/linkedin-core.js'
  ],
  instagram: [
    'content-scripts/settings-manager.js',
    'content-scripts/instagram.js'
  ],
  facebook: [
    'content-scripts/settings-manager.js',
    'content-scripts/facebook.js'
  ],
  dashboard: [
    'content-scripts/dashboard-sync.js'
  ],
  shared: [
    'content-scripts/settings-manager.js',
    'content-scripts/overlay.js'
  ]
};

/**
 * Get file statistics
 */
function getFileStats(filePath) {
  const fullPath = path.resolve(EXTENSION_DIR, filePath);

  if (!fs.existsSync(fullPath)) {
    return null;
  }

  const stats = fs.statSync(fullPath);
  const content = fs.readFileSync(fullPath, 'utf8');

  const lines = content.split('\n').length;
  const blankLines = content.split('\n').filter(line => line.trim() === '').length;
  const commentLines = content.split('\n').filter(line => {
    const trimmed = line.trim();
    return trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*');
  }).length;
  const codeLines = lines - blankLines - commentLines;

  return {
    path: filePath,
    sizeBytes: stats.size,
    sizeKB: (stats.size / 1024).toFixed(2),
    totalLines: lines,
    blankLines,
    commentLines,
    codeLines
  };
}

/**
 * Analyze all extension scripts
 */
function analyzeScripts() {
  const results = {
    timestamp: new Date().toISOString(),
    summary: {
      totalSize: 0,
      totalLines: 0,
      totalCodeLines: 0,
      largestFile: null,
      fileCount: 0
    },
    groups: {},
    individualFiles: []
  };

  // Get all unique script files
  const allFiles = new Set();
  Object.values(SCRIPT_GROUPS).forEach(group => {
    group.forEach(file => allFiles.add(file));
  });

  // Analyze each group
  for (const [groupName, files] of Object.entries(SCRIPT_GROUPS)) {
    const groupStats = {
      files: [],
      totalSize: 0,
      totalLines: 0,
      totalCodeLines: 0
    };

    for (const file of files) {
      const stats = getFileStats(file);
      if (stats) {
        groupStats.files.push(stats);
        groupStats.totalSize += stats.sizeBytes;
        groupStats.totalLines += stats.totalLines;
        groupStats.totalCodeLines += stats.codeLines;

        // Track for summary
        results.summary.totalSize += stats.sizeBytes;
        results.summary.totalLines += stats.totalLines;
        results.summary.totalCodeLines += stats.codeLines;

        if (!results.summary.largestFile || stats.sizeBytes > results.summary.largestFile.sizeBytes) {
          results.summary.largestFile = stats;
        }
      }
    }

    results.groups[groupName] = {
      fileCount: groupStats.files.length,
      totalSize: groupStats.totalSize,
      totalSizeKB: (groupStats.totalSize / 1024).toFixed(2),
      totalLines: groupStats.totalLines,
      totalCodeLines: groupStats.totalCodeLines,
      files: groupStats.files.map(f => ({
        path: f.path,
        sizeKB: f.sizeKB,
        lines: f.totalLines,
        codeLines: f.codeLines
      }))
    };
  }

  // Also track individual files for detailed view
  allFiles.forEach(file => {
    const stats = getFileStats(file);
    if (stats && !results.individualFiles.find(f => f.path === file)) {
      results.individualFiles.push(stats);
      results.summary.fileCount++;
    }
  });

  // Sort individual files by size
  results.individualFiles.sort((a, b) => b.sizeBytes - a.sizeBytes);

  results.summary.totalSizeKB = (results.summary.totalSize / 1024).toFixed(2);

  return results;
}

/**
 * Calculate performance scores
 */
function calculatePerformanceMetrics(results) {
  const { summary, groups } = results;

  // Load impact estimation (heuristic based on size)
  const estimatedLoadTime = Math.round(summary.totalSize / 10); // rough estimate in ms

  return {
    estimatedLoadTime: `${estimatedLoadTime}ms`,
    totalPayload: `${summary.totalSizeKB}KB`,
    codeComplexity: summary.totalCodeLines,
    platformBreakdown: Object.entries(groups).map(([name, data]) => ({
      platform: name,
      payload: data.totalSizeKB,
      files: data.fileCount
    }))
  };
}

/**
 * Display results
 */
function displayResults(results, showComparison = false) {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║          Lia 360 Extension - Performance Benchmark            ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');

  if (showComparison && results.comparison) {
    console.log('📊 Comparison to Baseline:\n');
    console.log(`  Total Size: ${results.comparison.sizeDiff} (${results.summary.totalSizeKB}KB → ${results.baseline.summary.totalSizeKB}KB)`);
    console.log(`  Load Time: ${results.comparison.loadTimeDiff}`);
    console.log(`  Code Lines: ${results.comparison.linesDiff}`);
    console.log(`  Files: ${results.summary.fileCount} (${results.comparison.fileCountDiff})`);
    console.log('');
  }

  console.log('📦 Summary Metrics:');
  console.log(`  Total Extension Size: ${results.summary.totalSizeKB}KB`);
  console.log(`  Total Lines: ${results.summary.totalLines.toLocaleString()}`);
  console.log(`  Code Lines: ${results.summary.totalCodeLines.toLocaleString()}`);
  console.log(`  Total Files: ${results.summary.fileCount}`);
  console.log(`  Largest File: ${results.summary.largestFile?.path} (${results.summary.largestFile?.sizeKB}KB)`);
  console.log('');

  const metrics = calculatePerformanceMetrics(results);
  console.log('⚡ Performance Estimates:');
  console.log(`  Estimated Load Time: ${metrics.estimatedLoadTime}`);
  console.log(`  Total Payload: ${metrics.totalPayload}`);
  console.log(`  Code Complexity: ${metrics.codeComplexity.toLocaleString()} lines`);
  console.log('');

  console.log('📋 Platform Breakdown:');
  for (const [platform, data] of Object.entries(results.groups)) {
    console.log(`  ${platform.charAt(0).toUpperCase() + platform.slice(1)}:`);
    console.log(`    Payload: ${data.totalSizeKB}KB`);
    console.log(`    Files: ${data.fileCount}`);
    console.log(`    Lines: ${data.totalCodeLines.toLocaleString()}`);
  }
  console.log('');

  console.log('📁 Top 5 Largest Files:');
  results.individualFiles.slice(0, 5).forEach((file, index) => {
    console.log(`  ${index + 1}. ${file.path}`);
    console.log(`     Size: ${file.sizeKB}KB | Lines: ${file.totalLines} | Code: ${file.codeLines}`);
  });
  console.log('');

  console.log(`🕐 Timestamp: ${results.timestamp}\n`);
}

/**
 * Save baseline results
 */
function saveBaseline(results) {
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
  console.log('✅ Baseline metrics saved to benchmark-results.json\n');
}

/**
 * Load baseline results
 */
function loadBaseline() {
  if (!fs.existsSync(RESULTS_FILE)) {
    return null;
  }

  try {
    const content = fs.readFileSync(RESULTS_FILE, 'utf8');
    return JSON.parse(content);
  } catch (error) {
    return null;
  }
}

/**
 * Compare current results to baseline
 */
function compareToBaseline(current) {
  const baseline = loadBaseline();

  if (!baseline) {
    console.log('⚠️  No baseline found. Run with --baseline to create one.\n');
    return null;
  }

  const sizeDiff = (current.summary.totalSize - baseline.summary.totalSize) / 1024;
  const sizeDiffPercent = ((sizeDiff / (baseline.summary.totalSize / 1024)) * 100).toFixed(1);
  const linesDiff = current.summary.totalLines - baseline.summary.totalLines;
  const linesDiffPercent = ((linesDiff / baseline.summary.totalLines) * 100).toFixed(1);
  const codeLinesDiff = current.summary.totalCodeLines - baseline.summary.totalCodeLines;

  const sizeChange = sizeDiff > 0 ? '+' : '';
  const linesChange = linesDiff > 0 ? '+' : '';

  return {
    baseline,
    comparison: {
      sizeDiff: `${sizeChange}${sizeDiff.toFixed(2)}KB (${sizeDiffPercent}%)`,
      loadTimeDiff: `${Math.round(current.summary.totalSize / 10)}ms vs ${Math.round(baseline.summary.totalSize / 10)}ms`,
      linesDiff: `${linesChange}${linesDiff} (${linesDiffPercent}%)`,
      codeLinesDiff: `${codeLinesDiff > 0 ? '+' : ''}${codeLinesDiff}`,
      fileCountDiff: `${current.summary.fileCount} vs ${baseline.summary.fileCount}`
    }
  };
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);

  if (args.includes('--help') || args.includes('-h')) {
    console.log('\nLia 360 Extension Performance Benchmark\n');
    console.log('Usage:');
    console.log('  node benchmark.js --baseline     Create baseline measurements');
    console.log('  node benchmark.js --compare      Compare current to baseline');
    console.log('  node benchmark.js                Show current metrics\n');
    process.exit(0);
  }

  const results = analyzeScripts();

  if (args.includes('--baseline')) {
    console.log('🔍 Creating baseline measurements...\n');
    displayResults(results);
    saveBaseline(results);
  } else if (args.includes('--compare')) {
    console.log('🔍 Comparing to baseline...\n');
    const comparison = compareToBaseline(results);
    if (comparison) {
      displayResults(comparison, true);

      // Performance target checks
      console.log('🎯 Performance Targets:');
      const loadTime = Math.round(results.summary.totalSize / 10);
      const memory = Math.round(results.summary.totalSize / 1024);

      console.log(`  Load Time < 500ms: ${loadTime < 500 ? '✅ PASS' : '❌ FAIL'} (${loadTime}ms)`);
      console.log(`  Memory < 50MB: ${memory < 50 ? '✅ PASS' : '❌ FAIL'} (~${memory}MB estimated)`);

      if (loadTime < 500 && memory < 50) {
        console.log('\n  🎉 All performance targets met!\n');
      } else {
        console.log('\n  ⚠️  Some targets not met. Continue optimization.\n');
      }
    }
  } else {
    console.log('🔍 Current metrics:\n');
    displayResults(results);
  }
}

// Run
main();
