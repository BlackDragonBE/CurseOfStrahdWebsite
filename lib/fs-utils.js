const fs = require('fs');
const path = require('path');

/**
 * Ensures a directory exists, creating it if necessary
 * @param {string} dir - Directory path to ensure exists
 */
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

/**
 * Copies images from source to output directory
 * @param {string} sourceDir - Source directory containing _images folder
 * @param {string} outputDir - Output directory to copy images to
 */
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

/**
 * Copies CSS file from src to output directory
 * @param {string} srcDir - Source directory containing styles.css
 * @param {string} outputDir - Output directory to copy CSS to
 */
function createCSS(srcDir, outputDir) {
    const cssSource = path.join(srcDir, 'src', 'styles.css');
    const cssOutput = path.join(outputDir, 'styles.css');
    
    if (fs.existsSync(cssSource)) {
        fs.copyFileSync(cssSource, cssOutput);
        console.log('Copied CSS from src/styles.css to docs/styles.css');
    } else {
        console.warn('Warning: src/styles.css not found');
    }
}

/**
 * Copies JavaScript file from src to output directory
 * @param {string} srcDir - Source directory containing search.js
 * @param {string} outputDir - Output directory to copy JS to
 */
function createSearchJS(srcDir, outputDir) {
    const jsSource = path.join(srcDir, 'src', 'search.js');
    const jsOutput = path.join(outputDir, 'search.js');
    
    if (fs.existsSync(jsSource)) {
        fs.copyFileSync(jsSource, jsOutput);
        console.log('Copied search.js from src/search.js to docs/search.js');
    } else {  
        console.warn('Warning: src/search.js not found');
    }
}

module.exports = {
    ensureDir,
    copyImages,
    createCSS,
    createSearchJS
};