const { Resend } = require('resend');
const nodemailer = require('nodemailer');
const { sql } = require('@vercel/postgres');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');

const resend = new Resend(process.env.RESEND_API_KEY);

// Create Gmail transporter for marketing emails
function createGmailTransporter() {
    if (!process.env.GMAIL_USER || !process.env.GMAIL_APP_PASSWORD) {
        console.warn('Gmail credentials not configured. Marketing emails will not work.');
        return null;
    }
    
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
}

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // For GET requests (email history), require auth
    if (req.method === 'GET') {
        return handleEmailHistory(req, res);
    }

    // For POST requests, check if it's send or log
    const { action } = req.body;
    
    if (action === 'log') {
        // Log-only request (from send-email after sending)
        return handleLogEmail(req, res);
    } else {
        // Send email (default)
        return handleSendEmail(req, res);
    }
};

// Handle email sending
async function handleSendEmail(req, res) {
    // Apply rate limiting for email sending
    if (!enforceRateLimit(req, res, 'email')) {
        return; // Rate limit exceeded
    }

    try {
        const { emailType, ...emailData } = req.body;

        if (!emailType) {
            return res.status(400).json({ error: 'emailType is required' });
        }

        let emailConfig;
        let useGmail = false; // Flag to determine which service to use

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
            case 'marketing':
                emailConfig = buildMarketing(emailData);
                useGmail = true; // Marketing emails use Gmail
                break;
            default:
                return res.status(400).json({ error: 'Invalid emailType' });
        }

        if (!emailConfig) {
            return res.status(400).json({ error: 'Failed to build email' });
        }

        let messageId;

        // Send email via appropriate service
        if (useGmail) {
            // Use Gmail for marketing emails
            const gmailTransporter = createGmailTransporter();
            
            if (!gmailTransporter) {
                return res.status(500).json({ 
                    error: 'Gmail not configured',
                    message: 'Please add GMAIL_USER and GMAIL_APP_PASSWORD environment variables'
                });
            }

            try {
                const info = await gmailTransporter.sendMail(emailConfig);
                messageId = info.messageId;
            } catch (gmailError) {
                console.error('Gmail send error:', gmailError);
                return res.status(500).json({ 
                    error: 'Failed to send email via Gmail',
                    details: gmailError.message 
                });
            }
        } else {
            // Use Resend for other email types
            const { data, error } = await resend.emails.send(emailConfig);

            if (error) {
                console.error('Resend error:', error);
                return res.status(400).json({ error: error.message });
            }
            
            messageId = data.id;
        }

        // Log to email history
        try {
            await fetch(`${req.headers.origin || 'https://helmickunderground.com'}/api/emails`, {
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
            messageId: messageId,
            message: 'Email sent successfully' 
        });

    } catch (error) {
        console.error('Send email error:', error);
        res.status(500).json({ 
            error: 'Failed to send email',
            details: error.message 
        });
    }
}

// Handle email history logging
async function handleLogEmail(req, res) {
    // Apply rate limiting
    if (!enforceRateLimit(req, res, 'apiWrite')) {
        return;
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS email_history (
                id BIGSERIAL PRIMARY KEY,
                email_type VARCHAR(50) NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                recipient_name VARCHAR(255),
                subject VARCHAR(500),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'sent',
                submission_id BIGINT,
                invoice_id BIGINT,
                metadata JSONB
            )
        `;

        const { emailType, recipientEmail, recipientName, subject, submissionId, invoiceId, metadata } = req.body;
        
        // Log email send
        await sql`
            INSERT INTO email_history (
                email_type,
                recipient_email,
                recipient_name,
                subject,
                submission_id,
                invoice_id,
                metadata
            )
            VALUES (
                ${emailType},
                ${recipientEmail},
                ${recipientName || null},
                ${subject || null},
                ${submissionId || null},
                ${invoiceId || null},
                ${metadata ? JSON.stringify(metadata) : null}
            )
        `;
        
        return res.status(200).json({ success: true });

    } catch (error) {
        console.error('Email history log error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}

// Handle email history retrieval
async function handleEmailHistory(req, res) {
    // Require authentication for email history access
    if (!requireAuth(req, res)) {
        return;
    }

    // Apply rate limiting (no CSRF needed for GET requests)
    if (!enforceRateLimit(req, res, 'apiRead')) {
        return;
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS email_history (
                id BIGSERIAL PRIMARY KEY,
                email_type VARCHAR(50) NOT NULL,
                recipient_email VARCHAR(255) NOT NULL,
                recipient_name VARCHAR(255),
                subject VARCHAR(500),
                sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(50) DEFAULT 'sent',
                submission_id BIGINT,
                invoice_id BIGINT,
                metadata JSONB
            )
        `;

        const { action } = req.query;
        
        if (action === 'all') {
            const result = await sql`
                SELECT * FROM email_history 
                ORDER BY sent_at DESC 
                LIMIT 500
            `;
            return res.status(200).json(result.rows);
        }
        
        if (action === 'stats') {
            const result = await sql`
                SELECT 
                    email_type,
                    COUNT(*) as count,
                    MAX(sent_at) as last_sent
                FROM email_history
                GROUP BY email_type
            `;
            return res.status(200).json(result.rows);
        }

        return res.status(400).json({ error: 'Invalid action parameter' });

    } catch (error) {
        console.error('Email history API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message 
        });
    }
}

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

