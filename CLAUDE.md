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

Claude Code should never run these commands. The build command is constantly running in the background, and the live server always active while developing.

**Source Structure:**
- Source files are in `../CurseOfStrahdNotes/` (external Obsidian vault)
- Static CSS is in `src/styles.css` (edit this file for theme changes - gets copied to `docs/styles.css` during build)
- Generated website outputs to `docs/` folder for GitHub Pages

## Architecture

### Modular Build System

The build system has been refactored into a modular architecture for better maintainability:

**Main Entry Point (`build.js`):**
- Orchestrates the build process (68 lines vs previous 591 lines)
- Imports and coordinates all modules
- Manages global search index

**Templates (`templates/`):**
- `page.js` - Individual content page template
- `index.js` - Category index page template  
- `main-index.js` - Homepage template
- HTML templates separated from logic for easier editing

**Library Modules (`lib/`):**
- `fs-utils.js` - File system operations (directory creation, file copying)
- `content-utils.js` - Content parsing (YAML frontmatter, HTML text extraction)
- `markdown-processor.js` - Markdown processing and Obsidian link resolution
- `search-utils.js` - Search index generation
- `folder-processor.js` - Folder traversal and processing logic

### Core Build Process

The build system follows this pipeline:

1. **File Mapping Phase:** Scans all markdown files to create a global filename → path mapping for link resolution
2. **Content Processing:** Converts each category folder, handling nested directories and Obsidian link syntax  
3. **HTML Generation:** Creates complete HTML pages using modular templates with consistent navigation and styling
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

**Key Functions (now modularized):**
- `buildFileMap()` (lib/markdown-processor.js) - Creates global file mapping for link resolution
- `resolveObsidianLink()` (lib/markdown-processor.js) - Handles various filename matching strategies  
- `processMarkdownFile()` (lib/markdown-processor.js) - Converts Obsidian syntax and generates HTML pages
- `renderPageTemplate()` (templates/page.js) - Generates individual page HTML
- `renderIndexTemplate()` (templates/index.js) - Generates category index HTML
- `renderMainIndexTemplate()` (templates/main-index.js) - Generates homepage HTML

### HTML Template Structure

Each page uses consistent navigation with links to all main sections. The build system generates:
- Individual HTML files for each markdown file (using `templates/page.js`)
- Index pages for each category folder (using `templates/index.js`)
- Main homepage with section overview cards (using `templates/main-index.js`)
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
- The `FOLDERS_TO_COPY` array in `build.js` controls which source folders are processed
- Navigation menus are defined in the three template files: `templates/page.js`, `templates/index.js`, and `templates/main-index.js`
- Link resolution depends on exact filename matching - changes to source file names may break internal links
- HTML templates are now in separate files for easier editing - modify template files rather than inline strings
- Each module has a specific purpose - follow the separation of concerns when adding features

**Content Updates:**
- Add new markdown files to appropriate category folders in source vault
- Images must be placed in source `_images/` folder (not the generated `docs/images/`)
- The build process is destructive - it completely regenerates the `docs/` folder each time