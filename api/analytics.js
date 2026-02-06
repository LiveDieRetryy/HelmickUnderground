const { sql } = require('@vercel/postgres');

// Helper to parse user agent
function parseUserAgent(ua) {
    if (!ua) return { deviceType: 'Unknown', browser: 'Unknown' };
    
    const deviceType = /mobile|android|iphone|ipad|tablet/i.test(ua) ? 'Mobile' : 'Desktop';
    
    let browser = 'Unknown';
    
    // Check for specific browsers first (order matters!)
    // Edge must be checked before Chrome since Edge contains "Chrome" in UA
    if (ua.includes('Edg/') || ua.includes('Edge/')) {
        browser = 'Edge';
    }
    // Opera must be checked before Chrome
    else if (ua.includes('OPR/') || ua.includes('Opera/')) {
        browser = 'Opera';
    }
    // Brave browser
    else if (ua.includes('Brave/')) {
        browser = 'Brave';
    }
    // Samsung Internet
    else if (ua.includes('SamsungBrowser/')) {
        browser = 'Samsung Internet';
    }
    // Chrome (check after Edge, Opera, Brave)
    else if (ua.includes('Chrome/') || ua.includes('CriOS/')) {
        browser = 'Chrome';
    }
    // Safari (check after Chrome since Chrome includes Safari)
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) {
        browser = 'Safari';
    }
    // Firefox
    else if (ua.includes('Firefox/') || ua.includes('FxiOS/')) {
        browser = 'Firefox';
    }
    // Internet Explorer
    else if (ua.includes('MSIE') || ua.includes('Trident/')) {
        browser = 'Internet Explorer';
    }
    // DuckDuckGo
    else if (ua.includes('DuckDuckGo/')) {
        browser = 'DuckDuckGo';
    }
    // Vivaldi
    else if (ua.includes('Vivaldi/')) {
        browser = 'Vivaldi';
    }
    
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
                session_id VARCHAR(100),
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Add session_id column if it doesn't exist (migration)
        await sql`
            ALTER TABLE analytics 
            ADD COLUMN IF NOT EXISTS session_id VARCHAR(100)
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
                
                // Extract request data
                const { page, referrer, userAgent, screenWidth, screenHeight, language, timestamp, sessionId } = req.body || {};
                
                // Enhanced bot and suspicious traffic filtering
                const botPatterns = [
                    /googlebot/i, /bingbot/i, 
                    /slurp/i, /duckduckbot/i, /baiduspider/i, /yandexbot/i,
                    /facebookexternalhit/i, /twitterbot/i, /linkedinbot/i,
                    /whatsapp/i, /lighthouse/i, /HeadlessChrome/i, /PhantomJS/i,
                    /^curl\//i, /^wget\//i, /^python-/i, /^java\//i, /^ruby\//i,
                    /scrapy/i, /go-http-client/i, /axios\//i, /node-fetch/i,
                    /check_http/i, /pingdom/i, /uptime/i, /UptimeRobot/i,
                    /semrushbot/i, /ahrefsbot/i, /mj12bot/i, /rogerbot/i, /dotbot/i
                ];
                
                const isBot = botPatterns.some(pattern => pattern.test(userAgent || ''));
                
                // Log what we're seeing (for debugging)
                console.log('Analytics request:', {
                    page,
                    city,
                    region,
                    country,
                    referrer,
                    isBot,
                    userAgent: userAgent?.substring(0, 100)
                });
                
                // Filter suspicious referrers (common spam patterns)
                const suspiciousReferrers = [
                    /semalt/i, /buttons-for-website/i, /best-seo/i, /free-share/i,
                    /success-seo/i, /floating-share/i, /get-free-traffic/i
                ];
                const hasSuspiciousReferrer = suspiciousReferrers.some(pattern => 
                    pattern.test(referrer || '')
                );
                
                // Filter Vercel/cloud infrastructure automated requests
                // Only from specific cities AND only home page with no referrer (health checks/previews)
                const infrastructureCities = ['Santa Clara', 'San Jose', 'Ashburn', 'Omaha'];
                const isInfrastructureCity = infrastructureCities.includes(city);
                const isHomePage = page === '/' || page === '/index.html';
                const hasNoReferrer = !referrer || referrer === '' || referrer === 'direct';
                const isSuspiciousInfrastructure = isInfrastructureCity && isHomePage && hasNoReferrer;
                
                // Only filter out actual bots, spam, and suspicious infrastructure traffic
                const isLikelyLegitimate = !isBot && !hasSuspiciousReferrer && !isSuspiciousInfrastructure;
                
                // Skip logging if not legitimate
                if (!isLikelyLegitimate) {
                    return res.status(200).json({ success: true, filtered: true });
                }
                
                // Parse user agent
                const deviceInfo = parseUserAgent(userAgent);
                
                // Insert analytics entry
                await sql`
                    INSERT INTO analytics (
                        page, referrer, ip, country, city, region, 
                        device_type, browser, screen_resolution, language, session_id, timestamp
                    )
                    VALUES (
                        ${page}, ${referrer || null}, ${ip}, ${country}, ${city}, ${region},
                        ${deviceInfo.deviceType}, ${deviceInfo.browser}, 
                        ${screenWidth && screenHeight ? `${screenWidth}x${screenHeight}` : null}, 
                        ${language || null}, ${sessionId}, ${timestamp || new Date().toISOString()}
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
                        COUNT(DISTINCT ip)::integer as total,
                        COUNT(DISTINCT CASE WHEN DATE(timestamp) = CURRENT_DATE THEN ip END)::integer as today,
                        COUNT(DISTINCT CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN ip END)::integer as week
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
                    entries: result.rows,
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
                // Calculate statistics - count unique sessions (each visit after 1hr counts as new)
                const stats = await sql`
                    SELECT 
                        COUNT(DISTINCT session_id)::integer as total,
                        COUNT(DISTINCT CASE WHEN DATE(timestamp) = CURRENT_DATE THEN session_id END)::integer as today,
                        COUNT(DISTINCT CASE WHEN timestamp >= CURRENT_DATE - INTERVAL '7 days' THEN session_id END)::integer as week
                    FROM analytics
                    WHERE session_id IS NOT NULL
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
