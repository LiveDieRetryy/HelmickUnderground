const { sql } = require('@vercel/postgres');

// Helper to parse user agent
function parseUserAgent(ua) {
    const deviceType = /mobile|android|iphone|ipad|tablet/i.test(ua) ? 'Mobile' : 'Desktop';
    
    let browser = 'Unknown';
    if (ua.includes('Chrome')) browser = 'Chrome';
    else if (ua.includes('Firefox')) browser = 'Firefox';
    else if (ua.includes('Safari') && !ua.includes('Chrome')) browser = 'Safari';
    else if (ua.includes('Edge')) browser = 'Edge';
    else if (ua.includes('MSIE') || ua.includes('Trident')) browser = 'IE';
    
    return { deviceType, browser };
}

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
            CREATE TABLE IF NOT EXISTS analytics (
                id BIGSERIAL PRIMARY KEY,
                page VARCHAR(500) NOT NULL,
                referrer TEXT,
                ip VARCHAR(100),
                country VARCHAR(100),
                city VARCHAR(100),
                region VARCHAR(100),
                device_type VARCHAR(50),
                browser VARCHAR(50),
                screen_resolution VARCHAR(50),
                language VARCHAR(50),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        if (req.method === 'POST') {
            const { action, page, referrer, userAgent, screenWidth, screenHeight, language, timestamp } = req.body;
            
            if (action === 'log') {
                // Get client info from Vercel headers
                const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
                          req.headers['x-real-ip'] || 
                          'unknown';
                const country = req.headers['x-vercel-ip-country'] || 'Unknown';
                const city = req.headers['x-vercel-ip-city'] || 'Unknown';
                const region = req.headers['x-vercel-ip-country-region'] || 'Unknown';
                
                // Parse user agent
                const deviceInfo = parseUserAgent(userAgent);
                
                // Insert analytics entry
                await sql`
                    INSERT INTO analytics (
                        page, referrer, ip, country, city, region, 
                        device_type, browser, screen_resolution, language, timestamp
                    )
                    VALUES (
                        ${page}, ${referrer || null}, ${ip}, ${country}, ${city}, ${region},
                        ${deviceInfo.deviceType}, ${deviceInfo.browser}, 
                        ${screenWidth && screenHeight ? `${screenWidth}x${screenHeight}` : null}, 
                        ${language || null}, ${timestamp || new Date().toISOString()}
                    )
                `;
                
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'GET') {
            const { action } = req.query;
            
            if (action === 'all') {
                // Return all analytics (most recent first, limit to last 1000)
                const result = await sql`
                    SELECT * FROM analytics 
                    ORDER BY timestamp DESC 
                    LIMIT 1000
                `;
                
                // Convert snake_case to camelCase for frontend compatibility
                const formattedData = result.rows.map(row => ({
                    timestamp: row.timestamp,
                    page: row.page,
                    referrer: row.referrer,
                    ip: row.ip,
                    country: row.country,
                    city: row.city,
                    region: row.region,
                    deviceType: row.device_type,
                    browser: row.browser,
                    screenResolution: row.screen_resolution,
                    language: row.language
                }));
                
                return res.status(200).json(formattedData);
            }
            
            if (action === 'stats') {
                // Calculate statistics
                const stats = await sql`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as today,
                        SUM(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as week
                    FROM analytics
                `;
                
                return res.status(200).json({
                    total: parseInt(stats.rows[0].total) || 0,
                    today: parseInt(stats.rows[0].today) || 0,
                    week: parseInt(stats.rows[0].week) || 0
                });
            }
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Analytics API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}
