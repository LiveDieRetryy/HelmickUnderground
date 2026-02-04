// Analytics tracking for Helmick Underground
/**
 * Analytics Tracking System
 * Tracks page views, user sessions, interactions, goals, and conversions
 * Stores data in JSON file via API
 */

(function() {
    'use strict';
    
    // Event tracking helper
    window.trackEvent = function(category, action, label, value) {
        const eventData = {
            action: 'event',
            category: category,
            eventAction: action,
            label: label || '',
            value: value || 0,
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        };
        
        fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventData)
        }).catch(err => console.debug('Event tracking failed:', err));
    };
    
    // Conversion tracking helper
    window.trackConversion = function(goalName, goalValue) {
        const conversionData = {
            action: 'conversion',
            goalName: goalName,
            goalValue: goalValue || 0,
            page: window.location.pathname,
            timestamp: new Date().toISOString()
        };
        
        fetch('/api/analytics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(conversionData)
        }).catch(err => console.debug('Conversion tracking failed:', err));
    };
    
    // Don't track admin pages or localhost
    if (window.location.pathname.includes('/admin') || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return;
    }

    // Track page view
    function trackPageView() {
        // Check if user was tracked in the last 30 minutes
        const lastTracked = localStorage.getItem('lastAnalyticsTrack');
        const now = Date.now();
        const thirtyMinutes = 30 * 60 * 1000; // 30 minutes in milliseconds
        
        if (lastTracked && (now - parseInt(lastTracked)) < thirtyMinutes) {
            console.debug('Analytics: Skipping duplicate tracking (within 30min window)');
            return;
        }
        
        const data = {
            action: 'log',
            page: window.location.pathname,
            referrer: document.referrer || 'direct',
            userAgent: navigator.userAgent,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language || navigator.userLanguage,
            timestamp: new Date().toISOString()
        };

        // Send to analytics API
        fetch('/api/analytics', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        }).then(response => {
            if (response.ok) {
                // Store timestamp of successful tracking
                localStorage.setItem('lastAnalyticsTrack', now.toString());
            }
        }).catch(err => {
            // Silently fail - don't disrupt user experience
            console.debug('Analytics tracking failed:', err);
        });
    }

    // Track on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            trackPageView();
            initEventTracking();
        });
    } else {
        trackPageView();
        initEventTracking();
    }
    
    // Initialize event tracking for user interactions
    function initEventTracking() {
        // Track phone number clicks
        document.querySelectorAll('a[href^="tel:"]').forEach(link => {
            link.addEventListener('click', function() {
                trackEvent('Contact', 'Phone Click', this.href.replace('tel:', ''));
                trackConversion('Phone Call Intent', 10);
            });
        });
        
        // Track email clicks
        document.querySelectorAll('a[href^="mailto:"]').forEach(link => {
            link.addEventListener('click', function() {
                trackEvent('Contact', 'Email Click', this.href.replace('mailto:', ''));
                trackConversion('Email Intent', 5);
            });
        });
        
        // Track contact form submission
        const contactForm = document.querySelector('form[action*="contact"]');
        if (contactForm) {
            contactForm.addEventListener('submit', function(e) {
                trackEvent('Form', 'Contact Form Submit', window.location.pathname);
                trackConversion('Contact Form Submission', 25);
            });
        }
        
        // Track service link clicks
        document.querySelectorAll('a[href*="/services/"]').forEach(link => {
            link.addEventListener('click', function() {
                const serviceName = this.href.split('/').pop().replace('.html', '');
                trackEvent('Navigation', 'Service Click', serviceName);
            });
        });
        
        // Track gallery interactions
        const galleryImages = document.querySelectorAll('.gallery-image, .gallery-item img');
        galleryImages.forEach(img => {
            img.addEventListener('click', function() {
                trackEvent('Engagement', 'Gallery Image Click', this.alt || 'Unknown');
            });
        });
        
        // Track video plays
        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            video.addEventListener('play', function() {
                trackEvent('Engagement', 'Video Play', this.src);
            });
        });
        
        // Track CTA button clicks
        document.querySelectorAll('.cta-btn, .btn-primary, button[type="button"]').forEach(btn => {
            btn.addEventListener('click', function() {
                const btnText = this.textContent.trim();
                if (btnText.toLowerCase().includes('quote') || btnText.toLowerCase().includes('estimate')) {
                    trackEvent('CTA', 'Quote Button Click', btnText);
                    trackConversion('Quote Request Intent', 15);
                } else {
                    trackEvent('CTA', 'Button Click', btnText);
                }
            });
        });
        
        // Track outbound links
        document.querySelectorAll('a[href^="http"]').forEach(link => {
            if (!link.href.includes(window.location.hostname)) {
                link.addEventListener('click', function() {
                    trackEvent('Outbound', 'External Link Click', this.href);
                });
            }
        });
        
        // Track scroll depth (25%, 50%, 75%, 100%)
        let scrollDepthTracked = { 25: false, 50: false, 75: false, 100: false };
        window.addEventListener('scroll', debounceScroll(function() {
            const scrollPercent = Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100);
            
            for (let depth in scrollDepthTracked) {
                if (scrollPercent >= depth && !scrollDepthTracked[depth]) {
                    scrollDepthTracked[depth] = true;
                    trackEvent('Engagement', 'Scroll Depth', depth + '%', parseInt(depth));
                }
            }
        }, 500));
        
        // Track time on page (when leaving)
        const pageLoadTime = Date.now();
        window.addEventListener('beforeunload', function() {
            const timeOnPage = Math.round((Date.now() - pageLoadTime) / 1000); // seconds
            if (timeOnPage > 5) { // Only track if more than 5 seconds
                trackEvent('Engagement', 'Time on Page', window.location.pathname, timeOnPage);
            }
        });
    }
    
    // Debounce helper for scroll events
    function debounceScroll(func, wait) {
        let timeout;
        return function() {
            clearTimeout(timeout);
            timeout = setTimeout(func, wait);
        };
    }
})();
