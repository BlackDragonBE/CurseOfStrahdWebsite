/**
 * Markdown Processor Module
 * 
 * This module handles the conversion of Obsidian-flavored markdown files to HTML pages.
 * It processes Obsidian-specific syntax like [[internal links]] and ![[images]], 
 * resolves file paths, and generates complete HTML pages with navigation.
 * 
 * Key Features:
 * - Obsidian link resolution with multiple matching strategies
 * - Image processing with alignment and sizing support
 * - YAML frontmatter parsing and display
 * - Search index generation
 * - Special handling for interactive map files
 */

const fs = require('fs');
const path = require('path');
const { marked } = require('marked');
const { extractTextFromHtml, getCategoryFromPath, parseYamlFrontmatter, generatePropertiesHtml } = require('./content-utils');
const { renderPageTemplate } = require('../templates/page');
const { generateLeafletMapHtml } = require('./leaflet-map');

// ============================================================================
// GLOBAL STATE
// ============================================================================

// Global file map to resolve Obsidian links
let fileMap = new Map();

// ============================================================================
// FILE MAPPING AND LINK RESOLUTION
// ============================================================================

/**
 * Builds a global file map for link resolution
 * 
 * Scans specified folders and creates a mapping of filenames to their HTML output paths.
 * This enables Obsidian-style [[filename]] links to be resolved to proper HTML paths.
 * The mapping includes multiple variations for robust matching:
 * - Exact filename match
 * - Lowercase filename match  
 * - Hyphenated lowercase filename match
 * 
 * @param {string} sourceDir - Source directory to scan for markdown files
 * @param {string[]} folders - Array of folder names to scan for files
 * @returns {void} Populates the global fileMap
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
 * 
 * Converts Obsidian [[filename]] and [[filename#header]] syntax to valid HTML paths.
 * Uses multiple matching strategies to handle variations in filename formatting.
 * Properly handles fragment identifiers for header links.
 * 
 * Matching Priority:
 * 1. Exact filename match
 * 2. Case-insensitive match
 * 3. Hyphenated lowercase match
 * 4. Fallback to generated filename
 * 
 * @param {string} linkText - The link text to resolve (may include # for headers)
 * @returns {string} Resolved HTML path with optional fragment identifier
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

// ============================================================================
// PATH CALCULATION UTILITIES
// ============================================================================

/**
 * Calculates relative paths and depths for a given file location
 * 
 * Determines the directory depth and generates appropriate relative paths
 * for CSS, JavaScript, and image resources based on the file's location
 * within the site structure.
 * 
 * @param {string} relativePath - Relative path of the current file
 * @returns {Object} Object containing cssPath, basePath, jsPath, and depth
 */
function calculateRelativePaths(relativePath) {
    const currentDir = path.dirname(relativePath);
    const depth = currentDir === '.' ? 0 : currentDir.split('/').length;
    const upLevels = depth === 0 ? '' : '../'.repeat(depth);
    
    return {
        depth,
        cssPath: depth === 0 ? 'styles.css' : upLevels + 'styles.css',
        basePath: upLevels,
        jsPath: depth === 0 ? 'search.js' : upLevels + 'search.js',
        imageBasePath: depth === 0 ? 'images/' : upLevels + 'images/'
    };
}

// ============================================================================
// OBSIDIAN CONTENT PROCESSING
// ============================================================================

/**
 * Processes Obsidian-style image links (![[image]]) and converts them to markdown format
 * 
 * Handles Obsidian's image syntax including pipe-separated parameters for alignment and sizing.
 * Calculates proper relative paths to the images directory based on the current file location.
 * 
 * Supported Obsidian syntax:
 * - ![[image.jpg]] - Basic image
 * - ![[image.jpg|center]] - Centered image
 * - ![[image.jpg|400]] - Image with width
 * - ![[image.jpg|center|400]] - Centered image with width
 * 
 * @param {string} content - Markdown content containing Obsidian image links
 * @param {string} relativePath - Relative path of the current file for path calculation
 * @returns {string} Content with Obsidian image links converted to markdown format
 */
