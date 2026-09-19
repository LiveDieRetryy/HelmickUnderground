const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');
const memoryStore = require('../lib/dev-memory-store');
const { normalizeRetainageRate, calculateRetainage } = require('../lib/retainage');

function normalizeInvoiceItems(items) {
    if (!Array.isArray(items) || items.length === 0) {
        return { error: 'At least one invoice line item is required' };
    }

    const normalizedItems = [];
    for (let index = 0; index < items.length; index++) {
        const item = items[index] || {};
        const description = String(item.description || '').trim();
        const quantity = Number(item.quantity);
        const rate = Number(item.rate);

        if (!description) {
            return { error: `Line item ${index + 1} is missing a description` };
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            return { error: `Line item ${index + 1} has an invalid quantity` };
        }
        if (!Number.isFinite(rate) || rate < 0) {
            return { error: `Line item ${index + 1} has an invalid rate` };
        }

        normalizedItems.push({
            ...item,
            description,
            quantity,
            rate,
            amount: quantity * rate
        });
    }

    return { items: normalizedItems };
}

function calculateInvoiceTotals(items, taxRate) {
    const normalizedTaxRate = Number(taxRate) || 0;
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const tax = subtotal * (normalizedTaxRate / 100);

    return {
        taxRate: normalizedTaxRate,
        subtotal,
        tax,
        total: subtotal + tax
    };
}

