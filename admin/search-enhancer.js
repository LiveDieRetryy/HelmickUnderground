/**
 * Enhanced Search with Fuse.js
 * Provides fuzzy search functionality with highlighting and ranking
 * 
 * @module search-enhancer
 */

/**
 * SearchEnhancer class for fuzzy search with Fuse.js
 * Supports searching across multiple fields with customizable options
 * Highlights matching terms in results
 */
class SearchEnhancer {
    /**
     * Create a SearchEnhancer instance
     * @param {Array} data - Array of objects to search
     * @param {Object} options - Fuse.js options
     * @param {Array<string>} options.keys - Fields to search across
     * @param {number} [options.threshold=0.4] - Match threshold (0=exact, 1=match anything)
     * @param {number} [options.distance=100] - Max distance for fuzzy matching
     * @param {boolean} [options.includeScore=true] - Include match score in results
     * @param {boolean} [options.includeMatches=true] - Include match positions for highlighting
     * 
     * @example
     * const searcher = new SearchEnhancer(customers, {
     *   keys: ['name', 'email', 'phone', 'city']
     * });
     * const results = searcher.search('john doe');
     */
    constructor(data, options = {}) {
        // Default Fuse.js options
        const defaultOptions = {
            threshold: 0.4, // 0 = exact match, 1 = match anything
            distance: 100, // Max distance for fuzzy match
            minMatchCharLength: 2, // Minimum characters to match
            includeScore: true, // Include match score
            includeMatches: true, // Include match positions for highlighting
            ignoreLocation: true, // Search entire string, not just location
            useExtendedSearch: false,
            ...options
        };

        this.data = data;
        this.options = defaultOptions;
        
        // Initialize Fuse.js if available
        if (typeof Fuse !== 'undefined') {
            this.fuse = new Fuse(data, defaultOptions);
            this.fuseAvailable = true;
        } else {
            console.warn('Fuse.js not loaded. Falling back to basic search.');
            this.fuseAvailable = false;
        }
    }

    /**
     * Update the searchable dataset
     * @param {Array} data - New data to search
     * @returns {void}
     * 
     * @example
     * searcher.updateData(newCustomers);
     */
    updateData(data) {
        this.data = data;
        if (this.fuseAvailable) {
            this.fuse.setCollection(data);
        }
    }

    /**
     * Search the dataset with fuzzy matching
     * @param {string} query - Search query
     * @returns {Array} Array of search results with scores and matches
     * 
     * @example
     * const results = searcher.search('john');
     * // Returns: [{ item: {...}, score: 0.2, matches: [...] }]
     */
    search(query) {
        if (!query || query.trim().length === 0) {
            // Return all items when query is empty
            return this.data.map(item => ({ item, score: 0, matches: [] }));
        }

        if (this.fuseAvailable) {
            // Use Fuse.js for fuzzy search
            return this.fuse.search(query);
        } else {
            // Fallback to basic includes() search
            return this.basicSearch(query);
        }
    }

    /**
     * Basic search fallback when Fuse.js is not available
     * @param {string} query - Search query
     * @returns {Array} Filtered results
     * @private
     */
    basicSearch(query) {
        const lowerQuery = query.toLowerCase();
        const keys = this.options.keys || [];
        
        return this.data
            .filter(item => {
                return keys.some(key => {
                    const value = this.getNestedValue(item, key);
                    return value && String(value).toLowerCase().includes(lowerQuery);
                });
            })
            .map(item => ({ item, score: 0, matches: [] }));
    }

    /**
     * Get nested object value by key path (e.g., 'address.city')
     * @param {Object} obj - Object to search in
     * @param {string} path - Dot-separated path to value
     * @returns {*} Value at path or undefined
     * @private
     */
    getNestedValue(obj, path) {
        return path.split('.').reduce((current, key) => current?.[key], obj);
    }

    /**
     * Highlight matching terms in text
     * @param {string} text - Original text
     * @param {Array} matches - Match positions from Fuse.js
     * @returns {string} HTML string with highlighted matches
     * 
     * @example
     * const highlighted = searcher.highlightMatches('John Doe', matches);
     * // Returns: '<mark>John</mark> Doe'
     */
    highlightMatches(text, matches = []) {
        if (!text || matches.length === 0) return text;

        // Sort matches by position (descending) to insert highlights from end
        const sortedMatches = [...matches].sort((a, b) => b[0] - a[0]);
        
        let result = text;
        for (const [start, end] of sortedMatches) {
            const before = result.slice(0, start);
            const match = result.slice(start, end + 1);
            const after = result.slice(end + 1);
            result = `${before}<mark class="search-highlight">${match}</mark>${after}`;
        }
        
        return result;
    }

