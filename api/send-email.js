const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
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
        const { emailType, ...emailData } = req.body;

        if (!emailType) {
            return res.status(400).json({ error: 'emailType is required' });
        }

        let emailConfig;

        // Route to appropriate email handler
        switch (emailType) {
            case 'acknowledgment':
                emailConfig = await buildAcknowledgment(emailData);
                break;
            case 'quote':
                emailConfig = await buildQuote(emailData);
                break;
            case 'rates':
                emailConfig = await buildRates(emailData);
                break;
            case 'custom':
                emailConfig = buildCustom(emailData);
                break;
            default:
                return res.status(400).json({ error: 'Invalid emailType' });
        }

        if (!emailConfig) {
            return res.status(400).json({ error: 'Failed to build email' });
        }

        // Send email via Resend
        const { data, error } = await resend.emails.send(emailConfig);

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
                    emailType: emailType,
                    recipientEmail: emailConfig.to[0],
                    recipientName: emailData.name || emailData.customerName || emailConfig.to[0],
                    subject: emailConfig.subject,
                    metadata: emailData.metadata || {}
                })
            });
        } catch (logError) {
            console.warn('Failed to log email to history:', logError);
        }

        res.status(200).json({ 
            success: true, 
            messageId: data.id,
            message: 'Email sent successfully' 
        });

    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ 
            error: 'Failed to send email',
            details: error.message 
        });
    }
};

// Email builders
async function buildAcknowledgment({ name, email, services }) {
    if (!name || !email) {
        throw new Error('Name and email are required for acknowledgment');
    }

    const servicesText = services && services.length > 0 
        ? services.join(', ') 
        : 'your requested services';

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #0a0a0a;">
    <div style="max-width: 650px; margin: 0 auto; background-color: #1a1a1a; color: #e5e7eb;">
        <div style="background: #1a1a1a; padding: 2rem 2rem 1rem 2rem; text-align: center; border-radius: 12px 12px 0 0;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground Logo" style="max-width: 250px; height: auto; margin-bottom: 1.5rem;">
        </div>
        <div style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); padding: 1.5rem 2rem; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 1.8rem; font-weight: 700;">CONTACT REQUEST RECEIVED</h1>
        </div>
        <div style="padding: 2rem; background: #1a1a1a;">
            <p style="font-size: 1.5rem; font-weight: 700; color: #ff6b1a; margin: 0 0 1.5rem 0;">Hello ${name},</p>
            <p style="font-size: 1rem; margin-bottom: 1.5rem; line-height: 1.8; color: #e5e7eb;">
                Thank you for contacting Helmick Underground. We have received your request for ${servicesText} and appreciate your interest in our services.
            </p>
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); border-left: 4px solid #ff6b1a; padding: 1.5rem; border-radius: 8px; margin: 2rem 0;">
                <h2 style="color: #ff6b1a; margin: 0 0 1rem 0; font-size: 1.3rem;">What Happens Next?</h2>
                <p style="font-size: 1rem; line-height: 1.8; color: #e5e7eb; margin: 0;">Our team will review your request and get back to you within <strong style="color: #ff6b1a;">24-48 business hours</strong>. We look forward to discussing how we can help with your project!</p>
            </div>
            <div style="text-align: center; margin: 2rem 0 1rem 0;">
                <p style="font-size: 1rem; color: #b0b0b0; margin-bottom: 1rem;">Best Regards,</p>
                <p style="font-size: 1.2rem; font-weight: 700; color: #ff6b1a; margin: 0;">The Helmick Underground Team</p>
            </div>
        </div>
        <div style="background: #0f0f0f; padding: 2rem; text-align: center; border-radius: 0 0 12px 12px;">
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Questions? Contact us:</p>
            <p style="color: #ff6b1a; font-size: 1rem; font-weight: 600; margin: 0.5rem 0;">📞 (712) 330-6073 | (712) 330-2060</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1.5rem;">© ${new Date().getFullYear()} Helmick Underground LLC. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return {
        from: 'Helmick Underground <noreply@helmickunderground.com>',
        to: [email],
        subject: 'We Received Your Contact Request - Helmick Underground',
        html
    };
}

