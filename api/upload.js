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
        const { fileName, fileContent, fileType, files, project_id, type } = req.body;
        
        // Handle multiple files upload (for project documents)
        if (files && Array.isArray(files)) {
            const uploadedFiles = [];
            
            for (const file of files) {
                const result = await uploadSingleFile(file.fileName, file.fileContent, file.fileType, project_id, type);
                uploadedFiles.push(result);
            }
            
            return res.status(200).json({ 
                success: true, 
                files: uploadedFiles
            });
        }
        
        // Handle single file upload (original functionality)
        const result = await uploadSingleFile(fileName, fileContent, fileType, project_id, type);
        return res.status(200).json(result);
        
    } catch (error) {
        console.error('Upload error:', error);
        return res.status(500).json({ error: error.message });
    }
    
    async function uploadSingleFile(fileName, fileContent, fileType, projectId, uploadType) {
        // Size limit check
        const sizeInMB = (fileContent.length * 0.75) / (1024 * 1024); // base64 to MB
        let maxSize = 5; // Default for images
        
        if (fileType.startsWith('video/')) {
            maxSize = 10;
        } else if (fileType === 'application/pdf' || fileType.startsWith('application/')) {
            maxSize = 15; // PDFs and documents can be larger
        }
        
        if (sizeInMB > maxSize) {
            const fileTypeName = fileType.startsWith('video/') ? 'Videos' : 
                                 fileType === 'application/pdf' ? 'PDFs' : 
                                 fileType.startsWith('application/') ? 'Documents' : 'Images';
            throw new Error(`File too large. ${fileTypeName} must be under ${maxSize}MB.`);
        }
        
        // Determine folder based on upload type
        let folder;
        if (projectId) {
            // Project-related files go in project-files directory
            folder = `project-files/${projectId}/${uploadType || 'documents'}`;
        } else if (fileType.startsWith('video/')) {
            folder = 'videos';
        } else {
            folder = 'images';
        }
        
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
            message: `Upload ${uploadType || fileType.split('/')[0]}: ${fileName}${projectId ? ` (Project ${projectId})` : ''}`,
            content: fileContent.split(',')[1], // Remove data prefix
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
        
        return { 
            success: true, 
            name: fileName,
            path: filePath,
            url: result.content.download_url,
            type: uploadType || fileType.split('/')[0]
        };
    }
}
