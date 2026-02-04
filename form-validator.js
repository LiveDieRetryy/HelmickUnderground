/**
 * Form Validation Utility
 * Provides real-time validation with field-level error messages
 */

class FormValidator {
    constructor() {
        this.validators = {
            required: this.validateRequired.bind(this),
            email: this.validateEmail.bind(this),
            phone: this.validatePhone.bind(this),
            url: this.validateUrl.bind(this),
            number: this.validateNumber.bind(this),
            minLength: this.validateMinLength.bind(this),
            maxLength: this.validateMaxLength.bind(this),
            min: this.validateMin.bind(this),
            max: this.validateMax.bind(this),
            pattern: this.validatePattern.bind(this)
        };
        
        this.errorMessages = {
            required: 'This field is required',
            email: 'Please enter a valid email address',
            phone: 'Please enter a valid phone number',
            url: 'Please enter a valid URL',
            number: 'Please enter a valid number',
            minLength: 'Must be at least {min} characters',
            maxLength: 'Must be no more than {max} characters',
            min: 'Must be at least {min}',
            max: 'Must be no more than {max}',
            pattern: 'Invalid format'
        };
    }

    /**
     * Validate a single field
     */
    validateField(field, rules = {}) {
        const value = field.value.trim();
        const errors = [];

        // Check each rule
        for (const [rule, ruleValue] of Object.entries(rules)) {
            const validator = this.validators[rule];
            if (!validator) continue;

            const isValid = validator(value, ruleValue, field);
            if (!isValid) {
                const message = this.getErrorMessage(rule, ruleValue);
                errors.push(message);
            }
        }

        return {
            isValid: errors.length === 0,
            errors
        };
    }

    /**
     * Get error message for a rule
     */
    getErrorMessage(rule, ruleValue) {
        let message = this.errorMessages[rule] || 'Invalid input';
        
        if (typeof ruleValue === 'object' && ruleValue.message) {
            return ruleValue.message;
        }
        
        // Replace placeholders
        if (typeof ruleValue === 'number') {
            message = message.replace('{min}', ruleValue).replace('{max}', ruleValue);
        } else if (typeof ruleValue === 'object') {
            Object.keys(ruleValue).forEach(key => {
                message = message.replace(`{${key}}`, ruleValue[key]);
            });
        }
        
        return message;
    }

    /**
     * Validation methods
     */
    validateRequired(value) {
        return value.length > 0;
    }

    validateEmail(value) {
        if (!value) return true; // Empty is valid unless required
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
    }

    validatePhone(value) {
        if (!value) return true;
        // Accepts: 319-555-1234, (319) 555-1234, 3195551234, etc.
        const phoneRegex = /^[\d\s\-\(\)\.]+$/;
        const digitsOnly = value.replace(/\D/g, '');
        return phoneRegex.test(value) && digitsOnly.length >= 10;
    }

