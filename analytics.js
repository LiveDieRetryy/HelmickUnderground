// Analytics tracking for Helmick Underground
(function() {
    'use strict';
    
    // Don't track admin pages or localhost
    if (window.location.pathname.includes('/admin') || 
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1') {
        return;
    }

    // Track page view
    function trackPageView() {
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
        }).catch(err => {
            // Silently fail - don't disrupt user experience
            console.debug('Analytics tracking failed:', err);
        });
    }

    // Track on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', trackPageView);
    } else {
        trackPageView();
    }
})();
