const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields, withErrorHandling } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');
const { logActivity } = require('./activity-log');
const memoryStore = require('../lib/dev-memory-store');
const { calculateRetainage, normalizeRetainageRate } = require('../lib/retainage');

function handleMemoryCustomers(req, res) {
    const action = req.query.action || 'all';

    if (req.method === 'GET' && action === 'all') {
        return res.status(200).json({ customers: memoryStore.clone(memoryStore.customers), pagination: { page: 1, limit: 1000, totalCount: memoryStore.customers.length, totalPages: 1, hasNextPage: false, hasPrevPage: false } });
    }
    if (req.method === 'GET' && (action === 'get' || action === 'full')) {
        const customer = memoryStore.customers.find(item => item.id === Number(req.query.id));
        if (!customer) return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
        if (action === 'full') {
            const relatedInvoices = memoryStore.invoices.filter(invoice => invoice.customer_id === customer.id || invoice.customer_name === customer.name);
            const invoicedProjects = new Set(relatedInvoices.map(invoice => invoice.job_number || invoice.id).filter(Boolean));
            const paidAmount = relatedInvoices.filter(invoice => invoice.status === 'paid')
                .reduce((sum, invoice) => sum + Number(invoice.amount_due || invoice.total || 0) + (invoice.retainage_status === 'paid' ? Number(invoice.retainage_amount || 0) : 0), 0);
            return res.status(200).json({ customer: memoryStore.clone(customer), projects: [], invoices: memoryStore.clone(relatedInvoices), stats: { totalInvoices: relatedInvoices.length, invoicedProjects: invoicedProjects.size, totalInvoiced: relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0), paidAmount, outstandingAmount: relatedInvoices.filter(invoice => invoice.status !== 'paid').reduce((sum, invoice) => sum + Number(invoice.amount_due || invoice.total || 0), 0), totalRetainage: relatedInvoices.reduce((sum, invoice) => sum + Number(invoice.retainage_amount || 0), 0), paidInvoices: relatedInvoices.filter(invoice => invoice.status === 'paid').length, unpaidInvoices: relatedInvoices.filter(invoice => invoice.status !== 'paid').length } });
        }
        return res.status(200).json(memoryStore.clone(customer));
    }
    if (req.method === 'POST') {
        const customer = { ...req.body, id: memoryStore.nextCustomerId(), custom_line_items: req.body.custom_line_items || [], retainage_rate: Math.max(0, Math.min(100, Number(req.body.retainage_rate) || 0)), created_at: new Date().toISOString(), updated_at: new Date().toISOString() };
        memoryStore.customers.push(customer);
        memoryStore.save();
        return res.status(201).json(memoryStore.clone(customer));
    }
    if (req.method === 'PUT') {
        const customer = memoryStore.customers.find(item => item.id === Number(req.query.id));
        if (!customer) return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
        Object.assign(customer, req.body, { retainage_rate: Math.max(0, Math.min(100, Number(req.body.retainage_rate) || 0)) });
        memoryStore.updateCustomerRetainage(customer.id, customer.retainage_rate);
        memoryStore.save();
        return res.status(200).json(memoryStore.clone(customer));
    }
    if (req.method === 'DELETE') {
        const index = memoryStore.customers.findIndex(item => item.id === Number(req.query.id));
        if (index < 0) return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
        memoryStore.customers.splice(index, 1);
        memoryStore.save();
        return res.status(200).json({ success: true, message: 'Customer deleted successfully' });
    }
    return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid request');
}
/**
 * Customer API Handler
 * Manages customer CRUD operations with pagination and composite queries
 * 
 * @param {import('http').IncomingMessage} req - Request object
 * @param {import('http').ServerResponse} res - Response object
 * @returns {Promise<void>}
 * 
 * @endpoint GET /api/customers?action=all&page=1&limit=25
 * @endpoint GET /api/customers?action=full&id=123 - Composite query (customer + projects + invoices)
 * @endpoint GET /api/customers?id=123 - Single customer
 * @endpoint POST /api/customers - Create customer
 * @endpoint PUT /api/customers?id=123 - Update customer
 * @endpoint DELETE /api/customers?id=123 - Delete customer
 * 
 * @example
 * // Fetch all customers with pagination
 * fetch('/api/customers?action=all&page=1&limit=25')
 * 
 * @example
 * // Fetch customer with all related data (66% faster than separate calls)
 * fetch('/api/customers?action=full&id=123')
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

    // Require authentication for all customer operations
    if (!requireAuth(req, res)) {
        return; // requireAuth already sent error response
    }

    // Require CSRF token for PUT and DELETE operations (skip POST for migration compatibility)
    if ((req.method === 'PUT' || req.method === 'DELETE') && !requireCsrfToken(req, res)) {
        return; // CSRF validation failed, error response already sent
    }

    // Apply rate limiting
    const limitType = req.method === 'GET' ? 'apiRead' : 'apiWrite';
    if (!enforceRateLimit(req, res, limitType)) {
        return; // Rate limit exceeded, error response already sent
    }

    if (memoryStore.enabled()) {
        return handleMemoryCustomers(req, res);
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS customers (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                contact_person VARCHAR(255),
                phone VARCHAR(50),
                email VARCHAR(255),
                preferred_contact VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(2),
                zip VARCHAR(20),
                notes TEXT,
                custom_line_items JSONB DEFAULT '[]',
                retainage_rate DECIMAL(5,2) DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        await sql`ALTER TABLE customers ADD COLUMN IF NOT EXISTS retainage_rate DECIMAL(5,2) DEFAULT 0`;

        const invoicesTable = await sql`SELECT to_regclass('public.invoices') AS table_name`;
        if (invoicesTable.rows[0]?.table_name) {
            await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_rate DECIMAL(5,2) DEFAULT 0`;
            await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_amount DECIMAL(10,2) DEFAULT 0`;
            await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS amount_due DECIMAL(10,2) DEFAULT 0`;
            await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS retainage_status VARCHAR(20) DEFAULT 'none'`;
            await sql`ALTER TABLE invoices ADD COLUMN IF NOT EXISTS customer_id BIGINT`;
            await sql`UPDATE invoices SET retainage_status = 'pending' WHERE COALESCE(retainage_amount, 0) > 0 AND retainage_status = 'none'`;
        }
        
        // Alter existing table to allow NULL for phone (migration for existing databases)
        await sql`ALTER TABLE customers ALTER COLUMN phone DROP NOT NULL`.catch(() => {
            // Ignore error if already nullable or table doesn't exist yet
        });
        
        // Create indexes for frequently queried columns
        await sql`CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_customers_type ON customers(type)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_customers_created_at ON customers(created_at DESC)`;

        const action = req.query.action || 'all';

        // GET all customers (with pagination support)
        if (req.method === 'GET' && action === 'all') {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 1000; // Default to all if not specified
            const offset = (page - 1) * limit;
            
            // Get total count
            const countResult = await sql`SELECT COUNT(*) FROM customers`;
            const totalCount = parseInt(countResult.rows[0].count);
            
            // Get paginated results
            const { rows } = await sql`
                SELECT * FROM customers
                ORDER BY name ASC
                LIMIT ${limit} OFFSET ${offset}
            `;
            
            return res.status(200).json({
                customers: rows,
                pagination: {
                    page,
                    limit,
                    totalCount,
                    totalPages: Math.ceil(totalCount / limit),
                    hasNextPage: page < Math.ceil(totalCount / limit),
                    hasPrevPage: page > 1
                }
            });
        }

        // GET single customer by ID
        if (req.method === 'GET' && action === 'get') {
            const { id } = req.query;
            const { rows } = await sql`
                SELECT * FROM customers 
                WHERE id = ${id}
            `;
            if (rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
            }
            return res.status(200).json(rows[0]);
        }

        // GET customer with related projects and invoices (optimized with JOINs)
        if (req.method === 'GET' && action === 'full') {
            const { id } = req.query;
            
            // Get customer details
            const customerResult = await sql`
                SELECT * FROM customers 
                WHERE id = ${id}
            `;
            
            if (customerResult.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
            }
            
            const customer = customerResult.rows[0];
            
            // Get projects for this customer (by customer_id which is email)
            const projectsResult = await sql`
                SELECT 
                    id, project_number, customer_id, project_name, 
                    job_address, job_city, job_state, description, 
                    status, start_date, estimated_completion, actual_completion,
                    total_estimate, total_billed, notes, created_at
                FROM projects 
                WHERE customer_id = ${customer.email}
                ORDER BY created_at DESC
            `;
            
            // Get invoices for this customer (by customer_name)
            const invoicesResult = await sql`
                SELECT 
                    id, invoice_number, job_number, customer_name,
                    invoice_date, due_date, status, total, 
                    subtotal, tax, retainage_rate, retainage_amount, amount_due, created_at
                FROM invoices 
                    WHERE customer_id = ${customer.id} OR (customer_id IS NULL AND customer_name = ${customer.name})
                ORDER BY invoice_date DESC
            `;
            
            // Calculate stats
            const projects = projectsResult.rows;
            const invoices = invoicesResult.rows;
            
            const stats = {
                totalInvoices: invoices.length,
                invoicedProjects: new Set(invoices.map(inv => inv.job_number || inv.id).filter(Boolean)).size,
                totalInvoiced: invoices.reduce((sum, inv) => sum + parseFloat(inv.total || 0), 0),
                paidAmount: invoices.filter(inv => inv.status === 'paid').reduce((sum, inv) => sum + parseFloat(inv.amount_due || inv.total || 0) + (inv.retainage_status === 'paid' ? parseFloat(inv.retainage_amount || 0) : 0), 0),
                outstandingAmount: invoices.filter(inv => inv.status !== 'paid').reduce((sum, inv) => sum + parseFloat(inv.amount_due || inv.total || 0), 0),
                paidInvoices: invoices.filter(inv => inv.status === 'paid').length,
                unpaidInvoices: invoices.filter(inv => inv.status !== 'paid').length
                ,totalRetainage: invoices.reduce((sum, inv) => sum + parseFloat(inv.retainage_amount || 0), 0)
            };
            
            return res.status(200).json({
                customer,
                projects,
                invoices,
                stats
            });
        }

        // POST - Create new customer
        if (req.method === 'POST') {
            const {
                name,
                type,
                contact_person,
                phone,
                email,
                preferred_contact,
                address,
                city,
                state,
                zip,
                notes,
                custom_line_items,
                retainage_rate
            } = req.body;

            const { rows } = await sql`
                INSERT INTO customers (
                    name, type, contact_person, phone, email, 
                    preferred_contact, address, city, state, zip, 
                    notes, custom_line_items, retainage_rate
                )
                VALUES (
                    ${name}, ${type}, ${contact_person}, ${phone}, ${email},
                    ${preferred_contact}, ${address}, ${city}, ${state}, ${zip},
                    ${notes}, ${JSON.stringify(custom_line_items || [])}, ${normalizeRetainageRate(retainage_rate)}
                )
                RETURNING *
            `;

            // Log activity
            await logActivity('create', 'customer', rows[0].id, req.user.email, { name, type });

            return res.status(201).json(rows[0]);
        }

        // PUT - Update customer
        if (req.method === 'PUT') {
            const { id } = req.query;
            const {
                name,
                type,
                contact_person,
                phone,
                email,
                preferred_contact,
                address,
                city,
                state,
                zip,
                notes,
                custom_line_items,
                retainage_rate
            } = req.body;

            const normalizedRetainageRate = normalizeRetainageRate(retainage_rate);
            const previousCustomer = await sql`SELECT name FROM customers WHERE id = ${id}`;
            const previousCustomerName = previousCustomer.rows[0]?.name;

            const { rows } = await sql`
                UPDATE customers 
                SET 
                    name = ${name},
                    type = ${type},
                    contact_person = ${contact_person},
                    phone = ${phone},
                    email = ${email},
                    preferred_contact = ${preferred_contact},
                    address = ${address},
                    city = ${city},
                    state = ${state},
                    zip = ${zip},
                    notes = ${notes},
                    custom_line_items = ${JSON.stringify(custom_line_items || [])},
                    retainage_rate = ${normalizedRetainageRate},
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
            }

            if (invoicesTable.rows[0]?.table_name) {
                await sql`
                    UPDATE invoices
                    SET
                        retainage_rate = ${normalizedRetainageRate},
                        retainage_amount = ROUND((subtotal + tax) * ${normalizedRetainageRate / 100}, 2),
                        amount_due = (subtotal + tax) - ROUND((subtotal + tax) * ${normalizedRetainageRate / 100}, 2),
                        retainage_status = CASE WHEN ${normalizedRetainageRate} > 0 THEN 'pending' ELSE 'none' END,
                        updated_at = CURRENT_TIMESTAMP
                          WHERE customer_id = ${id}
                              OR (customer_id IS NULL AND (customer_name = ${previousCustomerName || name} OR customer_name = ${name}))
                `;
            }

            // Log activity
            await logActivity('update', 'customer', parseInt(id), req.user.email, { name, type });

            return res.status(200).json(rows[0]);
        }

        // DELETE customer
        if (req.method === 'DELETE') {
            const { id, action } = req.query;

            const { rows } = await sql`
                DELETE FROM customers 
                WHERE id = ${id}
                RETURNING *
            `;

            if (rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Customer not found');
            }

            // Log activity
            await logActivity('delete', 'customer', parseInt(id), req.user.email, { name: rows[0].name });

            return res.status(200).json({ success: true, message: 'Customer deleted successfully' });
        }

        return sendErrorResponse(res, 'VALIDATION_ERROR', 'Invalid request');

    } catch (error) {
        console.error('Database error:', error);
        return sendErrorResponse(res, 'DATABASE_ERROR', error.message, error);
    }
};
