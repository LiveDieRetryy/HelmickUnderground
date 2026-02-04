/**
 * Authentication Middleware for API Endpoints
 * Provides JWT-based authentication and authorization
 */

const jwt = require('jsonwebtoken');

// Use environment variable or fallback (CHANGE THIS IN PRODUCTION!)
const JWT_SECRET = process.env.JWT_SECRET || 'helmick-underground-secret-key-change-in-production';
const JWT_EXPIRES_IN = '8h'; // Token expires after 8 hours

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User object
 * @param {string} user.username - Username
 * @param {string} user.email - User email
 * @returns {string} JWT token
 */
function generateToken(user) {
    return jwt.sign(
        {
            username: user.username,
            email: user.email,
            iat: Math.floor(Date.now() / 1000)
        },
        JWT_SECRET,
        { expiresIn: JWT_EXPIRES_IN }
    );
}

/**
 * Verify JWT token
 * @param {string} token - JWT token to verify
 * @returns {Object|null} Decoded token payload or null if invalid
 */
function verifyToken(token) {
    try {
        return jwt.verify(token, JWT_SECRET);
    } catch (error) {
        console.error('Token verification failed:', error.message);
        return null;
    }
}

/**
 * Extract token from request
 * Checks Authorization header and cookies
 * @param {Object} req - Request object
 * @returns {string|null} Token or null if not found
 */
function extractToken(req) {
    // Check Authorization header (Bearer token)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }
    
    // Check cookies
    const cookies = req.headers.cookie;
    if (cookies) {
        const tokenCookie = cookies.split(';').find(c => c.trim().startsWith('auth_token='));
        if (tokenCookie) {
            return tokenCookie.split('=')[1];
        }
    }
    
    return null;
}

/**
 * Middleware to require authentication
 * Returns 401 if not authenticated
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Function} next - Next middleware function
 * @returns {boolean} True if authenticated, false otherwise
 */
function requireAuth(req, res) {
    const token = extractToken(req);
    
    if (!token) {
        res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_ERROR',
            message: 'Authentication required. Please log in.',
            statusCode: 401
        });
        return false;
    }
    
    const decoded = verifyToken(token);
    
    if (!decoded) {
        res.status(401).json({
            success: false,
            error: 'AUTHENTICATION_ERROR',
            message: 'Invalid or expired token. Please log in again.',
            statusCode: 401
        });
        return false;
    }
    
    // Attach user info to request
    req.user = decoded;
    return true;
}

/**
 * Set authentication cookie
 * @param {Object} res - Response object
 * @param {string} token - JWT token
 */
function setAuthCookie(res, token) {
    const isProduction = process.env.NODE_ENV === 'production';
    
    res.setHeader('Set-Cookie', [
        `auth_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Strict${isProduction ? '; Secure' : ''}`
    ]);
}

/**
 * Clear authentication cookie
 * @param {Object} res - Response object
 */
function clearAuthCookie(res) {
    res.setHeader('Set-Cookie', [
        'auth_token=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict'
    ]);
}

module.exports = {
    generateToken,
    verifyToken,
    extractToken,
    requireAuth,
    setAuthCookie,
    clearAuthCookie,
    JWT_SECRET,
    JWT_EXPIRES_IN
};