function processObsidianImages(content, relativePath) {
    const { imageBasePath } = calculateRelativePaths(relativePath);
    
    return content.replace(/!\[\[([^\]]+)\]\]/g, (match, imageText) => {
        // Handle Obsidian pipe syntax ![[image.ext|alignment|size]]
        const parts = imageText.split('|').map(part => part.trim());
        const imageName = parts[0];
        const alignment = parts[1] || '';
        const size = parts[2] || '';

        // Create the image path
        const imagePath = imageBasePath + imageName;

        // Return markdown image format - the custom renderer will handle styling
        return `![${alignment}|${size}](${imagePath})`;
    });
}

/**
 * Processes Obsidian-style internal links ([[link]]) and converts them to markdown format
 * 
 * Handles Obsidian's internal link syntax including pipe-separated display text.
 * Resolves links using the global file map and calculates proper relative paths.
 * Properly encodes URLs for spaces and special characters.
 * 
 * Supported Obsidian syntax:
 * - [[Target]] - Link with filename as display text
 * - [[Target|Display Text]] - Link with custom display text
 * - [[Target#header]] - Link to specific header section
 * 
 * @param {string} content - Markdown content containing Obsidian internal links
 * @param {string} relativePath - Relative path of the current file for path calculation
 * @returns {string} Content with Obsidian links converted to markdown format
 */
