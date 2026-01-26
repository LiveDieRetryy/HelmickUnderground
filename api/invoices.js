const { sql } = require('@vercel/postgres');

module.exports = async function handler(req, res) {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
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

        if (req.method === 'POST') {
            const { action } = req.query;
            
            if (action === 'create') {
                const { 
                    invoiceNumber, 
                    invoiceDate, 
                    dueDate, 
                    customer, 
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
                    message: 'Invoice updated successfully'
                });
            }
            
            if (action === 'updateStatus' && id) {
                const { status } = req.body;
                const validStatuses = ['draft', 'sent', 'paid', 'overdue', 'cancelled'];
                
                if (!validStatuses.includes(status)) {
                    return res.status(400).json({ error: 'Invalid status' });
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

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Invoice API error:', error);
        return res.status(500).json({ 
            error: 'Internal server error', 
            message: error.message,
            details: error.toString()
        });
    }
};
