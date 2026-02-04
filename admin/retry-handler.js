/**
 * Error Retry Mechanism
 * Provides automatic retry with exponential backoff and manual retry UI
 */

class RetryHandler {
    constructor() {
        this.activeRetries = new Map();
        this.maxRetries = 3;
        this.baseDelay = 1000; // 1 second
        this.maxDelay = 10000; // 10 seconds
    }

    /**
     * Execute function with automatic retry on failure
     * @param {Function} fn - Async function to execute
     * @param {Object} options - Retry options
     * @returns {Promise} Result of the function
     */
    async retry(fn, options = {}) {
        const {
            maxRetries = this.maxRetries,
            baseDelay = this.baseDelay,
            maxDelay = this.maxDelay,
            onRetry = null,
            retryOn = null // Function to determine if error is retryable
        } = options;

        let lastError;
        
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                const result = await fn();
                return result;
            } catch (error) {
                lastError = error;
                
                // Check if error is retryable
                if (retryOn && !retryOn(error)) {
                    throw error; // Don't retry this error
                }
                
                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }
                
                // Calculate delay with exponential backoff
                const delay = Math.min(
                    baseDelay * Math.pow(2, attempt),
                    maxDelay
                );
                
                console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
                
                // Notify about retry
                if (onRetry) {
                    onRetry(attempt + 1, maxRetries, delay, error);
                }
                
