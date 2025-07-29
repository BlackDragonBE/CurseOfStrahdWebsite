const fs = require('fs');
const path = require('path');

/**
 * Copies a file with retry logic to handle EBUSY errors
 * @param {string} sourcePath - Source file path
 * @param {string} outputPath - Destination file path
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 */
function copyFileWithRetry(sourcePath, outputPath, maxRetries = 5, baseDelay = 100) {
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            fs.copyFileSync(sourcePath, outputPath);
            return; // Success, exit function
        } catch (error) {
            if (error.code === 'EBUSY' && attempt < maxRetries) {
                // Exponential backoff with jitter
                const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 100;
                const delayMs = Math.round(delay);
                
                if (attempt === 0) {
                    console.log(`File busy, retrying copy of ${path.basename(sourcePath)}...`);
                }
                
                // Synchronous delay
                const start = Date.now();
                while (Date.now() - start < delayMs) {
                    // Busy wait for the delay
                }
            } else {
                // Re-throw if not EBUSY or max retries reached
                if (error.code === 'EBUSY') {
                    console.error(`❌ Failed to copy ${path.basename(sourcePath)} after ${maxRetries + 1} attempts: ${error.message}`);
                }
                throw error;
            }
        }
    }
}

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
            copyFileWithRetry(sourcePath, outputPath);
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
        copyFileWithRetry(cssSource, cssOutput);
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
        copyFileWithRetry(jsSource, jsOutput);
        console.log('Copied search.js from src/search.js to docs/search.js');
    } else {  
        console.warn('Warning: src/search.js not found');
    }
}

/**
 * Copies all images from src/images to output/images directory
 * @param {string} srcDir - Source directory containing src/images folder
 * @param {string} outputDir - Output directory to copy images to
 */
function copySrcImages(srcDir, outputDir) {
    const imagesSource = path.join(srcDir, 'src', 'images');
    const imagesOutput = path.join(outputDir, 'images');
    
    if (fs.existsSync(imagesSource)) {
        ensureDir(imagesOutput);
        const files = fs.readdirSync(imagesSource);
        
        files.forEach(file => {
            const sourcePath = path.join(imagesSource, file);
            const outputPath = path.join(imagesOutput, file);
            copyFileWithRetry(sourcePath, outputPath);
            console.log(`Copied ${file} from src/images/ to docs/images/`);
        });
    } else {
        console.warn('Warning: src/images folder not found');
    }
}

module.exports = {
    ensureDir,
    copyImages,
    createCSS,
    createSearchJS,
    copySrcImages
};