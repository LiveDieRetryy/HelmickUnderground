/**
 * Rate Limiting Middleware
 * 
 * Prevents spam, DDoS attacks, and resource exhaustion by limiting
 * the number of requests from a single IP address or user.
 * 
 * Uses in-memory storage (works for serverless with single instance per request)
 * For production at scale, consider using Vercel KV or Edge Config
 * 
 * @module rate-limiter
 */

// Rate limit storage (in-memory)
// In serverless, each function instance has its own memory
// This provides basic protection per instance
const rateLimitStore = new Map();

// Rate limit configurations
const RATE_LIMITS = {
    // Contact form: 3 submissions per 15 minutes per IP
    contactForm: {
        maxRequests: 3,
        windowMs: 15 * 60 * 1000, // 15 minutes
        message: 'Too many contact form submissions. Please try again later.'
    },
    
    // Login attempts: 5 attempts per 15 minutes per IP
    login: {
        maxRequests: 5,
        windowMs: 15 * 60 * 1000, // 15 minutes
        message: 'Too many login attempts. Please try again in 15 minutes.'
    },
    
    // API writes: 60 requests per minute per IP (authenticated users)
    apiWrite: {
        maxRequests: 60,
        windowMs: 60 * 1000, // 1 minute
        message: 'Rate limit exceeded. Please slow down.'
    },
    
    // API reads: 120 requests per minute per IP
    apiRead: {
        maxRequests: 120,
        windowMs: 60 * 1000, // 1 minute
        message: 'Rate limit exceeded. Please slow down.'
    },
    
    // Email sending: 10 emails per hour per IP
    email: {
        maxRequests: 10,
        windowMs: 60 * 60 * 1000, // 1 hour
        message: 'Email rate limit exceeded. Please try again later.'
    }
};

/**
 * Get client IP address from request
 * Handles various proxy headers (Vercel, Cloudflare, etc.)
 * 
 * @param {object} req - Request object
 * @returns {string} Client IP address
 * 
 * @example
 * const ip = getClientIp(req);
 * // Returns: "192.168.1.1"
 */
function getClientIp(req) {
    // Check various headers (in order of preference)
    const forwardedFor = req.headers['x-forwarded-for'];
    if (forwardedFor) {
        // x-forwarded-for can contain multiple IPs, get the first one
        return forwardedFor.split(',')[0].trim();
    }
    
    return req.headers['x-real-ip'] ||
           req.headers['cf-connecting-ip'] || // Cloudflare
           req.connection?.remoteAddress ||
           req.socket?.remoteAddress ||
           'unknown';
}

/**
 * Clean up expired rate limit entries
 * Prevents memory leaks in long-running instances
 * 
 * @param {number} now - Current timestamp
 */
function cleanupExpiredEntries(now) {
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}

/**
 * Check if request should be rate limited
 * 
 * @param {string} identifier - Unique identifier (IP address or user ID)
 * @param {string} limitType - Type of rate limit to apply
 * @returns {object} Rate limit status
 * 
 * @example
 * const result = checkRateLimit('192.168.1.1', 'contactForm');
 * if (!result.allowed) {
 *   return res.status(429).json({ error: result.message });
 * }
 */
