/**
 * iOS Safari "Add to Home Screen" Instructions
 * Provides step-by-step guidance for installing the PWA on iOS
 */

class IOSInstallPrompt {
    constructor() {
        this.storageKey = 'ios-install-dismissed';
        this.cooldownDays = 30;
        
        this.init();
    }
    
    init() {
        // Only show on iOS Safari (not in standalone mode)
        if (!this.isIOSSafari() || this.isStandalone()) {
            console.debug('iOS install prompt not needed');
            return;
        }
        
        // Check if dismissed recently
        if (this.isRecentlyDismissed()) {
            console.debug('iOS install prompt dismissed recently');
            return;
        }
        
        // Show after a delay to not be intrusive
        setTimeout(() => {
            this.showInstallInstructions();
        }, 10000); // 10 seconds
    }
    
    isIOSSafari() {
        const ua = window.navigator.userAgent;
        const iOS = /iPad|iPhone|iPod/.test(ua);
        const webkit = /WebKit/.test(ua);
        const safari = /Safari/.test(ua);
        
        return iOS && webkit && safari;
    }
    
    isStandalone() {
        return window.navigator.standalone === true ||
               window.matchMedia('(display-mode: standalone)').matches;
    }
    
    isRecentlyDismissed() {
        const dismissedTime = localStorage.getItem(this.storageKey);
        if (!dismissedTime) return false;
        
        const daysSinceDismissed = (Date.now() - parseInt(dismissedTime)) / (1000 * 60 * 60 * 24);
        return daysSinceDismissed < this.cooldownDays;
    }
    
    showInstallInstructions() {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'ios-install-modal';
        modal.innerHTML = `
            <div class="ios-install-overlay"></div>
            <div class="ios-install-content">
                <button class="ios-install-close" aria-label="Close">&times;</button>
                
                <div class="ios-install-header">
                    <div class="ios-install-icon">📲</div>
                    <h2>Install App</h2>
                    <p>Add Helmick Underground to your home screen for quick access and offline support.</p>
                </div>
                
                <div class="ios-install-steps">
                    <div class="ios-install-step">
                        <div class="step-number">1</div>
                        <div class="step-content">
                            <p class="step-title">Tap the Share button</p>
                            <p class="step-description">Look for <span class="share-icon">⎙</span> in your browser toolbar</p>
                        </div>
                    </div>
                    
                    <div class="ios-install-step">
                        <div class="step-number">2</div>
                        <div class="step-content">
                            <p class="step-title">Scroll and tap "Add to Home Screen"</p>
                            <p class="step-description">Find it in the list of options</p>
                        </div>
                    </div>
                    
                    <div class="ios-install-step">
                        <div class="step-number">3</div>
                        <div class="step-content">
                            <p class="step-title">Tap "Add"</p>
                            <p class="step-description">The app will appear on your home screen</p>
                        </div>
                    </div>
                </div>
                
                <div class="ios-install-benefits">
                    <h3>Benefits</h3>
                    <ul>
                        <li>✓ Quick access from home screen</li>
                        <li>✓ Works offline</li>
                        <li>✓ Full-screen experience</li>
                        <li>✓ Faster loading</li>
                    </ul>
                </div>
                
                <button class="ios-install-dismiss">Maybe Later</button>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.injectStyles();
        
        // Animate in
        requestAnimationFrame(() => {
            modal.classList.add('visible');
        });
        
        // Event listeners
        modal.querySelector('.ios-install-close').addEventListener('click', () => {
            this.dismissPrompt(modal);
        });
        
        modal.querySelector('.ios-install-dismiss').addEventListener('click', () => {
            this.dismissPrompt(modal);
        });
        
        modal.querySelector('.ios-install-overlay').addEventListener('click', () => {
            this.dismissPrompt(modal);
        });
        
        // Track impression
        if (window.trackEvent) {
            window.trackEvent('PWA', 'iOS_Install_Shown', 'Modal');
        }
    }
    
    dismissPrompt(modal) {
        // Store dismiss time
        localStorage.setItem(this.storageKey, Date.now().toString());
        
        // Animate out
        modal.classList.remove('visible');
        
        setTimeout(() => {
            modal.remove();
        }, 300);
        
        // Track dismissal
        if (window.trackEvent) {
            window.trackEvent('PWA', 'iOS_Install_Dismissed', 'Modal');
        }
    }
    
    injectStyles() {
        if (document.getElementById('ios-install-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'ios-install-styles';
        styles.textContent = `
            .ios-install-modal {
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                padding: 1rem;
                opacity: 0;
                transition: opacity 0.3s ease;
            }
            
            .ios-install-modal.visible {
                opacity: 1;
            }
            
            .ios-install-overlay {
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                backdrop-filter: blur(8px);
            }
            
            .ios-install-content {
                position: relative;
                background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
                border: 1px solid rgba(255, 107, 26, 0.3);
                border-radius: 20px;
                max-width: 400px;
                width: 100%;
                max-height: 90vh;
                overflow-y: auto;
                padding: 2rem;
                transform: scale(0.9);
                transition: transform 0.3s ease;
                box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
            }
            
            .ios-install-modal.visible .ios-install-content {
                transform: scale(1);
            }
            
            .ios-install-close {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: #fff;
                width: 36px;
                height: 36px;
                border-radius: 50%;
                font-size: 24px;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }
            
            .ios-install-close:hover {
                background: rgba(255, 255, 255, 0.2);
                transform: rotate(90deg);
            }
            
            .ios-install-header {
                text-align: center;
                margin-bottom: 2rem;
            }
            
            .ios-install-icon {
                font-size: 3rem;
                margin-bottom: 1rem;
                animation: bounce 2s ease-in-out infinite;
            }
            
            @keyframes bounce {
                0%, 100% { transform: translateY(0); }
                50% { transform: translateY(-10px); }
            }
            
            .ios-install-header h2 {
                font-size: 1.5rem;
                margin-bottom: 0.5rem;
                color: #ff6b1a;
            }
            
            .ios-install-header p {
                color: #b0b0b0;
                line-height: 1.5;
            }
            
            .ios-install-steps {
                margin-bottom: 2rem;
            }
            
            .ios-install-step {
                display: flex;
                gap: 1rem;
                margin-bottom: 1.5rem;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.03);
                border-radius: 12px;
                border: 1px solid rgba(255, 255, 255, 0.05);
            }
            
