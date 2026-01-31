const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS contact_submissions (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) NOT NULL,
                phone VARCHAR(50),
                services TEXT[],
                message TEXT,
                status VARCHAR(50) DEFAULT 'unread',
                notes TEXT,
                ip VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Add notes column if it doesn't exist (for existing databases)
        await sql`
            DO $$ 
            BEGIN 
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='contact_submissions' AND column_name='notes') THEN
                    ALTER TABLE contact_submissions ADD COLUMN notes TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='contact_submissions' AND column_name='scheduled_date') THEN
                    ALTER TABLE contact_submissions ADD COLUMN scheduled_date TIMESTAMP;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='contact_submissions' AND column_name='quote_data') THEN
                    ALTER TABLE contact_submissions ADD COLUMN quote_data TEXT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='contact_submissions' AND column_name='invoice_id') THEN
                    ALTER TABLE contact_submissions ADD COLUMN invoice_id BIGINT;
                END IF;
                IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                              WHERE table_name='contact_submissions' AND column_name='completed_at') THEN
                    ALTER TABLE contact_submissions ADD COLUMN completed_at TIMESTAMP;
                END IF;
            END $$;
        `;

        if (req.method === 'POST') {
            const { name, email, phone, services, message, timestamp, honeypot, recaptchaToken } = req.body;
            
            // Get client IP
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
                      req.headers['x-real-ip'] || 
                      'unknown';
            
            // Server-side spam detection
            let isSpam = false;
            let spamReasons = [];
            
            // Verify reCAPTCHA token
            if (recaptchaToken) {
                try {
                    const recaptchaSecret = process.env.RECAPTCHA_SECRET_KEY;
                    if (recaptchaSecret) {
                        const verifyResponse = await fetch('https://www.google.com/recaptcha/api/siteverify', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                            body: `secret=${recaptchaSecret}&response=${recaptchaToken}&remoteip=${ip}`
                        });
                        
                        const verifyData = await verifyResponse.json();
                        
                        if (!verifyData.success) {
                            isSpam = true;
                            spamReasons.push('recaptcha_failed');
                            console.log('reCAPTCHA verification failed:', verifyData['error-codes']);
                        }
                    }
                } catch (err) {
                    console.error('reCAPTCHA verification error:', err);
                    // Don't mark as spam on verification error, just log it
                }
            } else {
                // No reCAPTCHA token provided
                isSpam = true;
                spamReasons.push('no_recaptcha_token');
            }
            
            // Check honeypot
            if (honeypot && honeypot.trim() !== '') {
                isSpam = true;
                spamReasons.push('honeypot_filled');
            }
            
            // Check for suspicious patterns in name
            if (name) {
                // Check for random character strings (like "CbNaPyWmMBgOWIWOrU")
                const hasRandomPattern = /^[A-Z][a-z][A-Z][a-z][A-Z]/i.test(name) && name.length > 10;
                const hasNoSpaces = !name.includes(' ') && name.length > 15;
                const hasRepeatingPattern = /([A-Z][a-z]){5,}/i.test(name);
                
                if (hasRandomPattern || hasNoSpaces || hasRepeatingPattern) {
                    isSpam = true;
                    spamReasons.push('suspicious_name_pattern');
                }
            }
            
            // Check for suspicious email patterns
            if (email) {
                const suspiciousEmailPatterns = [
                    /\.\w\.\w\.\w\.\w\./,  // Multiple single chars with dots: a.b.c.d.e
                    /[a-z]\.[a-z]\.[a-z]\.[a-z]@/i,  // Pattern like: a.b.c.d@
                    /\d{5,}@/,  // 5+ consecutive numbers before @
                ];
                
                for (const pattern of suspiciousEmailPatterns) {
                    if (pattern.test(email)) {
                        isSpam = true;
                        spamReasons.push('suspicious_email_pattern');
                        break;
                    }
                }
            }
            
            // Check for gibberish in message
            if (message) {
                const hasGibberish = /^[A-Z][a-z]{2}[A-Z][a-z]{2}[A-Z]/i.test(message) && message.length < 50;
                if (hasGibberish) {
                    isSpam = true;
                    spamReasons.push('gibberish_message');
                }
            }
            
            // Rate limiting: Check for multiple submissions from same IP
            try {
                const recentSubmissions = await sql`
                    SELECT COUNT(*) as count 
                    FROM contact_submissions 
                    WHERE ip = ${ip} 
                    AND timestamp > NOW() - INTERVAL '1 hour'
                `;
                
                const submissionCount = parseInt(recentSubmissions.rows[0]?.count || 0);
                
                if (submissionCount >= 3) {
                    isSpam = true;
                    spamReasons.push('rate_limit_exceeded');
                }
            } catch (err) {
                console.error('Rate limit check error:', err);
            }
            
            // If spam is detected, log it but return success to fool bots
            if (isSpam) {
                console.log('Spam submission blocked:', {
                    ip,
                    name,
                    email,
                    reasons: spamReasons
                });
                
                // Still insert as spam for admin review with special status
                await sql`
                    INSERT INTO contact_submissions (name, email, phone, services, message, ip, timestamp, status, notes)
                    VALUES (${name}, ${email}, ${phone || null}, ${services || []}, ${message}, ${ip}, ${timestamp || new Date().toISOString()}, 'spam', ${`[SPAM] ${spamReasons.join(', ')}`})
                `;
                
                // Return success to fool bots
                return res.status(200).json({ success: true, id: 0 });
            }
            
            // Insert legitimate submission
            const result = await sql`
                INSERT INTO contact_submissions (name, email, phone, services, message, ip, timestamp, status)
                VALUES (${name}, ${email}, ${phone || null}, ${services || []}, ${message}, ${ip}, ${timestamp || new Date().toISOString()}, 'unread')
                RETURNING id
            `;
            
            return res.status(200).json({ success: true, id: result.rows[0].id });
        }

        if (req.method === 'GET') {
            const { action, id } = req.query;
            
            if (action === 'all') {
                // Return all submissions (most recent first)
                const result = await sql`
                    SELECT * FROM contact_submissions 
                    ORDER BY timestamp DESC
                `;
                
                // Convert to frontend-compatible format
                const formattedData = result.rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    email: row.email,
                    phone: row.phone,
                    services: row.services,
                    message: row.message,
                    status: row.status,
                    notes: row.notes,
                    scheduled_date: row.scheduled_date,
                    quote_data: row.quote_data,
                    invoice_id: row.invoice_id,
                    ip: row.ip,
                    timestamp: row.timestamp,
                    completed_at: row.completed_at
                }));
                
                return res.status(200).json(formattedData);
            }
            
            if (action === 'stats') {
                // Calculate statistics
                const stats = await sql`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'unread' THEN 1 ELSE 0 END) as unread,
                        SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as read,
                        SUM(CASE WHEN status = 'acknowledged' THEN 1 ELSE 0 END) as acknowledged,
                        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
                        SUM(CASE WHEN status = 'quoted' THEN 1 ELSE 0 END) as quoted,
                        SUM(CASE WHEN status = 'accepted' THEN 1 ELSE 0 END) as accepted,
                        SUM(CASE WHEN status = 'invoiced' THEN 1 ELSE 0 END) as invoiced,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined,
                        SUM(CASE WHEN status = 'spam' THEN 1 ELSE 0 END) as spam,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as today
                    FROM contact_submissions
                `;
                
                return res.status(200).json({
                    total: parseInt(stats.rows[0].total) || 0,
                    unread: parseInt(stats.rows[0].unread) || 0,
                    read: parseInt(stats.rows[0].read) || 0,
                    acknowledged: parseInt(stats.rows[0].acknowledged) || 0,
                    contacted: parseInt(stats.rows[0].contacted) || 0,
                    scheduled: parseInt(stats.rows[0].scheduled) || 0,
                    accepted: parseInt(stats.rows[0].accepted) || 0,
                    quoted: parseInt(stats.rows[0].quoted) || 0,
                    invoiced: parseInt(stats.rows[0].invoiced) || 0,
                    completed: parseInt(stats.rows[0].completed) || 0,
                    declined: parseInt(stats.rows[0].declined) || 0,
                    spam: parseInt(stats.rows[0].spam) || 0,
                    today: parseInt(stats.rows[0].today) || 0
                });
            }
            
            if (action === 'markRead' && id) {
                // Mark submission as read
                await sql`
                    UPDATE contact_submissions 
                    SET status = 'read' 
                    WHERE id = ${id}
                `;
                return res.status(200).json({ success: true });
            }
            
            if (action === 'updateStatus' && id) {
                const { status, scheduled_date } = req.query;
                const validStatuses = ['unread', 'read', 'acknowledged', 'contacted', 'scheduled', 'quoted', 'accepted', 'invoiced', 'completed', 'declined', 'spam'];
                
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ error: 'Invalid status' });
                }
                
                if (status === 'completed') {
                    // Set completed_at timestamp when marking as completed
                    await sql`
                        UPDATE contact_submissions 
                        SET status = ${status}, completed_at = CURRENT_TIMESTAMP
                        WHERE id = ${id}
                    `;
                } else if (scheduled_date) {
                    await sql`
                        UPDATE contact_submissions 
                        SET status = ${status}, scheduled_date = ${scheduled_date}
                        WHERE id = ${id}
                    `;
                } else {
                    await sql`
                        UPDATE contact_submissions 
                        SET status = ${status} 
                        WHERE id = ${id}
                    `;
                }
                return res.status(200).json({ success: true });
            }
            
            if (action === 'delete' && id) {
                // Delete submission
                await sql`
                    DELETE FROM contact_submissions 
                    WHERE id = ${id}
                `;
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'PUT') {
            const { id, status, notes, scheduled_date, quote_data, invoice_id } = req.body;
            
            if (!id) {
                return res.status(400).json({ error: 'ID is required' });
            }
            
            const validStatuses = ['unread', 'read', 'acknowledged', 'contacted', 'scheduled', 'quoted', 'accepted', 'invoiced', 'completed', 'declined', 'spam'];
            
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            
            // Build update query dynamically based on what's provided
            if (status === 'completed') {
                // Set completed_at timestamp when marking as completed
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}, completed_at = CURRENT_TIMESTAMP
                    WHERE id = ${id}
                `;
            } else if (invoice_id !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET invoice_id = ${invoice_id}
                    WHERE id = ${id}
                `;
            } else if (status && quote_data !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}, quote_data = ${quote_data}
                    WHERE id = ${id}
                `;
            } else if (status && notes !== undefined && scheduled_date !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}, notes = ${notes}, scheduled_date = ${scheduled_date}
                    WHERE id = ${id}
                `;
            } else if (status && scheduled_date !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}, scheduled_date = ${scheduled_date}
                    WHERE id = ${id}
                `;
            } else if (status && notes !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}, notes = ${notes}
                    WHERE id = ${id}
                `;
            } else if (status) {
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status}
                    WHERE id = ${id}
                `;
            } else if (notes !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET notes = ${notes}
                    WHERE id = ${id}
                `;
            } else if (scheduled_date !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET scheduled_date = ${scheduled_date}
                    WHERE id = ${id}
                `;
            } else if (quote_data !== undefined) {
                await sql`
                    UPDATE contact_submissions 
                    SET quote_data = ${quote_data}
                    WHERE id = ${id}
                `;
            }
            
            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Contact submissions API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: error.toString()
        });
    }
}
