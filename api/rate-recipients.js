export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
        const REPO_OWNER = 'LiveDieRetryy';
        const REPO_NAME = 'HelmickUnderground';
        const FILE_PATH = 'rate-recipients.json';

        // Try GitHub API first
        if (GITHUB_TOKEN) {
            try {
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
                    const recipients = JSON.parse(content);
                    return res.status(200).json(recipients);
                }
            } catch (error) {
                console.error('GitHub API error:', error);
            }
        }

        // Fallback: Try public URL
        const publicUrl = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/${FILE_PATH}`;
        const fallbackResponse = await fetch(publicUrl);
        
        if (fallbackResponse.ok) {
            const recipients = await fallbackResponse.json();
            return res.status(200).json(recipients);
        }

        // If both fail, return empty list
        return res.status(200).json({ recipients: [] });

    } catch (error) {
        console.error('Error fetching recipients:', error);
        return res.status(500).json({ 
            error: 'Failed to fetch recipients',
            details: error.message 
        });
    }
}
