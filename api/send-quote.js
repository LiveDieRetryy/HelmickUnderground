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

        // Build line items HTML
        const lineItemsHTML = quoteData.lineItems.map(item => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 1rem 0.75rem;">
                    <strong style="color: #333;">${item.name}</strong>
                    ${item.description ? `<br><span style="color: #666; font-size: 0.9rem;">${item.description}</span>` : ''}
                </td>
                <td style="padding: 1rem 0.75rem; text-align: center; color: #666;">${item.quantity}</td>
                <td style="padding: 1rem 0.75rem; text-align: right; color: #666;">$${item.rate.toFixed(2)}</td>
                <td style="padding: 1rem 0.75rem; text-align: right; color: #333; font-weight: 600;">$${(item.quantity * item.rate).toFixed(2)}</td>
            </tr>
        `).join('');

        const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', sans-serif; background-color: #f5f5f5;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 2rem 0;">
        <tr>
            <td align="center">
                <table width="600" cellpadding="0" cellspacing="0" style="background-color: white; border-radius: 20px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="text-align: center; padding: 3rem 2rem 2rem 2rem;">
                            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground" style="max-width: 200px; margin-bottom: 1rem;">
                            <h1 style="color: #ff6b1a; font-size: 2rem; margin: 0;">Project Quote</h1>
                            <p style="color: #666; margin: 0.5rem 0 0 0;">Date: ${today}</p>
                        </td>
                    </tr>

                    <!-- Greeting -->
                    <tr>
                        <td style="padding: 0 2rem;">
                            <p style="color: #333; font-size: 1.1rem; line-height: 1.6; margin: 0;">
                                Dear ${customerName},
                            </p>
                            <p style="color: #666; line-height: 1.6; margin: 1rem 0 2rem 0;">
                                Thank you for considering Helmick Underground for your project. We're pleased to provide you with the following quote:
                            </p>
                        </td>
                    </tr>

                    <!-- Quote Details -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem;">
                            <h2 style="color: #333; font-size: 1.3rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #ff6b1a;">Quote Details</h2>
                            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                                <thead>
                                    <tr style="background: #f0f0f0;">
                                        <th style="padding: 0.75rem; text-align: left; color: #333; border-bottom: 2px solid #ddd;">Item</th>
                                        <th style="padding: 0.75rem; text-align: center; color: #333; border-bottom: 2px solid #ddd;">Qty</th>
                                        <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ddd;">Rate</th>
                                        <th style="padding: 0.75rem; text-align: right; color: #333; border-bottom: 2px solid #ddd;">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${lineItemsHTML}
                                </tbody>
                                <tfoot>
                                    <tr style="background: #fff3e6; font-size: 1.3rem; font-weight: 700;">
                                        <td colspan="3" style="padding: 1.25rem 0.75rem; text-align: right; color: #333; border-top: 3px solid #ff6b1a;">Total:</td>
                                        <td style="padding: 1.25rem 0.75rem; text-align: right; color: #ff6b1a; border-top: 3px solid #ff6b1a;">$${subtotal.toFixed(2)}</td>
                                    </tr>
                                </tfoot>
                            </table>
                        </td>
                    </tr>

                    ${quoteData.notes ? `
                    <!-- Notes -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem;">
                            <div style="background: #f9f9f9; padding: 1.5rem; border-radius: 12px; border-left: 4px solid #ff6b1a;">
                                <h3 style="color: #333; font-size: 1.1rem; margin: 0 0 0.75rem 0;">Additional Notes</h3>
                                <div style="color: #666; white-space: pre-wrap; line-height: 1.6;">${quoteData.notes}</div>
                            </div>
                        </td>
                    </tr>
                    ` : ''}

                    <!-- Closing -->
                    <tr>
                        <td style="padding: 0 2rem 2rem 2rem;">
                            <p style="color: #666; line-height: 1.6; margin: 1rem 0;">
                                If you have any questions about this quote or would like to proceed with the project, please don't hesitate to contact us.
                            </p>
                            <p style="color: #666; line-height: 1.6; margin: 1rem 0 0 0;">
                                We look forward to working with you!
                            </p>
                        </td>
                    </tr>

                    <!-- Footer -->
                    <tr>
                        <td style="text-align: center; padding: 2rem; background: #f9f9f9; border-top: 2px solid #eee;">
                            <p style="color: #666; margin: 0; font-size: 0.9rem;">Helmick Underground</p>
                            <p style="color: #999; margin: 0.5rem 0 0 0; font-size: 0.85rem;">Quality Underground Utility Services</p>
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

        console.log('Email sent successfully:', data);
        res.status(200).json({ success: true, messageId: data.id });

    } catch (error) {
        console.error('Error sending quote:', error);
        res.status(500).json({ error: 'Failed to send quote email' });
    }
}