    validateUrl(value) {
        if (!value) return true;
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    validateNumber(value) {
        if (!value) return true;
        return !isNaN(value) && !isNaN(parseFloat(value));
    }

    validateMinLength(value, min) {
        return value.length >= min;
    }

    validateMaxLength(value, max) {
        return value.length <= max;
    }

    validateMin(value, min) {
        return parseFloat(value) >= min;
    }

    validateMax(value, max) {
        return parseFloat(value) <= max;
    }

    validatePattern(value, pattern) {
        if (!value) return true;
        const regex = new RegExp(pattern);
        return regex.test(value);
    }

    /**
     * Show error message for a field
     */
    showError(field, message) {
        this.clearError(field);

        // Add error class
        field.classList.add('input-error');

        // Create error message element
        const errorEl = document.createElement('div');
        errorEl.className = 'field-error-message';
        errorEl.textContent = message;
        errorEl.setAttribute('role', 'alert');

        // Insert after field
        field.parentNode.insertBefore(errorEl, field.nextSibling);

        // Add ARIA attributes
        const errorId = `error-${Date.now()}`;
        errorEl.id = errorId;
        field.setAttribute('aria-invalid', 'true');
        field.setAttribute('aria-describedby', errorId);
    }

    /**
     * Clear error message for a field
     */
    clearError(field) {
        field.classList.remove('input-error');
        field.removeAttribute('aria-invalid');
        field.removeAttribute('aria-describedby');

        const existingError = field.parentNode.querySelector('.field-error-message');
        if (existingError) {
            existingError.remove();
        }
    }

    /**
     * Show success indicator for a field
     */
    showSuccess(field) {
        field.classList.remove('input-error');
        field.classList.add('input-success');
    }

    /**
     * Attach validation to a form
     */
    attachToForm(form, validationRules) {
        if (!form) return;

        // Inject validation styles
        this.injectStyles();

        // Validate on blur
        Object.keys(validationRules).forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!field) return;

            field.addEventListener('blur', () => {
                this.validateAndShowErrors(field, validationRules[fieldName]);
            });

            field.addEventListener('input', () => {
                // Clear error on input
                if (field.classList.contains('input-error')) {
                    this.clearError(field);
                }
            });
        });

        // Validate on submit
        form.addEventListener('submit', (e) => {
            if (!this.validateForm(form, validationRules)) {
                e.preventDefault();
                
                // Focus first error
                const firstError = form.querySelector('.input-error');
                if (firstError) {
                    firstError.focus();
                    firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    }

    /**
     * Validate and show errors for a field
     */
    validateAndShowErrors(field, rules) {
        const result = this.validateField(field, rules);
        
        if (!result.isValid) {
            this.showError(field, result.errors[0]);
            return false;
        } else {
            this.clearError(field);
            if (field.value.trim()) {
                this.showSuccess(field);
            }
            return true;
        }
    }

    /**
     * Validate entire form
     */
    validateForm(form, validationRules) {
        let isValid = true;

        Object.keys(validationRules).forEach(fieldName => {
            const field = form.querySelector(`[name="${fieldName}"]`);
            if (!field) return;

            const fieldValid = this.validateAndShowErrors(field, validationRules[fieldName]);
            if (!fieldValid) {
                isValid = false;
            }
        });

        return isValid;
    }

    /**
     * Inject validation styles
     */
    injectStyles() {
        if (document.querySelector('[data-form-validation-styles]')) return;

        const style = document.createElement('style');
        style.setAttribute('data-form-validation-styles', 'true');
        style.textContent = `
            .input-error {
                border-color: #ff6b6b !important;
                background-color: rgba(255, 107, 107, 0.05) !important;
            }
            
            .input-success {
                border-color: #51cf66 !important;
            }
            
            .field-error-message {
                color: #ff6b6b;
                font-size: 0.85rem;
                margin-top: 0.25rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
                animation: slideDown 0.2s ease-out;
            }
            
            .field-error-message::before {
                content: "⚠";
                font-size: 1rem;
            }
            
            @keyframes slideDown {
                from {
                    opacity: 0;
                    transform: translateY(-10px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
            
            /* Focus styles for accessibility */
            .input-error:focus {
                outline: 2px solid #ff6b6b;
                outline-offset: 2px;
            }
            
            .input-success:focus {
                outline: 2px solid #51cf66;
                outline-offset: 2px;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Create validation rules from HTML5 attributes
     */
    getRulesFromElement(field) {
        const rules = {};

        if (field.required) {
            rules.required = true;
        }

        if (field.type === 'email') {
            rules.email = true;
        }

        if (field.type === 'tel') {
            rules.phone = true;
        }

        if (field.type === 'url') {
            rules.url = true;
        }

        if (field.type === 'number') {
            rules.number = true;
            if (field.min) rules.min = parseFloat(field.min);
            if (field.max) rules.max = parseFloat(field.max);
        }

        if (field.minLength > 0) {
            rules.minLength = field.minLength;
        }

        if (field.maxLength > 0 && field.maxLength < 524288) { // Ignore default maxLength
            rules.maxLength = field.maxLength;
        }

        if (field.pattern) {
            rules.pattern = field.pattern;
        }

        return rules;
    }

    /**
     * Auto-attach validation to all forms with data-validate attribute
     */
    autoAttach() {
        const forms = document.querySelectorAll('form[data-validate]');
        
        forms.forEach(form => {
            const validationRules = {};
            
            // Get all fields with validation attributes
            const fields = form.querySelectorAll('input, textarea, select');
            fields.forEach(field => {
                if (!field.name) return;
                
                const rules = this.getRulesFromElement(field);
                if (Object.keys(rules).length > 0) {
                    validationRules[field.name] = rules;
                }
            });

            if (Object.keys(validationRules).length > 0) {
                this.attachToForm(form, validationRules);
            }
        });
    }
}

// Create global instance
window.formValidator = new FormValidator();

// Auto-attach on DOM ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        window.formValidator.autoAttach();
    });
} else {
    window.formValidator.autoAttach();
}

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = FormValidator;
}
