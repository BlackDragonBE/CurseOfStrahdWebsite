const { spawn } = require('child_process');
const chokidar = require('chokidar');
const path = require('path');
const http = require('http');
const fs = require('fs');
const WebSocket = require('ws');
const { build } = require('./build.js');

const SOURCE_DIR = path.join(__dirname, '..', 'CurseOfStrahdNotes');
let liveServerProcess = null;
let isBuilding = false;
let buildQueued = false;
let rebuildTimeout = null;

// WebSocket server for live reload
let wss = null;
const WEBSOCKET_PORT = 35729;

function debouncedRebuild() {
    console.log('🔄 Debounced rebuild triggered...');
    
    // Clear any existing timeout
    if (rebuildTimeout) {
        clearTimeout(rebuildTimeout);
        console.log('⏰ Cleared existing rebuild timeout');
    }
    
    // Set a new timeout to rebuild after a short delay
    rebuildTimeout = setTimeout(rebuildSite, 300);
    console.log('⏰ Set rebuild timeout for 300ms');
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
        
        // Notify all connected WebSocket clients to reload
        if (wss) {
            wss.clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send('reload');
                }
            });
            console.log(`✅ Build complete! Notified ${wss.clients.size} browser(s) to reload`);
        } else {
            console.log('✅ Build complete! (No WebSocket clients connected)');
        }
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

// Function to start WebSocket server for live reload
function startWebSocketServer() {
    wss = new WebSocket.Server({ port: WEBSOCKET_PORT });
    
    wss.on('connection', (ws) => {
        console.log('🔌 Browser connected for live reload');
        
        ws.on('close', () => {
            console.log('🔌 Browser disconnected from live reload');
        });
    });
    
    console.log(`🔌 WebSocket server running on port ${WEBSOCKET_PORT} for live reload`);
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
        '--entry-file=index.html' // Default entry point
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

// Start WebSocket server for live reload
startWebSocketServer();

// Start live-server
startLiveServer();

// File watchers
console.log('🔍 Setting up file watchers...');
console.log(`📁 SOURCE_DIR: ${SOURCE_DIR}`);
console.log(`📁 __dirname: ${__dirname}`);

// Check if source directory exists
if (!require('fs').existsSync(SOURCE_DIR)) {
    console.error(`❌ SOURCE_DIR does not exist: ${SOURCE_DIR}`);
    process.exit(1);
}

// Watch source files (markdown only - images rarely change during development)
// Try watching directories directly instead of glob patterns
const sourceWatcher = chokidar.watch(SOURCE_DIR, {
    ignored: [
        /node_modules/, 
        /\.git/,
        /\.obsidian/,  // Ignore Obsidian metadata
        '**/.*'        // Ignore hidden files
    ],
    persistent: true,
    ignoreInitial: true,
    depth: 99,         // Watch deeply nested directories
    usePolling: false, // Try without polling first
    awaitWriteFinish: { // Wait for file writes to complete
        stabilityThreshold: 100,
        pollInterval: 50
    }
});

// Add debugging for watcher ready
sourceWatcher.on('ready', () => {
    console.log('✅ Source watcher is ready and watching for changes');
    const watchedPaths = sourceWatcher.getWatched();
    console.log('📂 Watched directories:', Object.keys(watchedPaths).length);
    
    // Show first few directories being watched
    const dirs = Object.keys(watchedPaths).slice(0, 5);
    dirs.forEach(dir => {
        console.log(`   📁 ${dir} (${watchedPaths[dir].length} files)`);
    });
    
    if (Object.keys(watchedPaths).length > 5) {
        console.log(`   ... and ${Object.keys(watchedPaths).length - 5} more directories`);
    }
});

// Separate watcher for images with longer debounce
const imageWatcher = chokidar.watch([
    path.join(SOURCE_DIR, '_images/**/*')
], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
});

imageWatcher.on('ready', () => {
    console.log('✅ Image watcher is ready and watching for changes');
});

