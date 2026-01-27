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
            END $$;
        `;

        if (req.method === 'POST') {
            const { name, email, phone, services, message, timestamp } = req.body;
            
            // Get client IP
            const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
                      req.headers['x-real-ip'] || 
                      'unknown';
            
            // Insert new submission
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
                    timestamp: row.timestamp
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
                const validStatuses = ['unread', 'read', 'acknowledged', 'contacted', 'scheduled', 'quoted', 'accepted', 'invoiced', 'completed', 'declined'];
                
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ error: 'Invalid status' });
                }
                
                if (scheduled_date) {
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
            
            const validStatuses = ['unread', 'read', 'acknowledged', 'contacted', 'scheduled', 'quoted', 'accepted', 'invoiced', 'completed', 'declined'];
            
            if (status && !validStatuses.includes(status)) {
                return res.status(400).json({ error: 'Invalid status' });
            }
            
            // Build update query dynamically based on what's provided
            if (invoice_id !== undefined) {
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
