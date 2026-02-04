const crypto = require('crypto');

/**
 * CSRF (Cross-Site Request Forgery) Protection Middleware
 * 
 * Generates and validates CSRF tokens to prevent cross-site request forgery attacks.
 * Tokens are stored in HttpOnly cookies and must be included in request headers.
 * 
 * @module csrf-middleware
 */

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32; // bytes
const CSRF_COOKIE_NAME = 'csrf_token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_MAX_AGE = 86400; // 24 hours in seconds

/**
 * Generate a cryptographically secure random CSRF token
 * @returns {string} Hexadecimal CSRF token
 * 
 * @example
 * const token = generateCsrfToken();
 * // Returns: "a1b2c3d4e5f6..."
 */
function generateCsrfToken() {
    return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token as HttpOnly cookie
 * @param {object} res - Response object
 * @param {string} token - CSRF token to set
 * 
 * @example
 * setCsrfCookie(res, generateCsrfToken());
 */
function setCsrfCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.setHeader('Set-Cookie', [
        `${CSRF_COOKIE_NAME}=${token}`,
        `Path=/`,
        `Max-Age=${CSRF_COOKIE_MAX_AGE}`,
        `SameSite=Lax`,
        `HttpOnly`,
        ...(isProduction ? ['Secure'] : [])
    ].join('; '));
}

/**
 * Get CSRF token from cookies
 * @param {object} req - Request object
 * @returns {string|null} CSRF token or null if not found
 * 
 * @example
 * const token = getCsrfToken(req);
 */
function getCsrfToken(req) {
    const cookies = parseCookies(req);
    return cookies[CSRF_COOKIE_NAME] || null;
}

/**
 * Get CSRF token from request header
 * @param {object} req - Request object
 * @returns {string|null} CSRF token from header or null
 * 
 * @example
 * const headerToken = getCsrfTokenFromHeader(req);
 */
function getCsrfTokenFromHeader(req) {
    return req.headers[CSRF_HEADER_NAME] || 
           req.headers[CSRF_HEADER_NAME.toUpperCase()] || 
           null;
}

/**
 * Parse cookies from request header
 * @param {object} req - Request object
 * @returns {object} Parsed cookies as key-value pairs
 * 
 * @example
 * const cookies = parseCookies(req);
 * // Returns: { csrf_token: "abc123", auth_token: "xyz789" }
 */
function parseCookies(req) {
    const cookieHeader = req.headers.cookie || '';
    const cookies = {};
    
    cookieHeader.split(';').forEach(cookie => {
        const [name, ...rest] = cookie.trim().split('=');
        if (name) {
            cookies[name] = rest.join('=');
        }
    });
    
    return cookies;
}

/**
 * Validate CSRF token from request
 * Compares token in cookie with token in header using constant-time comparison
 * 
 * @param {object} req - Request object
 * @returns {boolean} True if token is valid, false otherwise
 * 
 * @example
 * if (!validateCsrfToken(req)) {
 *   return res.status(403).json({ error: 'Invalid CSRF token' });
 * }
 */
function validateCsrfToken(req) {
    const cookieToken = getCsrfToken(req);
    const headerToken = getCsrfTokenFromHeader(req);
    
    // Both tokens must be present
    if (!cookieToken || !headerToken) {
        return false;
    }
    
    // Use constant-time comparison to prevent timing attacks
    try {
        return crypto.timingSafeEqual(
            Buffer.from(cookieToken),
            Buffer.from(headerToken)
        );
    } catch (error) {
        // Tokens are different lengths, not equal
        return false;
    }
}

/**
 * Middleware to require CSRF token validation
 * Call this at the start of any API handler that modifies data (POST, PUT, DELETE)
 * 
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @returns {boolean} True if validation passed, false if failed (response already sent)
 * 
 * @example
 * // In API handler
 * if (req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') {
 *   if (!requireCsrfToken(req, res)) {
 *     return; // CSRF validation failed, error response already sent
 *   }
 * }
 */
function requireCsrfToken(req, res) {
    if (!validateCsrfToken(req)) {
        res.status(403).json({
            success: false,
            error: 'CSRF_TOKEN_INVALID',
            message: 'CSRF token validation failed. Please refresh the page and try again.',
            statusCode: 403,
            timestamp: new Date().toISOString()
        });
        return false;
    }
    return true;
}

/**
 * Generate and set a new CSRF token
 * Call this when user logs in or when token needs to be refreshed
 * 
 * @param {object} res - Response object
 * @returns {string} The generated token
 * 
 * @example
 * const token = generateAndSetCsrfToken(res);
 * return res.json({ success: true, csrfToken: token });
 */
function generateAndSetCsrfToken(res) {
    const token = generateCsrfToken();
    setCsrfCookie(res, token);
    return token;
}

/**
 * Clear CSRF token cookie
 * Call this when user logs out
 * 
 * @param {object} res - Response object
 * 
 * @example
 * clearCsrfCookie(res);
 */
function clearCsrfCookie(res) {
    res.setHeader('Set-Cookie', [
        `${CSRF_COOKIE_NAME}=`,
        `Path=/`,
        `Max-Age=0`,
        `SameSite=Strict`,
        `HttpOnly`
    ].join('; '));
}

module.exports = {
    generateCsrfToken,
    setCsrfCookie,
    getCsrfToken,
    getCsrfTokenFromHeader,
    validateCsrfToken,
    requireCsrfToken,
    generateAndSetCsrfToken,
    clearCsrfCookie,
    CSRF_HEADER_NAME,
    CSRF_COOKIE_NAME
};