function processObsidianLinks(content, relativePath) {
    const { depth } = calculateRelativePaths(relativePath);
    const upLevels = depth === 0 ? '' : '../'.repeat(depth);
    
    return content.replace(/\[\[([^\]]+)\]\]/g, (match, linkText) => {
        // Handle Obsidian pipe syntax [[Target|Display Text]]
        let targetFile = linkText;
        let displayText = linkText;

        if (linkText.includes('|')) {
            const parts = linkText.split('|');
            targetFile = parts[0].trim();
            displayText = parts[1].trim();
        }

        const resolvedPath = resolveObsidianLink(targetFile);
        let relativeLinkPath = upLevels + resolvedPath;

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
}

/**
 * Adds an item to the search index with proper metadata handling
 * 
 * Creates a search index entry with the provided content and metadata.
 * Handles aliases and tags from YAML frontmatter for enhanced searchability.
 * 
 * @param {Array} searchIndex - Array to add the search item to
 * @param {string} title - Title of the content
 * @param {string} content - Main content text for searching
 * @param {Object} frontmatter - YAML frontmatter object containing metadata
 * @param {string} relativePath - Relative path to the content file
 * @returns {void} Modifies the searchIndex array in place
 */
function addToSearchIndex(searchIndex, title, content, frontmatter, relativePath) {
    const searchItem = {
        title: title,
        path: relativePath,
        category: getCategoryFromPath(relativePath),
        content: content,
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
}

/**
 * Creates a custom image renderer for the marked.js library
 * 
 * Handles Obsidian-style image formatting with alignment and sizing parameters.
 * Parses the alt text for alignment (left, center) and size information,
 * then applies appropriate CSS styles to the rendered image.
 * 
 * Supported formats in alt text:
 * - "alignment" - Sets image alignment (left, center)
 * - "size" - Sets max-width in pixels
 * - "alignment|size" - Both alignment and size
 * 
 * @returns {Function} Custom image renderer function for marked.js
 */
function createCustomImageRenderer() {
    const renderer = new marked.Renderer();
    
    renderer.image = function (href, title, text) {
        // Parse the alt text for alignment and size info
        const parts = text.split('|').map(part => part.trim()).filter(part => part !== '');

        let alignment = '';
        let size = '';

        // Determine alignment and size based on parts
        if (parts.length === 1) {
            // Check if the single part is a number (size only)
            if (!isNaN(Number(parts[0]))) {
                size = parts[0];
            } else {
                alignment = parts[0];
            }
        } else if (parts.length === 2) {
            // Format: "alignment | size" or "size | alignment" - need to determine which is which
            if (!isNaN(Number(parts[0])) && isNaN(Number(parts[1]))) {
                // First is number, second is alignment
                size = parts[0];
                alignment = parts[1];
            } else if (isNaN(Number(parts[0])) && !isNaN(Number(parts[1]))) {
                // First is alignment, second is number
                alignment = parts[0];
                size = parts[1];
            }
        }

        // Build style attribute for alignment and size
        const styles = [];

        // Apply alignment styles
        if (alignment) {
            if (alignment === 'left') {
                styles.push('float: left', 'margin: 0 1rem 1rem 0');
            } else if (alignment === 'center') {
                styles.push('display: block', 'margin: 1rem auto');
            }
        }

        // Apply size if it's a valid number
        if (size && !isNaN(Number(size))) {
            styles.push(`max-width: ${size}px !important`);
        }

        // Combine styles into style attribute
        const styleAttr = styles.length > 0 ? ` style="${styles.join('; ')}"` : '';

        // Return the img tag with empty alt attribute since we don't have the filename
        return `<img src="${href}" alt=""${styleAttr}>`;
    };
    
    return renderer;
}

/**
 * Handles special processing for interactive map files
 * 
 * Processes files named '_Map' as interactive Leaflet maps rather than regular markdown.
 * Generates the map HTML, adds appropriate search index entry, and returns the complete page.
 * 
 * @param {string} filePath - Path to the map markdown file
 * @param {string} relativePath - Relative path for the output file
 * @param {Object} frontmatter - YAML frontmatter from the file
 * @param {Array} searchIndex - Array to add search data to
 * @param {Object} foldersWithContent - Object tracking which folders contain content
 * @returns {string} Complete HTML page content for the interactive map
 */
function handleSpecialMapFile(filePath, relativePath, frontmatter, searchIndex, foldersWithContent) {
    const htmlContent = generateLeafletMapHtml(relativePath, resolveObsidianLink);
    const propertiesHtml = generatePropertiesHtml(frontmatter);
    const title = 'Barovia Map';

    // Add to search index
    addToSearchIndex(searchIndex, title, 'Interactive map of Barovia with locations and markers', frontmatter, relativePath);

    // Calculate paths
    const { cssPath, basePath, jsPath } = calculateRelativePaths(relativePath);

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

// ============================================================================
// MAIN PROCESSING FUNCTIONS
// ============================================================================

/**
 * Processes a markdown file and returns HTML content
 * 
 * Main function that orchestrates the conversion of an Obsidian markdown file
 * to a complete HTML page. Handles YAML frontmatter, Obsidian syntax conversion,
 * search index generation, and template rendering.
 * 
 * Special Cases:
 * - Files named '_Map' are processed as interactive Leaflet maps
 * - Image and link processing uses relative path calculations
 * - Search index includes metadata for site-wide search functionality
 * 
 * @param {string} filePath - Absolute path to the markdown file
 * @param {string} relativePath - Relative path for the output HTML file
 * @param {Array} searchIndex - Array to add search data to
 * @param {Object} foldersWithContent - Object tracking which folders contain content
 * @returns {string} Complete HTML page content
 */
function processMarkdownFile(filePath, relativePath, searchIndex, foldersWithContent = {}) {
    // Read and parse the markdown file
    const content = fs.readFileSync(filePath, 'utf-8');
    const fileName = path.basename(filePath, '.md');
    const { frontmatter, content: bodyContent } = parseYamlFrontmatter(content);

    // Handle special map files differently
    if (fileName === '_Map') {
        return handleSpecialMapFile(filePath, relativePath, frontmatter, searchIndex, foldersWithContent);
    }

    // Process Obsidian-specific syntax
    let processedContent = processObsidianImages(bodyContent, relativePath);
    processedContent = processObsidianLinks(processedContent, relativePath);

    // Convert markdown to HTML with custom image renderer
    const renderer = createCustomImageRenderer();
    // Pre-process any remaining markdown links to avoid conflicts
    const finalContent = processedContent.replace(/(?<!\!)\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    const htmlContent = marked(finalContent, { renderer });

    // Generate page components
    const title = fileName;
    const propertiesHtml = generatePropertiesHtml(frontmatter);
    const { cssPath, basePath, jsPath } = calculateRelativePaths(relativePath);

    // Add to search index for site-wide search
    const textContent = extractTextFromHtml(htmlContent);
    addToSearchIndex(searchIndex, title, textContent, frontmatter, relativePath);

    // Render complete HTML page
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

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
    buildFileMap,
    resolveObsidianLink,
    processMarkdownFile,
    // Utility functions (exported for potential testing)
    calculateRelativePaths,
    processObsidianImages,
    processObsidianLinks,
    addToSearchIndex,
    createCustomImageRenderer,
    handleSpecialMapFile
};