            .step-number {
                flex-shrink: 0;
                width: 32px;
                height: 32px;
                background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: bold;
                color: white;
            }
            
            .step-content {
                flex: 1;
            }
            
            .step-title {
                font-weight: 600;
                color: #fff;
                margin-bottom: 0.25rem;
            }
            
            .step-description {
                color: #b0b0b0;
                font-size: 0.9rem;
            }
            
            .share-icon {
                display: inline-block;
                font-size: 1.2rem;
                vertical-align: middle;
            }
            
            .ios-install-benefits {
                background: rgba(255, 107, 26, 0.1);
                border: 1px solid rgba(255, 107, 26, 0.3);
                border-radius: 12px;
                padding: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .ios-install-benefits h3 {
                color: #ff6b1a;
                margin-bottom: 1rem;
                font-size: 1.1rem;
            }
            
            .ios-install-benefits ul {
                list-style: none;
                padding: 0;
            }
            
            .ios-install-benefits li {
                color: #e5e5e5;
                margin-bottom: 0.5rem;
                font-size: 0.95rem;
            }
            
            .ios-install-dismiss {
                width: 100%;
                padding: 1rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
                border-radius: 8px;
                font-size: 1rem;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.3s ease;
            }
            
            .ios-install-dismiss:hover {
                background: rgba(255, 255, 255, 0.15);
            }
            
            @media (max-width: 480px) {
                .ios-install-content {
                    padding: 1.5rem;
                }
                
                .ios-install-header h2 {
                    font-size: 1.3rem;
                }
                
                .ios-install-icon {
                    font-size: 2.5rem;
                }
            }
        `;
        document.head.appendChild(styles);
    }
}

// Initialize on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.iosInstallPrompt = new IOSInstallPrompt();
    });
} else {
    window.iosInstallPrompt = new IOSInstallPrompt();
}
