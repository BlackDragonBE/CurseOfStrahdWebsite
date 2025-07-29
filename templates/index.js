/**
 * Template for category index pages
 * @param {Object} options - Template options
 * @param {string} options.title - Page title
 * @param {string} options.cssPath - Relative path to CSS file
 * @param {string} options.basePath - Base path for navigation links
 * @param {string} options.jsPath - Relative path to search.js
 * @param {string} options.combinedList - HTML list of files and subdirectories
 * @returns {string} Complete HTML page
 */
function renderIndexTemplate({ title, cssPath, basePath, jsPath, combinedList }) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Curse of Strahd Campaign</title>
    <link rel="stylesheet" href="${cssPath}">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="${basePath}index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="${basePath}1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="${basePath}2_Locations/index.html">Locations</a></li>
                <li><a href="${basePath}3_Characters/index.html">Characters</a></li>
                <li><a href="${basePath}4_Items/index.html">Items</a></li>
                <li><a href="${basePath}5_Concepts/index.html">Concepts</a></li>
                <li><a href="${basePath}7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <h1>${title}</h1>
        <ul class="file-list">
            ${combinedList}
        </ul>
    </main>
    <script src="${jsPath}"></script>
</body>
</html>`;
}

module.exports = { renderIndexTemplate };