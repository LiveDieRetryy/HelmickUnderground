/**
 * Shared Utility Functions for Admin Pages
 * Helmick Underground LLC Admin Dashboard
 * 
 * This file contains common functions used across all admin pages to reduce
 * code duplication and ensure consistency.
 */

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Check if user is authenticated
 * Redirects to login page if not authenticated
 * @returns {boolean} True if authenticated, false otherwise
 */
function checkAuth() {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true';
    if (!isLoggedIn) {
        window.location.href = '/admin/login.html';
        return false;
    }
    return true;
}

/**
 * Logout user and redirect to login page
 */
function logout() {
    sessionStorage.removeItem('adminLoggedIn');
    window.location.href = '/admin/login.html';
}

/**
 * Setup logout button event listener
 * Call this in your page initialization
 */
function setupLogoutButton() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

// Track if notification styles have been injected
let notificationStylesInjected = false;

/**
 * Inject notification styles into document head (only once)
 */
function injectNotificationStyles() {
    // Check both flag and DOM to prevent duplicates
    if (notificationStylesInjected || document.querySelector('[data-notification-styles]')) return;
    
    const style = document.createElement('style');
    style.setAttribute('data-notification-styles', 'true');
    style.textContent = `
        @keyframes slideIn {
            from {
                transform: translateX(100%);
                opacity: 0;
            }
            to {
                transform: translateX(0);
                opacity: 1;
            }
        }
        @keyframes slideOut {
            from {
                transform: translateX(0);
                opacity: 1;
            }
            to {
                transform: translateX(100%);
                opacity: 0;
            }
        }
        .notification-container {
            position: fixed;
            top: 2rem;
            right: 2rem;
            z-index: 100000;
            display: flex;
            flex-direction: column;
            gap: 1rem;
            pointer-events: none;
        }
        .notification {
            pointer-events: auto;
            padding: 1rem 1.5rem;
            border-radius: 12px;
            font-weight: 600;
            box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.3s ease-out;
            color: white;
            min-width: 250px;
        }
        .notification.success {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        }
        .notification.error {
            background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
        }
        .notification.info {
            background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        }
        .notification.warning {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        }
    `;
    document.head.appendChild(style);
    notificationStylesInjected = true;
}

/**
 * Get or create notification container
 * @returns {HTMLElement} The notification container
 */
function getNotificationContainer() {
    let container = document.querySelector('.notification-container');
    if (!container) {
        container = document.createElement('div');
        container.className = 'notification-container';
        document.body.appendChild(container);
    }
    return container;
}

/**
 * Show a notification message
 * @param {string} message - The message to display
 * @param {string} type - Type of notification: 'success', 'error', 'info', 'warning'
 * @param {number} duration - How long to show the notification in milliseconds (default: 4000)
 */
function showNotification(message, type = 'success', duration = 4000) {
    // Inject styles if not already done
    injectNotificationStyles();
    
    // Get or create container
    const container = getNotificationContainer();
    
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // Add to container
    container.appendChild(notification);
    
    // Auto remove after duration
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => {
            notification.remove();
            // Remove container if empty
            if (container.children.length === 0) {
                container.remove();
            }
        }, 300);
    }, duration);
}

// ============================================================================
// API HELPERS
// ============================================================================

/**
 * Wrapper for fetch with error handling, loading states, and caching
 * @param {string} url - The URL to fetch
 * @param {object} options - Fetch options
 * @param {number} cacheTTL - Cache time-to-live in milliseconds (0 = no cache)
 * @returns {Promise<any>} The response data
 */
