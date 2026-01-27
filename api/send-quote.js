const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', 'true');
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
        const { to, customerName, quoteData } = req.body;

        if (!to || !customerName || !quoteData) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const today = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
        const subtotal = quoteData.subtotal;
        const tax = quoteData.tax || 0;
        const total = quoteData.total || subtotal;
        const iowaWork = quoteData.iowaWork || false;

        // Build line items HTML
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

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #0a0a0a;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 2rem 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: #1a1a1a; border-radius: 20px; overflow: hidden;">
                    <!-- Header -->
                    <tr>
                        <td style="text-align: center; padding: 2rem 2rem 1rem 2rem; background: #1a1a1a; border-radius: 12px 12px 0 0;">
                            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground" style="max-width: 200px; margin-bottom: 1.5rem;">
                        </td>
                    </tr>
                    <tr>
                        <td style="text-align: center; padding: 1.5rem 2rem; background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%);">
                            <h1 style="color: white; font-size: 1.8rem; margin: 0; font-weight: 700;">PROJECT QUOTE</h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 0.5rem 0 0 0; font-size: 0.95rem;">Date: ${today}</p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 2rem; background: #1a1a1a;">
                            <p style="color: #ffffff; font-size: 1.1rem; line-height: 1.6; margin: 0; font-weight: 600;">
                                Dear ${customerName},
                            </p>
                            <p style="color: #b0b0b0; line-height: 1.6; margin: 1rem 0 2rem 0;">
                                Thank you for considering Helmick Underground for your project. We're pleased to provide you with the following quote:
                            </p>
                        </td>
                    </tr>

                    <!-- Quote Details -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem; background: #1a1a1a;">
                            <h2 style="color: #ffffff; font-size: 1.3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a;">Quote Details</h2>
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; background: #2a2a2a; border-radius: 8px; overflow: hidden;">
                                <thead>
                                    <tr style="background: #333;">
                                        <th style="padding: 0.75rem; text-align: left; color: white; font-weight: 700;">Item</th>
                                        <th style="padding: 0.75rem; text-align: center; color: white; font-weight: 700;">Qty</th>
                                        <th style="padding: 0.75rem; text-align: right; color: white; font-weight: 700;">Rate</th>
                                        <th style="padding: 0.75rem; text-align: right; color: white; font-weight: 700;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${lineItemsHTML}
                                </tbody>
                                <tfoot>
                                    <tr style="border-top: 2px solid #ff6b1a;">
                                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #b0b0b0;">Subtotal:</td>
                                        <td style="padding: 1rem 0.75rem; text-align: right; color: #ffffff; font-weight: 600;">$${subtotal.toFixed(2)}</td>
                                    </tr>
                                    ${iowaWork && tax > 0 ? `
                                    <tr>
                                        <td colspan="3" style="padding: 1rem 0.75rem; text-align: right; font-weight: 600; color: #b0b0b0;">Tax (7% - Iowa):</td>
                                        <td style="padding: 1rem 0.75rem; text-align: right; color: #ff6b1a; font-weight: 600;">$${tax.toFixed(2)}</td>
                                    </tr>
                                    ` : ''}
                                    <tr style="background: linear-gradient(135deg, #ff6b1a 0%, #ff8c42 100%); font-size: 1.3rem; font-weight: 700;">
                                        <td colspan="3" style="padding: 1.25rem 0.75rem; text-align: right; color: white;">Total:</td>
                                        <td style="padding: 1.25rem 0.75rem; text-align: right; color: white;">$${total.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </td>
                    </tr>

                    ${quoteData.notes ? `
                    <!-- Notes -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem; background: #1a1a1a;">
                            <div style="background: #2a2a2a; padding: 1.5rem; border-radius: 12px; border-left: 4px solid #22c55e;">
                                <h3 style="color: #ffffff; font-size: 1.1rem; margin: 0 0 0.75rem 0;">Additional Notes</h3>
                                <div style="color: #e5e7eb; white-space: pre-wrap; line-height: 1.6;">${quoteData.notes}</div>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Closing -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem; background: #1a1a1a;">
                            <p style="color: #e5e7eb; line-height: 1.6; margin: 1rem 0;">
                                If you have any questions about this quote or would like to proceed with the project, please don't hesitate to contact us.
                            </p>
                            <p style="color: #e5e7eb; line-height: 1.6; margin: 1rem 0 0 0;">
                                We look forward to working with you!
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="text-align: center; padding: 2rem; background: linear-gradient(135deg, #333 0%, #1a1a1a 100%); color: white; border-radius: 0 0 12px 12px;">
                            <h3 style="margin: 0 0 1rem 0; color: #ff6b1a; font-size: 1.2rem;">Helmick Underground</h3>
                            <p style="margin: 0.5rem 0; color: #ccc; font-size: 0.95rem;">Quality Underground Utility Services Since 1988</p>
                            <div style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 2px solid #444;">
                                <p style="margin: 0.5rem 0; color: #fff;">📞 Tommy Helmick: (319) 721-9925</p>
                                <p style="margin: 0.5rem 0; color: #fff;">📧 HelmickUnderground@gmail.com</p>
                                <p style="margin: 0.5rem 0; color: #fff;">🌐 www.helmickunderground.com</p>
                            </div>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
        `;

        const { data, error } = await resend.emails.send({
            from: 'Helmick Underground <noreply@helmickunderground.com>',
            to: [to],
            subject: `Project Quote from Helmick Underground - ${today}`,
            html: htmlContent
        });

        if (error) {
            console.error('Resend error:', error);
            return res.status(400).json({ error: error.message || 'Failed to send email', details: error });
        }

        // Log to email history
        try {
            await fetch(`${req.headers.origin || 'https://helmickunderground.com'}/api/email-history`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type: 'quote',
                    email: to,
                    name: customerName,
                    subject: `Project Quote from Helmick Underground - ${today}`,
                    metadata: { subtotal, tax, total, itemCount: quoteData.lineItems?.length }
                })
            });
        } catch (logError) {
            console.error('Failed to log email history:', logError);
        }

        console.log('Email sent successfully:', data);
        res.status(200).json({ success: true, messageId: data.id });

    } catch (error) {
        console.error('Error sending quote:', error);
        res.status(500).json({ 
            error: 'Failed to send quote email', 
            message: error.message,
            details: error.toString()
        });
    }
}
