const fs = require('fs');
const path = require('path');

/**
 * Creates and writes the search index file
 * @param {Array} searchIndex - Array of search items
 * @param {string} outputDir - Output directory to write index to
 */
function createSearchIndex(searchIndex, outputDir) {
    const searchIndexPath = path.join(outputDir, 'search-index.json');
    
    // Optimize search index by truncating long content
    const optimizedIndex = searchIndex.map(item => ({
        ...item,
        content: item.content.length > 500 ? item.content.substring(0, 500) + '...' : item.content
    }));
    
    fs.writeFileSync(searchIndexPath, JSON.stringify(optimizedIndex, null, 2));
    console.log(`Generated search index with ${searchIndex.length} items`);
}

module.exports = {
    createSearchIndex
};