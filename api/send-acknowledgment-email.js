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
        const { recipientEmail, recipientName, services } = req.body;

        if (!recipientEmail || !recipientName) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const servicesText = services && services.length > 0 
            ? services.join(', ') 
            : 'your requested services';

        // Build HTML email
        const emailHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 700px; margin: 0 auto; background: white;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 40px 30px; text-align: center;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground LLC" style="max-width: 250px; margin-bottom: 15px;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                Quote Request Received
            </h1>
        </div>

        <!-- Content -->
        <div style="padding: 40px 30px;">
            <p style="color: #333; font-size: 18px; line-height: 1.6; margin: 0 0 20px 0;">
                Hello ${recipientName},
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                Thank you for contacting <strong style="color: #ff6b1a;">Helmick Underground LLC</strong>. We have received your quote request for <strong>${servicesText}</strong> and are currently reviewing the details.
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                Our team will carefully evaluate your project requirements and reach out to you within the next <strong>2-3 business days</strong> with a detailed quote and to discuss your specific needs.
            </p>

            <!-- Emergency Contact Box -->
            <div style="background: linear-gradient(135deg, rgba(255, 107, 26, 0.1) 0%, rgba(255, 140, 66, 0.1) 100%); border-left: 4px solid #ff6b1a; padding: 20px; margin: 30px 0; border-radius: 8px;">
                <h3 style="color: #ff6b1a; margin: 0 0 15px 0; font-size: 18px;">
                    🚨 Need Immediate Assistance?
                </h3>
                <p style="color: #555; font-size: 15px; line-height: 1.6; margin: 0 0 10px 0;">
                    If you have an emergency situation that requires immediate attention, please don't hesitate to contact us directly:
                </p>
                <div style="color: #333; font-size: 16px; line-height: 1.8;">
                    <div style="margin: 8px 0;">
                        <strong style="color: #ff6b1a;">📞 Phone:</strong> <a href="tel:319-551-4323" style="color: #333; text-decoration: none;">319-551-4323</a>
                    </div>
                    <div style="margin: 8px 0;">
                        <strong style="color: #ff6b1a;">📧 Email:</strong> <a href="mailto:HelmickUnderground@gmail.com" style="color: #333; text-decoration: none;">HelmickUnderground@gmail.com</a>
                    </div>
                </div>
            </div>

            <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 30px 0 20px 0;">
                We appreciate your interest in our services and look forward to working with you.
            </p>

            <p style="color: #555; font-size: 16px; line-height: 1.8; margin: 0;">
                Best regards,<br>
                <strong style="color: #ff6b1a;">Helmick Underground LLC</strong><br>
                <span style="color: #888; font-size: 14px;">Mount Vernon, Iowa</span>
            </p>
        </div>

        <!-- Footer -->
        <div style="background: #f9f9f9; padding: 25px 30px; border-top: 3px solid #ff6b1a; text-align: center;">
            <div style="color: #666; font-size: 14px; line-height: 1.6; margin-bottom: 15px;">
                <strong style="color: #333; display: block; margin-bottom: 8px;">Helmick Underground LLC</strong>
                Mount Vernon, Iowa<br>
                Phone: 319-551-4323<br>
                Email: HelmickUnderground@gmail.com
            </div>
            <div style="color: #999; font-size: 13px; margin-top: 15px; padding-top: 15px; border-top: 1px solid #ddd;">
                <strong>Services:</strong> Trenching, Directional Drilling, Fiber Blowing, Line Pulling, Plowing, 
                Excavating, Concrete Work, Utility Locating, Skid Loader Operations
            </div>
            <div style="color: #999; font-size: 12px; margin-top: 15px; font-style: italic;">
                This is an automated message. Please do not reply to this email.
            </div>
        </div>
    </div>
</body>
</html>
        `;

        // Plain text version
        const emailText = `
Hello ${recipientName},

Thank you for contacting Helmick Underground LLC. We have received your quote request for ${servicesText} and are currently reviewing the details.

Our team will carefully evaluate your project requirements and reach out to you within the next 2-3 business days with a detailed quote and to discuss your specific needs.

NEED IMMEDIATE ASSISTANCE?
If you have an emergency situation that requires immediate attention, please don't hesitate to contact us directly:

Phone: 319-551-4323
Email: HelmickUnderground@gmail.com

We appreciate your interest in our services and look forward to working with you.

Best regards,
Helmick Underground LLC
Mount Vernon, Iowa

---
This is an automated message. Please do not reply to this email.
        `;

        // Import Resend
        const { Resend } = await import('resend');
        const resend = new Resend(process.env.RESEND_API_KEY);

        // Send email using Resend
        const { data, error } = await resend.emails.send({
            from: 'Helmick Underground LLC <noreply@helmickunderground.com>',
            to: recipientEmail,
            subject: 'Quote Request Received - Helmick Underground LLC',
            html: emailHTML,
            text: emailText,
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(400).json({ error: error.message });
        }

        return res.status(200).json({ 
            success: true, 
            message: 'Acknowledgment email sent successfully',
            messageId: data.id 
        });

    } catch (error) {
        console.error('Email error:', error);
        return res.status(500).json({ 
            error: 'Failed to send email', 
            message: error.message 
        });
    }
}
