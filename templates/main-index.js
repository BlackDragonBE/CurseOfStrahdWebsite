/**
 * Template for the main homepage
 * @param {Object} foldersWithContent - Object mapping folder names to whether they have content
 * @returns {string} Complete HTML page
 */
function renderMainIndexTemplate(foldersWithContent = {}) {
    const sections = [
        { folder: '1_SessionNotes', title: 'Session Notes' },
        { folder: '2_Locations', title: 'Locations' },
        { folder: '3_Characters', title: 'Characters' },
        { folder: '4_Items', title: 'Items' },
        { folder: '5_Concepts', title: 'Concepts' },
        { folder: '7_Quests', title: 'Quests' }
    ].filter(section => foldersWithContent[section.folder] !== false);

    const navItems = sections.map(section => 
        `<li><a href="${section.folder}/index.html">${section.title}</a></li>`
    ).join('\n                ');

    const sectionCards = sections.map(section => 
        `<a href="${section.folder}/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>${section.title}</h2>
                </div>
            </a>`
    ).join('\n            ');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Curse of Strahd Campaign</title>
    <link rel="preload" href="images/background.jpeg" as="image">
    <style>
        body { 
            margin: 0; 
            background: #0a0a0b; 
            color: #ffffff; 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', roboto, sans-serif;
            opacity: 0;
            transition: opacity 0.1s ease-in;
        }
        body.loaded { opacity: 1; }
    </style>
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav>
        <div class="nav-container">
            <ul>
                ${navItems}
            </ul>
        </div>
    </nav>
    <main>
        <h1>Curse of Strahd Campaign</h1>
        
        <div class="section-grid">
            ${sectionCards}
        </div>
    </main>
    <script>
        document.addEventListener('DOMContentLoaded', function() {
            document.body.classList.add('loaded');
        });
    </script>
    <script src="search.js"></script>
</body>
</html>`;
}

module.exports = { renderMainIndexTemplate };