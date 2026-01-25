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
    <style>
        body {
            margin: 0;
            padding: 0;
            font-family: 'Arial', sans-serif;
            background-color: #f4f4f4;
        }
        .email-container {
            max-width: 600px;
            margin: 0 auto;
            background-color: #ffffff;
        }
        .header {
            background: #ffffff;
            padding: 40px 30px;
            text-align: center;
            border-bottom: 3px solid #ff6b1a;
        }
        .logo {
            max-width: 250px;
            height: auto;
            margin-bottom: 15px;
        }
        .logo-text {
            color: #ff6b1a;
            font-size: 32px;
            font-weight: 900;
            margin: 0;
        }
        .content {
            padding: 40px 30px;
            color: #333333;
            line-height: 1.8;
        }
        .greeting {
            font-size: 24px;
            font-weight: 700;
            color: #ff6b1a;
            margin: 0 0 20px 0;
        }
        .message {
            font-size: 16px;
            margin-bottom: 25px;
        }
        .emergency-note {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 25px 0;
            border-radius: 4px;
            font-size: 14px;
        }
        .emergency-note strong {
            color: #856404;
        }
        .footer {
            background-color: #1a1a1a;
            color: #999999;
            padding: 30px;
            text-align: center;
            font-size: 14px;
        }
        .footer-text {
            margin: 5px 0;
        }
        .footer-brand {
            color: #ff6b1a;
            font-weight: 700;
            font-size: 18px;
            margin-bottom: 10px;
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" class="logo">
            <h1 class="logo-text">HELMICK UNDERGROUND</h1>
        </div>
        
        <div class="content">
            <p class="greeting">Hello ${name},</p>
            
            <p class="message">
                Thank you for contacting Helmick Underground. We have received your request for ${servicesText} and appreciate your interest in our services.
            </p>
            
            <p class="message">
                Our team is currently reviewing your submission and will be in contact with you within the next 2-3 business days to discuss your project requirements and provide you with a detailed quote.
            </p>
            
            <div class="emergency-note">
                <strong>⚠️ Need Immediate Assistance?</strong><br>
                If your situation requires urgent attention or you have an emergency, please don't hesitate to call us directly at <a href="tel:319-721-9925" style="color: #856404; font-weight: 700;">319-721-9925</a>. We're here to help!
            </div>
            
            <p class="message">
                We look forward to working with you and providing the quality underground utility services that Helmick Underground is known for.
            </p>
            
            <p class="message" style="margin-top: 30px;">
                Best regards,<br>
                <strong style="color: #ff6b1a;">The Helmick Underground Team</strong>
            </p>
        </div>
        
        <div class="footer">
            <div class="footer-brand">HELMICK UNDERGROUND</div>
            <p class="footer-text">Professional Underground Utility Services</p>
            <p class="footer-text">Trenching • Directional Drilling • Excavating • Utility Locating</p>
            <p class="footer-text" style="margin-top: 15px; font-size: 12px;">
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
