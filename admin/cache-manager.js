/**
 * Cache Manager for API Responses
 * Implements in-memory caching with TTL support
 */

class CacheManager {
    constructor() {
        this.cache = new Map();
        this.timestamps = new Map();
        this.defaultTTL = 5 * 60 * 1000; // 5 minutes default
    }

    /**
     * Set a cache entry
     * @param {string} key - Cache key
     * @param {*} value - Value to cache
     * @param {number} ttl - Time to live in milliseconds
     */
    set(key, value, ttl = this.defaultTTL) {
        this.cache.set(key, value);
        this.timestamps.set(key, {
            created: Date.now(),
            ttl: ttl
        });
    }

    /**
     * Get a cache entry
     * @param {string} key - Cache key
     * @returns {*} Cached value or null if expired/missing
     */
    get(key) {
        if (!this.cache.has(key)) {
            return null;
        }

        const timestamp = this.timestamps.get(key);
        const age = Date.now() - timestamp.created;

        // Check if expired
        if (age > timestamp.ttl) {
            this.delete(key);
            return null;
        }

        return this.cache.get(key);
    }

    /**
     * Check if key exists and is valid
     * @param {string} key - Cache key
     * @returns {boolean}
     */
    has(key) {
        return this.get(key) !== null;
    }

    /**
     * Delete a cache entry
     * @param {string} key - Cache key
     */
    delete(key) {
        this.cache.delete(key);
        this.timestamps.delete(key);
    }

    /**
     * Clear all cache entries
     */
    clear() {
        this.cache.clear();
        this.timestamps.clear();
    }

    /**
     * Get cache stats
     * @returns {Object} Cache statistics
     */
    getStats() {
        const now = Date.now();
        let validEntries = 0;
        let expiredEntries = 0;

        this.timestamps.forEach((timestamp, key) => {
            const age = now - timestamp.created;
            if (age > timestamp.ttl) {
                expiredEntries++;
            } else {
                validEntries++;
            }
        });

        return {
            totalEntries: this.cache.size,
            validEntries,
            expiredEntries,
            memoryKeys: Array.from(this.cache.keys())
        };
    }

    /**
     * Clean up expired entries
     */
    cleanup() {
        const now = Date.now();
        const keysToDelete = [];

        this.timestamps.forEach((timestamp, key) => {
            const age = now - timestamp.created;
            if (age > timestamp.ttl) {
                keysToDelete.push(key);
            }
        });

        keysToDelete.forEach(key => this.delete(key));
        
        return keysToDelete.length;
    }

    /**
     * Wrap an async function with caching
     * @param {string} key - Cache key
     * @param {Function} fn - Async function to cache
     * @param {number} ttl - Time to live
     * @returns {Promise} Result from cache or function
     */
    async wrap(key, fn, ttl = this.defaultTTL) {
        // Check cache first
        const cached = this.get(key);
        if (cached !== null) {
            return cached;
        }

        // Execute function and cache result
        const result = await fn();
        this.set(key, result, ttl);
        return result;
    }

    /**
     * Get cache age for a key
     * @param {string} key - Cache key
     * @returns {number} Age in milliseconds or -1 if not found
     */
    getAge(key) {
        const timestamp = this.timestamps.get(key);
        if (!timestamp) return -1;
        return Date.now() - timestamp.created;
    }

    /**
     * Get remaining TTL for a key
     * @param {string} key - Cache key
     * @returns {number} Remaining TTL in milliseconds or -1 if not found
     */
    getRemainingTTL(key) {
        const timestamp = this.timestamps.get(key);
        if (!timestamp) return -1;
        
        const age = Date.now() - timestamp.created;
        const remaining = timestamp.ttl - age;
        return remaining > 0 ? remaining : 0;
    }
}

// Create global instance
window.cacheManager = new CacheManager();

// Periodic cleanup every 5 minutes
setInterval(() => {
    const cleaned = window.cacheManager.cleanup();
    if (cleaned > 0) {
        console.log(`[Cache] Cleaned up ${cleaned} expired entries`);
    }
}, 5 * 60 * 1000);

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CacheManager;
}
