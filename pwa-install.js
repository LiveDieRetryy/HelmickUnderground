/**
 * PWA Install Prompt Handler
 * Provides "Add to Home Screen" functionality
 */

class PWAInstaller {
    constructor() {
        this.deferredPrompt = null;
        this.isInstalled = false;
        this.isStandalone = false;
        
        this.init();
    }

    init() {
        // Check if app is already installed
        if (window.matchMedia('(display-mode: standalone)').matches) {
            this.isStandalone = true;
            this.isInstalled = true;
            console.log('PWA is running in standalone mode');
            return;
        }

        // Check iOS standalone
        if (window.navigator.standalone === true) {
            this.isStandalone = true;
            this.isInstalled = true;
            console.log('PWA is running in iOS standalone mode');
            return;
        }

        // Listen for install prompt
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            console.log('Install prompt available');
            
            // Show install button after a delay
            setTimeout(() => {
                this.showInstallPrompt();
            }, 5000); // Wait 5 seconds before showing
        });

        // Listen for successful install
        window.addEventListener('appinstalled', () => {
            console.log('PWA installed successfully');
            this.isInstalled = true;
            this.hideInstallPrompt();
            this.showInstalledMessage();
        });

        // Check if user has dismissed the prompt before
        const dismissedAt = localStorage.getItem('pwa-install-dismissed');
        if (dismissedAt) {
            const daysSinceDismissal = (Date.now() - parseInt(dismissedAt)) / (1000 * 60 * 60 * 24);
            if (daysSinceDismissal < 30) {
                console.log('Install prompt dismissed recently, not showing');
                return;
            }
        }
    }

    showInstallPrompt() {
        if (!this.deferredPrompt || this.isInstalled) return;

        // Check if banner already exists
        if (document.getElementById('pwa-install-banner')) return;

        const banner = document.createElement('div');
        banner.id = 'pwa-install-banner';
        banner.innerHTML = `
            <div class="pwa-install-content">
                <div class="pwa-install-icon">📱</div>
                <div class="pwa-install-text">
                    <strong>Install Helmick Underground</strong>
                    <p>Get quick access and offline support</p>
                </div>
                <button class="pwa-install-btn" id="pwa-install-accept">Install</button>
                <button class="pwa-install-close" id="pwa-install-dismiss" aria-label="Close">✕</button>
            </div>
        `;

        document.body.appendChild(banner);
        this.injectStyles();

        // Animate in
        requestAnimationFrame(() => {
            banner.classList.add('pwa-install-visible');
        });

        // Event listeners
        document.getElementById('pwa-install-accept').addEventListener('click', () => {
            this.install();
        });

        document.getElementById('pwa-install-dismiss').addEventListener('click', () => {
            this.dismissPrompt();
        });
    }

    async install() {
        if (!this.deferredPrompt) return;

        // Show the install prompt
        this.deferredPrompt.prompt();

        // Wait for user response
        const { outcome } = await this.deferredPrompt.userChoice;
        console.log(`User response to install prompt: ${outcome}`);

        if (outcome === 'accepted') {
            console.log('User accepted the install prompt');
        } else {
            console.log('User dismissed the install prompt');
            localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        }

        // Clear the prompt
        this.deferredPrompt = null;
        this.hideInstallPrompt();
    }

    dismissPrompt() {
        localStorage.setItem('pwa-install-dismissed', Date.now().toString());
        this.hideInstallPrompt();
    }

    hideInstallPrompt() {
        const banner = document.getElementById('pwa-install-banner');
        if (banner) {
            banner.classList.remove('pwa-install-visible');
            setTimeout(() => {
                banner.remove();
            }, 300);
        }
    }

    showInstalledMessage() {
        const message = document.createElement('div');
        message.className = 'pwa-installed-message';
        message.innerHTML = `
            <div class="pwa-installed-content">
                <div style="font-size: 2rem; margin-bottom: 0.5rem;">✓</div>
                <strong>App Installed!</strong>
                <p>Access Helmick Underground from your home screen</p>
            </div>
        `;
        
        document.body.appendChild(message);
        
        setTimeout(() => {
            message.classList.add('pwa-installed-visible');
        }, 100);
        
        setTimeout(() => {
            message.classList.remove('pwa-installed-visible');
            setTimeout(() => message.remove(), 300);
        }, 3000);
    }

    injectStyles() {
        if (document.querySelector('[data-pwa-install-styles]')) return;

        const style = document.createElement('style');
        style.setAttribute('data-pwa-install-styles', 'true');
        style.textContent = `
            #pwa-install-banner {
                position: fixed;
                bottom: -200px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                max-width: 500px;
                width: calc(100% - 2rem);
                background: linear-gradient(135deg, #1a1a1a 0%, #2a2a2a 100%);
                border: 2px solid rgba(255, 107, 26, 0.5);
                border-radius: 16px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.8);
                padding: 1.5rem;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            }
            
            #pwa-install-banner.pwa-install-visible {
                bottom: 2rem;
            }
            
            .pwa-install-content {
                display: flex;
                align-items: center;
                gap: 1rem;
                position: relative;
            }
            
            .pwa-install-icon {
                font-size: 2.5rem;
                flex-shrink: 0;
            }
            
            .pwa-install-text {
                flex: 1;
                min-width: 0;
            }
            
            .pwa-install-text strong {
                display: block;
                color: #ffffff;
                font-size: 1.1rem;
                margin-bottom: 0.25rem;
            }
            
            .pwa-install-text p {
                margin: 0;
                color: #b0b0b0;
                font-size: 0.9rem;
            }
            
            .pwa-install-btn {
                background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);
                color: white;
                border: none;
                padding: 0.75rem 1.5rem;
                border-radius: 8px;
                font-weight: 600;
                cursor: pointer;
                transition: all 0.2s;
                white-space: nowrap;
                font-size: 0.95rem;
            }
            
            .pwa-install-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(255, 107, 26, 0.4);
            }
            
            .pwa-install-btn:active {
                transform: translateY(0);
            }
            
            .pwa-install-close {
                position: absolute;
                top: -0.5rem;
                right: -0.5rem;
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #ffffff;
                width: 28px;
                height: 28px;
                border-radius: 50%;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
                transition: all 0.2s;
            }
            
            .pwa-install-close:hover {
                background: rgba(255, 107, 26, 0.3);
                border-color: rgba(255, 107, 26, 0.5);
                transform: rotate(90deg);
            }
            
            .pwa-installed-message {
                position: fixed;
                top: -200px;
                left: 50%;
                transform: translateX(-50%);
                z-index: 999999;
                background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
                color: white;
                padding: 1.5rem 2rem;
                border-radius: 12px;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                text-align: center;
            }
            
            .pwa-installed-message.pwa-installed-visible {
                top: 2rem;
            }
            
            .pwa-installed-content strong {
                display: block;
                font-size: 1.2rem;
                margin-bottom: 0.25rem;
            }
            
            .pwa-installed-content p {
                margin: 0;
                opacity: 0.9;
                font-size: 0.9rem;
            }
            
            @media (max-width: 768px) {
                #pwa-install-banner {
                    bottom: -250px;
                }
                
                #pwa-install-banner.pwa-install-visible {
                    bottom: 1rem;
                }
                
                .pwa-install-content {
                    flex-wrap: wrap;
                }
                
                .pwa-install-btn {
                    width: 100%;
                    margin-top: 0.5rem;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Manual trigger for install button
    showInstallButton(targetElement) {
        if (!this.deferredPrompt || this.isInstalled) {
            if (targetElement) {
                targetElement.style.display = 'none';
            }
            return false;
        }

        if (targetElement) {
            targetElement.style.display = 'block';
            targetElement.addEventListener('click', () => {
                this.install();
            });
        }

        return true;
    }
}

// Create global instance
window.pwaInstaller = new PWAInstaller();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PWAInstaller;
}