async function buildQuote({ to, customerName, quoteData }) {
    if (!to || !customerName || !quoteData) {
        throw new Error('Missing required fields for quote');
    }

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const subtotal = quoteData.subtotal;
    const tax = quoteData.tax || 0;
    const total = quoteData.total || subtotal;

    const lineItemsHTML = quoteData.lineItems.map(item => `
        <tr style="border-bottom: 1px solid #404040;">
            <td style="padding: 1rem 0.75rem;">
                <strong style="color: #e5e7eb;">${item.name}</strong>
                ${item.description ? `<br><span style="color: #b0b0b0; font-size: 0.9rem;">${item.description}</span>` : ''}
            </td>
            <td style="padding: 1rem 0.75rem; text-align: center; color: #b0b0b0;">${item.quantity}</td>
            <td style="padding: 1rem 0.75rem; text-align: right; color: #b0b0b0;">$${item.rate.toFixed(2)}</td>
            <td style="padding: 1rem 0.75rem; text-align: right; color: #ffffff; font-weight: 600;">$${(item.quantity * item.rate).toFixed(2)}</td>
        </tr>
    `).join('');

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
    <div style="max-width: 800px; margin: 0 auto; background: #1a1a1a; border-radius: 12px;">
        <div style="text-align: center; padding: 2rem 2rem 1rem 2rem; background: #1a1a1a; border-radius: 12px 12px 0 0;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground LLC" style="max-width: 300px; margin-bottom: 1.5rem;">
        </div>
        <div style="text-align: center; padding: 1.5rem 2rem; background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);">
            <strong style="display: block; font-size: 1.8rem; color: white; margin-bottom: 0.5rem; font-weight: 700;">PROJECT QUOTE</strong>
            <div style="color: rgba(255,255,255,0.9); font-size: 1rem;">${today}</div>
        </div>
        <div style="padding: 2rem;">
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); padding: 1.5rem; border-radius: 8px; margin-bottom: 2rem; border-left: 4px solid #ff6b1a;">
                <p style="color: #e5e7eb; margin: 0; line-height: 1.8; font-size: 1rem;">Dear <strong style="color: #ff6b1a;">${customerName}</strong>,</p>
                <p style="color: #e5e7eb; margin: 1rem 0 0 0; line-height: 1.8; font-size: 1rem;">Thank you for your interest in Helmick Underground. Below is your customized project quote.</p>
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #0f0f0f; border-radius: 8px; overflow: hidden; margin-bottom: 1.5rem;">
                <thead>
                    <tr style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); border-bottom: 2px solid #ff6b1a;">
                        <th style="padding: 1rem 0.75rem; text-align: left; color: #ffffff; font-weight: 700;">Service Description</th>
                        <th style="padding: 1rem 0.75rem; text-align: center; color: #ffffff; font-weight: 700;">Qty</th>
                        <th style="padding: 1rem 0.75rem; text-align: right; color: #ffffff; font-weight: 700;">Rate</th>
                        <th style="padding: 1rem 0.75rem; text-align: right; color: #ffffff; font-weight: 700;">Amount</th>
                    </tr>
                </thead>
                <tbody>${lineItemsHTML}</tbody>
                <tfoot>
                    <tr style="border-top: 2px solid #404040;">
                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; color: #b0b0b0; font-weight: 600;">Subtotal:</td>
                        <td style="padding: 1rem 0.75rem; text-align: right; color: #ffffff; font-weight: 700;">$${subtotal.toFixed(2)}</td>
                    </tr>
                    ${tax > 0 ? `<tr><td colspan="3" style="padding: 0.5rem 0.75rem; text-align: right; color: #b0b0b0;">Tax:</td><td style="padding: 0.5rem 0.75rem; text-align: right; color: #ffffff;">$${tax.toFixed(2)}</td></tr>` : ''}
                    <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);">
                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; color: white; font-weight: 700; font-size: 1.1rem;">Total:</td>
                        <td style="padding: 1rem 0.75rem; text-align: right; color: white; font-weight: 700; font-size: 1.1rem;">$${total.toFixed(2)}</td>
                    </tr>
                </tfoot>
            </table>
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); border-left: 4px solid #ff6b1a; padding: 1.5rem; border-radius: 8px; margin: 2rem 0;">
                <p style="color: #e5e7eb; margin: 0; line-height: 1.8;">This quote is valid for 30 days. Please contact us to schedule your project or if you have any questions.</p>
            </div>
        </div>
        <div style="background: #0f0f0f; padding: 2rem; text-align: center; border-radius: 0 0 12px 12px;">
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Questions? Contact us:</p>
            <p style="color: #ff6b1a; font-size: 1rem; font-weight: 600; margin: 0.5rem 0;">📞 (712) 330-6073 | (712) 330-2060</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1.5rem;">© ${new Date().getFullYear()} Helmick Underground LLC. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return {
        from: 'Helmick Underground <noreply@helmickunderground.com>',
        to: [to],
        subject: `Your Project Quote from Helmick Underground - ${today}`,
        html
    };
}

