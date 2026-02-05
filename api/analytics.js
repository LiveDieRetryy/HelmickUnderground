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
        // Create tables if they don't exist
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
        
        // Create events table for tracking user interactions
        await sql`
            CREATE TABLE IF NOT EXISTS analytics_events (
                id BIGSERIAL PRIMARY KEY,
                category VARCHAR(100) NOT NULL,
                action VARCHAR(100) NOT NULL,
                label VARCHAR(255),
                value INTEGER DEFAULT 0,
                page VARCHAR(500),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Create conversions table for tracking goals
        await sql`
            CREATE TABLE IF NOT EXISTS analytics_conversions (
                id BIGSERIAL PRIMARY KEY,
                goal_name VARCHAR(100) NOT NULL,
                goal_value INTEGER DEFAULT 0,
                page VARCHAR(500),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Create indexes for efficient querying
        await sql`CREATE INDEX IF NOT EXISTS idx_events_timestamp ON analytics_events(timestamp DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_events_category ON analytics_events(category)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_conversions_timestamp ON analytics_conversions(timestamp DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_conversions_goal ON analytics_conversions(goal_name)`;

        if (req.method === 'POST') {
            // Get action from query params or body
            const action = req.query.action || req.body?.action;
            
            // Handle event tracking
            if (action === 'event') {
                const { category, eventAction, label, value, page, timestamp } = req.body;
                
                await sql`
                    INSERT INTO analytics_events (category, action, label, value, page, timestamp)
                    VALUES (${category}, ${eventAction}, ${label || null}, ${value || 0}, ${page}, ${timestamp || new Date().toISOString()})
                `;
                
                return res.status(200).json({ success: true });
            }
            
            // Handle conversion tracking
            if (action === 'conversion') {
                const { goalName, goalValue, page, timestamp } = req.body;
                
                await sql`
                    INSERT INTO analytics_conversions (goal_name, goal_value, page, timestamp)
                    VALUES (${goalName}, ${goalValue || 0}, ${page}, ${timestamp || new Date().toISOString()})
                `;
                
                return res.status(200).json({ success: true });
            }
            
            const { page, referrer, userAgent, screenWidth, screenHeight, language, timestamp } = req.body || {};
            
            if (action === 'clear') {
                // Delete all analytics data
                await sql`DELETE FROM analytics`;
                return res.status(200).json({ success: true, message: 'Analytics cleared' });
            }
            
            if (action === 'cleanup') {
                // Fix URL-encoded location data in existing records
                await sql`
                    UPDATE analytics 
                    SET 
                        city = REPLACE(city, '%20', ' '),
                        region = REPLACE(region, '%20', ' '),
                        country = REPLACE(country, '%20', ' ')
                    WHERE city LIKE '%\%%' OR region LIKE '%\%%' OR country LIKE '%\%%'
                `;
                return res.status(200).json({ success: true, message: 'Location data cleaned' });
            }
            
            if (action === 'log') {
                // Get client info from Vercel headers
                const ip = req.headers['x-forwarded-for']?.split(',')[0] || 
                          req.headers['x-real-ip'] || 
                          'unknown';
                const country = decodeURIComponent(req.headers['x-vercel-ip-country'] || 'Unknown');
                const city = decodeURIComponent(req.headers['x-vercel-ip-city'] || 'Unknown');
                const region = decodeURIComponent(req.headers['x-vercel-ip-country-region'] || 'Unknown');
                
                // Filter out bots and crawlers
                const botPatterns = [
                    /bot/i, /crawler/i, /spider/i, /googlebot/i, /bingbot/i, 
                    /slurp/i, /duckduckbot/i, /baiduspider/i, /yandexbot/i,
                    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
                    /whatsapp/i, /lighthouse/i, /headless/i, /phantom/i
                ];
                
                const isBot = botPatterns.some(pattern => pattern.test(userAgent || ''));
                
                // Filter out Vercel infrastructure locations
                const vercelCities = ['Santa Clara', 'San Jose', 'Omaha', 'Ashburn', 'Frankfurt'];
                const isVercelInfra = vercelCities.includes(city);
                
                // Skip logging if bot or Vercel infrastructure
                if (isBot || isVercelInfra) {
                    return res.status(200).json({ success: true, filtered: true });
                }
                
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
                
                const pageViewStats = await sql`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as today,
                        SUM(CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN 1 ELSE 0 END) as week
                    FROM analytics
                `;
                
                const eventStats = await sql`
                    SELECT 
                        COUNT(*) as total_events,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as events_today
                    FROM analytics_events
                `;
                
                const conversionStats = await sql`
                    SELECT 
                        COUNT(*) as total_conversions,
                        SUM(CASE WHEN DATE(timestamp) = CURRENT_DATE THEN 1 ELSE 0 END) as conversions_today,
                        SUM(goal_value) as total_conversion_value
                    FROM analytics_conversions
                `;
                
                // Get top events
                const topEvents = await sql`
                    SELECT category, action, COUNT(*) as count
                    FROM analytics_events
                    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY category, action
                    ORDER BY count DESC
                    LIMIT 10
                `;
                
                // Get conversion funnel
                const conversionFunnel = await sql`
                    SELECT goal_name, COUNT(*) as count, SUM(goal_value) as total_value
                    FROM analytics_conversions
                    WHERE timestamp >= CURRENT_DATE - INTERVAL '30 days'
                    GROUP BY goal_name
                    ORDER BY count DESC
                `;
                
                return res.status(200).json({
                    pageViews: {
                        total: parseInt(pageViewStats.rows[0].total) || 0,
                        today: parseInt(pageViewStats.rows[0].today) || 0,
                        week: parseInt(pageViewStats.rows[0].week) || 0
                    },
                    events: {
                        total: parseInt(eventStats.rows[0].total_events) || 0,
                        today: parseInt(eventStats.rows[0].events_today) || 0,
                        top: topEvents.rows
                    },
                    conversions: {
                        total: parseInt(conversionStats.rows[0].total_conversions) || 0,
                        today: parseInt(conversionStats.rows[0].conversions_today) || 0,
                        totalValue: parseInt(conversionStats.rows[0].total_conversion_value) || 0,
                        funnel: conversionFunnel.rows
                    }
                });
            }
            
            if (action === 'events') {
                // Get all events with optional filtering
                const { category, limit = 100 } = req.query;
                
                let query = 'SELECT * FROM analytics_events';
                const params = [];
                
                if (category) {
                    query += ' WHERE category = $1';
                    params.push(category);
                }
                
                query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
                params.push(parseInt(limit));
                
                const result = await sql.query(query, params);
                return res.status(200).json(result.rows);
            }
            
            if (action === 'conversions') {
                // Get all conversions with optional filtering
                const { goalName, limit = 100 } = req.query;
                
                let query = 'SELECT * FROM analytics_conversions';
                const params = [];
                
                if (goalName) {
                    query += ' WHERE goal_name = $1';
                    params.push(goalName);
                }
                
                query += ' ORDER BY timestamp DESC LIMIT $' + (params.length + 1);
                params.push(parseInt(limit));
                
                const result = await sql.query(query, params);
                return res.status(200).json(result.rows);
            }
            
            // Return basic stats by default
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
                    totalVisits: parseInt(stats.rows[0].total) || 0,
                    todayVisits: parseInt(stats.rows[0].today) || 0,
                    weekVisits: parseInt(stats.rows[0].week) || 0
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