function handleMemoryInvoices(req, res) {
    const action = req.query.action || 'all';
    if (req.method === 'GET' && action === 'all') return res.status(200).json({ invoices: memoryStore.clone(memoryStore.invoices) });
    if (req.method === 'GET' && action === 'stats') {
        const invoices = memoryStore.invoices;
        const paidAmount = invoices.filter(invoice => invoice.status === 'paid').reduce((sum, invoice) => sum + invoice.amount_due + (invoice.retainage_status === 'paid' ? invoice.retainage_amount : 0), 0);
        const pendingRetainageAmount = invoices.filter(invoice => ['sent', 'paid'].includes(invoice.status) && invoice.retainage_status === 'pending').reduce((sum, invoice) => sum + invoice.retainage_amount, 0);
        return res.status(200).json({ total: invoices.length, paid: invoices.filter(invoice => invoice.status === 'paid').length, overdue: invoices.filter(invoice => invoice.status === 'overdue').length, paidAmount, pendingAmount: invoices.filter(invoice => invoice.status === 'sent').reduce((sum, invoice) => sum + invoice.amount_due, 0) + pendingRetainageAmount, pendingRetainageAmount });
    }
    if (req.method === 'GET' && action === 'get') {
        const invoice = memoryStore.invoices.find(item => item.id === Number(req.query.id));
        return invoice ? res.status(200).json(memoryStore.clone(invoice)) : res.status(404).json({ error: 'Invoice not found' });
    }
    if (req.method === 'POST' && action === 'create') {
        const normalized = normalizeInvoiceItems(req.body.items);
        if (normalized.error) return sendErrorResponse(res, 'VALIDATION_ERROR', normalized.error);
        const calculated = calculateInvoiceTotals(normalized.items, req.body.taxRate);
        const retainageRate = Math.max(0, Math.min(100, Number(req.body.retainageRate) || 0));
        const retainageAmount = Math.round(calculated.total * retainageRate) / 100;
        const invoice = { id: memoryStore.nextInvoiceId(), invoice_number: req.body.invoiceNumber, invoice_date: req.body.invoiceDate, due_date: req.body.dueDate, customer_name: req.body.customer?.name || '', customer_id: req.body.customer?.customerId || null, customer_email: req.body.customer?.email || '', customer_phone: req.body.customer?.phone || '', customer_address: req.body.customer?.address || '', job_number: req.body.jobInfo?.jobNumber || '', job_address: req.body.jobInfo?.jobAddress || '', job_city: req.body.jobInfo?.jobCity || '', job_state: req.body.jobInfo?.jobState || '', items: normalized.items, tax_rate: calculated.taxRate, subtotal: calculated.subtotal, tax: calculated.tax, total: calculated.total, retainage_rate: retainageRate, retainage_amount: retainageAmount, amount_due: calculated.total - retainageAmount, retainage_status: retainageAmount > 0 ? 'pending' : 'none', status: req.body.status || 'draft', created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        memoryStore.invoices.push(invoice);
        memoryStore.save();
        return res.status(200).json({ success: true, invoiceId: invoice.id, id: invoice.id, message: 'Invoice created successfully' });
    }
    if (req.method === 'PUT' && action === 'update') {
        const invoice = memoryStore.invoices.find(item => item.id === Number(req.query.id));
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        const normalized = normalizeInvoiceItems(req.body.items);
        if (normalized.error) return sendErrorResponse(res, 'VALIDATION_ERROR', normalized.error);
        const calculated = calculateInvoiceTotals(normalized.items, req.body.taxRate);
        Object.assign(invoice, { invoice_number: req.body.invoiceNumber, invoice_date: req.body.invoiceDate, due_date: req.body.dueDate, customer_name: req.body.customer?.name || invoice.customer_name, customer_id: req.body.customer?.customerId || invoice.customer_id, customer_email: req.body.customer?.email || '', customer_phone: req.body.customer?.phone || '', customer_address: req.body.customer?.address || '', job_number: req.body.jobInfo?.jobNumber || '', job_address: req.body.jobInfo?.jobAddress || '', job_city: req.body.jobInfo?.jobCity || '', job_state: req.body.jobInfo?.jobState || '', items: normalized.items, tax_rate: calculated.taxRate, subtotal: calculated.subtotal, tax: calculated.tax, total: calculated.total, retainage_rate: Math.max(0, Math.min(100, Number(req.body.retainageRate) || 0)), status: req.body.status || invoice.status });
        memoryStore.recalculateInvoice(invoice, invoice.retainage_rate);
        memoryStore.save();
        return res.status(200).json({ success: true, invoiceId: invoice.id, message: 'Invoice updated successfully' });
    }
    if (req.method === 'PUT' && action === 'updateStatus') {
        const invoice = memoryStore.invoices.find(item => item.id === Number(req.query.id));
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        invoice.status = req.body.status;
        memoryStore.save();
        return res.status(200).json({ success: true });
    }
    if (req.method === 'PUT' && action === 'updateRetainageStatus') {
        const invoice = memoryStore.invoices.find(item => item.id === Number(req.query.id));
        if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
        invoice.retainage_status = req.body.retainageStatus;
        memoryStore.save();
        return res.status(200).json({ success: true });
    }
    if (req.method === 'DELETE' && action === 'delete') {
        const index = memoryStore.invoices.findIndex(item => item.id === Number(req.query.id));
        if (index < 0) return res.status(404).json({ error: 'Invoice not found' });
        memoryStore.invoices.splice(index, 1);
        memoryStore.save();
        return res.status(200).json({ success: true, message: 'Invoice deleted successfully' });
    }
    return res.status(409).json({ success: false, error: 'MEMORY_MODE_OPERATION_UNSUPPORTED', message: 'Use the seeded invoice and supported status operations in local memory mode.' });
}

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
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-csrf-token, Authorization');

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

    if (memoryStore.enabled()) {
        return handleMemoryInvoices(req, res);
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
                customer_id BIGINT,
                customer_email VARCHAR(255),
                customer_phone VARCHAR(50),
                customer_address TEXT,
                job_number VARCHAR(100),
                job_address VARCHAR(255),
                job_city VARCHAR(100),
                job_state VARCHAR(2),
                submission_id BIGINT,
                items JSONB NOT NULL,
                tax_rate DECIMAL(5,2) DEFAULT 0,
                subtotal DECIMAL(10,2) NOT NULL,
                tax DECIMAL(10,2) NOT NULL,
                total DECIMAL(10,2) NOT NULL,
                retainage_rate DECIMAL(5,2) DEFAULT 0,
                retainage_amount DECIMAL(10,2) DEFAULT 0,
                amount_due DECIMAL(10,2) DEFAULT 0,
                retainage_status VARCHAR(20) DEFAULT 'none',
                status VARCHAR(50) DEFAULT 'draft',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_rate DECIMAL(5,2) DEFAULT 0`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id BIGINT`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_amount DECIMAL(10,2) DEFAULT 0`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10,2) DEFAULT 0`;
        await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_status VARCHAR(20) DEFAULT 'none'`;
        await sql`UPDATE invoices SET amount_due = total - COALESCE(retainage_amount, 0) WHERE amount_due IS NULL OR amount_due = 0`;
        await sql`UPDATE invoices SET retainage_status = 'pending' WHERE COALESCE(retainage_amount, 0) > 0 AND retainage_status = 'none'`;
                await sql`
                        UPDATE invoices AS i
                        SET customer_id = c.id
                        FROM customers AS c
                        WHERE i.customer_id IS NULL
                            AND i.customer_name = c.name
                            AND (SELECT COUNT(*) FROM customers AS c2 WHERE c2.name = i.customer_name) = 1
                `;
        
        // Create indexes for frequently queried columns
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_name ON invoices(customer_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON invoices(customer_id)`;
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
                BEGIN
                    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS submission_id BIGINT;
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
                    status,
                    submissionId,
                    retainageRate
                } = req.body;

                const normalized = normalizeInvoiceItems(items);
                if (normalized.error) {
                    return sendErrorResponse(res, 'VALIDATION_ERROR', normalized.error);
                }
                const calculated = calculateInvoiceTotals(normalized.items, taxRate);
                const retainage = calculateRetainage(calculated.total, retainageRate);
                
                // Insert new invoice
                const result = await sql`
                    INSERT INTO invoices (
                        invoice_number, 
                        invoice_date, 
                        due_date,
                        customer_name,
                        customer_id,
                        customer_email,
                        customer_phone,
                        customer_address,
                        job_number,
                        job_address,
                        job_city,
                        job_state,
                        submission_id,
                        items,
                        tax_rate,
                        subtotal,
                        tax,
                        total,
                        retainage_rate,
                        retainage_amount,
                        amount_due,
                        retainage_status,
                        status
                    )
                    VALUES (
                        ${invoiceNumber},
                        ${invoiceDate},
                        ${dueDate},
                        ${customer.name},
                        ${customer.customerId || null},
                        ${customer.email || null},
                        ${customer.phone || null},
                        ${customer.address || null},
                        ${jobInfo?.jobNumber || null},
                        ${jobInfo?.jobAddress || null},
                        ${jobInfo?.jobCity || null},
                        ${jobInfo?.jobState || null},
                        ${submissionId || null},
                        ${JSON.stringify(normalized.items)},
                        ${calculated.taxRate},
                        ${calculated.subtotal},
                        ${calculated.tax},
                        ${calculated.total},
                        ${retainage.rate},
                        ${retainage.amount},
                        ${retainage.amountDue},
                        ${retainage.status},
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
                        SUM(retainage_amount) as retainage_amount,
                        SUM(amount_due) as amount_due,
                        SUM(CASE WHEN status = 'paid' THEN amount_due + CASE WHEN retainage_status = 'paid' THEN retainage_amount ELSE 0 END ELSE 0 END) as paid_amount,
                        SUM(CASE WHEN status = 'sent' THEN amount_due ELSE 0 END) + SUM(CASE WHEN status IN ('sent', 'paid') AND retainage_status = 'pending' THEN retainage_amount ELSE 0 END) as pending_amount,
                        SUM(CASE WHEN status IN ('sent', 'paid') AND retainage_status = 'pending' THEN retainage_amount ELSE 0 END) as pending_retainage_amount,
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
                    retainageAmount: parseFloat(stats.rows[0].retainage_amount) || 0,
                    amountDue: parseFloat(stats.rows[0].amount_due) || 0,
                    paidAmount: parseFloat(stats.rows[0].paid_amount) || 0,
                    pendingAmount: parseFloat(stats.rows[0].pending_amount) || 0,
                    pendingRetainageAmount: parseFloat(stats.rows[0].pending_retainage_amount) || 0,
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
                    status,
                    retainageRate
                } = req.body;

                const normalized = normalizeInvoiceItems(items);
                if (normalized.error) {
                    return sendErrorResponse(res, 'VALIDATION_ERROR', normalized.error);
                }
                const calculated = calculateInvoiceTotals(normalized.items, taxRate);
                const retainage = calculateRetainage(calculated.total, retainageRate);
                const requestedRetainageStatus = ['none', 'pending', 'paid'].includes(req.body.retainageStatus) ? req.body.retainageStatus : null;
                const existingInvoice = await sql`SELECT retainage_amount, retainage_status FROM invoices WHERE id = ${id}`;
                const existingRetainageAmount = Number(existingInvoice.rows[0]?.retainage_amount || 0);
                const retainageStatus = requestedRetainageStatus || (existingRetainageAmount !== retainage.amount ? retainage.status : (existingInvoice.rows[0]?.retainage_status || retainage.status));
                
                await sql`
                    UPDATE invoices 
                    SET 
                        invoice_number = ${invoiceNumber},
                        invoice_date = ${invoiceDate},
                        due_date = ${dueDate},
                        customer_name = ${customer.name},
                        customer_id = COALESCE(${customer.customerId || null}, customer_id),
                        customer_email = ${customer.email || null},
                        customer_phone = ${customer.phone || null},
                        customer_address = ${customer.address || null},
                        job_number = ${jobInfo?.jobNumber || null},
                        job_address = ${jobInfo?.jobAddress || null},
                        job_city = ${jobInfo?.jobCity || null},
                        job_state = ${jobInfo?.jobState || null},
                        items = ${JSON.stringify(normalized.items)},
                        tax_rate = ${calculated.taxRate},
                        subtotal = ${calculated.subtotal},
                        tax = ${calculated.tax},
                        total = ${calculated.total},
                        retainage_rate = ${retainage.rate},
                        retainage_amount = ${retainage.amount},
                        amount_due = ${retainage.amountDue},
                        retainage_status = ${retainageStatus},
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

            if (action === 'updateRetainageStatus' && id) {
                const { retainageStatus } = req.body;
                if (!['none', 'pending', 'paid'].includes(retainageStatus)) {
                    return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid retainage status');
                }

                await sql`
                    UPDATE invoices
                    SET retainage_status = ${retainageStatus}, updated_at = CURRENT_TIMESTAMP
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
