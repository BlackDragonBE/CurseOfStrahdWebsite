class SearchEngine {
    constructor() {
        this.searchIndex = [];
        this.searchInput = null;
        this.searchResults = null;
        this.searchOverlay = null;
        this.isLoaded = false;
        this.currentQuery = '';
        this.debounceTimer = null;
        
        this.init();
    }
    
    async init() {
        // Wait for DOM to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupSearch());
        } else {
            this.setupSearch();
        }
    }
    
    async setupSearch() {
        try {
            // Load search index
            await this.loadSearchIndex();
            
            // Create search UI
            this.createSearchUI();
            
            // Setup event listeners
            this.setupEventListeners();
            
            console.log('Search engine initialized with', this.searchIndex.length, 'items');
        } catch (error) {
            console.error('Failed to initialize search:', error);
        }
    }
    
    async loadSearchIndex() {
        try {
            // Calculate path to search index from current page
            const pathToRoot = this.getPathToRoot();
            const searchIndexUrl = pathToRoot + 'search-index.json';
            
            const response = await fetch(searchIndexUrl);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            this.searchIndex = await response.json();
            this.isLoaded = true;
        } catch (error) {
            console.error('Failed to load search index:', error);
            this.searchIndex = [];
        }
    }
    
    getPathToRoot() {
        const currentPath = window.location.pathname;
        
        // For GitHub Pages, handle the repository path correctly
        // Check if we're on GitHub Pages (contains username.github.io)
        if (window.location.hostname.includes('github.io')) {
            // Extract the repository name from the path
            const pathParts = currentPath.split('/').filter(part => part);
            
            // If we're at the root (just the repo name), use relative path
            if (pathParts.length <= 1) {
                return './';
            }
            
            // Count how many levels deep we are from the repository root
            let depth = pathParts.length - 1; // Subtract 1 for the repository name
            
            // If the last part is an HTML file, don't count it as a directory level
            if (pathParts[pathParts.length - 1].endsWith('.html')) {
                depth--;
            }
            
            return depth > 0 ? '../'.repeat(depth) : './';
        } else {
            // Local development - original logic
            const pathParts = currentPath.split('/').filter(part => part && part !== 'index.html');
            
            // Count directory levels from root (excluding the HTML file itself)
            let depth = 0;
            for (const part of pathParts) {
                if (!part.endsWith('.html')) {
                    depth++;
                }
            }
            
            return depth > 0 ? '../'.repeat(depth) : './';
        }
    }
    
    createSearchUI() {
        const nav = document.querySelector('nav .nav-container');
        if (!nav) return;
        
        // Create search container
        const searchContainer = document.createElement('div');
        searchContainer.className = 'search-container';
        
        // Create search input
        const searchInput = document.createElement('input');
        searchInput.type = 'text';
        searchInput.className = 'search-input';
        searchInput.placeholder = 'Search campaign notes...';
        searchInput.setAttribute('aria-label', 'Search campaign notes');
        
        // Create keyboard shortcut hint
        const shortcut = document.createElement('div');
        shortcut.className = 'search-shortcut';
        shortcut.textContent = 'Ctrl+K';
        
        // Create results container
        const searchResults = document.createElement('div');
        searchResults.className = 'search-results';
        searchResults.setAttribute('role', 'listbox');
        
        // Assemble UI
        searchContainer.appendChild(searchInput);
        searchContainer.appendChild(shortcut);
        searchContainer.appendChild(searchResults);
        
        // Insert search container after the navigation links
        const navList = nav.querySelector('ul');
        if (navList && navList.nextSibling) {
            nav.insertBefore(searchContainer, navList.nextSibling);
        } else {
            nav.appendChild(searchContainer);
        }
        
        // Store references
        this.searchInput = searchInput;
        this.searchResults = searchResults;
    }
    
    setupEventListeners() {
        if (!this.searchInput) return;
        
        // Search input events
        this.searchInput.addEventListener('input', (e) => {
            this.handleSearchInput(e.target.value);
        });
        
        this.searchInput.addEventListener('focus', () => {
            if (this.currentQuery) {
                this.showResults();
            }
        });
        
        this.searchInput.addEventListener('blur', (e) => {
            // Delay hiding to allow clicking on results
            setTimeout(() => {
                if (!this.searchResults.contains(document.activeElement)) {
                    this.hideResults();
                }
            }, 200);
        });
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl+K or Cmd+K to focus search
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                this.focusSearch();
            }
            
            // Escape to close search
            if (e.key === 'Escape') {
                this.hideResults();
                this.searchInput.blur();
            }
            
            // Arrow keys for navigation
            if (this.searchResults.classList.contains('visible')) {
                this.handleKeyboardNavigation(e);
            }
        });
        
        // Click outside to close
        document.addEventListener('click', (e) => {
            const searchContainer = this.searchInput.closest('.search-container');
            if (searchContainer && !searchContainer.contains(e.target)) {
                this.hideResults();
            }
        });
        
        // Prevent search results from losing focus
        this.searchResults.addEventListener('mousedown', (e) => {
            e.preventDefault();
        });
    }
    
    handleSearchInput(query) {
        this.currentQuery = query.trim();
        
        // Clear previous debounce
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        // Debounce search
        this.debounceTimer = setTimeout(() => {
            if (this.currentQuery.length > 0) {
                this.performSearch(this.currentQuery);
                this.showResults();
            } else {
                this.hideResults();
            }
        }, 150);
    }
    
    performSearch(query) {
        if (!this.isLoaded || !query) {
            this.displayResults([]);
            return;
        }
        
        const results = this.searchItems(query);
        this.displayResults(results);
    }
    
    searchItems(query) {
        const queryLower = query.toLowerCase();
        const searchWords = queryLower.split(' ').filter(word => word.length > 0);
        
        return this.searchIndex
            .map(item => {
                let score = 0;
                let matches = [];
                
                // Search in title (higher weight)
                const titleScore = this.calculateMatchScore(item.title.toLowerCase(), searchWords, 3);
                score += titleScore.score;
                matches.push(...titleScore.matches);
                
                // Search in aliases (high weight)
                if (item.aliases) {
                    for (const alias of item.aliases) {
                        const aliasScore = this.calculateMatchScore(alias.toLowerCase(), searchWords, 2.5);
                        score += aliasScore.score;
                        matches.push(...aliasScore.matches);
                    }
                }
                
                // Search in tags (medium weight)
                if (item.tags) {
                    for (const tag of item.tags) {
                        const tagScore = this.calculateMatchScore(tag.toLowerCase(), searchWords, 2);
                        score += tagScore.score;
                        matches.push(...tagScore.matches);
                    }
                }
                
                // Search in content (lower weight)
                const contentScore = this.calculateMatchScore(item.content.toLowerCase(), searchWords, 1);
                score += contentScore.score;
                matches.push(...contentScore.matches);
                
                // Search in category (medium weight)
                const categoryScore = this.calculateMatchScore(item.category.toLowerCase(), searchWords, 2);
                score += categoryScore.score;
                matches.push(...categoryScore.matches);
                
                return {
                    item,
                    score,
                    matches: [...new Set(matches)] // Remove duplicates
                };
            })
            .filter(result => result.score > 0)
            .sort((a, b) => b.score - a.score)
            .slice(0, 10); // Limit to top 10 results
    }
    
    calculateMatchScore(text, searchWords, weight = 1) {
        let score = 0;
        let matches = [];
        
        for (const word of searchWords) {
            if (text.includes(word)) {
                // Exact word match
                if (text.split(' ').includes(word)) {
                    score += 2 * weight;
                } else {
                    // Partial match
                    score += 1 * weight;
                }
                matches.push(word);
            }
        }
        
        // Bonus for exact phrase match
        const fullQuery = searchWords.join(' ');
        if (text.includes(fullQuery)) {
            score += 3 * weight;
        }
        
        return { score, matches };
    }
    
    displayResults(results) {
        if (!this.searchResults) return;
        
        this.searchResults.innerHTML = '';
        
        if (results.length === 0) {
            const noResults = document.createElement('div');
            noResults.className = 'search-no-results';
            noResults.textContent = this.currentQuery ? 'No results found' : 'Start typing to search...';
            this.searchResults.appendChild(noResults);
            return;
        }
        
        results.forEach((result, index) => {
            const resultElement = this.createResultElement(result.item, result.matches, index);
            this.searchResults.appendChild(resultElement);
        });
    }
    
    createResultElement(item, matches, index) {
        const element = document.createElement('div');
        element.className = 'search-result-item';
        element.setAttribute('role', 'option');
        element.setAttribute('data-index', index);
        
        // Title
        const title = document.createElement('div');
        title.className = 'search-result-title';
        title.textContent = item.title;
        
        // Category
        const category = document.createElement('div');
        category.className = 'search-result-category';
        category.textContent = item.category;
        
        // Content snippet
        const snippet = document.createElement('div');
        snippet.className = 'search-result-snippet';
        snippet.innerHTML = this.createSnippet(item.content, matches);
        
        element.appendChild(title);
        element.appendChild(category);
        element.appendChild(snippet);
        
        // Click handler
        element.addEventListener('click', () => {
            this.navigateToResult(item);
        });
        
        return element;
    }
    
    createSnippet(content, matches) {
        if (!matches.length || !content) return content.substring(0, 100) + '...';
        
        // Find the first match and create a snippet around it
        const firstMatch = matches[0];
        const matchIndex = content.toLowerCase().indexOf(firstMatch.toLowerCase());
        
        if (matchIndex === -1) return content.substring(0, 100) + '...';
        
        // Create snippet with some context
        const start = Math.max(0, matchIndex - 50);
        const end = Math.min(content.length, matchIndex + firstMatch.length + 50);
        let snippet = content.substring(start, end);
        
        if (start > 0) snippet = '...' + snippet;
        if (end < content.length) snippet = snippet + '...';
        
        // Highlight matches
        matches.forEach(match => {
            const regex = new RegExp(`(${this.escapeRegex(match)})`, 'gi');
            snippet = snippet.replace(regex, '<span class="search-result-highlight">$1</span>');
        });
        
        return snippet;
    }
    
    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    
    handleKeyboardNavigation(e) {
        const items = this.searchResults.querySelectorAll('.search-result-item');
        if (!items.length) return;
        
        const currentFocus = this.searchResults.querySelector('.search-result-item:focus');
        let currentIndex = currentFocus ? parseInt(currentFocus.getAttribute('data-index')) : -1;
        
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                currentIndex = Math.min(currentIndex + 1, items.length - 1);
                items[currentIndex].focus();
                break;
                
            case 'ArrowUp':
                e.preventDefault();
                currentIndex = Math.max(currentIndex - 1, 0);
                items[currentIndex].focus();
                break;
                
            case 'Enter':
                e.preventDefault();
                if (currentFocus) {
                    currentFocus.click();
                }
                break;
        }
    }
    
    navigateToResult(item) {
        // Calculate path to target from current page
        const pathToRoot = this.getPathToRoot();
        const targetPath = pathToRoot + item.path;
        
        window.location.href = targetPath;
    }
    
    focusSearch() {
        if (this.searchInput) {
            this.searchInput.focus();
            this.searchInput.select();
        }
    }
    
    showResults() {
        if (this.searchResults) {
            this.searchResults.classList.add('visible');
        }
    }
    
    hideResults() {
        if (this.searchResults) {
            this.searchResults.classList.remove('visible');
        }
    }
}

