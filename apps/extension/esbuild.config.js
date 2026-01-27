import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const isWatch = process.argv.includes('--watch');
const outdir = path.join(__dirname, 'dist');

// Entry points for the extension
const entryPoints = [
  'background.js',
  'popup.js',
  'content-scripts/bootstrap.js',
  'content-scripts/linkedin-ui.js',
  'content-scripts/linkedin-extractors.js',
  'content-scripts/linkedin-utils.js',
  'content-scripts/linkedin-dom.js',
  'content-scripts/linkedin-state.js',
  'content-scripts/linkedin-core.js',
  'content-scripts/linkedin-selectors.js',
  'content-scripts/dashboard-sync.js',
  'content-scripts/lru-map.js',
  'content-scripts/facebook.js',
  'content-scripts/instagram.js',
  'content-scripts/instagram/ui.js',
  'content-scripts/instagram/followers-import.js',
  'content-scripts/instagram/post-import.js',
  'content-scripts/instagram/profile-import.js',
  'content-scripts/instagram/utils.js',
  'content-scripts/overlay.js',
  'content-scripts/settings-manager.js'
];

// Copy static files (manifest, HTML, CSS, images)
function copyStaticFiles() {
  const staticFiles = [
    { src: 'manifest.json', dest: 'dist/manifest.json' },
    { src: 'popup.html', dest: 'dist/popup.html' },
    { src: 'icon-16.png', dest: 'dist/icon-16.png' },
    { src: 'icon-48.png', dest: 'dist/icon-48.png' },
    { src: 'icon-128.png', dest: 'dist/icon-128.png' }
  ];

  // Create dist directory if it doesn't exist
  if (!fs.existsSync(outdir)) {
    fs.mkdirSync(outdir, { recursive: true });
  }

  // Copy individual files
  staticFiles.forEach(({ src, dest }) => {
    const srcPath = path.join(__dirname, src);
    const destPath = path.join(__dirname, dest);
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    }
  });

  // Copy styles directory
  const stylesSrc = path.join(__dirname, 'styles');
  const stylesDest = path.join(outdir, 'styles');
  if (fs.existsSync(stylesSrc)) {
    if (!fs.existsSync(stylesDest)) {
      fs.mkdirSync(stylesDest, { recursive: true });
    }
    const cssFiles = fs.readdirSync(stylesSrc).filter(f => f.endsWith('.css'));
    cssFiles.forEach(file => {
      fs.copyFileSync(
        path.join(stylesSrc, file),
        path.join(stylesDest, file)
      );
    });
  }
}

// Build function
async function build() {
  console.log('Building Chrome extension...');

  // Copy static files
  copyStaticFiles();
  console.log('✓ Static files copied');

  // Build JavaScript files
  const context = await esbuild.context({
    entryPoints,
    bundle: false, // Keep files separate (Chrome extension requirement)
    minify: true,
    sourcemap: true,
    target: 'es2020',
    outdir,
    loader: {
      '.js': 'js'
    },
    logLevel: 'info'
  });

  if (isWatch) {
    await context.watch();
    console.log('✓ Watching for changes...');
  } else {
    await context.rebuild();
    await context.dispose();
    console.log('✓ Build complete');
    console.log(`\nOutput directory: ${outdir}`);
  }
}

// Run build
build().catch(error => {
  console.error('Build failed:', error);
  process.exit(1);
});