// Watch build script, templates, library files, and CSS files
const buildWatcher = chokidar.watch([
    path.join(__dirname, 'build.js'),
    path.join(__dirname, 'templates', '**', '*.js'),
    path.join(__dirname, 'lib', '**', '*.js'),
    path.join(__dirname, 'src', 'styles.css'),
    path.join(__dirname, 'docs', 'search.js')
], {
    persistent: true,
    ignoreInitial: true
});

buildWatcher.on('ready', () => {
    console.log('✅ Build watcher is ready and watching for changes');
});

sourceWatcher.on('change', (filePath) => {
    // Only process markdown files
    if (path.extname(filePath) === '.md') {
        console.log(`📝 Markdown file changed: ${path.relative(SOURCE_DIR, filePath)}`);
        debouncedRebuild();
    } else {
        console.log(`🔍 Non-markdown file changed (ignored): ${path.relative(SOURCE_DIR, filePath)}`);
    }
});

sourceWatcher.on('add', (filePath) => {
    if (path.extname(filePath) === '.md') {
        console.log(`➕ Markdown file added: ${path.relative(SOURCE_DIR, filePath)}`);
        debouncedRebuild();
    } else {
        console.log(`🔍 Non-markdown file added (ignored): ${path.relative(SOURCE_DIR, filePath)}`);
    }
});

sourceWatcher.on('unlink', (filePath) => {
    if (path.extname(filePath) === '.md') {
        console.log(`➖ Markdown file removed: ${path.relative(SOURCE_DIR, filePath)}`);
        debouncedRebuild();
    } else {
        console.log(`🔍 Non-markdown file removed (ignored): ${path.relative(SOURCE_DIR, filePath)}`);
    }
});

sourceWatcher.on('error', (error) => {
    console.error('❌ Source watcher error:', error);
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

imageWatcher.on('error', (error) => {
    console.error('❌ Image watcher error:', error);
});

buildWatcher.on('change', (filePath) => {
    console.log(`🔧 Build file changed: ${path.relative(__dirname, filePath)}`);
    debouncedRebuild();
});

buildWatcher.on('add', (filePath) => {
    console.log(`🔧 Build file added: ${path.relative(__dirname, filePath)}`);
    debouncedRebuild();
});

buildWatcher.on('unlink', (filePath) => {
    console.log(`🔧 Build file removed: ${path.relative(__dirname, filePath)}`);
    debouncedRebuild();
});

buildWatcher.on('error', (error) => {
    console.error('❌ Build watcher error:', error);
});

console.log(`\n🌐 Development server will be available at http://localhost:3000`);
console.log(`🔄 Live reload enabled - changes will auto-refresh the browser`);
console.log(`👀 Watching for changes in:`);
console.log(`   📝 Markdown files: ${path.relative(__dirname, SOURCE_DIR)}`);
console.log(`   🖼️  Images: ${path.relative(__dirname, SOURCE_DIR)}_images/`);
console.log(`   🔧 Build files: build.js, templates/, lib/`);
console.log(`   🎨 CSS file: src/styles.css`);
console.log(`   🔍 Search script: docs/search.js`);
console.log('\nPress Ctrl+C to stop the server');
console.log('💡 If file watching isn\'t working, try manually triggering a build by editing this dev-server-live.js file');
console.log('💡 On Windows, some editors don\'t trigger file system events properly - consider using polling mode\n');

// If no file changes are detected after 10 seconds, suggest polling mode
setTimeout(() => {
    console.log('⚠️  If you\'ve made changes but nothing is detected, try enabling polling mode:');
    console.log('   Edit this file and change "usePolling: false" to "usePolling: true"');
}, 10000);

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    if (liveServerProcess) {
        liveServerProcess.kill('SIGTERM');
    }
    if (wss) {
        wss.close();
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
    if (wss) {
        wss.close();
    }
    sourceWatcher.close();
    imageWatcher.close();
    buildWatcher.close();
    process.exit(0);
});