import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
        const { type, to, subject, html, name, metadata } = req.body;

        if (!to || !subject || !html || !type) {
            return res.status(400).json({ error: 'Missing required fields: type, to, subject, html' });
        }

        // Send email via Resend
        const { data, error } = await resend.emails.send({
            from: 'Helmick Underground <noreply@helmickunderground.com>',
            to: [to],
            subject: subject,
            html: html,
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(400).json({ error: error.message });
        }

        // Log to email history
        try {
            await fetch(`${req.headers.origin || 'https://helmickunderground.com'}/api/email-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'log',
                    emailType: type,
                    recipientEmail: to,
                    recipientName: name || to,
                    subject: subject,
                    metadata: metadata || {}
                })
            });
        } catch (logError) {
            console.error('Failed to log email:', logError);
            // Don't fail the email send if logging fails
        }

        return res.status(200).json({ 
            success: true, 
            messageId: data.id,
            message: 'Email sent successfully'
        });

    } catch (error) {
        console.error('Error sending email:', error);
        return res.status(500).json({ error: 'Failed to send email' });
    }
}
