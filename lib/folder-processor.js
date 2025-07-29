const fs = require('fs');
const path = require('path');
const { ensureDir } = require('./fs-utils');
const { processMarkdownFile } = require('./markdown-processor');
const { renderIndexTemplate } = require('../templates/index');
const { renderMainIndexTemplate } = require('../templates/main-index');

/**
 * Creates an index page for a folder
 * @param {string} folderName - Name of the folder
 * @param {string[]} files - Array of file names in the folder
 * @param {string[]} subdirectories - Array of subdirectory names
 * @param {number} depth - Depth level for path calculation
 * @returns {string} Complete HTML content for index page
 */
function createIndexPage(folderName, files, subdirectories = [], depth = 1) {
    const title = folderName.replace(/^\d+_/, '').replace(/_/g, ' ');
    const cssPath = depth === 0 ? 'styles.css' : '../'.repeat(depth) + 'styles.css';
    const basePath = depth === 0 ? '' : '../'.repeat(depth);
    const jsPath = depth === 0 ? 'search.js' : '../'.repeat(depth) + 'search.js';
    
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
    
    return renderIndexTemplate({
        title,
        cssPath,
        basePath,
        jsPath,
        combinedList
    });
}

/**
 * Processes a folder and all its contents recursively
 * @param {string} folderName - Name of the folder to process
 * @param {string} sourceDir - Source directory path
 * @param {string} outputDir - Output directory path
 * @param {Array} searchIndex - Search index array to populate
 */
function processFolder(folderName, sourceDir, outputDir, searchIndex) {
    const sourceFolder = path.join(sourceDir, folderName);
    const outputFolder = path.join(outputDir, folderName);
    
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
                const relativePath = path.relative(outputDir, outputPath).replace(/\\/g, '/');
                
                const htmlContent = processMarkdownFile(sourcePath, relativePath, searchIndex);
                fs.writeFileSync(outputPath, htmlContent);
            }
        });
        
        // Create index.html for this directory if it has files OR subdirectories
        if (files.length > 0 || subdirectories.length > 0) {
            const indexPath = path.join(currentOutput, 'index.html');
            // Calculate depth based on how many levels down from OUTPUT_DIR we are
            const relativePath = path.relative(outputDir, currentOutput);
            const depth = relativePath === '' ? 0 : relativePath.split(path.sep).length;
            const indexContent = createIndexPage(path.basename(currentOutput), files, subdirectories, depth);
            fs.writeFileSync(indexPath, indexContent);
        }
    }
    
    processDirectory(sourceFolder, outputFolder);
}

/**
 * Creates the main index.html page
 * @param {string} outputDir - Output directory path
 */
function createMainIndex(outputDir) {
    const indexContent = renderMainIndexTemplate();    
    fs.writeFileSync(path.join(outputDir, 'index.html'), indexContent);
}

module.exports = {
    createIndexPage,
    processFolder,
    createMainIndex
};