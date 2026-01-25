const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
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
                ip VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
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
                        SUM(CASE WHEN status = 'contacted' THEN 1 ELSE 0 END) as contacted,
                        SUM(CASE WHEN status = 'scheduled' THEN 1 ELSE 0 END) as scheduled,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
                        SUM(CASE WHEN status = 'declined' THEN 1 ELSE 0 END) as declined,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as today
                    FROM contact_submissions
                `;
                
                return res.status(200).json({
                    total: parseInt(stats.rows[0].total) || 0,
                    unread: parseInt(stats.rows[0].unread) || 0,
                    read: parseInt(stats.rows[0].read) || 0,
                    contacted: parseInt(stats.rows[0].contacted) || 0,
                    scheduled: parseInt(stats.rows[0].scheduled) || 0,
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
                const { status } = req.query;
                const validStatuses = ['unread', 'read', 'contacted', 'scheduled', 'completed', 'declined'];
                
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ error: 'Invalid status' });
                }
                
                await sql`
                    UPDATE contact_submissions 
                    SET status = ${status} 
                    WHERE id = ${id}
                `;
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
