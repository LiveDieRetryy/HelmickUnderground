// Vercel Serverless Function to manage gallery data
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'LiveDieRetryy';
    const REPO_NAME = 'HelmickUnderground';
    const FILE_PATH = 'gallery-data.json';
    
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }
    
    try {
        // GET - Read gallery data
        if (req.method === 'GET') {
            const response = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (!response.ok) {
                throw new Error('Failed to fetch gallery data');
            }
            
            const data = await response.json();
            const content = Buffer.from(data.content, 'base64').toString('utf-8');
            const galleryData = JSON.parse(content);
            
            return res.status(200).json(galleryData);
        }
        
        // POST - Update gallery data
        if (req.method === 'POST') {
            const { action, item } = req.body;
            
            // First, get current file
            const getResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            const currentFile = await getResponse.json();
            const currentContent = Buffer.from(currentFile.content, 'base64').toString('utf-8');
            const galleryData = JSON.parse(currentContent);
            
            // Modify data based on action
            if (action === 'add') {
                if (!galleryData.items) galleryData.items = [];
                galleryData.items.unshift(item);
            } else if (action === 'delete') {
                galleryData.items = galleryData.items.filter(i => i.id !== item.id);
            }
            
            // Update file on GitHub
            const newContent = Buffer.from(JSON.stringify(galleryData, null, 2)).toString('base64');
            
            const updateResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Update gallery: ${action} item`,
                        content: newContent,
                        sha: currentFile.sha
                    })
                }
            );
            
            if (!updateResponse.ok) {
                throw new Error('Failed to update gallery');
            }
            
            return res.status(200).json({ success: true, data: galleryData });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Gallery API Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
