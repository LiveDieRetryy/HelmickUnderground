// Vercel Serverless Function to manage rates data
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'LiveDieRetryy';
    const REPO_NAME = 'HelmickUnderground';
    const FILE_PATH = 'rates-data.json';
    
    try {
        // GET - Read rates data
        if (req.method === 'GET') {
            // Try to fetch from GitHub first
            if (GITHUB_TOKEN) {
                const response = await fetch(
                    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                    {
                        headers: {
                            'Authorization': `token ${GITHUB_TOKEN}`,
                            'Accept': 'application/vnd.github.v3+json'
                        }
                    }
                );
                
                if (response.ok) {
                    const data = await response.json();
                    const content = Buffer.from(data.content, 'base64').toString('utf-8');
                    const ratesData = JSON.parse(content);
                    return res.status(200).json(ratesData);
                }
            }
            
            // Fallback: Fetch from raw GitHub URL (public access)
            const publicResponse = await fetch(
                `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`
            );
            
            if (!publicResponse.ok) {
                throw new Error('Failed to fetch rates data');
            }
            
            const ratesData = await publicResponse.json();
            return res.status(200).json(ratesData);
        }
        
        // POST - Update rates data
        if (req.method === 'POST') {
            if (!GITHUB_TOKEN) {
                return res.status(500).json({ error: 'GitHub token not configured. Cannot save rates.' });
            }
            
            const ratesData = req.body;
            
            // First, get current file to get its SHA
            const getResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );
            
            if (!getResponse.ok) {
                throw new Error('Failed to get current rates file');
            }
            
            const currentFile = await getResponse.json();
            
            // Update the file
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
                        message: `Update rates - ${new Date().toLocaleString()}`,
                        content: Buffer.from(JSON.stringify(ratesData, null, 2)).toString('base64'),
                        sha: currentFile.sha
                    })
                }
            );
            
            if (!updateResponse.ok) {
                const errorData = await updateResponse.json();
                throw new Error(`Failed to update rates: ${errorData.message}`);
            }
            
            return res.status(200).json({ success: true, message: 'Rates updated successfully' });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
        
    } catch (error) {
        console.error('Error in rates API:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}
