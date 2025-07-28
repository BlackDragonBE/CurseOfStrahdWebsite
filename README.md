# Curse of Strahd Campaign Website

This project automatically generates a static website from your Obsidian vault containing Curse of Strahd campaign notes.

## Features

- Converts Obsidian markdown files to HTML
- Processes Obsidian-style internal links `[[Link]]`
- Creates navigation structure
- Responsive design with gothic D&D theme
- Development server with live reload and file watching
- Automatic GitHub Pages deployment

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. For development with automatic reloading:
   ```bash
   npm run dev
   ```

3. Build for production:
   ```bash
   npm run build
   ```

4. Preview production build:
   ```bash
   npm start
   ```

## GitHub Pages Deployment

1. Push this repository to GitHub
2. Go to repository Settings > Pages
3. Set Source to "GitHub Actions"
4. The website will auto-deploy on every push to main branch

## Folder Structure

The build process copies these folders from `../CurseOfStrahdNotes/`:
- `1_SessionNotes` - Session-by-session game notes
- `2_Locations` - Places and maps
- `3_Characters` - NPCs, PCs, deities, familiars
- `4_Items` - Magical items and artifacts
- `5_Concepts` - Important lore and concepts
- `7_Quests` - Quest tracking
- `_images` - Images and assets

## Development Workflow

Use `npm run dev` for theme development and content editing:

- **Live Reload**: Browser automatically refreshes when files change
- **File Watching**: Monitors source markdown files, images, and build script
- **Auto-rebuild**: Regenerates the site when changes are detected
- **Console Feedback**: Shows which files changed and build status

Perfect for testing CSS changes, content updates, and theme modifications!

## Generated Structure

```
docs/
├── index.html              # Main homepage
├── styles.css              # Site styling
├── images/                 # Copied from _images
├── 1_SessionNotes/
│   ├── index.html
│   └── [converted-files].html
├── 2_Locations/
├── 3_Characters/
├── 4_Items/
├── 5_Concepts/
└── 7_Quests/
```