// Hover Preview System
class HoverPreview {
    constructor() {
        this.preview = null;
        this.currentLink = null;
        this.showTimer = null;
        this.hideTimer = null;
        this.cache = new Map();
        this.isLoading = false;
        
        this.init();
    }
    
    init() {
        // Wait for DOM to load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupPreview());
        } else {
            this.setupPreview();
        }
    }
    
    setupPreview() {
        this.createPreviewElement();
        this.setupEventListeners();
    }
    
    createPreviewElement() {
        this.preview = document.createElement('div');
        this.preview.className = 'preview-popup';
        this.preview.innerHTML = '<div class="preview-content"></div>';
        document.body.appendChild(this.preview);
    }
    
    setupEventListeners() {
        // Add event listeners to all internal links
        this.attachToLinks();
        
        // Re-attach when new content is loaded (for dynamic content)
        const observer = new MutationObserver(() => {
            this.attachToLinks();
        });
        
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Preview popup event listeners
        this.preview.addEventListener('mouseenter', () => {
            this.clearHideTimer();
        });
        
        this.preview.addEventListener('mouseleave', () => {
            this.hidePreview();
        });
    }
    
    attachToLinks() {
        // Find all internal links (links to .html files)
        const links = document.querySelectorAll('a[href$=".html"]');
        
        links.forEach(link => {
            // Skip if already processed
            if (link.hasAttribute('data-preview-attached')) return;
            
            // Skip navigation links, folder links, and buttons that shouldn't have previews
            if (this.shouldSkipLink(link)) return;
            
            link.setAttribute('data-preview-attached', 'true');
            
            link.addEventListener('mouseenter', (e) => {
                this.handleLinkHover(e.target);
            });
            
            link.addEventListener('mouseleave', () => {
                this.handleLinkLeave();
            });
        });
    }
    
    shouldSkipLink(link) {
        // Skip links in navigation
        if (link.closest('nav')) return true;
        
        // Skip links that are buttons or have button-like classes
        if (link.classList.contains('button') || 
            link.classList.contains('btn') ||
            link.classList.contains('nav-link') ||
            link.classList.contains('category-card') ||
            link.closest('.category-card')) return true;
        
        // Skip folder/index links (they typically end with / or are index pages)
        const href = link.getAttribute('href');
        if (href && (href.endsWith('/index.html') || href.includes('/index.html'))) return true;
        
        // Skip if the link text suggests it's navigation (very short text)
        const linkText = link.textContent.trim();
        if (linkText.length < 3) return true;
        
        // Skip common navigation text
        const navTexts = ['home', 'back', 'up', 'index', 'menu'];
        if (navTexts.includes(linkText.toLowerCase())) return true;
        
        return false;
    }
    
    handleLinkHover(link) {
        this.currentLink = link;
        
        // Clear any existing timers
        this.clearShowTimer();
        this.clearHideTimer();
        
        // Start show timer
        this.showTimer = setTimeout(() => {
            this.showPreview(link);
        }, 500); // 500ms delay before showing
    }
    
    handleLinkLeave() {
        this.clearShowTimer();
        
        // Start hide timer
        this.hideTimer = setTimeout(() => {
            this.hidePreview();
        }, 300); // 300ms delay before hiding
    }
    
    async showPreview(link) {
        if (!link || this.isLoading) return;
        
        const href = link.getAttribute('href');
        if (!href) return;
        
        // Convert relative URL to absolute
        const url = new URL(href, window.location.href);
        const urlKey = url.pathname;
        
        try {
            this.isLoading = true;
            
            // Check cache first
            let content;
            if (this.cache.has(urlKey)) {
                content = this.cache.get(urlKey);
            } else {
                // Fetch page content
                const response = await fetch(url.href);
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                
                const html = await response.text();
                content = this.extractContent(html);
                
                // Only cache if content exists
                if (content) {
                    this.cache.set(urlKey, content);
                }
            }
            
            // Only show preview if we have content and still hovering the same link
            if (this.currentLink === link && content) {
                // Position preview
                this.positionPreview(link);
                
                // Show preview with content
                this.preview.querySelector('.preview-content').innerHTML = content;
                this.preview.classList.add('visible');
            }
            
        } catch (error) {
            console.error('Failed to load preview:', error);
            // Don't show anything on error
        } finally {
            this.isLoading = false;
        }
    }
    
    extractContent(html) {
        // Create a temporary DOM to parse the HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        // Find the main article content
        const article = doc.querySelector('main article');
        if (!article) return null; // Return null instead of error message
        
        // Clone the article to avoid modifying the original
        const content = article.cloneNode(true);
        
        // Remove any script tags
        const scripts = content.querySelectorAll('script');
        scripts.forEach(script => script.remove());
        
        // Convert any relative image paths to absolute
        const images = content.querySelectorAll('img');
        images.forEach(img => {
            const src = img.getAttribute('src');
            if (src && !src.startsWith('http') && !src.startsWith('data:')) {
                // Make relative to the page we're previewing
                const baseUrl = new URL(this.currentLink.href);
                const absoluteUrl = new URL(src, baseUrl);
                img.setAttribute('src', absoluteUrl.href);
            }
        });
        
        // Convert any relative links to absolute (to prevent broken navigation)
        const links = content.querySelectorAll('a[href]');
        links.forEach(link => {
            const href = link.getAttribute('href');
            if (href && !href.startsWith('http') && !href.startsWith('#')) {
                const baseUrl = new URL(this.currentLink.href);
                const absoluteUrl = new URL(href, baseUrl);
                link.setAttribute('href', absoluteUrl.href);
            }
        });
        
        return content.innerHTML;
    }
    
    positionPreview(link) {
        const linkRect = link.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;
        const previewWidth = 600;
        const previewHeight = 600;
        const gap = 10;
        
        let left = linkRect.right + gap;
        let top = linkRect.top;
        
        // Adjust if preview would go off right edge
        if (left + previewWidth > viewportWidth - gap) {
            left = linkRect.left - previewWidth - gap; // Show on left side instead
        }
        
        // Adjust if preview would go off bottom edge
        if (top + previewHeight > viewportHeight - gap) {
            top = viewportHeight - previewHeight - gap;
        }
        
        // Ensure preview doesn't go above viewport
        if (top < gap) {
            top = gap;
        }
        
        // Ensure preview doesn't go off left edge
        if (left < gap) {
            left = gap;
        }
        
        this.preview.style.left = left + 'px';
        this.preview.style.top = top + 'px';
    }
    
    hidePreview() {
        this.preview.classList.remove('visible');
        this.currentLink = null;
        this.clearHideTimer();
        this.clearShowTimer();
    }
    
    clearShowTimer() {
        if (this.showTimer) {
            clearTimeout(this.showTimer);
            this.showTimer = null;
        }
    }
    
    clearHideTimer() {
        if (this.hideTimer) {
            clearTimeout(this.hideTimer);
            this.hideTimer = null;
        }
    }
}

// Initialize search engine and hover preview when script loads
const searchEngine = new SearchEngine();
const hoverPreview = new HoverPreview();