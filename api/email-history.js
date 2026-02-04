const { sql } = require('@vercel/postgres');
const { requireAuth } = require('./auth-middleware');
const { requireCsrfToken } = require('./csrf-middleware');
const { enforceRateLimit } = require('./rate-limiter');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Require authentication for email history access
    if (!requireAuth(req, res)) {
        return; // requireAuth already sent error response
    }

    // Require CSRF token for state-changing operations
    if ((req.method === 'POST' || req.method === 'DELETE') && !requireCsrfToken(req, res)) {
        return; // CSRF validation failed, error response already sent
    }

    // Apply rate limiting
    // Email sending is heavily rate limited (10 per hour)
    if (req.method === 'POST') {
        if (!enforceRateLimit(req, res, 'email')) {
            return; // Rate limit exceeded, error response already sent
        }
    } else {
        const limitType = req.method === 'GET' ? 'apiRead' : 'apiWrite';
        if (!enforceRateLimit(req, res, limitType)) {
            return; // Rate limit exceeded, error response already sent
        }
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS email_history (
                id BIGSERIAL PRIMARY KEY,
                email_type VARCHAR(50) NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                recipient_name VARCHAR(255),
                subject VARCHAR(500),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'sent',
                submission_id BIGINT,
                invoice_id BIGINT,
                metadata JSONB
            )
        `;

        if (req.method === 'POST') {
            const { type, email, name, subject, submissionId, invoiceId, metadata } = req.body;
            
            // Log email send
            await sql`
                INSERT INTO email_history (
                    email_type,
                    recipient_email,
                    recipient_name,
                    subject,
                    submission_id,
                    invoice_id,
                    metadata
                )
                VALUES (
                    ${type},
                    ${email},
                    ${name || null},
                    ${subject || null},
                    ${submissionId || null},
                    ${invoiceId || null},
                    ${metadata ? JSON.stringify(metadata) : null}
                )
            `;
            
            return res.status(200).json({ success: true });
        }

        if (req.method === 'GET') {
            const { action } = req.query;
            
            if (action === 'all') {
                const result = await sql`
                    SELECT * FROM email_history 
                    ORDER BY sent_at DESC 
                    LIMIT 500
                `;
                return res.status(200).json(result.rows);
            }
            
            if (action === 'stats') {
                const result = await sql`
                    SELECT 
                        email_type,
                        COUNT(*) as count,
                        MAX(sent_at) as last_sent
                    FROM email_history
                    GROUP BY email_type
                `;
                return res.status(200).json(result.rows);
            }
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Email history API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
};
