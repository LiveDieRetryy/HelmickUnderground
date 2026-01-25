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
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 800px; margin: 0 auto; background: white; padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px solid #ff6b1a;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground LLC" style="max-width: 300px; margin-bottom: 20px;">
            <div style="color: #666; font-size: 16px;">
                <strong style="display: block; font-size: 20px; color: #333; margin-bottom: 8px;">Service Rates & Pricing</strong>
                Mount Vernon, Iowa<br>
                Effective: ${today}
            </div>
        </div>

        <h2 style="color: #333; font-size: 24px; margin: 25px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ff6b1a; text-align: center;">Base Rates</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
                <tr>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: left; font-weight: 700;">Service</th>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: right; font-weight: 700;">Rate</th>
                </tr>
            </thead>
            <tbody>
                ${ratesData.baseRates.map((item, index) => `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">$${item.rate.toFixed(2)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <h2 style="color: #333; font-size: 24px; margin: 25px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ff6b1a; text-align: center;">Custom Work Per Hour</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
                <tr>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: left; font-weight: 700;">Service</th>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: right; font-weight: 700;">Rate</th>
                </tr>
            </thead>
            <tbody>
                ${ratesData.customWork.map((item, index) => `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">$${item.rate.toFixed(2)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <h2 style="color: #333; font-size: 24px; margin: 25px 0 15px 0; padding-bottom: 8px; border-bottom: 2px solid #ff6b1a; text-align: center;">Additional Items</h2>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
            <thead>
                <tr>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: left; font-weight: 700;">Service</th>
                    <th style="background: #ff6b1a; color: white; padding: 12px; text-align: right; font-weight: 700;">Rate</th>
                </tr>
            </thead>
            <tbody>
                ${ratesData.additionalItems.map((item, index) => `
                <tr style="background: ${index % 2 === 0 ? '#ffffff' : '#f9f9f9'};">
                    <td style="padding: 10px; border-bottom: 1px solid #ddd;">${item.name}</td>
                    <td style="padding: 10px; text-align: right; border-bottom: 1px solid #ddd;">$${item.rate.toFixed(2)}</td>
                </tr>
                `).join('')}
            </tbody>
        </table>

        <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #ddd; text-align: center; color: #666; font-size: 15px;">
            <p style="margin: 8px 0;"><strong>Contact Information</strong></p>
            <p style="margin: 8px 0;">Tommy Helmick: 319-721-9925 | Travis Helmick: 319-551-4323</p>
            <p style="margin: 8px 0;">Email: HelmickUnderground@gmail.com | www.helmickunderground.com</p>
            <p style="margin-top: 15px; font-size: 14px;">Rates subject to change. Contact us for current pricing and free estimates.</p>
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
