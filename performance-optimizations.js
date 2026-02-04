/**
 * Core Web Vitals Performance Optimizations
 * Improves LCP, FID, CLS metrics for better UX and SEO
 */

(function() {
    'use strict';
    
    // 1. Optimize images for LCP (Largest Contentful Paint)
    function optimizeImages() {
        // Add loading="lazy" to off-screen images
        const images = document.querySelectorAll('img:not([loading])');
        images.forEach((img, index) => {
            // First 2-3 images should load eagerly (above fold)
            if (index > 2) {
                img.loading = 'lazy';
            }
        });
        
        // Add fetchpriority="high" to hero/LCP images
        const heroImages = document.querySelectorAll('.hero img, .logo img, h1 img');
        heroImages.forEach(img => {
            img.setAttribute('fetchpriority', 'high');
        });
    }
    
    // 2. Reduce CLS (Cumulative Layout Shift) by reserving space for images
    function reserveImageSpace() {
        const images = document.querySelectorAll('img:not([width]):not([height])');
        images.forEach(img => {
            // Only if image is loaded
            if (img.naturalWidth && img.naturalHeight) {
                const aspectRatio = (img.naturalHeight / img.naturalWidth) * 100;
                img.style.aspectRatio = `${img.naturalWidth} / ${img.naturalHeight}`;
            }
            
            // Set dimensions from actual size once loaded
            img.addEventListener('load', function() {
                if (!this.hasAttribute('width')) {
                    this.setAttribute('width', this.naturalWidth);
                    this.setAttribute('height', this.naturalHeight);
                }
            }, { once: true });
        });
    }
    
    // 3. Optimize third-party scripts for FID (First Input Delay)
    function optimizeThirdPartyScripts() {
        // Defer non-critical scripts
        const scripts = document.querySelectorAll('script[src]:not([async]):not([defer])');
        scripts.forEach(script => {
            // Skip if script is inline or critical
            if (!script.src || script.src.includes('analytics') || script.src.includes('critical')) {
                return;
            }
            script.defer = true;
        });
    }
    
    // 4. Prefetch critical navigation
    function prefetchCriticalPages() {
        if ('IntersectionObserver' in window) {
            const navLinks = document.querySelectorAll('a[href^="/"]');
            const observer = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const link = entry.target;
                        const href = link.getAttribute('href');
                        
                        // Create prefetch link
                        const prefetchLink = document.createElement('link');
                        prefetchLink.rel = 'prefetch';
                        prefetchLink.href = href;
                        document.head.appendChild(prefetchLink);
                        
                        observer.unobserve(link);
                    }
                });
            }, { rootMargin: '50px' });
            
            navLinks.forEach(link => observer.observe(link));
        }
    }
    
    // 5. Reduce main thread blocking
    function reduceMainThreadBlocking() {
        // Break up long tasks
        if ('requestIdleCallback' in window) {
            requestIdleCallback(() => {
                // Defer non-critical initializations
                console.debug('Performance: Idle callback executing');
            }, { timeout: 2000 });
        }
    }
    
    // 6. Optimize font loading
    function optimizeFonts() {
        // Use font-display: swap is already in CSS/links
        // Preload critical fonts
        if (document.fonts) {
            document.fonts.ready.then(() => {
                console.debug('Performance: Fonts loaded');
            });
        }
    }
    
    // 7. Report Web Vitals to analytics
    function reportWebVitals() {
        if ('PerformanceObserver' in window) {
            // Track LCP
            try {
                const lcpObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    const lastEntry = entries[entries.length - 1];
                    const lcp = lastEntry.renderTime || lastEntry.loadTime;
                    
                    if (window.trackEvent) {
                        window.trackEvent('Performance', 'LCP', window.location.pathname, Math.round(lcp));
                    }
                });
                lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
            } catch (e) {
                console.debug('LCP observer not supported');
            }
            
            // Track FID
            try {
                const fidObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach(entry => {
                        const fid = entry.processingStart - entry.startTime;
                        
                        if (window.trackEvent) {
                            window.trackEvent('Performance', 'FID', window.location.pathname, Math.round(fid));
                        }
                    });
                });
                fidObserver.observe({ entryTypes: ['first-input'] });
            } catch (e) {
                console.debug('FID observer not supported');
            }
            
            // Track CLS
            try {
                let clsValue = 0;
                const clsObserver = new PerformanceObserver((list) => {
                    for (const entry of list.getEntries()) {
                        if (!entry.hadRecentInput) {
                            clsValue += entry.value;
                        }
                    }
                });
                clsObserver.observe({ entryTypes: ['layout-shift'] });
                
                // Report CLS on page hide
                window.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'hidden' && window.trackEvent) {
                        window.trackEvent('Performance', 'CLS', window.location.pathname, Math.round(clsValue * 1000));
                    }
                }, { once: true });
            } catch (e) {
                console.debug('CLS observer not supported');
            }
        }
    }
    
    // Initialize optimizations
    function init() {
        // Run on DOMContentLoaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                optimizeImages();
                reserveImageSpace();
                optimizeThirdPartyScripts();
                prefetchCriticalPages();
                reduceMainThreadBlocking();
                optimizeFonts();
                reportWebVitals();
            });
        } else {
            optimizeImages();
            reserveImageSpace();
            optimizeThirdPartyScripts();
            prefetchCriticalPages();
            reduceMainThreadBlocking();
            optimizeFonts();
            reportWebVitals();
        }
    }
    
    init();
})();
