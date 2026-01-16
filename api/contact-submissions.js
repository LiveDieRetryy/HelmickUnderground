const { Octokit } = require('@octokit/rest');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const OWNER = 'LiveDieRetryy';
const REPO = 'HelmickUnderground';
const FILE_PATH = 'contact-submissions.json';

const octokit = new Octokit({ auth: GITHUB_TOKEN });

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
        // Get existing submissions
        let submissions = [];
        let sha = null;
        
        try {
            const { data } = await octokit.repos.getContent({
                owner: OWNER,
                repo: REPO,
                path: FILE_PATH
            });
            sha = data.sha;
            const content = Buffer.from(data.content, 'base64').toString('utf8');
            submissions = JSON.parse(content);
        } catch (error) {
            // File doesn't exist yet, will be created
            if (error.status !== 404) throw error;
        }

        if (req.method === 'POST') {
            const { name, email, phone, services, message, timestamp } = req.body;
            
            // Create new submission
            const submission = {
                id: Date.now(),
                name,
                email,
                phone,
                services: services || [],
                message,
                timestamp: timestamp || new Date().toISOString(),
                status: 'unread',
                ip: req.headers['x-forwarded-for']?.split(',')[0] || req.connection?.remoteAddress || 'unknown'
            };
            
            // Add to beginning of array (most recent first)
            submissions.unshift(submission);
            
            // Keep only last 1000 submissions
            if (submissions.length > 1000) {
                submissions = submissions.slice(0, 1000);
            }
            
            // Save back to GitHub
            const fileParams = {
                owner: OWNER,
                repo: REPO,
                path: FILE_PATH,
                message: 'Add contact submission',
                content: Buffer.from(JSON.stringify(submissions, null, 2)).toString('base64')
            };
            
            // Only include sha if file already exists
            if (sha) {
                fileParams.sha = sha;
            }
            
            await octokit.repos.createOrUpdateFileContents(fileParams);
            
            return res.status(200).json({ success: true, id: submission.id });
        }

        if (req.method === 'GET') {
            const { action, id } = req.query;
            
            if (action === 'all') {
                // Return all submissions (for admin)
                return res.status(200).json(submissions);
            }
            
            if (action === 'stats') {
                // Calculate statistics
                const unread = submissions.filter(s => s.status === 'unread').length;
                const read = submissions.filter(s => s.status === 'read').length;
                const archived = submissions.filter(s => s.status === 'archived').length;
                
                const now = new Date();
                const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                const todaySubmissions = submissions.filter(s => {
                    const subDate = new Date(s.timestamp);
                    return subDate >= today;
                }).length;
                
                return res.status(200).json({
                    total: submissions.length,
                    unread,
                    read,
                    archived,
                    today: todaySubmissions
                });
            }
            
            if (action === 'markRead' && id) {
                // Mark submission as read
                const submission = submissions.find(s => s.id === parseInt(id));
                if (submission) {
                    submission.status = 'read';
                    
                    const markReadParams = {
                        owner: OWNER,
                        repo: REPO,
                        path: FILE_PATH,
                        message: 'Mark submission as read',
                        content: Buffer.from(JSON.stringify(submissions, null, 2)).toString('base64')
                    };
                    if (sha) markReadParams.sha = sha;
                    
                    await octokit.repos.createOrUpdateFileContents(markReadParams);
                    
                    return res.status(200).json({ success: true });
                }
            }
            
            if (action === 'delete' && id) {
                // Delete submission
                submissions = submissions.filter(s => s.id !== parseInt(id));
                
                const deleteParams = {
                    owner: OWNER,
                    repo: REPO,
                    path: FILE_PATH,
                    message: 'Delete submission',
                    content: Buffer.from(JSON.stringify(submissions, null, 2)).toString('base64')
                };
                if (sha) deleteParams.sha = sha;
                
                await octokit.repos.createOrUpdateFileContents(deleteParams);
                
                return res.status(200).json({ success: true });
            }
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Contact submissions API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: error.response?.data || error.toString()
        });
    }
};