async function apiFetch(url, options = {}, cacheTTL = 0) {
    const startTime = performance.now();
    const method = options.method || 'GET';
    const cacheKey = `api:${method}:${url}`;
    
    try {
        // Check cache for GET requests if cache manager is available
        if (method === 'GET' && cacheTTL > 0 && window.cacheManager) {
            const cached = window.cacheManager.get(cacheKey);
            if (cached !== null) {
                const duration = performance.now() - startTime;
                console.log(`[Cache HIT] ${url} (${duration.toFixed(2)}ms)`);
                
                if (window.logger) {
                    window.logger.info('API Call (Cached)', {
                        url,
                        method,
                        duration,
                        cached: true
                    });
                }
                
                return cached;
            }
        }
        
        // Get auth token if available
        const token = window.adminAuth?.getAuthToken();
        const csrfToken = window.adminAuth?.getCsrfToken();
        
        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...(token && { 'Authorization': `Bearer ${token}` }), // Add auth token if available
                ...(csrfToken && (method === 'POST' || method === 'PUT' || method === 'DELETE') && { 'x-csrf-token': csrfToken }), // Add CSRF token for state-changing operations
                ...options.headers
            },
            credentials: 'include' // Include cookies for HttpOnly token
        });
        
        const duration = performance.now() - startTime;
        
        // Log API call if logger is available
        if (window.logger) {
            window.logger.logApiCall(
                options.method || 'GET',
                url,
                response.status,
                duration.toFixed(2),
                { ok: response.ok }
            );
        }
        
        // Handle 401 Unauthorized - redirect to login
        if (response.status === 401) {
            if (window.adminAuth) {
                window.adminAuth.redirectToLogin();
            } else {
                window.location.href = '/admin/login.html';
            }
            throw new Error('Unauthorized - please login again');
        }

        // Handle 403 CSRF token error - refresh token and retry once
        if (response.status === 403) {
            const errorData = await response.json().catch(() => ({}));
            
            if (errorData.error === 'CSRF_TOKEN_INVALID' && window.adminAuth) {
                // Try to refresh CSRF token
                const newCsrfToken = await window.adminAuth.refreshCsrfToken();
                
                if (newCsrfToken) {
                    // Retry the request once with new token
                    console.log('[CSRF] Token refreshed, retrying request...');
                    return apiFetch(url, options, cacheTTL);
                }
            }
            
            // Log CSRF error
            if (window.logger) {
                window.logger.error('CSRF Token Validation Failed', {
                    url,
                    status: 403,
                    method: options.method || 'GET',
                    error: errorData.message || 'CSRF token invalid'
                });
            }
            
            throw new Error(errorData.message || 'CSRF token validation failed. Please refresh the page.');
        }
        
        if (!response.ok) {
            const errorText = await response.text();
            const error = new Error(`API Error: ${response.status} - ${errorText}`);
            
            // Log error
            if (window.logger) {
                window.logger.error('API Request Failed', {
                    url,
                    status: response.status,
                    method: options.method || 'GET',
                    error: errorText
                });
            }
            
            throw error;
        }
        
        const data = await response.json();
        
        // Cache successful GET responses if TTL > 0
        if (method === 'GET' && cacheTTL > 0 && window.cacheManager) {
            window.cacheManager.set(cacheKey, data, cacheTTL);
            console.log(`[Cache SET] ${url} (TTL: ${cacheTTL}ms)`);
        }
        
        return data;
        
    } catch (error) {
        console.error('API Fetch Error:', error);
        
        // Log error if logger available
        if (window.logger) {
            window.logger.error('API Fetch Error', {
                url,
                error: error.message,
                stack: error.stack
            });
        }
        
        throw error;
    }
}

/**
 * Retry a function multiple times with exponential backoff
 * @param {Function} fn - The async function to retry
 * @param {number} maxRetries - Maximum number of retries (default: 3)
 * @param {number} delay - Initial delay in ms (default: 1000)
 * @returns {Promise<any>} The result of the function
 */
async function retryWithBackoff(fn, maxRetries = 3, delay = 1000) {
    let lastError;
    
    for (let i = 0; i < maxRetries; i++) {
        try {
            return await fn();
        } catch (error) {
            lastError = error;
            if (i < maxRetries - 1) {
                await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
            }
        }
    }
    
    throw lastError;
}

// ============================================================================
// FORMATTERS
// ============================================================================

/**
 * Format a number as USD currency
 * @param {number} amount - The amount to format
 * @returns {string} Formatted currency string
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

/**
 * Format a date string to readable format
 * @param {string|Date} date - The date to format
 * @param {string} format - Format type: 'short', 'long', 'time' (default: 'short')
 * @returns {string} Formatted date string
 */
function formatDate(date, format = 'short') {
    const d = new Date(date);
    
    if (format === 'long') {
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    } else if (format === 'time') {
        return d.toLocaleString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } else {
        // short format
        return d.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    }
}

/**
 * Format a phone number
 * @param {string} phone - The phone number to format
 * @returns {string} Formatted phone number
 */