function checkRateLimit(identifier, limitType) {
    const config = RATE_LIMITS[limitType];
    if (!config) {
        throw new Error(`Unknown rate limit type: ${limitType}`);
    }
    
    const key = `${limitType}:${identifier}`;
    const now = Date.now();
    
    // Clean up old entries periodically (every 100 requests)
    if (Math.random() < 0.01) {
        cleanupExpiredEntries(now);
    }
    
    const record = rateLimitStore.get(key);
    
    if (!record) {
        // First request in window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs
        });
        
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime: now + config.windowMs,
            retryAfter: null
        };
    }
    
    // Check if window has expired
    if (now > record.resetTime) {
        // Reset window
        rateLimitStore.set(key, {
            count: 1,
            resetTime: now + config.windowMs
        });
        
        return {
            allowed: true,
            remaining: config.maxRequests - 1,
            resetTime: now + config.windowMs,
            retryAfter: null
        };
    }
    
    // Within window, check count
    if (record.count >= config.maxRequests) {
        // Rate limit exceeded
        const retryAfter = Math.ceil((record.resetTime - now) / 1000); // seconds
        
        return {
            allowed: false,
            remaining: 0,
            resetTime: record.resetTime,
            retryAfter,
            message: config.message
        };
    }
    
    // Increment count
    record.count++;
    rateLimitStore.set(key, record);
    
    return {
        allowed: true,
        remaining: config.maxRequests - record.count,
        resetTime: record.resetTime,
        retryAfter: null
    };
}

/**
 * Middleware to enforce rate limiting
 * Call this at the start of API handlers that need rate limiting
 * 
 * @param {object} req - Request object
 * @param {object} res - Response object
 * @param {string} limitType - Type of rate limit to apply
 * @returns {boolean} True if request is allowed, false if rate limited (response already sent)
 * 
 * @example
 * // In contact form API
 * if (!enforceRateLimit(req, res, 'contactForm')) {
 *   return; // Rate limit exceeded, error response already sent
 * }
 */
function enforceRateLimit(req, res, limitType) {
    const ip = getClientIp(req);
    const result = checkRateLimit(ip, limitType);
    
    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', RATE_LIMITS[limitType].maxRequests);
    res.setHeader('X-RateLimit-Remaining', result.remaining);
    res.setHeader('X-RateLimit-Reset', new Date(result.resetTime).toISOString());
    
    if (!result.allowed) {
        res.setHeader('Retry-After', result.retryAfter);
        res.status(429).json({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: result.message || 'Too many requests. Please try again later.',
            statusCode: 429,
            retryAfter: result.retryAfter,
            resetAt: new Date(result.resetTime).toISOString(),
            timestamp: new Date().toISOString()
        });
        
        // Log rate limit exceeded
        console.warn(`[RATE LIMIT] ${limitType} exceeded for IP: ${ip}`);
        
        return false;
    }
    
    return true;
}

/**
 * Get rate limit info for an identifier
 * Useful for checking limits without incrementing counter
 * 
 * @param {string} identifier - Unique identifier (IP address or user ID)
 * @param {string} limitType - Type of rate limit to check
 * @returns {object|null} Rate limit info or null if no limit set
 * 
 * @example
 * const info = getRateLimitInfo('192.168.1.1', 'login');
 * console.log(`Remaining attempts: ${info?.remaining}`);
 */
function getRateLimitInfo(identifier, limitType) {
    const config = RATE_LIMITS[limitType];
    if (!config) return null;
    
    const key = `${limitType}:${identifier}`;
    const record = rateLimitStore.get(key);
    
    if (!record) {
        return {
            count: 0,
            remaining: config.maxRequests,
            resetTime: null
        };
    }
    
    const now = Date.now();
    if (now > record.resetTime) {
        return {
            count: 0,
            remaining: config.maxRequests,
            resetTime: null
        };
    }
    
    return {
        count: record.count,
        remaining: Math.max(0, config.maxRequests - record.count),
        resetTime: record.resetTime
    };
}

/**
 * Reset rate limit for an identifier
 * Useful for admin actions or testing
 * 
 * @param {string} identifier - Unique identifier (IP address or user ID)
 * @param {string} limitType - Type of rate limit to reset
 * 
 * @example
 * resetRateLimit('192.168.1.1', 'login');
 */
function resetRateLimit(identifier, limitType) {
    const key = `${limitType}:${identifier}`;
    rateLimitStore.delete(key);
}

module.exports = {
    getClientIp,
    checkRateLimit,
    enforceRateLimit,
    getRateLimitInfo,
    resetRateLimit,
    RATE_LIMITS
};
