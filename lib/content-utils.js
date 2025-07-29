/**
 * Extracts plain text from HTML content
 * @param {string} html - HTML content to extract text from
 * @returns {string} Plain text content
 */
function extractTextFromHtml(html) {
    // Remove HTML tags and decode entities
    return html
        .replace(/<[^>]*>/g, ' ')
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&nbsp;/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Gets category name from relative path
 * @param {string} relativePath - Relative path to categorize
 * @returns {string} Category name
 */
function getCategoryFromPath(relativePath) {
    const parts = relativePath.split('/');
    const folder = parts[0];
    
    const categoryMap = {
        '1_SessionNotes': 'Session Notes',
        '2_Locations': 'Locations', 
        '3_Characters': 'Characters',
        '4_Items': 'Items',
        '5_Concepts': 'Concepts',
        '7_Quests': 'Quests'
    };
    
    return categoryMap[folder] || 'Other';
}

/**
 * Parses YAML frontmatter from markdown content
 * @param {string} content - Markdown content with potential frontmatter
 * @returns {Object} Object with frontmatter and content properties
 */
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

/**
 * Generates HTML for frontmatter properties
 * @param {Object} frontmatter - Frontmatter object
 * @returns {string} HTML representation of properties
 */
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

module.exports = {
    extractTextFromHtml,
    getCategoryFromPath,
    parseYamlFrontmatter,
    generatePropertiesHtml
};