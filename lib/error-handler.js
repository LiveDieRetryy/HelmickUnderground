/**
 * Standardized Error Handler for API Endpoints
 * Provides consistent error responses and logging across all API endpoints
 */

/**
 * Standard error response format
 * @typedef {Object} ErrorResponse
 * @property {boolean} success - Always false for errors
 * @property {string} error - Error type/category
 * @property {string} message - Human-readable error message
 * @property {number} statusCode - HTTP status code
 * @property {string} [details] - Additional error details (only in development)
 * @property {string} timestamp - ISO timestamp of error
 */

/**
 * Known error types with their HTTP status codes
 */
const ERROR_TYPES = {
    VALIDATION_ERROR: { code: 400, message: 'Validation failed' },
    AUTHENTICATION_ERROR: { code: 401, message: 'Authentication required' },
    AUTHORIZATION_ERROR: { code: 403, message: 'Insufficient permissions' },
    NOT_FOUND: { code: 404, message: 'Resource not found' },
    CONFLICT: { code: 409, message: 'Resource conflict' },
    RATE_LIMIT: { code: 429, message: 'Too many requests' },
    DATABASE_ERROR: { code: 500, message: 'Database operation failed' },
    INTERNAL_ERROR: { code: 500, message: 'Internal server error' },
    SERVICE_UNAVAILABLE: { code: 503, message: 'Service temporarily unavailable' }
};

/**
 * Create a standardized error response
 * @param {string} errorType - Type of error from ERROR_TYPES
 * @param {string} [customMessage] - Optional custom message to override default
 * @param {Error} [originalError] - Original error object for logging
 * @returns {ErrorResponse} Formatted error response
 */
function createErrorResponse(errorType, customMessage = null, originalError = null) {
    const errorConfig = ERROR_TYPES[errorType] || ERROR_TYPES.INTERNAL_ERROR;
    const isDevelopment = process.env.NODE_ENV !== 'production';
    
    const response = {
        success: false,
        error: errorType,
        message: customMessage || errorConfig.message,
        statusCode: errorConfig.code,
        timestamp: new Date().toISOString()
    };
    
    // Include details only in development mode
    if (isDevelopment && originalError) {
        response.details = originalError.message;
        response.stack = originalError.stack;
    }
    
    return response;
}

/**
 * Send error response to client
 * @param {import('http').ServerResponse} res - Response object
 * @param {string} errorType - Type of error from ERROR_TYPES
 * @param {string} [customMessage] - Optional custom message
 * @param {Error} [originalError] - Original error for logging
 * @returns {void}
 */
function sendErrorResponse(res, errorType, customMessage = null, originalError = null) {
    const errorResponse = createErrorResponse(errorType, customMessage, originalError);
    
    // Log error to console
    console.error('[API Error]', {
        type: errorType,
        message: errorResponse.message,
        statusCode: errorResponse.statusCode,
        timestamp: errorResponse.timestamp,
        error: originalError?.message,
        stack: originalError?.stack
    });
    
    // Send response
    res.status(errorResponse.statusCode).json(errorResponse);
}

/**
 * Wrap API handler with standardized error handling
 * Catches all unhandled errors and sends proper error response
 * @param {Function} handler - Async handler function
 * @returns {Function} Wrapped handler with error handling
 * 
 * @example
 * module.exports = withErrorHandling(async (req, res) => {
 *   // Your API logic here
 *   const data = await fetchData();
 *   return res.status(200).json({ success: true, data });
 * });
 */
function withErrorHandling(handler) {
    return async (req, res) => {
        try {
            await handler(req, res);
        } catch (error) {
            // Determine error type based on error properties
            let errorType = 'INTERNAL_ERROR';
            
            if (error.message?.includes('not found') || error.code === '404') {
                errorType = 'NOT_FOUND';
            } else if (error.message?.includes('validation') || error.code === 'VALIDATION_ERROR') {
                errorType = 'VALIDATION_ERROR';
            } else if (error.message?.includes('database') || error.code?.startsWith('23')) {
                // PostgreSQL error codes starting with 23 are constraint violations
                errorType = 'DATABASE_ERROR';
            } else if (error.message?.includes('duplicate') || error.code === '23505') {
                errorType = 'CONFLICT';
            } else if (error.message?.includes('unauthorized') || error.code === '401') {
                errorType = 'AUTHENTICATION_ERROR';
            } else if (error.message?.includes('forbidden') || error.code === '403') {
                errorType = 'AUTHORIZATION_ERROR';
            }
            
            sendErrorResponse(res, errorType, error.message, error);
        }
    };
}

/**
 * Validate required fields in request body
 * Throws validation error if any required field is missing
 * @param {Object} body - Request body
 * @param {string[]} requiredFields - Array of required field names
 * @throws {Error} Validation error if fields are missing
 * 
 * @example
 * validateRequiredFields(req.body, ['name', 'email', 'phone']);
 */
function validateRequiredFields(body, requiredFields) {
    const missingFields = requiredFields.filter(field => !body[field]);
    
    if (missingFields.length > 0) {
        const error = new Error(`Missing required fields: ${missingFields.join(', ')}`);
        error.code = 'VALIDATION_ERROR';
        throw error;
    }
}

/**
 * Validate email format
 * @param {string} email - Email to validate
 * @returns {boolean} True if valid email format
 */
function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate phone format (US format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if valid phone format
 */
function validatePhone(phone) {
    const phoneRegex = /^[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

module.exports = {
    ERROR_TYPES,
    createErrorResponse,
    sendErrorResponse,
    withErrorHandling,
    validateRequiredFields,
    validateEmail,
    validatePhone
};
