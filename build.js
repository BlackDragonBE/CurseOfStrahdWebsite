const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const SOURCE_DIR = path.join(__dirname, '..', 'CurseOfStrahdNotes');
const OUTPUT_DIR = path.join(__dirname, 'docs');

const FOLDERS_TO_COPY = [
    '1_SessionNotes', 
    '2_Locations',
    '3_Characters',
    '4_Items',
    '5_Concepts',
    '7_Quests',
    '_images'
];

// Global file map to resolve Obsidian links
let fileMap = new Map();

function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

function copyImages(sourceDir, outputDir) {
    const imagesSource = path.join(sourceDir, '_images');
    const imagesOutput = path.join(outputDir, 'images');
    
    if (fs.existsSync(imagesSource)) {
        ensureDir(imagesOutput);
        const files = fs.readdirSync(imagesSource);
        
        files.forEach(file => {
            const sourcePath = path.join(imagesSource, file);
            const outputPath = path.join(imagesOutput, file);
            fs.copyFileSync(sourcePath, outputPath);
        });
    }
}

function buildFileMap() {
    fileMap.clear();
    
    function scanDirectory(dir) {
        if (!fs.existsSync(dir)) return;
        
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory()) {
                scanDirectory(fullPath);
            } else if (item.endsWith('.md')) {
                const baseName = path.basename(item, '.md');
                const relativePath = path.relative(SOURCE_DIR, fullPath);
                const outputPath = relativePath.replace(/\.md$/, '.html').replace(/\\/g, '/');
                
                // Map both the exact filename and common variations
                fileMap.set(baseName, outputPath);
                fileMap.set(baseName.toLowerCase(), outputPath);
                fileMap.set(baseName.replace(/\s+/g, '-').toLowerCase(), outputPath);
            }
        });
    }
    
    FOLDERS_TO_COPY.forEach(folder => {
        if (folder !== '_images') {
            scanDirectory(path.join(SOURCE_DIR, folder));
        }
    });
}

function resolveObsidianLink(linkText) {
    // Try exact match first
    if (fileMap.has(linkText)) {
        return fileMap.get(linkText);
    }
    
    // Try lowercase match
    if (fileMap.has(linkText.toLowerCase())) {
        return fileMap.get(linkText.toLowerCase());
    }
    
    // Try hyphenated lowercase match
    const hyphenated = linkText.replace(/\s+/g, '-').toLowerCase();
    if (fileMap.has(hyphenated)) {
        return fileMap.get(hyphenated);
    }
    
    // If no match found, return original with .html extension
    return `${linkText.replace(/\s+/g, '-').toLowerCase()}.html`;
}

function processMarkdownFile(filePath, relativePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Convert Obsidian-style links [[link]] to markdown links
    const processedContent = content.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
        // Handle Obsidian pipe syntax [[Target|Display Text]]
        let targetFile = linkText;
        let displayText = linkText;
        
        if (linkText.includes('|')) {
            const parts = linkText.split('|');
            targetFile = parts[0].trim();
            displayText = parts[1].trim();
        }
        
        const resolvedPath = resolveObsidianLink(targetFile);
        
        // Calculate relative path from current file to target file
        const currentDir = path.dirname(relativePath);
        let relativeLinkPath = resolvedPath;
        
        // If we're in a subdirectory, adjust the path
        if (currentDir !== '.') {
            const depth = currentDir.split('/').length;
            const upLevels = '../'.repeat(depth);
            relativeLinkPath = upLevels + resolvedPath;
        }
        
        // URL encode the path for spaces and special characters
        const encodedPath = relativeLinkPath.split('/').map(segment => {
            // Only encode the filename part, not the directory separators
            return segment.includes('.html') ? encodeURIComponent(segment) : segment;
        }).join('/');
        
        return `[${displayText}](${encodedPath})`;
    });
    
    // Convert markdown to HTML
    const htmlContent = marked(processedContent);
    
    // Create full HTML page
    const title = path.basename(filePath, '.md');
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="../index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="../1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="../2_Locations/index.html">Locations</a></li>
                <li><a href="../3_Characters/index.html">Characters</a></li>
                <li><a href="../4_Items/index.html">Items</a></li>
                <li><a href="../5_Concepts/index.html">Concepts</a></li>
                <li><a href="../7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <article>
            <h1>${title}</h1>
            ${htmlContent}
        </article>
    </main>
