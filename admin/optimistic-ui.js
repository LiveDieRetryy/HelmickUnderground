/**
 * Optimistic UI Update Handler
 * Provides instant UI feedback before server confirmation
 */

class OptimisticUI {
    constructor() {
        this.pendingOperations = new Map();
        this.rollbackStates = new Map();
    }

    /**
     * Execute operation with optimistic UI update
     * @param {Object} options - Operation configuration
     * @returns {Promise} Result of the operation
     */
    async execute(options) {
        const {
            id,
            optimisticUpdate,
            operation,
            rollback,
            successMessage,
            errorMessage
        } = options;

        // Generate unique operation ID if not provided
        const operationId = id || `op-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        try {
            // Store current state for potential rollback
            if (rollback) {
                this.rollbackStates.set(operationId, rollback.getState());
            }

            // Apply optimistic update immediately
            if (optimisticUpdate) {
                optimisticUpdate();
            }

            // Mark as pending
            this.pendingOperations.set(operationId, {
                startTime: Date.now(),
                operation: options
            });

            // Execute actual operation
            const result = await operation();

            // Operation succeeded
            this.pendingOperations.delete(operationId);
            this.rollbackStates.delete(operationId);

            // Show success notification if provided
            if (successMessage && window.showNotification) {
                showNotification(successMessage, 'success');
            }

            // Log success
            if (window.logger) {
                window.logger.info('Optimistic Update Success', {
                    operationId,
                    duration: Date.now() - this.pendingOperations.get(operationId)?.startTime
                });
            }

            return result;

        } catch (error) {
            // Operation failed - rollback
            console.error('Optimistic update failed:', error);

            if (window.logger) {
                window.logger.error('Optimistic Update Failed', {
                    operationId,
                    error: error.message
                });
            }

            // Perform rollback
            if (rollback) {
                const savedState = this.rollbackStates.get(operationId);
                if (savedState) {
                    rollback.restore(savedState);
                }
            }

            // Clean up
            this.pendingOperations.delete(operationId);
            this.rollbackStates.delete(operationId);

            // Show error notification
            const message = errorMessage || error.message || 'Operation failed';
            if (window.showNotification) {
                showNotification(message, 'error');
            }

            throw error;
        }
    }

    /**
     * Add item to list optimistically
     */
    async addItem(options) {
        const {
            container,
            item,
            createItemElement,
            apiCall,
            position = 'prepend'
        } = options;

        return this.execute({
            optimisticUpdate: () => {
                const element = createItemElement(item);
                element.classList.add('optimistic-item');
                
                if (position === 'prepend') {
                    container.insertAdjacentElement('afterbegin', element);
                } else {
                    container.appendChild(element);
                }
            },
            operation: apiCall,
            rollback: {
                getState: () => ({
                    html: container.innerHTML
                }),
                restore: (state) => {
                    container.innerHTML = state.html;
                }
            }
        });
    }

    /**
     * Update item optimistically
     */
    async updateItem(options) {
        const {
            element,
            updates,
            apiCall
        } = options;

        return this.execute({
            optimisticUpdate: () => {
                element.classList.add('optimistic-updating');
                
                // Apply updates to element
                Object.keys(updates).forEach(key => {
                    const target = element.querySelector(`[data-field="${key}"]`);
                    if (target) {
                        target.textContent = updates[key];
                    }
                });
            },
            operation: async () => {
                const result = await apiCall();
                element.classList.remove('optimistic-updating');
                element.classList.add('optimistic-success');
                setTimeout(() => {
                    element.classList.remove('optimistic-success');
                }, 1000);
                return result;
            },
            rollback: {
                getState: () => ({
                    html: element.innerHTML,
                    classes: element.className
                }),
                restore: (state) => {
                    element.innerHTML = state.html;
                    element.className = state.classes;
                }
            }
        });
    }

    /**
     * Delete item optimistically
     */
    async deleteItem(options) {
        const {
            element,
            apiCall,
            animation = 'fade'
        } = options;

        return this.execute({
            optimisticUpdate: () => {
                element.classList.add('optimistic-deleting');
                
                if (animation === 'fade') {
                    element.style.opacity = '0.5';
                    element.style.pointerEvents = 'none';
                } else if (animation === 'slide') {
                    element.style.transform = 'translateX(-100%)';
                    element.style.opacity = '0';
                }
            },
            operation: async () => {
                const result = await apiCall();
                
                // Animate out and remove
                element.style.transition = 'all 0.3s ease-out';
                element.style.height = element.offsetHeight + 'px';
                
                requestAnimationFrame(() => {
                    element.style.height = '0';
                    element.style.margin = '0';
                    element.style.padding = '0';
                    element.style.opacity = '0';
                    
                    setTimeout(() => {
                        element.remove();
                    }, 300);
                });
                
                return result;
            },
            rollback: {
                getState: () => ({
                    element: element.cloneNode(true),
                    parent: element.parentNode,
                    nextSibling: element.nextSibling
                }),
                restore: (state) => {
                    // Restore element to original position
                    element.style.opacity = '';
                    element.style.transform = '';
                    element.style.height = '';
                    element.style.margin = '';
                    element.style.padding = '';
                    element.style.pointerEvents = '';
                    element.classList.remove('optimistic-deleting');
                }
            }
        });
    }

    /**
     * Batch operations
     */
    async batchExecute(operations) {
        const results = [];
        const errors = [];

        for (const operation of operations) {
            try {
                const result = await this.execute(operation);
                results.push({ success: true, result });
            } catch (error) {
                errors.push({ success: false, error });
            }
        }

        return {
            results,
            errors,
            allSucceeded: errors.length === 0
        };
    }

    /**
     * Check if there are pending operations
     */
    hasPendingOperations() {
        return this.pendingOperations.size > 0;
    }

    /**
     * Get pending operations count
     */
    getPendingCount() {
        return this.pendingOperations.size;
    }

    /**
     * Clear all pending operations
     */
    clearPending() {
        this.pendingOperations.clear();
        this.rollbackStates.clear();
    }

    /**
     * Inject optimistic UI styles
     */
    injectStyles() {
        if (document.querySelector('[data-optimistic-styles]')) return;

        const style = document.createElement('style');
        style.setAttribute('data-optimistic-styles', 'true');
        style.textContent = `
            @keyframes optimisticPulse {
                0%, 100% { opacity: 1; }
                50% { opacity: 0.7; }
            }
            
            @keyframes optimisticSuccess {
                0% { background-color: transparent; }
                50% { background-color: rgba(81, 207, 102, 0.2); }
                100% { background-color: transparent; }
            }
            
            .optimistic-item {
                animation: optimisticPulse 1s ease-in-out;
            }
            
            .optimistic-updating {
                opacity: 0.8;
                pointer-events: none;
                position: relative;
            }
            
            .optimistic-updating::after {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: linear-gradient(90deg, 
                    transparent 0%, 
                    rgba(255, 107, 26, 0.1) 50%, 
                    transparent 100%);
                animation: shimmer 1.5s infinite;
            }
            
            @keyframes shimmer {
                0% { transform: translateX(-100%); }
                100% { transform: translateX(100%); }
            }
            
            .optimistic-success {
                animation: optimisticSuccess 1s ease-out;
            }
            
            .optimistic-deleting {
                transition: all 0.3s ease-out;
            }
        `;
        document.head.appendChild(style);
    }
}

// Create global instance
window.optimisticUI = new OptimisticUI();

// Inject styles on load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.optimisticUI.injectStyles();
    });
} else {
    window.optimisticUI.injectStyles();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OptimisticUI;
}
