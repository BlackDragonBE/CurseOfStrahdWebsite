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

function parseYamlFrontmatter(content) {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/;
    const match = content.match(frontmatterRegex);
    
    if (!match) {
        return { frontmatter: null, content: content };
    }
    
    const yamlString = match[1];
    const bodyContent = match[2];
    const frontmatter = {};
    
    // Simple YAML parser for basic key-value pairs and arrays
    const lines = yamlString.split('\n');
    let currentKey = null;
    
    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        
        if (trimmed.startsWith('- ')) {
            // Array item
            if (currentKey) {
                if (!Array.isArray(frontmatter[currentKey])) {
                    frontmatter[currentKey] = [];
                }
                frontmatter[currentKey].push(trimmed.substring(2));
            }
        } else if (trimmed.includes(':')) {
            // Key-value pair
            const colonIndex = trimmed.indexOf(':');
            const key = trimmed.substring(0, colonIndex).trim();
            const value = trimmed.substring(colonIndex + 1).trim();
            
            if (value) {
                frontmatter[key] = value;
                currentKey = null;
            } else {
                // Key without value, likely followed by array
                currentKey = key;
            }
        }
    }
    
    return { frontmatter, content: bodyContent };
}

function generatePropertiesHtml(frontmatter) {
    if (!frontmatter || Object.keys(frontmatter).length === 0) {
        return '';
    }
    
    const propertyItems = Object.entries(frontmatter)
        .map(([key, value]) => {
            const displayKey = key.charAt(0).toUpperCase() + key.slice(1);
            let displayValue;
            
            if (Array.isArray(value)) {
                displayValue = value.join(', ');
            } else {
                displayValue = value;
            }
            
            return `<li><span class="property-key">${displayKey}:</span> <span class="property-value">${displayValue}</span></li>`;
        })
        .join('\n');
    
    return `<div class="note-properties">
        <ul class="properties-list">
            ${propertyItems}
        </ul>
    </div>`;
}

function processMarkdownFile(filePath, relativePath) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse YAML frontmatter
    const { frontmatter, content: bodyContent } = parseYamlFrontmatter(content);
    
    // Convert Obsidian-style links [[link]] to markdown links
    const processedContent = bodyContent.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
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
    
    // Generate properties HTML
    const propertiesHtml = generatePropertiesHtml(frontmatter);
    
    // Create full HTML page
    const title = path.basename(filePath, '.md');
    
    // Calculate depth for CSS path and navigation links
    const currentDir = path.dirname(relativePath);
    const depth = currentDir === '.' ? 0 : currentDir.split('/').length;
    const cssPath = depth === 0 ? 'styles.css' : '../'.repeat(depth) + 'styles.css';
    const basePath = depth === 0 ? '' : '../'.repeat(depth);
    
    const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="${basePath}index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="${basePath}1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="${basePath}2_Locations/index.html">Locations</a></li>
                <li><a href="${basePath}3_Characters/index.html">Characters</a></li>
                <li><a href="${basePath}4_Items/index.html">Items</a></li>
                <li><a href="${basePath}5_Concepts/index.html">Concepts</a></li>
                <li><a href="${basePath}7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <article>
            <h1>${title}</h1>
            ${propertiesHtml}
            ${htmlContent}
        </article>
    </main>
</body>
</html>`;
    
    return fullHtml;
}


function createIndexPage(folderName, files, subdirectories = [], depth = 1) {
    const title = folderName.replace(/^\d+_/, '').replace(/_/g, ' ');
    const cssPath = depth === 0 ? 'styles.css' : '../'.repeat(depth) + 'styles.css';
    const basePath = depth === 0 ? '' : '../'.repeat(depth);
    
    const fileList = files
        .filter(file => file.endsWith('.md'))
        .sort((a, b) => {
            // Extract numeric prefix for natural sorting (e.g., "1_cos.md" vs "10_cos.md")
            const aMatch = a.match(/^(\d+)/);
            const bMatch = b.match(/^(\d+)/);
            
            if (aMatch && bMatch) {
                const aNum = parseInt(aMatch[1], 10);
                const bNum = parseInt(bMatch[1], 10);
                return aNum - bNum;
            }
            
            // Fallback to alphabetical sorting
            return a.localeCompare(b);
        })
        .map(file => {
            const name = path.basename(file, '.md');
            const htmlFileName = file.replace('.md', '.html');
            return `<li><a href="${encodeURIComponent(htmlFileName)}">${name}</a></li>`;
        })
        .join('\n');
    
    const subdirectoryList = subdirectories
        .map(subdir => {
            const displayName = subdir.replace(/_/g, ' ');
            return `<li><a href="${encodeURIComponent(subdir)}/index.html">${displayName}</a></li>`;
        })
        .join('\n');
    
    const combinedList = [subdirectoryList, fileList].filter(list => list.length > 0).join('\n');
    
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="${basePath}index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="${basePath}1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="${basePath}2_Locations/index.html">Locations</a></li>
                <li><a href="${basePath}3_Characters/index.html">Characters</a></li>
                <li><a href="${basePath}4_Items/index.html">Items</a></li>
                <li><a href="${basePath}5_Concepts/index.html">Concepts</a></li>
                <li><a href="${basePath}7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <h1>${title}</h1>
        <ul class="file-list">
            ${combinedList}
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
        const subdirectories = [];
        
        items.forEach(item => {
            const sourcePath = path.join(currentSource, item);
            const stat = fs.statSync(sourcePath);
            
            if (stat.isDirectory()) {
                subdirectories.push(item);
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
        
        // Create index.html for this directory if it has files OR subdirectories
        if (files.length > 0 || subdirectories.length > 0) {
            const indexPath = path.join(currentOutput, 'index.html');
            // Calculate depth based on how many levels down from OUTPUT_DIR we are
            const relativePath = path.relative(OUTPUT_DIR, currentOutput);
            const depth = relativePath === '' ? 0 : relativePath.split(path.sep).length;
            const indexContent = createIndexPage(path.basename(currentOutput), files, subdirectories, depth);
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
            <a href="1_SessionNotes/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Session Notes</h2>
                    <p>Detailed notes from each game session.</p>
                </div>
            </a>
            <a href="2_Locations/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Locations</h2>
                    <p>Information about places in Barovia and beyond.</p>
                </div>
            </a>
            <a href="3_Characters/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Characters</h2>
                    <p>NPCs, players, deities, and familiars encountered in the campaign.</p>
                </div>
            </a>
            <a href="4_Items/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Items</h2>
                    <p>Special items and artifacts found during the adventure.</p>
                </div>
            </a>
            <a href="5_Concepts/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Concepts</h2>
                    <p>Important concepts, organizations, and lore.</p>
                </div>
            </a>
            <a href="7_Quests/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Quests</h2>
                    <p>Active, completed, and failed quest lines.</p>
                </div>
            </a>
        </div>
    </main>
</body>
</html>`;
    
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.html'), indexContent);
}

function createCSS() {
    const cssSource = path.join(__dirname, 'src', 'styles.css');
    const cssOutput = path.join(OUTPUT_DIR, 'styles.css');
    
    if (fs.existsSync(cssSource)) {
        fs.copyFileSync(cssSource, cssOutput);
        console.log('Copied CSS from src/styles.css to docs/styles.css');
    } else {
        console.warn('Warning: src/styles.css not found');
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
    createCSS();
    
    console.log('Build complete! Website generated in docs/ folder');
    console.log('Ready for GitHub Pages deployment');
}

if (require.main === module) {
    build();
}

module.exports = { build };