                // Wait before retrying
                await this.sleep(delay);
            }
        }
        
        // All retries failed
        throw lastError;
    }

    /**
     * Execute fetch request with retry logic
     * @param {string} url - URL to fetch
     * @param {Object} options - Fetch options
     * @param {Object} retryOptions - Retry configuration
     * @returns {Promise<Response>} Fetch response
     */
    async fetchWithRetry(url, options = {}, retryOptions = {}) {
        return this.retry(
            async () => {
                const response = await fetch(url, options);
                
                // Retry on server errors (5xx) but not client errors (4xx)
                if (response.status >= 500) {
                    throw new Error(`Server error: ${response.status}`);
                }
                
                if (!response.ok && response.status !== 404) {
                    throw new Error(`HTTP error: ${response.status}`);
                }
                
                return response;
            },
            {
                ...retryOptions,
                retryOn: (error) => {
                    // Retry on network errors and 5xx errors
                    return error.message.includes('fetch') || 
                           error.message.includes('network') ||
                           error.message.includes('Server error');
                }
            }
        );
    }

    /**
     * Show error message with retry button
     * @param {string} message - Error message
     * @param {Function} retryFn - Function to call when retry is clicked
     * @param {HTMLElement} container - Container to show error in
     */
    showErrorWithRetry(message, retryFn, container) {
        if (!container) {
            console.error('No container provided for error display');
            return;
        }

        const errorId = `error-${Date.now()}`;
        
        const errorHTML = `
            <div id="${errorId}" class="error-message-container" style="
                background: linear-gradient(135deg, #fff5f5 0%, #ffe5e5 100%);
                border: 2px solid #ff6b6b;
                border-radius: 8px;
                padding: 1.5rem;
                margin: 1rem 0;
                display: flex;
                flex-direction: column;
                gap: 1rem;
                animation: slideIn 0.3s ease-out;
            ">
                <div style="display: flex; align-items: start; gap: 1rem;">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#ff6b6b" stroke-width="2" style="flex-shrink: 0; margin-top: 2px;">
                        <circle cx="12" cy="12" r="10"/>
                        <line x1="12" y1="8" x2="12" y2="12"/>
                        <line x1="12" y1="16" x2="12.01" y2="16"/>
                    </svg>
                    <div style="flex: 1;">
                        <div style="font-weight: 600; color: #c92a2a; margin-bottom: 0.5rem;">
                            Error
                        </div>
                        <div style="color: #862e2e; line-height: 1.5;">
                            ${message}
                        </div>
                    </div>
                </div>
                <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
                    <button onclick="retryHandler.executeRetry('${errorId}')" class="retry-button" style="
                        background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
                        color: white;
                        border: none;
                        padding: 0.6rem 1.5rem;
                        border-radius: 6px;
                        font-size: 0.9rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                        display: flex;
                        align-items: center;
                        gap: 0.5rem;
                    ">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        Retry
                    </button>
                    <button onclick="retryHandler.dismissError('${errorId}')" style="
                        background: transparent;
                        color: #862e2e;
                        border: 2px solid #ff6b6b;
                        padding: 0.6rem 1.5rem;
                        border-radius: 6px;
                        font-size: 0.9rem;
                        font-weight: 600;
                        cursor: pointer;
                        transition: all 0.2s;
                    ">
                        Dismiss
                    </button>
                </div>
            </div>
        `;

        // Add animation styles if not already present
        if (!document.querySelector('[data-retry-styles]')) {
            const style = document.createElement('style');
            style.setAttribute('data-retry-styles', 'true');
            style.textContent = `
                @keyframes slideIn {
                    from {
                        opacity: 0;
                        transform: translateY(-20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                .retry-button:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
                }
                .retry-button:active {
                    transform: translateY(0);
                }
                .error-message-container button:hover {
                    opacity: 0.9;
                }
            `;
            document.head.appendChild(style);
        }

        // Store retry function
        this.activeRetries.set(errorId, {
            retryFn,
            container
        });

        // Insert error at the top of container
        container.insertAdjacentHTML('afterbegin', errorHTML);
    }

    /**
     * Execute retry for a specific error
     * @param {string} errorId - Error element ID
     */
    async executeRetry(errorId) {
        const retryData = this.activeRetries.get(errorId);
        if (!retryData) return;

        const { retryFn, container } = retryData;
        const errorEl = document.getElementById(errorId);
        
        if (errorEl) {
            // Show loading state
            const button = errorEl.querySelector('.retry-button');
            if (button) {
                button.innerHTML = `
                    <div style="width: 16px; height: 16px; border: 2px solid white; border-top-color: transparent; border-radius: 50%; animation: spin 0.6s linear infinite;"></div>
                    Retrying...
                `;
                button.disabled = true;
            }
        }

        try {
            await retryFn();
            // Success - remove error message
            this.dismissError(errorId);
        } catch (error) {
            // Still failed - update message
            if (errorEl) {
                const button = errorEl.querySelector('.retry-button');
                if (button) {
                    button.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M21.5 2v6h-6M2.5 22v-6h6M2 11.5a10 10 0 0 1 18.8-4.3M22 12.5a10 10 0 0 1-18.8 4.2"/>
                        </svg>
                        Retry Again
                    `;
                    button.disabled = false;
                }
            }
            console.error('Retry failed:', error);
        }
    }

    /**
     * Dismiss error message
     * @param {string} errorId - Error element ID
     */
    dismissError(errorId) {
        const errorEl = document.getElementById(errorId);
        if (errorEl) {
            errorEl.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => {
                errorEl.remove();
                this.activeRetries.delete(errorId);
            }, 300);
        }
    }

    /**
     * Sleep utility
     * @param {number} ms - Milliseconds to sleep
     * @returns {Promise} Promise that resolves after delay
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check if error is a network error (retryable)
     * @param {Error} error - Error to check
     * @returns {boolean} True if network error
     */
    isNetworkError(error) {
        return error.message.includes('fetch') ||
               error.message.includes('network') ||
               error.message.includes('Failed to fetch') ||
               error.message.includes('NetworkError') ||
               error.message.includes('Server error');
    }

    /**
     * Clear all active retries
     */
    clearAll() {
        this.activeRetries.forEach((_, errorId) => {
            this.dismissError(errorId);
        });
    }
}

// Add slideOut animation
if (!document.querySelector('[data-retry-animation]')) {
    const style = document.createElement('style');
    style.setAttribute('data-retry-animation', 'true');
    style.textContent = `
        @keyframes slideOut {
            from {
                opacity: 1;
                transform: translateY(0);
            }
            to {
                opacity: 0;
                transform: translateY(-20px);
            }
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(style);
}

// Create global instance
window.retryHandler = new RetryHandler();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RetryHandler;
}
