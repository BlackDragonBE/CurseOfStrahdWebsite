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

function createCSS() {
    const cssContent = `@import url('https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Crimson+Text:ital,wght@0,400;0,600;1,400&display=swap');

* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: 'Crimson Text', Georgia, serif;
    line-height: 1.7;
    color: #d4af37;
    background: linear-gradient(135deg, #1a1a2e 0%, #16213e 35%, #0f3460 100%);
    min-height: 100vh;
    background-attachment: fixed;
}

nav {
    background: linear-gradient(90deg, #8b0000 0%, #660000 50%, #8b0000 100%);
    color: #d4af37;
    padding: 1rem 0;
    position: sticky;
    top: 0;
    z-index: 100;
    box-shadow: 0 4px 15px rgba(0,0,0,0.6);
    border-bottom: 3px solid #d4af37;
}

.nav-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 2rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
}

nav h1 {
    margin: 0;
    font-family: 'Cinzel', serif;
    font-weight: 700;
    font-size: 1.8rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
}

nav h1 a {
    color: #d4af37;
    text-decoration: none;
    transition: color 0.3s ease;
}

nav h1 a:hover {
    color: #ffd700;
    text-shadow: 2px 2px 8px rgba(255,215,0,0.5);
}

nav ul {
    display: flex;
    list-style: none;
    gap: 2rem;
    flex-wrap: wrap;
}

nav a {
    color: #d4af37;
    text-decoration: none;
    font-weight: 600;
    font-size: 1.1rem;
    transition: all 0.3s ease;
    padding: 0.5rem 1rem;
    border-radius: 4px;
}

nav a:hover {
    color: #ffd700;
    background: rgba(212, 175, 55, 0.1);
    text-shadow: 1px 1px 3px rgba(255,215,0,0.5);
}

main {
    max-width: 1200px;
    margin: 2rem auto;
    padding: 0 2rem;
    background: linear-gradient(135deg, rgba(30,30,30,0.95) 0%, rgba(20,20,20,0.98) 100%);
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    border: 2px solid #8b0000;
    backdrop-filter: blur(10px);
}

article {
    padding: 2rem;
}

.section-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 2rem;
    margin-top: 2rem;
}

.section-card {
    background: linear-gradient(135deg, rgba(40,40,40,0.9) 0%, rgba(25,25,25,0.95) 100%);
    padding: 2rem;
    border-radius: 12px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    border: 2px solid #8b0000;
    border-left: 6px solid #d4af37;
    transition: all 0.3s ease;
    position: relative;
    overflow: hidden;
}

.section-card::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%);
}

.section-card:hover {
    transform: translateY(-5px);
    box-shadow: 0 8px 30px rgba(139,0,0,0.3);
    border-color: #d4af37;
}

.section-card h2 {
    margin-bottom: 1rem;
    color: #d4af37;
    font-family: 'Cinzel', serif;
    font-weight: 600;
    font-size: 1.4rem;
}

.section-card h2 a {
    color: inherit;
    text-decoration: none;
    transition: color 0.3s ease;
}

.section-card h2 a:hover {
    color: #ffd700;
    text-shadow: 1px 1px 3px rgba(255,215,0,0.3);
}

.section-card p {
    color: #c9c9c9;
    font-style: italic;
}

.file-list {
    list-style: none;
    padding: 2rem;
}

.file-list li {
    margin-bottom: 0.8rem;
    padding: 0.8rem 1rem;
    background: linear-gradient(90deg, rgba(40,40,40,0.6) 0%, rgba(30,30,30,0.8) 100%);
    border-radius: 6px;
    border-left: 4px solid #8b0000;
    transition: all 0.3s ease;
    border: 1px solid rgba(139,0,0,0.3);
}

.file-list li:hover {
    background: linear-gradient(90deg, rgba(139,0,0,0.2) 0%, rgba(40,40,40,0.8) 100%);
    border-left-color: #d4af37;
    transform: translateX(5px);
}

.file-list a {
    color: #d4af37;
    text-decoration: none;
    font-weight: 500;
    font-size: 1.1rem;
    transition: color 0.3s ease;
}

.file-list a:hover {
    color: #ffd700;
    text-shadow: 1px 1px 2px rgba(255,215,0,0.3);
}

h1, h2, h3, h4, h5, h6 {
    color: #d4af37;
    margin-bottom: 1rem;
    font-family: 'Cinzel', serif;
    font-weight: 600;
}

h1 {
    font-size: 2.5rem;
    text-align: center;
    margin-bottom: 2rem;
    text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
    border-bottom: 3px solid #8b0000;
    padding-bottom: 1rem;
}

p {
    margin-bottom: 1rem;
    color: #c9c9c9;
    text-align: justify;
}

blockquote {
    border-left: 4px solid #d4af37;
    margin: 1.5rem 0;
    padding-left: 1.5rem;
    color: #b8860b;
    font-style: italic;
    background: rgba(212,175,55,0.05);
    padding: 1rem 1.5rem;
    border-radius: 0 8px 8px 0;
}

code {
    background: rgba(139,0,0,0.2);
    padding: 0.3rem 0.6rem;
    border-radius: 4px;
    font-family: 'Courier New', monospace;
    color: #ffd700;
    border: 1px solid rgba(139,0,0,0.5);
}

pre {
    background: rgba(20,20,20,0.8);
    padding: 1.5rem;
    border-radius: 8px;
    overflow-x: auto;
    margin: 1rem 0;
    border: 2px solid #8b0000;
    color: #d4af37;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 1.5rem 0;
    background: rgba(30,30,30,0.8);
    border-radius: 8px;
    overflow: hidden;
    border: 2px solid #8b0000;
}

th, td {
    border: 1px solid #8b0000;
    padding: 1rem;
    text-align: left;
}

th {
    background: linear-gradient(90deg, #8b0000 0%, #660000 100%);
    font-weight: bold;
    color: #d4af37;
    font-family: 'Cinzel', serif;
}

td {
    color: #c9c9c9;
}

img {
    max-width: 100%;
    height: auto;
    border-radius: 8px;
    margin: 1rem 0;
    border: 3px solid #8b0000;
    box-shadow: 0 4px 15px rgba(0,0,0,0.5);
}

ul, ol {
    color: #c9c9c9;
    margin-left: 2rem;
    margin-bottom: 1rem;
}

li {
    margin-bottom: 0.5rem;
}

strong, b {
    color: #ffd700;
    font-weight: 600;
}

em, i {
    color: #d4af37;
}

a {
    color: #d4af37;
    text-decoration: none;
    border-bottom: 1px dotted #d4af37;
    transition: all 0.3s ease;
}

a:hover {
    color: #ffd700;
    border-bottom-color: #ffd700;
    text-shadow: 1px 1px 2px rgba(255,215,0,0.3);
}

hr {
    border: none;
    height: 2px;
    background: linear-gradient(90deg, transparent 0%, #8b0000 20%, #d4af37 50%, #8b0000 80%, transparent 100%);
    margin: 2rem 0;
}

@media (max-width: 768px) {
    .nav-container {
        flex-direction: column;
        text-align: center;
    }
    
    nav ul {
        margin-top: 1rem;
        justify-content: center;
        gap: 1rem;
    }
    
    nav a {
        font-size: 1rem;
        padding: 0.4rem 0.8rem;
    }
    
    main {
        margin: 1rem;
        padding: 0 1rem;
    }
    
    article {
        padding: 1rem;
    }
    
    .section-grid {
        grid-template-columns: 1fr;
        gap: 1rem;
    }
    
    .section-card {
        padding: 1.5rem;
    }
    
    h1 {
        font-size: 2rem;
    }
    
    nav h1 {
        font-size: 1.5rem;
    }
}`;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'styles.css'), cssContent);
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
    createCSS();
    
    console.log('Build complete! Website generated in docs/ folder');
    console.log('Ready for GitHub Pages deployment');
}

if (require.main === module) {
    build();
}

module.exports = { build };