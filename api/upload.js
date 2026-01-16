// Vercel Serverless Function to upload files to GitHub
export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }
    
    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = 'LiveDieRetryy';
    const REPO_NAME = 'HelmickUnderground';
    
    if (!GITHUB_TOKEN) {
        return res.status(500).json({ error: 'GitHub token not configured' });
    }
    
    try {
        const { fileName, fileContent, fileType } = req.body;
        
        // Size limit check (already checked on client, but double-check)
        const sizeInMB = (fileContent.length * 0.75) / (1024 * 1024); // base64 to MB
        const maxSize = fileType.startsWith('video/') ? 10 : 5;
        
        if (sizeInMB > maxSize) {
            return res.status(400).json({ 
                error: `File too large. ${fileType.startsWith('video/') ? 'Videos' : 'Images'} must be under ${maxSize}MB.` 
            });
        }
        
        // Determine folder
        const folder = fileType.startsWith('video/') ? 'videos' : 'images';
        const filePath = `${folder}/${fileName}`;
        
        // Check if file exists
        const checkResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
            {
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            }
        );
        
        let sha = null;
        if (checkResponse.ok) {
            const existingFile = await checkResponse.json();
            sha = existingFile.sha;
        }
        
        // Upload file
        const uploadBody = {
            message: `Upload ${fileType.startsWith('video/') ? 'video' : 'image'}: ${fileName}`,
            content: fileContent.split(',')[1], // Remove data:image/jpeg;base64, prefix
        };
        
        if (sha) {
            uploadBody.sha = sha; // Update existing file
        }
        
        const uploadResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${filePath}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github.v3+json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(uploadBody)
            }
        );
        
        if (!uploadResponse.ok) {
            const error = await uploadResponse.text();
            throw new Error(`Upload failed: ${error}`);
        }
        
        const result = await uploadResponse.json();
        
        return res.status(200).json({ 
            success: true, 
            path: filePath,
            url: result.content.download_url
        });
        
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: error.message });
    }
}
