const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { extractTextFromHtml, getCategoryFromPath, parseYamlFrontmatter, generatePropertiesHtml } = require('./content-utils');
const { renderPageTemplate } = require('../templates/page');

// Global file map to resolve Obsidian links
let fileMap = new Map();

/**
 * Builds a global file map for link resolution
 * @param {string} sourceDir - Source directory to scan
 * @param {string[]} folders - Folders to scan for files
 */
function buildFileMap(sourceDir, folders) {
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
                const relativePath = path.relative(sourceDir, fullPath);
                const outputPath = relativePath.replace(/\.md$/, '.html').replace(/\\/g, '/');
                
                // Map both the exact filename and common variations
                fileMap.set(baseName, outputPath);
                fileMap.set(baseName.toLowerCase(), outputPath);
                fileMap.set(baseName.replace(/\s+/g, '-').toLowerCase(), outputPath);
            }
        });
    }
    
    folders.forEach(folder => {
        if (folder !== '_images') {
            scanDirectory(path.join(sourceDir, folder));
        }
    });
}

/**
 * Resolves Obsidian-style links to HTML paths
 * @param {string} linkText - The link text to resolve
 * @returns {string} Resolved HTML path
 */
function resolveObsidianLink(linkText) {
    // Handle fragment identifiers (header links)
    let fragment = '';
    let fileName = linkText;
    
    if (linkText.includes('#')) {
        const parts = linkText.split('#');
        fileName = parts[0];
        // Convert fragment to match marked.js header ID format: lowercase with hyphens
        const fragmentText = parts[1]
            .toLowerCase()
            .replace(/[^\w\s-]/g, '') // Remove special characters except spaces and hyphens
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single hyphen
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        fragment = '#' + fragmentText;
    }
    
    // Try exact match first
    if (fileMap.has(fileName)) {
        return fileMap.get(fileName) + fragment;
    }
    
    // Try lowercase match
    if (fileMap.has(fileName.toLowerCase())) {
        return fileMap.get(fileName.toLowerCase()) + fragment;
    }
    
    // Try hyphenated lowercase match
    const hyphenated = fileName.replace(/\s+/g, '-').toLowerCase();
    if (fileMap.has(hyphenated)) {
        return fileMap.get(hyphenated) + fragment;
    }
    
    // If no match found, return original with .html extension
    return `${fileName.replace(/\s+/g, '-').toLowerCase()}.html${fragment}`;
}

/**
 * Processes a markdown file and returns HTML content
 * @param {string} filePath - Path to the markdown file
 * @param {string} relativePath - Relative path for the output file
 * @param {Object} searchIndex - Array to add search data to
 * @returns {string} Complete HTML page content
 */
function processMarkdownFile(filePath, relativePath, searchIndex, foldersWithContent = {}) {
    const content = fs.readFileSync(filePath, 'utf-8');
    
    // Parse YAML frontmatter
    const { frontmatter, content: bodyContent } = parseYamlFrontmatter(content);
    
    // First, convert Obsidian-style image links ![[image]] to markdown images
    let processedContent = bodyContent.replace(/!\[\[([^\]]+)\]\]/g, (match, imageText) => {
        // Handle Obsidian pipe syntax ![[image.ext|alignment|size]]
        const parts = imageText.split('|').map(part => part.trim());
        const imageName = parts[0];
        const alignment = parts[1] || '';
        const size = parts[2] || '';
        
        // Calculate relative path to images folder
        const currentDir = path.dirname(relativePath);
        let imageBasePath = 'images/';
        
        // If we're in a subdirectory, adjust the path
        if (currentDir !== '.') {
            const depth = currentDir.split('/').length;
            const upLevels = '../'.repeat(depth);
            imageBasePath = upLevels + 'images/';
        }
        
        // Create the image path
        const imagePath = imageBasePath + imageName;
        
        // Return markdown image format - the custom renderer will handle styling
        return `![${alignment}|${size}](${imagePath})`;
    });
    
    // Then convert Obsidian-style links [[link]] to markdown links
    processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
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
        // Handle fragment identifiers separately - don't encode the # or fragment part
        let pathPart = relativeLinkPath;
        let fragmentPart = '';
        
        if (relativeLinkPath.includes('#')) {
            const parts = relativeLinkPath.split('#');
            pathPart = parts[0];
            fragmentPart = '#' + parts[1];
        }
        
        const encodedPath = pathPart.split('/').map(segment => {
            // Only encode the filename part, not the directory separators
            return segment.includes('.html') ? encodeURIComponent(segment) : segment;
        }).join('/') + fragmentPart;
        
        return `[${displayText}](${encodedPath})`;
    });
    
    // Configure custom renderer for images
    const renderer = new marked.Renderer();
    renderer.image = function(href, title, text) {
        // Parse the alt text for alignment and size info
        const parts = text.split('|');
        const alignment = parts[0] || '';
        const size = parts[1] || '';
        
        // Build style attribute for alignment and size
        let styleAttr = '';
        const styles = [];
        
        if (alignment) {
            if (alignment === 'left') {
                styles.push('float: left', 'margin: 0 1rem 1rem 0');
            } else if (alignment === 'right') {
                styles.push('float: right', 'margin: 0 0 1rem 1rem');
            } else if (alignment === 'center') {
                styles.push('display: block', 'margin: 1rem auto');
            }
        }
        
        if (size && !isNaN(size)) {
            styles.push(`max-width: ${size}px`);
        }
        
        if (styles.length > 0) {
            styleAttr = ` style="${styles.join('; ')}"`;
        }
        
        return `<img src="${href}" alt="${alignment}"${styleAttr}>`;
    };
    
    // Convert markdown to HTML
    const htmlContent = marked(processedContent, { renderer });
    
    // Generate properties HTML
    const propertiesHtml = generatePropertiesHtml(frontmatter);
    
    // Create full HTML page
    const title = path.basename(filePath, '.md');
    
    // Add to search index
    const textContent = extractTextFromHtml(htmlContent);
    const searchItem = {
        title: title,
        path: relativePath,
        category: getCategoryFromPath(relativePath),
        content: textContent,
        frontmatter: frontmatter || {}
    };
    
    // Add aliases and tags for better searchability
    if (frontmatter) {
        if (frontmatter.aliases) {
            searchItem.aliases = Array.isArray(frontmatter.aliases) ? frontmatter.aliases : [frontmatter.aliases];
        }
        if (frontmatter.tags) {
            searchItem.tags = Array.isArray(frontmatter.tags) ? frontmatter.tags : [frontmatter.tags];
        }
    }
    
    searchIndex.push(searchItem);
    
    // Calculate depth for CSS path and navigation links
    const currentDir = path.dirname(relativePath);
    const depth = currentDir === '.' ? 0 : currentDir.split('/').length;
    const cssPath = depth === 0 ? 'styles.css' : '../'.repeat(depth) + 'styles.css';
    const basePath = depth === 0 ? '' : '../'.repeat(depth);
    const jsPath = depth === 0 ? 'search.js' : '../'.repeat(depth) + 'search.js';
    
    return renderPageTemplate({
        title,
        cssPath,
        basePath,
        jsPath,
        propertiesHtml,
        htmlContent,
        foldersWithContent
    });
}

module.exports = {
    buildFileMap,
    resolveObsidianLink,
    processMarkdownFile
};