</body>
</html>`;
    
    return fullHtml;
}

function createIndexPage(folderName, files) {
    const title = folderName.replace(/^\d+_/, '').replace(/_/g, ' ');
    
    const fileList = files
        .filter(file => file.endsWith('.md'))
        .map(file => {
            const name = path.basename(file, '.md');
            const htmlFileName = file.replace('.md', '.html');
            return `<li><a href="${encodeURIComponent(htmlFileName)}">${name}</a></li>`;
        })
        .join('\n');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="../index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="../1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="../2_Locations/index.html">Locations</a></li>
                <li><a href="../3_Characters/index.html">Characters</a></li>
                <li><a href="../4_Items/index.html">Items</a></li>
                <li><a href="../5_Concepts/index.html">Concepts</a></li>
                <li><a href="../7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <h1>${title}</h1>
        <ul class="file-list">
            ${fileList}
        </ul>
    </main>
</body>
</html>`;
}

function processFolder(folderName) {
    const sourceFolder = path.join(SOURCE_DIR, folderName);
    const outputFolder = path.join(OUTPUT_DIR, folderName);
    
    if (!fs.existsSync(sourceFolder)) {
        console.warn(`Source folder ${folderName} does not exist`);
        return;
    }
    
    ensureDir(outputFolder);
    
    function processDirectory(currentSource, currentOutput) {
        const items = fs.readdirSync(currentSource);
        const files = [];
        
        items.forEach(item => {
            const sourcePath = path.join(currentSource, item);
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                const subOutputDir = path.join(currentOutput, item);
                ensureDir(subOutputDir);
                processDirectory(sourcePath, subOutputDir);
            } else if (item.endsWith('.md')) {
                files.push(item);
                const htmlFileName = item.replace('.md', '.html');
                const outputPath = path.join(currentOutput, htmlFileName);
                const relativePath = path.relative(OUTPUT_DIR, outputPath).replace(/\\/g, '/');
                const htmlContent = processMarkdownFile(sourcePath, relativePath);
                fs.writeFileSync(outputPath, htmlContent);
            }
        });
        
        // Create index.html for this directory
        if (files.length > 0) {
            const indexPath = path.join(currentOutput, 'index.html');
            const indexContent = createIndexPage(path.basename(currentOutput), files);
            fs.writeFileSync(indexPath, indexContent);
        }
    }
    
    processDirectory(sourceFolder, outputFolder);
}

function createMainIndex() {
    const indexContent = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="2_Locations/index.html">Locations</a></li>
                <li><a href="3_Characters/index.html">Characters</a></li>
                <li><a href="4_Items/index.html">Items</a></li>
                <li><a href="5_Concepts/index.html">Concepts</a></li>
                <li><a href="7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <h1>Curse of Strahd Campaign</h1>
        <p>Welcome to our Curse of Strahd campaign website. Navigate using the menu above to explore different sections.</p>
        
        <div class="section-grid">
            <div class="section-card">
                <h2><a href="1_SessionNotes/index.html">Session Notes</a></h2>
                <p>Detailed notes from each game session.</p>
            </div>
            <div class="section-card">
                <h2><a href="2_Locations/index.html">Locations</a></h2>
                <p>Information about places in Barovia and beyond.</p>
            </div>
            <div class="section-card">
                <h2><a href="3_Characters/index.html">Characters</a></h2>
                <p>NPCs, players, deities, and familiars encountered in the campaign.</p>
            </div>
            <div class="section-card">
                <h2><a href="4_Items/index.html">Items</a></h2>
                <p>Special items and artifacts found during the adventure.</p>
            </div>
            <div class="section-card">
                <h2><a href="5_Concepts/index.html">Concepts</a></h2>
                <p>Important concepts, organizations, and lore.</p>
            </div>
            <div class="section-card">
                <h2><a href="7_Quests/index.html">Quests</a></h2>
                <p>Active, completed, and failed quest lines.</p>
            </div>
        </div>
    </main>
</body>
</html>`;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexContent);
}

function copyCSS() {
    const sourceCSSPath = path.join(__dirname, 'src', 'styles.css');
    const outputCSSPath = path.join(OUTPUT_DIR, 'styles.css');
    
    if (fs.existsSync(sourceCSSPath)) {
        fs.copyFileSync(sourceCSSPath, outputCSSPath);
        console.log('CSS file copied from src/styles.css');
    } else {
        console.error('Warning: src/styles.css not found');
    }
}

function build() {
    console.log('Starting build process...');
    
    // Clean and create output directory
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true });
    }
    ensureDir(OUTPUT_DIR);
    
    // Build file map first for link resolution
    console.log('Building file map for link resolution...');
    buildFileMap();
    
    // Copy images
    copyImages(SOURCE_DIR, OUTPUT_DIR);
    
    // Process each folder
    FOLDERS_TO_COPY.forEach(folder => {
        if (folder !== '_images') {
            console.log(`Processing ${folder}...`);
            processFolder(folder);
        }
    });
    
    // Create main files
    createMainIndex();
    copyCSS();
    
    console.log('Build complete! Website generated in docs/ folder');
    console.log('Ready for GitHub Pages deployment');
}

if (require.main === module) {
    build();
}

module.exports = { build };