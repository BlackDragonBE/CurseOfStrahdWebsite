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
 * Generates HTML for a Leaflet map from Obsidian plugin data
 * @param {string} relativePath - Relative path for the output file
 * @returns {string} Leaflet map HTML content
 */
function generateLeafletMapHtml(relativePath) {
    // Read the Obsidian leaflet plugin data
    const dataPath = path.join(__dirname, '../../CurseOfStrahdNotes/.obsidian/plugins/obsidian-leaflet-plugin/data.json');
    
    if (!fs.existsSync(dataPath)) {
        return '<p>Map data not found.</p>';
    }
    
    const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
    const mapData = data.mapMarkers.find(map => map.id === 'leaflet-map');
    
    if (!mapData) {
        return '<p>Leaflet map data not found.</p>';
    }
    
    // Calculate depth for image path
    const currentDir = path.dirname(relativePath);
    const depth = currentDir === '.' ? 0 : currentDir.split('/').length;
    const imageBasePath = depth === 0 ? 'images/' : '../'.repeat(depth) + 'images/';
    
    // Generate marker data for JavaScript
    const markers = mapData.markers.map(marker => ({
        id: marker.id,
        type: marker.type,
        loc: marker.loc,
        link: marker.link,
        description: marker.description,
        tooltip: marker.tooltip
    }));
    
    // Generate marker icon definitions
    const markerIcons = data.markerIcons.reduce((acc, icon) => {
        acc[icon.type] = {
            iconName: icon.iconName,
            color: icon.color,
            size: icon.transform.size
        };
        return acc;
    }, {});
    
    // Add default marker icon
    markerIcons['default'] = {
        iconName: data.defaultMarker.iconName,
        color: data.defaultMarker.color,
        size: data.defaultMarker.transform.size
    };
    
    return `
        <style>
            #map {
                width: 100%;
                height: 800px;
                border: 1px solid #ccc;
                border-radius: 8px;
            }
        </style>
        
        <div id="map"></div>
        
        <!-- Leaflet CSS -->
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        
        <!-- Leaflet JS -->
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        
        <script>
            // Image dimensions (from Barovia.jpg)
            const imageWidth = 5025;
            const imageHeight = 3225;
            
            // Create the map with CRS.Simple for pixel coordinates
            const map = L.map('map', {
                crs: L.CRS.Simple,
                minZoom: -2,
                maxZoom: 3
            });
            
            // Define the image bounds in pixel coordinates
            const bounds = [[0, 0], [imageHeight, imageWidth]];
            
            // Add the image overlay
            L.imageOverlay('${imageBasePath}Barovia.jpg', bounds).addTo(map);
            
            // Fit the map view to show the entire image
            map.fitBounds(bounds);
            
            // Marker icons configuration
            const markerIcons = ${JSON.stringify(markerIcons, null, 12)};
            
            // Add custom CSS for marker icons first
            const style = document.createElement('style');
            style.textContent = \`
                .custom-div-icon {
                    background: none !important;
                    border: none !important;
                }
                .custom-div-icon i {
                    color: #dddddd;
                    text-shadow: 2px 2px 4px rgba(0,0,0,0.7);
                    font-size: 18px;
                }
                \` + Object.entries(markerIcons).map(([type, config]) => \`
                .marker-\${type} i {
                    color: \${config.color} !important;
                }
                \`).join('');
            document.head.appendChild(style);
            
            // Function to create custom icons
            function createCustomIcon(type) {
                const iconConfig = markerIcons[type] || markerIcons['default'];
                return L.divIcon({
                    html: '<i class="fas fa-' + iconConfig.iconName + '"></i>',
                    iconSize: [iconConfig.size * 4, iconConfig.size * 4],
                    className: 'custom-div-icon marker-' + type,
                    iconAnchor: [iconConfig.size * 2, iconConfig.size * 4]
                });
            }
            
            // Add markers
            const markers = ${JSON.stringify(markers, null, 12)};
            
            markers.forEach(markerData => {
                const [lat, lng] = markerData.loc;
                const marker = L.marker([lat, lng], {
                    icon: createCustomIcon(markerData.type)
                }).addTo(map);
                
                // Add popup with link if available
                if (markerData.link) {
                    const popupContent = markerData.description 
                        ? '<strong>' + markerData.link + '</strong><br>' + markerData.description
                        : '<strong>' + markerData.link + '</strong>';
                    marker.bindPopup(popupContent);
                }
                
                // Handle tooltip display
                if (markerData.tooltip === 'always' && markerData.link) {
                    marker.bindTooltip(markerData.link, { permanent: true });
                } else if (markerData.tooltip === 'hover' && (markerData.link || markerData.description)) {
                    marker.bindTooltip(markerData.link || markerData.description);
                }
            });
        </script>
        
        <!-- Font Awesome for icons -->
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    `;
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
    const fileName = path.basename(filePath, '.md');
    
    // Parse YAML frontmatter
    const { frontmatter, content: bodyContent } = parseYamlFrontmatter(content);
    
    // Special handling for _Map file
    if (fileName === '_Map') {
        const htmlContent = generateLeafletMapHtml(relativePath);
        
        // Generate properties HTML
        const propertiesHtml = generatePropertiesHtml(frontmatter);
        
        // Create full HTML page
        const title = 'Barovia Map';
        
        // Add to search index
        const searchItem = {
            title: title,
            path: relativePath,
            category: getCategoryFromPath(relativePath),
            content: 'Interactive map of Barovia with locations and markers',
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
    processMarkdownFile,
    generateLeafletMapHtml
};