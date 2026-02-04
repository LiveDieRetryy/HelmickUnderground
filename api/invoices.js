const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');

/**
 * Invoice API Handler
 * Manages invoice CRUD operations with status management
 * 
 * @param {import('http').IncomingMessage} req - Request object
 * @param {import('http').ServerResponse} res - Response object
 * @returns {Promise<void>}
 * 
 * @endpoint GET /api/invoices?action=all - Get all invoices
 * @endpoint GET /api/invoices?action=stats - Get invoice statistics
 * @endpoint GET /api/invoices?action=customer&customer_name=Name - Get customer invoices
 * @endpoint GET /api/invoices?id=123 - Get single invoice
 * @endpoint POST /api/invoices - Create invoice
 * @endpoint PUT /api/invoices?id=123 - Update invoice
 * @endpoint PUT /api/invoices?action=status&id=123 - Update invoice status only
 * @endpoint DELETE /api/invoices?id=123 - Delete invoice
 * 
 * @example
 * // Update invoice status
 * fetch('/api/invoices?action=status&id=123', {
 *   method: 'PUT',
 *   body: JSON.stringify({ status: 'paid' })
 * })
 */
module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Require authentication for all invoice operations
    if (!requireAuth(req, res)) {
        return; // requireAuth already sent error response
    }

    // Require CSRF token for state-changing operations
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !requireCsrfToken(req, res)) {
        return; // CSRF validation failed, error response already sent
    }

    // Apply rate limiting
    const limitType = req.method === 'GET' ? 'apiRead' : 'apiWrite';
    if (!enforceRateLimit(req, res, limitType)) {
        return; // Rate limit exceeded, error response already sent
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS invoices (
                id BIGSERIAL PRIMARY KEY,
                invoice_number VARCHAR(100) UNIQUE NOT NULL,
                invoice_date DATE NOT NULL,
                due_date DATE NOT NULL,
                customer_name VARCHAR(255) NOT NULL,
                customer_email VARCHAR(255),
                customer_phone VARCHAR(50),
                customer_address TEXT,
                job_number VARCHAR(100),
                job_address VARCHAR(255),
                job_city VARCHAR(100),
                job_state VARCHAR(2),
                items JSONB NOT NULL,
                tax_rate DECIMAL(5,2) DEFAULT 0,
                subtotal DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;
        
        // Create indexes for frequently queried columns
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_invoice_date ON invoices(invoice_date DESC)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date)`;

        // Add job columns if they don't exist (for existing tables)
        await sql`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_number VARCHAR(100);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_address VARCHAR(255);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_city VARCHAR(100);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS job_state VARCHAR(2);
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `;

        if (req.method === 'POST') {
            const { action } = req.query;
            
            if (action === 'create') {
                const { 
                    invoiceNumber, 
                    invoiceDate, 
                    dueDate, 
                    customer,
                    jobInfo,
                    items, 
                    taxRate, 
                    subtotal, 
                    tax, 
                    total,
                    status 
                } = req.body;
                
                // Insert new invoice
                const result = await sql`
                    INSERT INTO invoices (
                        invoice_number, 
                        invoice_date, 
                        due_date,
                        customer_name,
                        customer_email,
                        customer_phone,
                        customer_address,
                        job_number,
                        job_address,
                        job_city,
                        job_state,
                        items,
                        tax_rate,
                        subtotal,
                        tax,
                        total,
                        status
                    )
                    VALUES (
                        ${invoiceNumber},
                        ${invoiceDate},
                        ${dueDate},
                        ${customer.name},
                        ${customer.email || null},
                        ${customer.phone || null},
                        ${customer.address || null},
                        ${jobInfo?.jobNumber || null},
                        ${jobInfo?.jobAddress || null},
                        ${jobInfo?.jobCity || null},
                        ${jobInfo?.jobState || null},
                        ${JSON.stringify(items)},
                        ${taxRate},
                        ${subtotal},
                        ${tax},
                        ${total},
                        ${status || 'draft'}
                    )
                    RETURNING id
                `;
                
                return res.status(200).json({ 
                    success: true, 
                    invoiceId: result.rows[0].id,
                    id: result.rows[0].id,
                    message: 'Invoice created successfully'
                });
            }
        }

        if (req.method === 'GET') {
            const { action, id } = req.query;
            
            if (action === 'all') {
                // Return all invoices
                const result = await sql`
                    SELECT * FROM invoices 
                    ORDER BY created_at DESC
                `;
                
                return res.status(200).json({ 
                    invoices: result.rows 
                });
            }
            
            if (action === 'get' && id) {
                // Get single invoice
                const result = await sql`
                    SELECT * FROM invoices 
                    WHERE id = ${id}
                `;
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }
                
                return res.status(200).json(result.rows[0]);
            }
            
            if (action === 'stats') {
                // Calculate statistics
                const stats = await sql`
                    SELECT 
                        COUNT(*) as total,
                        SUM(CASE WHEN status = 'draft' THEN 1 ELSE 0 END) as draft,
                        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
                        SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid,
                        SUM(CASE WHEN status = 'overdue' THEN 1 ELSE 0 END) as overdue,
                        SUM(total) as total_amount,
                        SUM(CASE WHEN status = 'paid' THEN total ELSE 0 END) as paid_amount,
                        SUM(CASE WHEN status = 'sent' THEN total ELSE 0 END) as pending_amount,
                        SUM(CASE WHEN status != 'paid' THEN total ELSE 0 END) as outstanding_amount
                    FROM invoices
                `;
                
                return res.status(200).json({
                    total: parseInt(stats.rows[0].total) || 0,
                    draft: parseInt(stats.rows[0].draft) || 0,
                    sent: parseInt(stats.rows[0].sent) || 0,
                    paid: parseInt(stats.rows[0].paid) || 0,
                    overdue: parseInt(stats.rows[0].overdue) || 0,
                    totalAmount: parseFloat(stats.rows[0].total_amount) || 0,
                    paidAmount: parseFloat(stats.rows[0].paid_amount) || 0,
                    pendingAmount: parseFloat(stats.rows[0].pending_amount) || 0,
                    outstandingAmount: parseFloat(stats.rows[0].outstanding_amount) || 0
                });
            }
            
            if (action === 'get' && id) {
                // Get single invoice
                const result = await sql`
                    SELECT * FROM invoices 
                    WHERE id = ${id}
                `;
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Invoice not found' });
                }
                
                return res.status(200).json(result.rows[0]);
            }
        }

        if (req.method === 'PUT') {
            const { action, id } = req.query;
            
            if (action === 'update' && id) {
                const { 
                    invoiceNumber, 
                    invoiceDate, 
                    dueDate, 
                    customer,
                    jobInfo,
                    items, 
                    taxRate, 
                    subtotal, 
                    tax, 
                    total,
                    status 
                } = req.body;
                
                await sql`
                    UPDATE invoices 
                    SET 
                        invoice_number = ${invoiceNumber},
                        invoice_date = ${invoiceDate},
                        due_date = ${dueDate},
                        customer_name = ${customer.name},
                        customer_email = ${customer.email || null},
                        customer_phone = ${customer.phone || null},
                        customer_address = ${customer.address || null},
                        job_number = ${jobInfo?.jobNumber || null},
                        job_address = ${jobInfo?.jobAddress || null},
                        job_city = ${jobInfo?.jobCity || null},
                        job_state = ${jobInfo?.jobState || null},
                        items = ${JSON.stringify(items)},
                        tax_rate = ${taxRate},
                        subtotal = ${subtotal},
                        tax = ${tax},
                        total = ${total},
                        status = ${status || 'draft'},
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${id}
                `;
                
                return res.status(200).json({ 
                    success: true,
                    invoiceId: id,
                    message: 'Invoice updated successfully'
                });
            }
            
            if (action === 'updateStatus' && id) {
                const { status } = req.body;
                const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
                
                if (!validStatuses.includes(status)) {
                    return sendErrorResponse(res, 'VALIDATION_ERROR', `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
                }
                
                await sql`
                    UPDATE invoices 
                    SET status = ${status}, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ${id}
                `;
                
                return res.status(200).json({ success: true });
            }
        }

        if (req.method === 'DELETE') {
            const { action, id } = req.query;
            
            if (action === 'delete' && id) {
                await sql`
                    DELETE FROM invoices 
                    WHERE id = ${id}
                `;
                
                return res.status(200).json({ success: true });
            }
        }

        return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid request');

    } catch (error) {
        console.error('Invoice API error:', error);
        return sendErrorResponse(res, 'DATABASE_ERROR', error.message, error);
    }
};