async function buildRates({ recipientEmail, ratesData }) {
    if (!recipientEmail || !ratesData) {
        throw new Error('Missing required fields for rates email');
    }

    const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: Arial, sans-serif; background-color: #0a0a0a;">
    <div style="max-width: 800px; margin: 0 auto; background: #1a1a1a; border-radius: 12px;">
        <div style="text-align: center; padding: 2rem 2rem 1rem 2rem; background: #1a1a1a; border-radius: 12px 12px 0 0;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground LLC" style="max-width: 300px; margin-bottom: 1.5rem;">
        </div>
        <div style="text-align: center; padding: 1.5rem 2rem; background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);">
            <strong style="display: block; font-size: 1.5rem; color: white; margin-bottom: 0.5rem; font-weight: 700;">SERVICE RATES & PRICING</strong>
            <div style="color: rgba(255,255,255,0.9); font-size: 1rem;">Effective: ${today}</div>
        </div>
        <div style="padding: 2rem;">
            <h2 style="color: #ffffff; font-size: 1.5rem; margin: 1.5rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a; text-align: center;">Base Rates</h2>
            ${Object.entries(ratesData.baseRates || {}).map(([key, value]) => `
                <div style="background: #0f0f0f; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                    <strong style="color: #e5e7eb; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
                    <span style="color: #ff6b1a; font-weight: 700; float: right;">$${value.toFixed(2)}</span>
                </div>
            `).join('')}
            ${ratesData.equipmentRates ? `
                <h2 style="color: #ffffff; font-size: 1.5rem; margin: 2rem 0 1rem 0; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a; text-align: center;">Equipment Rates</h2>
                ${Object.entries(ratesData.equipmentRates).map(([key, value]) => `
                    <div style="background: #0f0f0f; padding: 1rem; margin-bottom: 1rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
                        <strong style="color: #e5e7eb; text-transform: capitalize;">${key.replace(/([A-Z])/g, ' $1').trim()}:</strong>
                        <span style="color: #ff6b1a; font-weight: 700; float: right;">$${value.toFixed(2)}</span>
                    </div>
                `).join('')}
            ` : ''}
            <div style="background: linear-gradient(135deg, #2d2d2d 0%, #1f1f1f 100%); border-left: 4px solid #ff6b1a; padding: 1.5rem; border-radius: 8px; margin-top: 2rem;">
                <p style="color: #e5e7eb; margin: 0; line-height: 1.8; font-size: 0.9rem;">Rates are subject to change. Contact us for custom quotes and project-specific pricing.</p>
            </div>
        </div>
        <div style="background: #0f0f0f; padding: 2rem; text-align: center; border-radius: 0 0 12px 12px;">
            <p style="color: #6b7280; font-size: 0.9rem; margin-bottom: 1rem;">Questions? Contact us:</p>
            <p style="color: #ff6b1a; font-size: 1rem; font-weight: 600; margin: 0.5rem 0;">📞 (712) 330-6073 | (712) 330-2060</p>
            <p style="color: #6b7280; font-size: 0.85rem; margin-top: 1.5rem;">© ${new Date().getFullYear()} Helmick Underground LLC. All rights reserved.</p>
        </div>
    </div>
</body>
</html>`;

    return {
        from: 'Helmick Underground <noreply@helmickunderground.com>',
        to: [recipientEmail],
        subject: `Helmick Underground - Service Rates (${today})`,
        html
    };
}

function buildCustom({ to, subject, html, name, metadata }) {
    if (!to || !subject || !html) {
        throw new Error('Missing required fields: to, subject, html');
    }

    return {
        from: 'Helmick Underground <noreply@helmickunderground.com>',
        to: [to],
        subject,
        html
    };
}
