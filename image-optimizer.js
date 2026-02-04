/**
 * Image Optimization Utility
 * Provides lazy loading, responsive images, and performance optimizations
 */

class ImageOptimizer {
    constructor() {
        this.observer = null;
        this.images = new Set();
        this.init();
    }

    init() {
        // Set up intersection observer for lazy loading
        this.setupLazyLoading();
        
        // Optimize existing images on page
        this.optimizePageImages();
        
        // Monitor for new images added dynamically
        this.observeNewImages();
    }

    /**
     * Setup Intersection Observer for lazy loading
     */
    setupLazyLoading() {
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            this.loadImage(entry.target);
                            this.observer.unobserve(entry.target);
                        }
                    });
                },
                {
                    rootMargin: '50px', // Start loading 50px before image enters viewport
                    threshold: 0.01
                }
            );
        }
    }

    /**
     * Optimize all images on the current page
     */
    optimizePageImages() {
        const images = document.querySelectorAll('img');
        images.forEach(img => this.optimizeImage(img));
    }

    /**
     * Optimize a single image element
     */
    optimizeImage(img) {
        if (this.images.has(img)) return; // Already processed
        this.images.add(img);

        // Add decoding="async" for better performance
        if (!img.hasAttribute('decoding')) {
            img.setAttribute('decoding', 'async');
        }

        // Handle lazy loading
        const loadingAttr = img.getAttribute('loading');
        
        if (loadingAttr === 'lazy' || (!loadingAttr && !this.isAboveFold(img))) {
            img.setAttribute('loading', 'lazy');
            
            // Use Intersection Observer as fallback for older browsers
            if (this.observer && !('loading' in HTMLImageElement.prototype)) {
                // Browser doesn't support native lazy loading
                const originalSrc = img.src;
                img.dataset.src = originalSrc;
                img.src = this.getPlaceholder(img.width, img.height);
                this.observer.observe(img);
            }
        }

        // Add responsive image handling
        this.addResponsiveSupport(img);

        // Add error handling
        if (!img.onerror) {
            img.onerror = () => this.handleImageError(img);
        }

        // Track load performance
        if (window.logger) {
            img.addEventListener('load', () => {
                window.logger.debug('Image Loaded', {
                    src: img.src,
                    width: img.naturalWidth,
                    height: img.naturalHeight,
                    size: `${img.naturalWidth}x${img.naturalHeight}`
                });
            }, { once: true });
        }
    }

    /**
     * Load image (for Intersection Observer fallback)
     */
    loadImage(img) {
        const src = img.dataset.src;
        if (src) {
            img.src = src;
            delete img.dataset.src;
        }
    }

    /**
     * Check if image is above the fold
     */
    isAboveFold(img) {
        const rect = img.getBoundingClientRect();
        return rect.top < window.innerHeight && rect.bottom > 0;
    }

    /**
     * Generate placeholder data URL
     */
    getPlaceholder(width, height) {
        // Create a tiny SVG placeholder
        const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
            <rect width="100%" height="100%" fill="#1a1a1a"/>
        </svg>`;
        return `data:image/svg+xml,${encodeURIComponent(svg)}`;
    }

    /**
     * Add responsive image support (srcset)
     */
    addResponsiveSupport(img) {
        // Skip if already has srcset
        if (img.hasAttribute('srcset')) return;

        const src = img.getAttribute('src') || img.dataset.src;
        if (!src) return;

        // Check if this is a gallery image or other optimizable image
        if (src.includes('/images/') || src.includes('gallery')) {
            // Generate srcset for different screen densities
            const baseSrc = src.replace(/\.(jpg|jpeg|png|webp)$/i, '');
            const ext = src.match(/\.(jpg|jpeg|png|webp)$/i)?.[1] || 'jpg';
            
            // For now, just set the single image
            // In production, you'd generate multiple sizes server-side
            img.setAttribute('sizes', '(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw');
        }
    }

    /**
     * Handle image load errors
     */
    handleImageError(img) {
        console.warn('Image failed to load:', img.src);
        
        if (window.logger) {
            window.logger.warn('Image Load Failed', {
                src: img.src,
                alt: img.alt
            });
        }

        // Try fallback if available
        const fallback = img.dataset.fallback;
        if (fallback && img.src !== fallback) {
            img.src = fallback;
            return;
        }

        // Show placeholder
        img.style.background = 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)';
        img.style.display = 'block';
        img.alt = img.alt || 'Image unavailable';
    }

    /**
     * Observe for new images added to DOM
     */
    observeNewImages() {
        if ('MutationObserver' in window) {
            const mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    mutation.addedNodes.forEach((node) => {
                        if (node.tagName === 'IMG') {
                            this.optimizeImage(node);
                        } else if (node.querySelectorAll) {
                            node.querySelectorAll('img').forEach(img => {
                                this.optimizeImage(img);
                            });
                        }
                    });
                });
            });

            mutationObserver.observe(document.body, {
                childList: true,
                subtree: true
            });
        }
    }

    /**
     * Preload critical images
     */
    preloadImages(urls) {
        urls.forEach(url => {
            const link = document.createElement('link');
            link.rel = 'preload';
            link.as = 'image';
            link.href = url;
            document.head.appendChild(link);
        });
    }

    /**
     * Get image performance stats
     */
    getStats() {
        const images = Array.from(this.images);
        const loaded = images.filter(img => img.complete);
        const errors = images.filter(img => img.complete && !img.naturalWidth);
        
        return {
            total: images.length,
            loaded: loaded.length,
            errors: errors.length,
            pending: images.length - loaded.length
        };
    }

    /**
     * Force load all lazy images (for testing)
     */
    loadAll() {
        this.images.forEach(img => {
            if (img.dataset.src) {
                this.loadImage(img);
            }
        });
    }
}

// Auto-initialize on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.imageOptimizer = new ImageOptimizer();
    });
} else {
    window.imageOptimizer = new ImageOptimizer();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ImageOptimizer;
}
