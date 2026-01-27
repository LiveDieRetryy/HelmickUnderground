export default async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { recipientEmail, ratesData } = req.body;

        if (!recipientEmail || !ratesData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const today = new Date().toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // Build HTML email
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
    <div style="max-width: 800px; margin: 0 auto; background: #1a1a1a; border-radius: 12px;">
        <!-- Header -->
        <div style="text-align: center; padding: 2.5rem 2rem; background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); border-radius: 12px 12px 0 0;">
            <div style="background: #000; display: inline-block; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 1rem;">
                <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground LLC" style="max-width: 300px;">
            </div>
            <div style="color: rgba(255,255,255,0.9); font-size: 1rem;">
                <strong style="display: block; font-size: 1.5rem; color: white; margin-bottom: 0.5rem; font-weight: 700;">SERVICE RATES & PRICING</strong>
                Mount Vernon, Iowa<br>
                Effective: ${today}
            </div>
        </div>

        <div style="padding: 2rem;">
            <h2 style="color: #ffffff; font-size: 1.5rem; margin: 1.5rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a; text-align: center;">Base Rates</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr>
                        <th style="background: #333; color: white; padding: 1rem; text-align: left; font-weight: 700;">Service</th>
                        <th style="background: #333; color: white; padding: 1rem; text-align: right; font-weight: 700;">Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${ratesData.baseRates.map((item, index) => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.75rem 1rem; color: #e5e7eb;">${item.name}</td>
                        <td style="padding: 0.75rem 1rem; text-align: right; color: #ffffff; font-weight: 600;">$${item.rate.toFixed(2)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <h2 style="color: #ffffff; font-size: 1.5rem; margin: 1.5rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a; text-align: center;">Custom Work Per Hour</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr>
                        <th style="background: #333; color: white; padding: 1rem; text-align: left; font-weight: 700;">Service</th>
                        <th style="background: #333; color: white; padding: 1rem; text-align: right; font-weight: 700;">Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${ratesData.customWork.map((item, index) => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.75rem 1rem; color: #e5e7eb;">${item.name}</td>
                        <td style="padding: 0.75rem 1rem; text-align: right; color: #ffffff; font-weight: 600;">$${item.rate.toFixed(2)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>

            <h2 style="color: #ffffff; font-size: 1.5rem; margin: 1.5rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a; text-align: center;">Additional Items</h2>
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 2rem; background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                <thead>
                    <tr>
                        <th style="background: #333; color: white; padding: 1rem; text-align: left; font-weight: 700;">Service</th>
                        <th style="background: #333; color: white; padding: 1rem; text-align: right; font-weight: 700;">Rate</th>
                    </tr>
                </thead>
                <tbody>
                    ${ratesData.additionalItems.map((item, index) => `
                    <tr style="border-bottom: 1px solid #404040;">
                        <td style="padding: 0.75rem 1rem; color: #e5e7eb;">${item.name}</td>
                        <td style="padding: 0.75rem 1rem; text-align: right; color: #ffffff; font-weight: 600;">$${item.rate.toFixed(2)}</td>
                    </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #333 0%, #1a1a1a 100%); color: white; border-radius: 0 0 12px 12px;">
            <h3 style="margin: 0 0 1rem 0; color: #ff6b1a; font-size: 1.2rem;">Helmick Underground</h3>
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #444;">
                <p style="margin: 0.5rem 0; color: #fff;">📞 Tommy Helmick: (319) 721-9925 | Travis Helmick: (319) 551-4323</p>
                <p style="margin: 0.5rem 0; color: #fff;">📧 HelmickUnderground@gmail.com</p>
                <p style="margin: 0.5rem 0; color: #fff;">🌐 www.helmickunderground.com</p>
            </div>
            <p style="margin-top: 1.5rem; font-size: 0.85rem; color: #888;">Rates subject to change. Contact us for current pricing and free estimates.</p>
        </div>
    </div>
</body>
</html>`;

        // Use Resend API for email sending (you'll need to sign up at resend.com and add RESEND_API_KEY to Vercel env vars)
        const RESEND_API_KEY = process.env.RESEND_API_KEY;

        if (!RESEND_API_KEY) {
            // Fallback: return the HTML so the frontend can handle it
            return res.status(200).json({ 
                success: false, 
                message: 'Email service not configured. Please set RESEND_API_KEY environment variable.',
                html: emailHTML
            });
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Helmick Underground <noreply@helmickunderground.com>',
                to: recipientEmail,
                subject: 'Helmick Underground - Service Rates & Pricing',
                html: emailHTML
            })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Failed to send email');
        }

        // Log the recipient to our tracking file
        try {
            const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
            const REPO_OWNER = 'LiveDieRetryy';
            const REPO_NAME = 'HelmickUnderground';
            const FILE_PATH = 'rate-recipients.json';

            // Get current recipients file
            const getFileResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json'
                    }
                }
            );

            let recipients = [];
            let sha = null;

            if (getFileResponse.ok) {
                const fileData = await getFileResponse.json();
                sha = fileData.sha;
                const content = Buffer.from(fileData.content, 'base64').toString('utf-8');
                const parsed = JSON.parse(content);
                recipients = parsed.recipients || [];
            }

            // Add new recipient
            recipients.push({
                email: recipientEmail,
                sentAt: new Date().toISOString(),
                ratesVersion: ratesData.lastUpdated || new Date().toISOString()
            });

            // Update file in GitHub
            const updatedContent = Buffer.from(JSON.stringify({ recipients }, null, 2)).toString('base64');
            
            await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `token ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github.v3+json',
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        message: `Add rate recipient: ${recipientEmail}`,
                        content: updatedContent,
                        sha: sha
                    })
                }
            );
        } catch (logError) {
            console.error('Failed to log recipient:', logError);
            // Don't fail the whole request if logging fails
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Email sent successfully!',
            emailId: data.id 
        });

    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ 
            error: 'Failed to send email',
            details: error.message 
        });
    }
}
