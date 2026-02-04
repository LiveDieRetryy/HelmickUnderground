/**
 * Authentication API Endpoint
 * Handles login, logout, token verification, and CSRF token generation
 */

const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { generateToken, verifyToken, extractToken, setAuthCookie, clearAuthCookie } = require('../lib/auth-middleware');
const { generateAndSetCsrfToken, clearCsrfCookie, CSRF_HEADER_NAME } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');

// Helper function to generate CSRF token
function generateCsrfToken() {
    return crypto.randomBytes(32).toString('hex');
}

// TEMPORARY: Hardcoded admin credentials
// TODO: Move to database with proper user management
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || '$2a$10$rZ8qYPYGVwXYJK5UpYvH0uEqKqF9Y4.xQZ0xhXvK8RqPbZ5N0QZ5W'; // 'password123'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@helmickunderground.com';

/**
 * Hash password for storage
 * @param {string} password - Plain text password
 * @returns {Promise<string>} Hashed password
 */
async function hashPassword(password) {
    return await bcrypt.hash(password, 10);
}

/**
 * Verify password against hash
 * @param {string} password - Plain text password
 * @param {string} hash - Hashed password
 * @returns {Promise<boolean>} True if password matches
 */
async function verifyPassword(password, hash) {
    return await bcrypt.compare(password, hash);
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // POST /api/auth - Login
        if (req.method === 'POST' && !req.query.action) {
            // Rate limit login attempts
            if (!enforceRateLimit(req, res, 'login')) {
                return; // Rate limit exceeded, error response already sent
            }

            const { username, password } = req.body;

            if (!username || !password) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Username and password are required'
                });
            }

            // Verify credentials
            if (username === ADMIN_USERNAME) {
                const isValid = await verifyPassword(password, ADMIN_PASSWORD_HASH);
                
                if (isValid) {
                    // Generate JWT token
                    const token = generateToken({
                        username: ADMIN_USERNAME,
                        email: ADMIN_EMAIL
                    });

                    // Generate CSRF token
                    const csrfToken = generateCsrfToken();
                    
                    // Set both cookies at once to avoid overwriting
                    const isProduction = process.env.NODE_ENV === 'production';
                    res.setHeader('Set-Cookie', [
                        `auth_token=${token}; HttpOnly; Path=/; Max-Age=28800; SameSite=Lax${isProduction ? '; Secure' : ''}`,
                        `csrf_token=${csrfToken}; HttpOnly; Path=/; Max-Age=86400; SameSite=Lax${isProduction ? '; Secure' : ''}`
                    ]);

                    return res.status(200).json({
                        success: true,
                        message: 'Login successful',
                        token, // Also return token for storage in client
                        csrfToken, // Return CSRF token for client to use in requests
                        user: {
                            username: ADMIN_USERNAME,
                            email: ADMIN_EMAIL
                        }
                    });
                }
            }

            // Invalid credentials
            return res.status(401).json({
                success: false,
                error: 'AUTHENTICATION_ERROR',
                message: 'Invalid username or password'
            });
        }

        // POST /api/auth?action=logout - Logout
        if (req.method === 'POST' && req.query.action === 'logout') {
            clearAuthCookie(res);
            clearCsrfCookie(res);
            
            return res.status(200).json({
                success: true,
                message: 'Logout successful'
            });
        }

        // GET /api/auth?action=verify - Verify token
        if (req.method === 'GET' && req.query.action === 'verify') {
            try {
                const token = extractToken(req);
                
                if (!token) {
                    return res.status(401).json({
                        success: false,
                        authenticated: false,
                        error: 'AUTHENTICATION_ERROR',
                        message: 'No authentication token found'
                    });
                }

                const decoded = verifyToken(token);
                
                if (!decoded) {
                    return res.status(401).json({
                        success: false,
                        authenticated: false,
                        error: 'AUTHENTICATION_ERROR',
                        message: 'Invalid or expired token'
                    });
                }

                return res.status(200).json({
                    success: true,
                    authenticated: true,
                    message: 'Token is valid',
                    user: {
                        username: decoded.username,
                        email: decoded.email
                    },
                    expiresAt: decoded.exp
                });
            } catch (error) {
                console.error('Token verification error:', error);
                return res.status(401).json({
                    success: false,
                    authenticated: false,
                    error: 'AUTHENTICATION_ERROR',
                    message: 'Token verification failed'
                });
            }
        }

        // GET /api/auth?action=csrf - Get CSRF token
        if (req.method === 'GET' && req.query.action === 'csrf') {
            const csrfToken = generateAndSetCsrfToken(res);
            
            return res.status(200).json({
                success: true,
                csrfToken,
                message: 'CSRF token generated'
            });
        }

        // POST /api/auth?action=hash-password - Generate password hash (DEVELOPMENT ONLY)
        if (req.method === 'POST' && req.query.action === 'hash-password' && process.env.NODE_ENV !== 'production') {
            const { password } = req.body;
            
            if (!password) {
                return res.status(400).json({
                    success: false,
                    error: 'VALIDATION_ERROR',
                    message: 'Password is required'
                });
            }

            const hash = await hashPassword(password);
            
            return res.status(200).json({
                success: true,
                hash,
                message: 'Set this as ADMIN_PASSWORD_HASH environment variable'
            });
        }

        return res.status(400).json({
            success: false,
            error: 'VALIDATION_ERROR',
            message: 'Invalid request'
        });

    } catch (error) {
        console.error('Auth API error:', error);
        return res.status(500).json({
            success: false,
            error: 'INTERNAL_ERROR',
            message: 'An error occurred during authentication',
            details: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