    /**
     * Get highlighted version of item fields that matched
     * @param {Object} result - Fuse.js result object
     * @returns {Object} Item with highlighted fields
     * 
     * @example
     * const highlighted = searcher.getHighlightedItem(result);
     * // Returns: { name: 'John <mark>Doe</mark>', email: '...' }
     */
    getHighlightedItem(result) {
        if (!result.matches || result.matches.length === 0) {
            return result.item;
        }

        const highlighted = { ...result.item };
        
        for (const match of result.matches) {
            const key = match.key;
            const value = this.getNestedValue(result.item, key);
            
            if (value && match.indices) {
                highlighted[key] = this.highlightMatches(String(value), match.indices);
            }
        }
        
        return highlighted;
    }

    /**
     * Search and return items with highlighted matches
     * @param {string} query - Search query
     * @returns {Array} Array of items with highlighted matches
     * 
     * @example
     * const results = searcher.searchWithHighlights('john');
     * // Returns: [{ name: '<mark>John</mark> Doe', email: '...', _score: 0.2 }]
     */
    searchWithHighlights(query) {
        const results = this.search(query);
        
        return results.map(result => ({
            ...this.getHighlightedItem(result),
            _score: result.score || 0,
            _matches: result.matches || []
        }));
    }

    /**
     * Get search statistics
     * @param {Array} results - Search results
     * @returns {Object} Statistics about search results
     * 
     * @example
     * const stats = searcher.getSearchStats(results);
     * // Returns: { total: 100, matches: 5, avgScore: 0.15 }
     */
    getSearchStats(results) {
        return {
            total: this.data.length,
            matches: results.length,
            avgScore: results.length > 0 
                ? results.reduce((sum, r) => sum + (r.score || 0), 0) / results.length 
                : 0,
            bestScore: results.length > 0 ? Math.min(...results.map(r => r.score || 0)) : null
        };
    }
}

/**
 * Initialize search enhancer for customers
 * @param {Array} customers - Array of customer objects
 * @returns {SearchEnhancer} Configured search instance
 * 
 * @example
 * const customerSearch = initCustomerSearch(customers);
 * const results = customerSearch.search('john doe');
 */
function initCustomerSearch(customers) {
    return new SearchEnhancer(customers, {
        keys: [
            { name: 'name', weight: 3 }, // Name has highest weight
            { name: 'contact_person', weight: 2 },
            { name: 'email', weight: 2 },
            { name: 'phone', weight: 1.5 },
            { name: 'city', weight: 1 },
            { name: 'address', weight: 0.5 },
            { name: 'notes', weight: 0.5 }
        ],
        threshold: 0.4,
        distance: 100
    });
}

/**
 * Initialize search enhancer for contact submissions
 * @param {Array} submissions - Array of submission objects
 * @returns {SearchEnhancer} Configured search instance
 */
function initSubmissionSearch(submissions) {
    return new SearchEnhancer(submissions, {
        keys: [
            { name: 'name', weight: 3 },
            { name: 'email', weight: 2 },
            { name: 'phone', weight: 1.5 },
            { name: 'message', weight: 1 },
            { name: 'services', weight: 1 }
        ],
        threshold: 0.4,
        distance: 100
    });
}

// Add CSS for search highlighting
function injectSearchHighlightStyles() {
    // Check if styles already injected
    if (document.querySelector('[data-search-highlight-styles]')) {
        return;
    }

    const style = document.createElement('style');
    style.setAttribute('data-search-highlight-styles', 'true');
    style.textContent = `
        .search-highlight {
            background: rgba(255, 107, 26, 0.3);
            color: var(--primary-color);
            font-weight: 600;
            padding: 0.1em 0.2em;
            border-radius: 3px;
            box-shadow: 0 0 0 2px rgba(255, 107, 26, 0.1);
        }

        .search-stats {
            color: var(--gray);
            font-size: 0.9rem;
            margin-bottom: 1rem;
            padding: 0.75rem 1rem;
            background: rgba(255, 107, 26, 0.05);
            border-radius: 8px;
            border: 1px solid rgba(255, 107, 26, 0.2);
        }

        .search-stats strong {
            color: var(--primary-color);
            font-weight: 600;
        }
    `;
    document.head.appendChild(style);
}

// Auto-inject styles when script loads
injectSearchHighlightStyles();

// Make available globally
if (typeof window !== 'undefined') {
    window.SearchEnhancer = SearchEnhancer;
    window.initCustomerSearch = initCustomerSearch;
    window.initSubmissionSearch = initSubmissionSearch;
}
