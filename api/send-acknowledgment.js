module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { name, email, services } = req.body;

        if (!name || !email) {
            return res.status(400).json({ error: 'Name and email are required' });
        }

        const servicesText = services && services.length > 0 
            ? services.join(', ') 
            : 'your requested services';

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #0a0a0a;">
    <div style="max-width: 650px; margin: 0 auto; background-color: #1a1a1a; color: #e5e7eb;">
        <!-- Header with Logo -->
        <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 2.5rem 2rem; text-align: center; border-radius: 12px 12px 0 0;">
            <div style="background: #000; display: inline-block; padding: 1.5rem 2rem; border-radius: 8px; margin-bottom: 1rem;">
                <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="max-width: 250px; height: auto;">
            </div>
            <h1 style="color: white; margin: 1rem 0 0 0; font-size: 1.8rem; font-weight: 700;">QUOTE REQUEST RECEIVED</h1>
        </div>
        
        <div style="padding: 2rem; background: #1a1a1a;">
            <p style="font-size: 1.5rem; font-weight: 700; color: #ff6b1a; margin: 0 0 1.5rem 0;">Hello ${name},</p>
            
            <p style="font-size: 1rem; margin-bottom: 1.5rem; line-height: 1.8; color: #e5e7eb;">
                Thank you for contacting Helmick Underground. We have received your request for ${servicesText} and appreciate your interest in our services.
            </p>
            
            <p style="font-size: 1rem; margin-bottom: 1.5rem; line-height: 1.8; color: #e5e7eb;">
                Our team is currently reviewing your submission and will be in contact with you within the next 2-3 business days to discuss your project requirements and provide you with a detailed quote.
            </p>
            
            <div style="background: #2a2a2a; border-left: 4px solid #ffc107; padding: 1.5rem; margin: 1.5rem 0; border-radius: 8px;">
                <strong style="color: #ffc107; font-size: 1rem;">⚠️ Need Immediate Assistance?</strong><br>
                <p style="margin: 0.5rem 0 0 0; color: #e5e7eb; line-height: 1.6;">
                    If your situation requires urgent attention or you have an emergency, please don't hesitate to call us directly at <a href="tel:319-721-9925" style="color: #ff6b1a; font-weight: 700; text-decoration: none;">319-721-9925</a>. We're here to help!
                </p>
            </div>
            
            <p style="font-size: 1rem; margin-bottom: 1.5rem; line-height: 1.8; color: #e5e7eb;">
                We look forward to working with you and providing the quality underground utility services that Helmick Underground is known for.
            </p>
            
            <p style="font-size: 1rem; margin-top: 2rem; line-height: 1.8; color: #e5e7eb;">
                Best regards,<br>
                <strong style="color: #ff6b1a;">The Helmick Underground Team</strong>
            </p>
        </div>
        
        <div style="background: linear-gradient(135deg, #333 0%, #1a1a1a 100%); color: white; padding: 2rem; text-align: center; border-radius: 0 0 12px 12px;">
            <h3 style="margin: 0 0 1rem 0; color: #ff6b1a; font-size: 1.2rem;">Helmick Underground</h3>
            <p style="margin: 0.5rem 0; color: #ccc; font-size: 0.95rem;">Professional Underground Utility Services</p>
            <p style="margin: 0.5rem 0; color: #ccc; font-size: 0.9rem;">Trenching • Directional Drilling • Excavating • Utility Locating</p>
            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #444;">
                <p style="margin: 0.5rem 0; color: #fff;">📞 Tommy Helmick: (319) 721-9925</p>
                <p style="margin: 0.5rem 0; color: #fff;">📧 HelmickUnderground@gmail.com</p>
                <p style="margin: 0.5rem 0; color: #fff;">🌐 www.helmickunderground.com</p>
            </div>
            <p style="margin-top: 1.5rem; font-size: 0.75rem; color: #888;">
                This is an automated acknowledgment email. Please do not reply to this message.
            </p>
        </div>
    </div>
</body>
</html>
`;

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'Helmick Underground <noreply@helmickunderground.com>',
                to: [email],
                subject: 'Quote Request Received - Helmick Underground',
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
            message: 'Acknowledgment email sent successfully'
        });

    } catch (error) {
        console.error('Error sending acknowledgment email:', error);
        return res.status(500).json({ 
            error: 'Failed to send email',
            message: error.message,
            details: error.toString()
        });
    }
};
