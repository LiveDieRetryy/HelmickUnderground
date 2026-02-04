/**
 * Offline Detection and Handling System
 * Monitors network connectivity and provides visual feedback
 */

class OfflineHandler {
    constructor() {
        this.isOnline = navigator.onLine;
        this.banner = null;
        this.actionQueue = [];
        this.retryCallbacks = new Set();
        this.init();
    }

    init() {
        // Create offline banner
        this.createBanner();
        
        // Listen for online/offline events
        window.addEventListener('online', () => this.handleOnline());
        window.addEventListener('offline', () => this.handleOffline());
        
        // Check initial state
        if (!this.isOnline) {
            this.showBanner();
        }
    }

    createBanner() {
        this.banner = document.createElement('div');
        this.banner.id = 'offline-banner';
        this.banner.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
            color: white;
            padding: 12px 20px;
            text-align: center;
            font-size: 14px;
            font-weight: 500;
            z-index: 10000;
            display: none;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            animation: slideDown 0.3s ease-out;
        `;
        
        this.banner.innerHTML = `
            <div style="display: flex; align-items: center; justify-content: center; gap: 12px;">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                </svg>
                <span id="offline-message">You are offline. Changes will be saved when connection returns.</span>
            </div>
        `;
        
        // Add animation styles
        const style = document.createElement('style');
        style.textContent = `
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
            @keyframes slideUp {
                from {
                    transform: translateY(0);
                    opacity: 1;
                }
                to {
                    transform: translateY(-100%);
                    opacity: 0;
                }
            }
            .offline-banner-hiding {
                animation: slideUp 0.3s ease-out forwards !important;
            }
        `;
        document.head.appendChild(style);
        
        document.body.appendChild(this.banner);
    }

    showBanner() {
        if (this.banner) {
            this.banner.style.display = 'block';
            this.banner.classList.remove('offline-banner-hiding');
        }
    }

    hideBanner() {
        if (this.banner) {
            this.banner.classList.add('offline-banner-hiding');
            setTimeout(() => {
                this.banner.style.display = 'none';
            }, 300);
        }
    }

    updateBannerMessage(message, isSuccess = false) {
        const messageEl = document.getElementById('offline-message');
        if (messageEl) {
            messageEl.textContent = message;
        }
        
        if (isSuccess) {
            this.banner.style.background = 'linear-gradient(135deg, #51cf66 0%, #37b24d 100%)';
        } else {
            this.banner.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%)';
        }
    }

    handleOffline() {
        this.isOnline = false;
        console.log('🔴 Connection lost');
        this.showBanner();
        
        // Notify all listeners
        this.notifyListeners('offline');
    }

    handleOnline() {
        this.isOnline = true;
        console.log('🟢 Connection restored');
        
        // Update banner to show reconnection
        this.updateBannerMessage('Connection restored! Syncing...', true);
        
        // Process queued actions
        this.processQueue();
        
        // Notify all listeners
        this.notifyListeners('online');
        
        // Hide banner after delay
        setTimeout(() => {
            this.hideBanner();
        }, 2000);
    }

    /**
     * Queue an action to be executed when connection returns
     * @param {Function} action - Function to execute
     * @param {string} description - Human-readable description
     */
    queueAction(action, description = 'Pending action') {
        if (this.isOnline) {
            // If online, execute immediately
            return action();
        }
        
        this.actionQueue.push({
            action,
            description,
            timestamp: Date.now()
        });
        
        console.log(`📋 Queued: ${description}`);
        return Promise.reject(new Error('Offline - action queued'));
    }

    /**
     * Process all queued actions
     */
    async processQueue() {
        if (this.actionQueue.length === 0) {
            return;
        }
        
        console.log(`📤 Processing ${this.actionQueue.length} queued actions...`);
        
        const queue = [...this.actionQueue];
        this.actionQueue = [];
        
        let successCount = 0;
        let failCount = 0;
        
        for (const item of queue) {
            try {
                await item.action();
                successCount++;
                console.log(`✅ Completed: ${item.description}`);
            } catch (error) {
                failCount++;
                console.error(`❌ Failed: ${item.description}`, error);
                // Re-queue failed actions
                this.actionQueue.push(item);
            }
        }
        
        if (successCount > 0) {
            this.updateBannerMessage(
                `Synced ${successCount} action${successCount > 1 ? 's' : ''}!`,
                true
            );
        }
        
        if (failCount > 0) {
            this.updateBannerMessage(
                `${failCount} action${failCount > 1 ? 's' : ''} failed. Will retry...`,
                false
            );
        }
    }

    /**
     * Register a callback for online/offline events
     * @param {Function} callback - Function to call with 'online' or 'offline'
     */
    onStatusChange(callback) {
        this.retryCallbacks.add(callback);
        
        // Return unsubscribe function
        return () => {
            this.retryCallbacks.delete(callback);
        };
    }

    notifyListeners(status) {
        this.retryCallbacks.forEach(callback => {
            try {
                callback(status);
            } catch (error) {
                console.error('Error in status change callback:', error);
            }
        });
    }

    /**
     * Check if currently online
     */
    checkStatus() {
        return this.isOnline;
    }

    /**
     * Get queued action count
     */
    getQueueSize() {
        return this.actionQueue.length;
    }

    /**
     * Clear all queued actions
     */
    clearQueue() {
        const count = this.actionQueue.length;
        this.actionQueue = [];
        console.log(`🗑️ Cleared ${count} queued actions`);
        return count;
    }
}

// Create global instance
window.offlineHandler = new OfflineHandler();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OfflineHandler;
}
