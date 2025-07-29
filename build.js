const fs = require('fs');
const path = require('path');

// Import modular components
const { ensureDir, copyImages, createCSS, createSearchJS, copySrcImages } = require('./lib/fs-utils');
const { buildFileMap } = require('./lib/markdown-processor');
const { processFolder, createMainIndex } = require('./lib/folder-processor');
const { createSearchIndex } = require('./lib/search-utils');

// Configuration
const SOURCE_DIR = path.join(__dirname, '..', 'CurseOfStrahdNotes');
const OUTPUT_DIR = path.join(__dirname, 'docs');

const FOLDERS_TO_COPY = [
    '1_SessionNotes', 
    '2_Locations',
    '3_Characters',
    '4_Items',
    '5_Concepts',
    '7_Quests',
    '8_Custom',
    '_images'
];

// Global search index to store searchable content
let searchIndex = [];

function build() {
    console.log('Starting build process...');
    
    // Clean and create output directory
    if (fs.existsSync(OUTPUT_DIR)) {
        fs.rmSync(OUTPUT_DIR, { recursive: true });
    }
    ensureDir(OUTPUT_DIR);
    
    // Clear search index
    searchIndex = [];
    
    // Build file map first for link resolution
    console.log('Building file map for link resolution...');
    buildFileMap(SOURCE_DIR, FOLDERS_TO_COPY);
    
    // Copy images
    copyImages(SOURCE_DIR, OUTPUT_DIR);
    
    // Process each folder and track which ones have content
    const foldersWithContent = {};
    
    // First pass: determine which folders have content
    FOLDERS_TO_COPY.forEach(folder => {
        if (folder !== '_images') {
            const sourceFolder = path.join(SOURCE_DIR, folder);
            if (fs.existsSync(sourceFolder)) {
                const hasContent = hasMarkdownFiles(sourceFolder);
                foldersWithContent[folder] = hasContent;
            } else {
                foldersWithContent[folder] = false;
            }
        }
    });
    
    // Second pass: process folders with content information available
    FOLDERS_TO_COPY.forEach(folder => {
        if (folder !== '_images') {
            console.log(`Processing ${folder}...`);
            processFolder(folder, SOURCE_DIR, OUTPUT_DIR, searchIndex, foldersWithContent);
        }
    });
    
    // Helper function to check if a folder contains markdown files
    function hasMarkdownFiles(folderPath) {
        try {
            const items = fs.readdirSync(folderPath);
            
            for (const item of items) {
                const itemPath = path.join(folderPath, item);
                const stat = fs.statSync(itemPath);
                
                if (stat.isFile() && item.endsWith('.md')) {
                    return true;
                }
                
                if (stat.isDirectory() && hasMarkdownFiles(itemPath)) {
                    return true;
                }
            }
            
            return false;
        } catch (error) {
            return false;
        }
    }
    
    // Create main files
    createMainIndex(OUTPUT_DIR, foldersWithContent);
    createCSS(__dirname, OUTPUT_DIR);
    createSearchJS(__dirname, OUTPUT_DIR);
    copySrcImages(__dirname, OUTPUT_DIR);
    createSearchIndex(searchIndex, OUTPUT_DIR);
    
    console.log('Build complete! Website generated in docs/ folder');
    console.log('Ready for GitHub Pages deployment');
}

if (require.main === module) {
    build();
}

module.exports = { build };