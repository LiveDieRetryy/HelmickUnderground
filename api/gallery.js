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
        
        // POST - Update gallery data or upload image
        if (req.method === 'POST') {
            const { action, item, fileName, fileContent } = req.body;
            
            // Handle image upload
            if (action === 'upload') {
                try {
                    const uploadResponse = await fetch(
                        `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/images/${fileName}`,
                        {
                            method: 'PUT',
                            headers: {
                                'Authorization': `token ${GITHUB_TOKEN}`,
                                'Accept': 'application/vnd.github.v3+json',
                                'Content-Type': 'application/json'
                            },
                            body: JSON.stringify({
                                message: `Upload image: ${fileName}`,
                                content: fileContent
                            })
                        }
                    );
                    
                    if (!uploadResponse.ok) {
                        throw new Error('Failed to upload image to GitHub');
                    }
                    
                    return res.status(200).json({ success: true, path: `images/${fileName}` });
                } catch (error) {
                    return res.status(500).json({ error: 'Image upload failed: ' + error.message });
                }
            }
            
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
            } else if (action === 'edit') {
                const index = galleryData.items.findIndex(i => i.id === item.id);
                if (index !== -1) {
                    // Keep existing image/video/embed data, only update title, description, date
                    galleryData.items[index] = {
                        ...galleryData.items[index],
                        title: item.title,
                        description: item.description,
                        date: item.date
                    };
                }
            } else if (action === 'reorder') {
                // Replace entire items array with new order
                const { items } = req.body;
                galleryData.items = items;
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
