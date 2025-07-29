/**
 * Template for the main homepage
 * @returns {string} Complete HTML page
 */
function renderMainIndexTemplate() {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Curse of Strahd Campaign</title>
    <link rel="preload" href="images/background.jpeg" as="image">
    <link rel="stylesheet" href="styles.css">
</head>
<body>
    <nav>
        <div class="nav-container">
            <h1><a href="index.html">Curse of Strahd Campaign</a></h1>
            <ul>
                <li><a href="1_SessionNotes/index.html">Session Notes</a></li>
                <li><a href="2_Locations/index.html">Locations</a></li>
                <li><a href="3_Characters/index.html">Characters</a></li>
                <li><a href="4_Items/index.html">Items</a></li>
                <li><a href="5_Concepts/index.html">Concepts</a></li>
                <li><a href="7_Quests/index.html">Quests</a></li>
            </ul>
        </div>
    </nav>
    <main>
        <h1>Curse of Strahd Campaign</h1>
        <p>Welcome to our Curse of Strahd campaign website. Navigate using the menu above to explore different sections.</p>
        
        <div class="section-grid">
            <a href="1_SessionNotes/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Session Notes</h2>
                    <p>Detailed notes from each game session.</p>
                </div>
            </a>
            <a href="2_Locations/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Locations</h2>
                    <p>Information about places in Barovia and beyond.</p>
                </div>
            </a>
            <a href="3_Characters/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Characters</h2>
                    <p>NPCs, players, deities, and familiars encountered in the campaign.</p>
                </div>
            </a>
            <a href="4_Items/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Items</h2>
                    <p>Special items and artifacts found during the adventure.</p>
                </div>
            </a>
            <a href="5_Concepts/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Concepts</h2>
                    <p>Important concepts, organizations, and lore.</p>
                </div>
            </a>
            <a href="7_Quests/index.html" class="section-card-link">
                <div class="section-card">
                    <h2>Quests</h2>
                    <p>Active, completed, and failed quest lines.</p>
                </div>
            </a>
        </div>
    </main>
    <script src="search.js"></script>
</body>
</html>`;
}

module.exports = { renderMainIndexTemplate };