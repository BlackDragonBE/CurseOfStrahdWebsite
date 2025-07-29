const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const { build } = require('./build.js');

const SOURCE_DIR = path.join(__dirname, '..', 'CurseOfStrahdNotes');
let liveServerProcess = null;
let isBuilding = false;
let buildQueued = false;
let rebuildTimeout = null;

function debouncedRebuild() {
    // Clear any existing timeout
    if (rebuildTimeout) {
        clearTimeout(rebuildTimeout);
    }
    
    // Set a new timeout to rebuild after a short delay
    rebuildTimeout = setTimeout(rebuildSite, 300);
}

async function rebuildSite() {
    if (isBuilding) {
        buildQueued = true;
        return;
    }
    
    isBuilding = true;
    console.log('\n🔄 Rebuilding website...');
    
    try {
        build();
        console.log('✅ Build complete! Live-server will auto-refresh...');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
    }
    
    isBuilding = false;
    
    // If another build was queued while we were building, run it now
    if (buildQueued) {
        buildQueued = false;
        setTimeout(rebuildSite, 100);
    }
}

// Function to start live-server
function startLiveServer() {
    console.log('🌐 Starting live-server...');
    
    liveServerProcess = spawn('npx', [
        'live-server',
        'docs',
        '--port=3000',
        '--no-browser', // Don't auto-open browser in CLI environment
        '--ignore=node_modules',
        '--wait=200' // Wait 200ms before reloading
    ], {
        stdio: 'inherit',
        shell: true
    });
    
    liveServerProcess.on('error', (error) => {
        console.error('❌ Failed to start live-server:', error);
    });
    
    liveServerProcess.on('close', (code) => {
        if (code !== 0) {
            console.log(`Live-server exited with code ${code}`);
        }
    });
}

// Initial build
console.log('🏗️  Building initial version...');
build();

// Start live-server
startLiveServer();

// File watchers
console.log('🔍 Setting up file watchers...');

// Watch source files (markdown only - images rarely change during development)
const sourceWatcher = chokidar.watch([
    path.join(SOURCE_DIR, '**/*.md')
], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
});

// Separate watcher for images with longer debounce
const imageWatcher = chokidar.watch([
    path.join(SOURCE_DIR, '_images/**/*')
], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
});

// Watch build script and CSS files
const buildWatcher = chokidar.watch([
    path.join(__dirname, 'build.js'),
    path.join(__dirname, 'src', 'styles.css')
], {
    persistent: true,
    ignoreInitial: true
});

sourceWatcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

sourceWatcher.on('add', (filePath) => {
    console.log(`➕ File added: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

sourceWatcher.on('unlink', (filePath) => {
    console.log(`➖ File removed: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

// Image watcher with longer debounce to avoid EBUSY errors
imageWatcher.on('change', (filePath) => {
    console.log(`🖼️  Image changed: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

imageWatcher.on('add', (filePath) => {
    console.log(`🖼️  Image added: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

imageWatcher.on('unlink', (filePath) => {
    console.log(`🖼️  Image removed: ${path.relative(SOURCE_DIR, filePath)}`);
    debouncedRebuild();
});

buildWatcher.on('change', (filePath) => {
    console.log(`🔧 Build script changed: ${path.basename(filePath)}`);
    debouncedRebuild();
});

console.log(`\n🌐 Development server will be available at http://localhost:3000`);
console.log(`🔄 Live reload enabled - changes will auto-refresh the browser`);
console.log(`👀 Watching for changes in:`);
console.log(`   📝 Markdown files: ${path.relative(__dirname, SOURCE_DIR)}`);
console.log(`   🖼️  Images: ${path.relative(__dirname, SOURCE_DIR)}_images/`);
console.log(`   🔧 Build script: build.js`);
console.log(`   🎨 CSS file: src/styles.css`);
console.log('\nPress Ctrl+C to stop the server\n');

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    if (liveServerProcess) {
        liveServerProcess.kill('SIGTERM');
    }
    sourceWatcher.close();
    imageWatcher.close();
    buildWatcher.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n👋 Shutting down development server...');
    if (liveServerProcess) {
        liveServerProcess.kill('SIGTERM');
    }
    sourceWatcher.close();
    imageWatcher.close();
    buildWatcher.close();
    process.exit(0);
});