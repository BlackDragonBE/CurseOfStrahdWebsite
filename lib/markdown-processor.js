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