function buildCustom({ to, subject, html, name, metadata, attachments }) {
    if (!to || !subject || !html) {
        throw new Error('Missing required fields: to, subject, html');
    }

    const emailConfig = {
        from: 'Helmick Underground <noreply@helmickunderground.com>',
        to: [to],
        subject,
        html
    };

    // Add attachments if provided
    if (attachments && attachments.length > 0) {
        emailConfig.attachments = attachments;
    }

    return emailConfig;
}

// Build marketing email (sent via Gmail)
function buildMarketing({ to, subject, body, recipientName, companyName, metadata }) {
    if (!to || !subject || !body) {
        throw new Error('Missing required fields: to, subject, body');
    }

    // Get Gmail configuration
    const fromName = process.env.GMAIL_FROM_NAME || 'Helmick Underground';
    const fromEmail = process.env.GMAIL_USER || 'HelmickUnderground@gmail.com';
    
    // Replace variables in subject and body
    let processedSubject = subject;
    let processedBody = body;
    
    if (recipientName) {
        processedSubject = processedSubject.replace(/\{name\}/gi, recipientName);
        processedBody = processedBody.replace(/\{name\}/gi, recipientName);
    }
    
    if (companyName) {
        processedSubject = processedSubject.replace(/\{company\}/gi, companyName);
        processedBody = processedBody.replace(/\{company\}/gi, companyName);
    }
    
    // Handle county from metadata
    const county = metadata?.county || '';
    if (county) {
        processedSubject = processedSubject.replace(/\{county\}/gi, county);
        processedBody = processedBody.replace(/\{county\}/gi, county);
    }
    
    // Convert plain text body to professional HTML with sections
    // Split by double newlines to identify paragraphs
    const paragraphs = processedBody.split('\n\n').filter(p => p.trim());
    
    // Build HTML paragraphs with proper styling
    let htmlContent = '';
    paragraphs.forEach(para => {
        const trimmed = para.trim();
        
        // Check if it's a bulleted list
        if (trimmed.includes('\n-') || trimmed.includes('\n•')) {
            const items = trimmed.split('\n').filter(line => line.trim().startsWith('-') || line.trim().startsWith('•'));
            const listItems = items.map(item => {
                const text = item.replace(/^[-•]\s*/, '').trim();
                return `<li style="margin-bottom: 0.5rem; color: #444;">${text}</li>`;
            }).join('');
            
            htmlContent += `
                <ul style="margin: 1.5rem 0; padding-left: 1.5rem; line-height: 1.8;">
                    ${listItems}
                </ul>
            `;
        } else if (trimmed.length < 100 && !trimmed.endsWith('.') && !trimmed.endsWith('?') && !trimmed.endsWith('!')) {
            // Likely a heading or subheading
            htmlContent += `
                <h3 style="color: #ff6b1a; margin: 1.5rem 0 1rem; font-size: 1.1rem; font-weight: 600;">
                    ${trimmed}
                </h3>
            `;
        } else {
            // Regular paragraph
            const formatted = trimmed.replace(/\n/g, '<br>');
            htmlContent += `
                <p style="margin-bottom: 1.2rem; line-height: 1.8; color: #333; font-size: 1rem;">
                    ${formatted}
                </p>
            `;
        }
    });
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Arial', 'Helvetica', sans-serif; background-color: #f5f5f5;">
    <div style="max-width: 650px; margin: 0 auto; background: #ffffff; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
        <!-- Header with Logo -->
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); padding: 2rem; text-align: center; border-bottom: 4px solid #ff6b1a;">
            <img src="https://helmickunderground.com/logo.png" alt="Helmick Underground" style="max-width: 220px; height: auto; margin-bottom: 0.5rem;">
        </div>
        
        <!-- Main Content -->
        <div style="padding: 2.5rem 2rem;">
            ${htmlContent}
        </div>
        
        <!-- Call to Action -->
        <div style="background: linear-gradient(135deg, rgba(255, 107, 26, 0.1) 0%, rgba(255, 107, 26, 0.05) 100%); padding: 1.5rem; margin: 0 2rem 2rem; border-radius: 8px; border-left: 4px solid #ff6b1a;">
            <p style="margin: 0; color: #333; font-size: 0.95rem; line-height: 1.6;">
                <strong style="color: #ff6b1a;">Learn more about our services:</strong><br>
                <a href="https://helmickunderground.com" style="color: #ff6b1a; text-decoration: none; font-weight: 600;">HelmickUnderground.com</a>
            </p>
        </div>
        
        <!-- Footer -->
        <div style="background: linear-gradient(180deg, #0f0f0f 0%, #1a1a1a 100%); padding: 2rem; text-align: center; border-top: 2px solid #ff6b1a;">
            <p style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: #ff6b1a;">
                Helmick Underground LLC
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.95rem;">
                📞 <strong style="color: #ff6b1a;">319-721-9925</strong>
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.9rem;">
                📧 ${fromEmail}
            </p>
            <p style="margin: 0.5rem 0; color: #bbb; font-size: 0.9rem;">
                🌐 HelmickUnderground.com
            </p>
            <p style="margin: 1.5rem 0 0 0; color: #777; font-size: 0.8rem; line-height: 1.5;">
                Expert underground utility services for fiber optic installation,<br>
                directional drilling, and broadband infrastructure in Iowa
            </p>
            <p style="margin: 1rem 0 0 0; color: #666; font-size: 0.75rem;">
                © ${new Date().getFullYear()} Helmick Underground LLC. All rights reserved.
            </p>
        </div>
    </div>
</body>
</html>`;

    return {
        from: `${fromName} <${fromEmail}>`,
        to: to,
        replyTo: fromEmail, // Replies go back to Gmail
        subject: processedSubject,
        html,
        text: processedBody // Plain text version for email clients that don't support HTML
    };
}

