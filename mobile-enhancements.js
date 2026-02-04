/**
 * Mobile-Specific Enhancements
 * Pull-to-refresh, network status, haptic feedback, device detection
 */

class MobileEnhancements {
    constructor() {
        this.isPullToRefreshEnabled = false;
        this.startY = 0;
        this.currentY = 0;
        this.isPulling = false;
        this.pullThreshold = 80; // pixels
        this.refreshElement = null;
        
        this.init();
    }
    
    init() {
        // Only enable on mobile devices
        if (!this.isMobileDevice()) {
            console.debug('Mobile enhancements disabled on desktop');
            return;
        }
        
        console.log('Mobile enhancements enabled');
        
        // Initialize features
        this.initPullToRefresh();
        this.initNetworkStatus();
        this.initHapticFeedback();
        this.initScreenWakeLock();
        this.detectDeviceCapabilities();
    }
    
    isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               (window.matchMedia && window.matchMedia('(max-width: 768px)').matches);
    }
    
    // Pull-to-Refresh Implementation
    initPullToRefresh() {
        // Only enable on pages with data lists
        const dataContainers = document.querySelectorAll(
            '.submissions-container, .customers-container, #logContainer, .table-container'
        );
        
        if (dataContainers.length === 0) return;
        
        // Create refresh indicator
        this.refreshElement = document.createElement('div');
        this.refreshElement.className = 'pull-to-refresh-indicator';
        this.refreshElement.innerHTML = `
            <div class="pull-to-refresh-spinner"></div>
            <div class="pull-to-refresh-text">Pull to refresh</div>
        `;
        document.body.insertBefore(this.refreshElement, document.body.firstChild);
        
        // Add styles
        this.injectPullToRefreshStyles();
        
        // Touch event listeners
        let touchStartY = 0;
        let isAtTop = false;
        
        document.addEventListener('touchstart', (e) => {
            touchStartY = e.touches[0].clientY;
            isAtTop = window.scrollY === 0;
            this.startY = touchStartY;
        }, { passive: true });
        
        document.addEventListener('touchmove', (e) => {
            if (!isAtTop) return;
            
            const touchY = e.touches[0].clientY;
            const pullDistance = touchY - touchStartY;
            
            if (pullDistance > 0) {
                this.isPulling = true;
                this.currentY = Math.min(pullDistance, this.pullThreshold * 1.5);
                
                // Update UI
                this.refreshElement.style.transform = `translateY(${this.currentY}px)`;
                this.refreshElement.style.opacity = Math.min(this.currentY / this.pullThreshold, 1);
                
                if (this.currentY >= this.pullThreshold) {
                    this.refreshElement.classList.add('ready');
                    this.refreshElement.querySelector('.pull-to-refresh-text').textContent = 'Release to refresh';
                    this.triggerHaptic('light');
                } else {
                    this.refreshElement.classList.remove('ready');
                    this.refreshElement.querySelector('.pull-to-refresh-text').textContent = 'Pull to refresh';
                }
            }
        }, { passive: true });
        
        document.addEventListener('touchend', () => {
            if (this.isPulling && this.currentY >= this.pullThreshold) {
                this.performRefresh();
            } else {
                this.resetPullToRefresh();
            }
            this.isPulling = false;
        }, { passive: true });
    }
    
    async performRefresh() {
        this.refreshElement.classList.add('refreshing');
        this.refreshElement.querySelector('.pull-to-refresh-text').textContent = 'Refreshing...';
        this.triggerHaptic('medium');
        
        // Find and call the page's reload function
        try {
            if (typeof window.loadData === 'function') {
                await window.loadData();
            } else if (typeof window.loadAnalyticsData === 'function') {
                await window.loadAnalyticsData();
            } else if (typeof window.loadActivityLog === 'function') {
                await window.loadActivityLog();
            } else {
                // Fallback: reload the page
                await new Promise(resolve => setTimeout(resolve, 1000));
                window.location.reload();
            }
            
            this.triggerHaptic('success');
        } catch (error) {
            console.error('Refresh failed:', error);
            this.triggerHaptic('error');
        }
        
        // Reset after delay
        setTimeout(() => {
            this.resetPullToRefresh();
        }, 500);
    }
    
    resetPullToRefresh() {
        this.refreshElement.style.transform = 'translateY(-100%)';
        this.refreshElement.style.opacity = '0';
        this.refreshElement.classList.remove('ready', 'refreshing');
        this.refreshElement.querySelector('.pull-to-refresh-text').textContent = 'Pull to refresh';
        this.currentY = 0;
    }
    
    // Network Status Monitoring
    initNetworkStatus() {
        const showNetworkStatus = (isOnline) => {
            // Remove existing status
            const existing = document.getElementById('network-status-banner');
            if (existing) existing.remove();
            
            if (!isOnline) {
                const banner = document.createElement('div');
                banner.id = 'network-status-banner';
                banner.className = 'network-status offline';
                banner.innerHTML = `
                    <span class="network-status-icon">📡</span>
                    <span class="network-status-text">You're offline. Some features may be limited.</span>
                `;
                document.body.insertBefore(banner, document.body.firstChild);
                this.triggerHaptic('warning');
            } else if (existing) {
                // Show back online message briefly
                const banner = document.createElement('div');
                banner.id = 'network-status-banner';
                banner.className = 'network-status online';
                banner.innerHTML = `
                    <span class="network-status-icon">✓</span>
                    <span class="network-status-text">Back online</span>
                `;
                document.body.insertBefore(banner, document.body.firstChild);
                this.triggerHaptic('success');
                
                setTimeout(() => {
                    banner.remove();
                }, 3000);
            }
        };
        
        window.addEventListener('online', () => showNetworkStatus(true));
        window.addEventListener('offline', () => showNetworkStatus(false));
        
        // Check initial status
        if (!navigator.onLine) {
            showNetworkStatus(false);
        }
        
        this.injectNetworkStatusStyles();
    }
    
    // Haptic Feedback (iOS & Android)
    triggerHaptic(type = 'light') {
        if (!navigator.vibrate && !window.navigator.vibrate) return;
        
        const patterns = {
            light: 10,
            medium: 20,
            heavy: 40,
            success: [10, 50, 10],
            warning: [20, 100, 20],
            error: [30, 100, 30, 100, 30]
        };
        
        const pattern = patterns[type] || patterns.light;
        
        if (navigator.vibrate) {
            navigator.vibrate(pattern);
        } else if (window.navigator.vibrate) {
            window.navigator.vibrate(pattern);
        }
    }
    
    // Screen Wake Lock (prevent screen sleep during important tasks)
    async initScreenWakeLock() {
        if (!('wakeLock' in navigator)) {
            console.debug('Wake Lock API not supported');
            return;
        }
        
        let wakeLock = null;
        
        // Expose global function to request wake lock
        window.requestScreenWakeLock = async () => {
            try {
                wakeLock = await navigator.wakeLock.request('screen');
                console.log('Screen wake lock active');
                
                wakeLock.addEventListener('release', () => {
                    console.log('Screen wake lock released');
                });
            } catch (err) {
                console.error('Failed to acquire wake lock:', err);
            }
        };
        
        window.releaseScreenWakeLock = () => {
            if (wakeLock) {
                wakeLock.release();
                wakeLock = null;
            }
        };
    }
    
    // Detect Device Capabilities
    detectDeviceCapabilities() {
        const capabilities = {
            standalone: window.matchMedia('(display-mode: standalone)').matches,
            touchscreen: 'ontouchstart' in window,
            orientation: screen.orientation?.type || 'unknown',
            connection: navigator.connection?.effectiveType || 'unknown',
            memory: navigator.deviceMemory || 'unknown',
            cores: navigator.hardwareConcurrency || 'unknown',
            maxTouchPoints: navigator.maxTouchPoints || 0,
            vibration: 'vibrate' in navigator,
            wakeLock: 'wakeLock' in navigator,
            share: 'share' in navigator,
            clipboard: 'clipboard' in navigator
        };
        
        console.log('Device capabilities:', capabilities);
        
        // Store for analytics
        if (window.trackEvent) {
            window.trackEvent('Device', 'Capabilities', JSON.stringify(capabilities));
        }
        
        return capabilities;
    }
    
    // Inject Styles
    injectPullToRefreshStyles() {
        if (document.getElementById('mobile-pull-refresh-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'mobile-pull-refresh-styles';
        styles.textContent = `
            .pull-to-refresh-indicator {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                height: 80px;
                background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                z-index: 99999;
                transform: translateY(-100%);
                opacity: 0;
                transition: opacity 0.3s ease;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .pull-to-refresh-spinner {
                width: 24px;
                height: 24px;
                border: 3px solid rgba(255, 255, 255, 0.3);
                border-top-color: white;
                border-radius: 50%;
                margin-bottom: 8px;
            }
            
            .pull-to-refresh-indicator.ready .pull-to-refresh-spinner {
                animation: spin 1s linear infinite;
            }
            
            .pull-to-refresh-indicator.refreshing .pull-to-refresh-spinner {
                animation: spin 0.6s linear infinite;
            }
            
            .pull-to-refresh-text {
                color: white;
                font-weight: 600;
                font-size: 14px;
            }
            
            @keyframes spin {
                to { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(styles);
    }
    
    injectNetworkStatusStyles() {
        if (document.getElementById('mobile-network-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'mobile-network-styles';
        styles.textContent = `
            .network-status {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                padding: 0.75rem 1rem;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 0.5rem;
                z-index: 100000;
                font-weight: 600;
                font-size: 0.9rem;
                animation: slideDown 0.3s ease-out;
            }
            
            .network-status.offline {
                background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
                color: white;
            }
            
            .network-status.online {
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                color: white;
            }
            
            .network-status-icon {
                font-size: 1.2rem;
            }
            
            @keyframes slideDown {
                from {
                    transform: translateY(-100%);
                    opacity: 0;
                }
                to {
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.mobileEnhancements = new MobileEnhancements();
    });
} else {
    window.mobileEnhancements = new MobileEnhancements();
}
