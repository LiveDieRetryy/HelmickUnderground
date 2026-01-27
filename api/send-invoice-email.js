module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { to, subject, htmlContent } = req.body;

        if (!to || !subject || !htmlContent) {
            return res.status(400).json({ error: 'Missing required fields: to, subject, htmlContent' });
        }

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Helmick Underground <noreply@helmickunderground.com>',
                to: [to],
                subject: subject,
                html: htmlContent,
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Resend API error:', errorText);
            throw new Error(`Resend API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        return res.status(200).json({ 
            success: true, 
            messageId: data.id,
            message: 'Invoice email sent successfully'
        });

    } catch (error) {
        console.error('Error sending invoice email:', error);
        return res.status(500).json({ 
            error: 'Failed to send email',
            message: error.message,
            details: error.toString()
        });
    }
};