function formatPhone(phone) {
    if (!phone) return '';
    
    // Remove all non-digit characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Format as (XXX) XXX-XXXX
    if (cleaned.length === 10) {
        return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6)}`;
    }
    
    return phone;
}

/**
 * Truncate text to specified length
 * @param {string} text - The text to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} Truncated text with ellipsis if needed
 */
function truncateText(text, maxLength = 50) {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate email address
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Validate phone number
 * @param {string} phone - Phone to validate
 * @returns {boolean} True if valid
 */
function isValidPhone(phone) {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 10 || cleaned.length === 11;
}

/**
 * Validate required field
 * @param {any} value - Value to check
 * @returns {boolean} True if not empty
 */
function isRequired(value) {
    if (typeof value === 'string') {
        return value.trim().length > 0;
    }
    return value !== null && value !== undefined;
}

// ============================================================================
// DEBOUNCING
// ============================================================================

/**
 * Debounce a function call
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in milliseconds
 * @returns {Function} Debounced function
 */
function debounce(func, wait = 300) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ============================================================================
// DOM HELPERS
// ============================================================================

/**
 * Inject loading styles into the page
 * Only injects once per page load
 */
function injectLoadingStyles() {
    if (loadingStylesInjected || document.getElementById('loading-styles')) return;
    
    const style = document.createElement('style');
    style.id = 'loading-styles';
    style.textContent = `
        .loading-spinner {
            display: inline-block;
            width: 20px;
            height: 20px;
            border: 3px solid rgba(255, 107, 26, 0.3);
            border-radius: 50%;
            border-top-color: var(--primary-color, #ff6b1a);
            animation: spin 1s ease-in-out infinite;
        }
        @keyframes spin {
            to { transform: rotate(360deg); }
        }
        .loading-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.7);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        }
        .loading-content {
            background: #1a1a1a;
            padding: 2rem;
            border-radius: 12px;
            border: 2px solid var(--primary-color, #ff6b1a);
            text-align: center;
        }
    `;
    document.head.appendChild(style);
    loadingStylesInjected = true;
}

/**
 * Show loading state on an element
 * @param {HTMLElement} element - Element to show loading on
 * @param {string} loadingText - Text to display while loading
 */
function showLoading(element, loadingText = 'Loading...') {
    injectLoadingStyles();
    if (element) {
        element.dataset.originalContent = element.innerHTML;
        element.innerHTML = `<div style="text-align: center; padding: 2rem; color: var(--gray);">${loadingText}</div>`;
    }
}

/**
 * Hide loading state and restore original content
 * @param {HTMLElement} element - Element to hide loading on
 */
function hideLoading(element) {
    if (element && element.dataset.originalContent) {
        element.innerHTML = element.dataset.originalContent;
        delete element.dataset.originalContent;
    }
}

/**
 * Create a confirmation modal
 * @param {string} title - Modal title
 * @param {string} message - Modal message
 * @param {Function} onConfirm - Callback when confirmed
 * @param {Function} onCancel - Callback when cancelled
 */
function confirmDialog(title, message, onConfirm, onCancel = null) {
    const confirmed = window.confirm(`${title}\n\n${message}`);
    if (confirmed && onConfirm) {
        onConfirm();
    } else if (!confirmed && onCancel) {
        onCancel();
    }
}

// ============================================================================
// LOCAL STORAGE HELPERS
// ============================================================================

/**
 * Save data to localStorage with JSON serialization
 * @param {string} key - Storage key
 * @param {any} value - Value to store
 */
function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
        console.error('Error saving to localStorage:', error);
    }
}

/**
 * Load data from localStorage with JSON parsing
 * @param {string} key - Storage key
 * @param {any} defaultValue - Default value if key doesn't exist
 * @returns {any} Stored value or default
 */
function loadFromStorage(key, defaultValue = null) {
    try {
        const item = localStorage.getItem(key);
        return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
        console.error('Error loading from localStorage:', error);
        return defaultValue;
    }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

// ============================================================================
// OFFLINE HANDLING
// ============================================================================

/**
 * Execute an API call with offline detection and retry logic
 * Will queue the action if offline and retry when connection returns
 * @param {Function} apiCall - The API function to execute
 * @param {string} description - Description of the action (for queue display)
 * @param {Object} retryOptions - Options for retry behavior
 * @returns {Promise} Promise that resolves with the API response
 */
async function executeWithOfflineHandling(apiCall, description = 'API call', retryOptions = {}) {
    // Check if offline handler is available
    if (!window.offlineHandler) {
        // Fallback to retry handler if available
        if (window.retryHandler) {
            return window.retryHandler.retry(apiCall, retryOptions);
        }
        // Last resort - direct execution
        return apiCall();
    }
    
    // Check if online
    if (window.offlineHandler.checkStatus()) {
        try {
            // Use retry handler if available for automatic retries
            if (window.retryHandler) {
                return await window.retryHandler.retry(apiCall, {
                    maxRetries: retryOptions.maxRetries || 2,
                    onRetry: (attempt, maxRetries, delay, error) => {
                        console.log(`Retrying ${description}: attempt ${attempt}/${maxRetries}`, error);
                    },
                    ...retryOptions
                });
            }
            return await apiCall();
        } catch (error) {
            // Check if it's a network error
            if (window.retryHandler && window.retryHandler.isNetworkError(error)) {
                console.error('Network error detected, queueing action');
                return window.offlineHandler.queueAction(apiCall, description);
            }
            throw error;
        }
    } else {
        // Offline - queue the action
        return window.offlineHandler.queueAction(apiCall, description);
    }
}

/**
 * Register a callback for online/offline status changes
 * @param {Function} callback - Function to call with 'online' or 'offline'
 * @returns {Function} Unsubscribe function
 */
function onNetworkStatusChange(callback) {
    if (!window.offlineHandler) {
        console.warn('Offline handler not available');
        return () => {};
    }
    return window.offlineHandler.onStatusChange(callback);
}

/**
 * Check if currently online
 * @returns {boolean} True if online, false if offline
 */
function isOnline() {
    if (!window.offlineHandler) {
        return navigator.onLine;
    }
    return window.offlineHandler.checkStatus();
}

/**
 * Initialize common admin page functionality
 * Call this at the start of your admin pages
 */
function initAdminPage() {
    // Check authentication
    if (!checkAuth()) return;
    
    // Setup logout button
    setupLogoutButton();
    
    // Inject notification styles
    injectNotificationStyles();
}

// Auto-initialize if DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAdminPage);
} else {
    // DOM already loaded
    initAdminPage();
}
