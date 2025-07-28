# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static website generator that converts an Obsidian vault containing Curse of Strahd D&D campaign notes into a GitHub Pages website. The build system transforms markdown files with Obsidian-style `[[internal links]]` into a structured HTML website with navigation and cross-references.

## Commands

**Build and Development:**
```bash
npm install              # Install dependencies (marked, http-server, chokidar, ws)
npm run dev             # Development server with live reload and file watching
npm run build           # Generate complete website in docs/ folder
npm start               # Build and serve locally on localhost:3000
```

**Source Structure:**
- Source files are in `../CurseOfStrahdNotes/` (external Obsidian vault)
- Static CSS is in `src/styles.css` (edit this file for theme changes)
- Generated website outputs to `docs/` folder for GitHub Pages

## Architecture

### Core Build Process (`build.js`)

The build system follows this pipeline:

1. **File Mapping Phase:** Scans all markdown files to create a global filename → path mapping for link resolution
2. **Content Processing:** Converts each category folder, handling nested directories and Obsidian link syntax  
3. **HTML Generation:** Creates complete HTML pages with consistent navigation and styling
4. **Asset Management:** Copies images and static CSS file

### Content Categories

The system processes these specific folders from the source vault:
- `1_SessionNotes/` - Game session records (numbered 1_cos.md through 23_cos.md)
- `2_Locations/` - Places and maps 
- `3_Characters/` - NPCs with subfolders: `_Deity/`, `_Familiars/`, `_Players/`
- `4_Items/` - Magical items and artifacts
- `5_Concepts/` - Important lore and game concepts  
- `7_Quests/` - Status-organized: `Done/`, `Failed/`, `In Progress/`, `Inactive/`
- `_images/` - Copied to `docs/images/`

### Link Resolution System

**Obsidian Link Processing:**
- Converts `[[Target]]` and `[[Target|Display Text]]` syntax
- Uses multiple matching strategies: exact, case-insensitive, hyphenated lowercase
- Calculates relative paths between files in different folders
- URL-encodes filenames with spaces (`Castle Ravenloft.html` → `Castle%20Ravenloft.html`)

**Key Functions:**
- `buildFileMap()` - Creates global file mapping for link resolution
- `resolveObsidianLink()` - Handles various filename matching strategies  
- `processMarkdownFile()` - Converts Obsidian syntax and generates HTML pages

### HTML Template Structure

Each page uses consistent navigation with links to all main sections. The build system generates:
- Individual HTML files for each markdown file
- Index pages for each category folder
- Main homepage with section overview cards
- Single CSS file with responsive design

## Deployment

**GitHub Actions:** Automatic deployment on push to `main` branch via `.github/workflows/deploy.yml`

**Manual Process:**
1. Run `npm run build` 
2. Commit `docs/` folder changes
3. Push to GitHub (Pages serves from `docs/` folder)

## Development Notes

**When modifying the build system:**
- Always test with `npm run build && npm start` 
- The `FOLDERS_TO_COPY` array controls which source folders are processed
- Navigation menus are hardcoded in three places: main page template, individual page template, and index page template
- Link resolution depends on exact filename matching - changes to source file names may break internal links

**Content Updates:**
- Add new markdown files to appropriate category folders in source vault
- Images must be placed in source `_images/` folder (not the generated `docs/images/`)
- The build process is destructive - it completely regenerates the `docs/` folder each time