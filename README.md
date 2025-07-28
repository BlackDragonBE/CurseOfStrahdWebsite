# Curse of Strahd Campaign Website

This project automatically generates a static website from your Obsidian vault containing Curse of Strahd campaign notes.

## Features

- Converts Obsidian markdown files to HTML
- Processes Obsidian-style internal links `[[Link]]`
- Creates navigation structure
- Responsive design
- Automatic GitHub Pages deployment

## Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the website:
   ```bash
   npm run build
   ```

3. Preview locally:
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
- `0_Collections` - Compiled lists and collections
- `1_SessionNotes` - Session-by-session game notes
- `2_Locations` - Places and maps
- `3_Characters` - NPCs, PCs, deities, familiars
- `4_Items` - Magical items and artifacts
- `5_Concepts` - Important lore and concepts
- `7_Quests` - Quest tracking
- `_images` - Images and assets

## Generated Structure

```
docs/
├── index.html              # Main homepage
├── styles.css              # Site styling
├── images/                 # Copied from _images
├── 0_Collections/
│   ├── index.html
│   └── [converted-files].html
├── 1_SessionNotes/
├── 2_Locations/
├── 3_Characters/
├── 4_Items/
├── 5_Concepts/
└── 7_Quests/
```