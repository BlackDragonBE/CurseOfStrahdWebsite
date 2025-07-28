const chokidar = require('chokidar');
const { WebSocketServer } = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { build } = require('./build.js');

const PORT = 3000;
const WS_PORT = 3001;
const SOURCE_DIR = path.join(__dirname, '..', 'CurseOfStrahdNotes');
const OUTPUT_DIR = path.join(__dirname, 'docs');

// MIME types for serving files
const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function getContentType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    return mimeTypes[ext] || 'text/plain';
}

// WebSocket server for live reload
const wss = new WebSocketServer({ port: WS_PORT });
let clients = [];

wss.on('connection', (ws) => {
    clients.push(ws);
    console.log(`📡 Browser connected for live reload (${clients.length} total)`);
    
    ws.on('close', () => {
        clients = clients.filter(client => client !== ws);
        console.log(`📡 Browser disconnected from live reload (${clients.length} remaining)`);
    });
    
    ws.on('error', (error) => {
        console.error('📡 WebSocket error:', error);
    });
});

wss.on('error', (error) => {
    console.error('📡 WebSocket server error:', error);
});

function broadcastReload() {
    console.log(`📡 Broadcasting reload to ${clients.length} browser(s)`);
    clients.forEach((client, index) => {
        try {
            if (client.readyState === 1) { // WebSocket.OPEN
                client.send('reload');
            } else {
                console.log(`📡 Client ${index} not ready, state: ${client.readyState}`);
            }
        } catch (error) {
            console.error(`📡 Error sending to client ${index}:`, error);
        }
    });
    // Clean up closed connections
    clients = clients.filter(client => client.readyState === 1);
}

// HTTP server
const server = http.createServer((req, res) => {
    let filePath = path.join(OUTPUT_DIR, req.url === '/' ? 'index.html' : req.url);
    
    // Handle URL decoding for files with spaces
    try {
        filePath = decodeURIComponent(filePath);
    } catch (e) {
        // If decoding fails, use original path
    }
    
    // Security check - ensure we're serving from OUTPUT_DIR
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(path.normalize(OUTPUT_DIR))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
    }
    
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404);
            res.end('File not found');
            return;
        }
        
        const contentType = getContentType(filePath);
        res.writeHead(200, { 'Content-Type': contentType });
        
        // Inject live reload script into HTML files
        if (contentType === 'text/html') {
            const liveReloadScript = `
<script>
(function() {
    console.log('🔄 Live reload client starting...');
    let ws;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 10;

    function connect() {
        try {
            ws = new WebSocket('ws://localhost:${WS_PORT}');
            
            ws.onopen = function() {
                console.log('✅ Live reload connected');
                reconnectAttempts = 0;
            };
            
            ws.onmessage = function(event) {
                if (event.data === 'reload') {
                    console.log('🔄 Reloading page...');
                    location.reload();
                }
            };
            
            ws.onclose = function() {
                console.log('❌ Live reload disconnected');
                // Try to reconnect with exponential backoff
                if (reconnectAttempts < maxReconnectAttempts) {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), 10000);
                    console.log(\`🔄 Reconnecting in \${delay}ms...\`);
                    setTimeout(connect, delay);
                    reconnectAttempts++;
                } else {
                    console.log('❌ Max reconnection attempts reached');
                }
            };
            
            ws.onerror = function(error) {
                console.error('❌ Live reload error:', error);
            };
        } catch (error) {
            console.error('❌ Failed to create WebSocket:', error);
        }
    }
    
    connect();
})();
</script>`;
            const htmlString = data.toString();
            const modifiedHtml = htmlString.replace('</body>', liveReloadScript + '\n</body>');
            res.end(modifiedHtml);
        } else {
            res.end(data);
        }
    });
});

let isBuilding = false;
let buildQueued = false;

async function rebuildSite() {
    if (isBuilding) {
        buildQueued = true;
        return;
    }
    
    isBuilding = true;
    console.log('\n🔄 Rebuilding website...');
    
    try {
        build();
        console.log('✅ Build complete! Refreshing browsers...');
        broadcastReload();
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

// File watcher
console.log('🔍 Setting up file watchers...');

// Watch source files
const sourceWatcher = chokidar.watch([
    path.join(SOURCE_DIR, '**/*.md'),
    path.join(SOURCE_DIR, '_images/**/*')
], {
    ignored: /node_modules/,
    persistent: true,
    ignoreInitial: true
});

// Watch build script and CSS files
const buildWatcher = chokidar.watch([
    path.join(__dirname, 'build.js')
], {
    persistent: true,
    ignoreInitial: true
});

// Separate watcher for CSS edits - rebuild and reload
const cssWatcher = chokidar.watch([
    path.join(__dirname, 'src', 'styles.css')
], {
    persistent: true,
    ignoreInitial: true
});

sourceWatcher.on('change', (filePath) => {
    console.log(`📝 File changed: ${path.relative(SOURCE_DIR, filePath)}`);
    rebuildSite();
});

sourceWatcher.on('add', (filePath) => {
    console.log(`➕ File added: ${path.relative(SOURCE_DIR, filePath)}`);
    rebuildSite();
});

sourceWatcher.on('unlink', (filePath) => {
    console.log(`➖ File removed: ${path.relative(SOURCE_DIR, filePath)}`);
    rebuildSite();
});

buildWatcher.on('change', (filePath) => {
    console.log(`🔧 Build script changed: ${path.basename(filePath)}`);
    rebuildSite();
});

cssWatcher.on('change', (filePath) => {
    console.log(`🎨 CSS changed: ${path.basename(filePath)}`);
    rebuildSite();
});

// Initial build
console.log('🏗️  Building initial version...');
build();

// Start servers
server.listen(PORT, () => {
    console.log(`\n🌐 Development server running at http://localhost:${PORT}`);
    console.log(`🔄 Live reload server running on port ${WS_PORT}`);
    console.log(`👀 Watching for changes in:`);
    console.log(`   📝 Source files: ${path.relative(__dirname, SOURCE_DIR)}`);
    console.log(`   🔧 Build script: build.js`);
    console.log(`   🎨 CSS file: src/styles.css`);
    console.log('\nPress Ctrl+C to stop the server\n');
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n👋 Shutting down development server...');
    server.close();
    wss.close();
    sourceWatcher.close();
    buildWatcher.close();
    cssWatcher.close();
    process.exit(0);
});