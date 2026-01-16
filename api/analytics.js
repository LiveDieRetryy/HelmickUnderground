const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'LiveDieRetryy';
const REPO = 'HelmickUnderground';
const FILE_PATH = 'analytics-data.json';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Helper to get client IP and location info
function getClientInfo(req) {
    // Try to get real IP from various headers (Vercel sets x-forwarded-for)
    const ip = req.headers['x-forwarded-for']?.split(',')[0] ||
               req.headers['x-real-ip'] ||
               req.connection?.remoteAddress ||
               'unknown';
    
    // Get country from Vercel's geo headers
    const country = req.headers['x-vercel-ip-country'] || 'Unknown';
    const city = req.headers['x-vercel-ip-city'] || 'Unknown';
    const region = req.headers['x-vercel-ip-country-region'] || 'Unknown';
    
    return { ip, country, city, region };
}

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

module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Get existing analytics data
        let analyticsData = [];
        let sha = null;
        
        try {
            const { data } = await octokit.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: FILE_PATH
            });
            sha = data.sha;
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            analyticsData = JSON.parse(content);
        } catch (error) {
            // File doesn't exist yet, will be created
            if (error.status !== 404) throw error;
        }

        if (req.method === 'POST') {
            const { action, page, referrer, userAgent, screenWidth, screenHeight, language, timestamp } = req.body;
            
            if (action === 'log') {
                // Get client info
                const clientInfo = getClientInfo(req);
                const deviceInfo = parseUserAgent(userAgent);
                
                // Create new entry
                const entry = {
                    timestamp,
                    page,
                    referrer,
                    ...clientInfo,
                    ...deviceInfo,
                    screenResolution: `${screenWidth}x${screenHeight}`,
                    language
                };
                
                // Add to beginning of array (most recent first)
                analyticsData.unshift(entry);
                
                // Keep only last 10,000 entries to prevent file getting too large
                if (analyticsData.length > 10000) {
                    analyticsData = analyticsData.slice(0, 10000);
                }
                
                // Save back to GitHub
                const analyticsParams = {
                    owner: OWNER,
                    repo: REPO,
                    path: FILE_PATH,
                    message: 'Update analytics data',
                    content: Buffer.from(JSON.stringify(analyticsData, null, 2)).toString('base64')
                };
                if (sha) analyticsParams.sha = sha;
                
                await octokit.repos.createOrUpdateFileContents(analyticsParams);
                
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'GET') {
            const { action } = req.query;
            
            if (action === 'all') {
                // Return all analytics data (for admin)
                return res.status(200).json(analyticsData);
            }
            
            if (action === 'stats') {
                // Calculate statistics
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const weekAgo = new Date(today);
                weekAgo.setDate(weekAgo.getDate() - 7);
                
                const todayVisits = analyticsData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= today;
                }).length;
                
                const weekVisits = analyticsData.filter(entry => {
                    const entryDate = new Date(entry.timestamp);
                    return entryDate >= weekAgo;
                }).length;
                
                return res.status(200).json({
                    total: analyticsData.length,
                    today: todayVisits,
                    week: weekVisits
                });
            }
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Analytics API error:', error);
        return res.status(500).json({ error: 'Internal server error', message: error.message });
    }
};
