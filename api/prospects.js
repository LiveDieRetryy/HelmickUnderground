const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields, withErrorHandling } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');
const { logActivity } = require('./activity-log');

/**
 * Prospects API Handler
 * Manages marketing/outreach prospects (companies to contact)
 * 
 * @endpoint GET /api/prospects?action=all - Get all prospects
 * @endpoint GET /api/prospects?id=123 - Get single prospect
 * @endpoint POST /api/prospects - Create prospect
 * @endpoint PUT /api/prospects?id=123 - Update prospect
 * @endpoint DELETE /api/prospects?id=123 - Delete prospect
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

    // Require authentication for all operations
    if (!requireAuth(req, res)) {
        return;
    }

    // Require CSRF token for write operations
    if ((req.method === 'POST' || req.method === 'PUT' || req.method === 'DELETE') && !requireCsrfToken(req, res)) {
        return;
    }

    // Apply rate limiting
    const limitType = req.method === 'GET' ? 'apiRead' : 'apiWrite';
    if (!enforceRateLimit(req, res, limitType)) {
        return;
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS prospects (
                id BIGSERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                contact_person VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                website VARCHAR(255),
                
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(2),
                zip VARCHAR(20),
                
                status VARCHAR(50) DEFAULT 'not_contacted',
                last_contacted DATE,
                next_followup DATE,
                
                nofa_recipient_id BIGINT,
                source VARCHAR(100),
                
                notes TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_prospects_company ON prospects(company_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_prospects_status ON prospects(status)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_prospects_next_followup ON prospects(next_followup)`;

        const action = req.query.action || 'all';

        // GET all prospects
        if (req.method === 'GET' && action === 'all') {
            const statusFilter = req.query.status;

            let query = `SELECT * FROM prospects`;
            let params = [];

            if (statusFilter) {
                query += ` WHERE status = $1`;
                params.push(statusFilter);
            }

            query += ` ORDER BY 
                CASE 
                    WHEN next_followup IS NOT NULL THEN next_followup
                    ELSE created_at
                END DESC,
                company_name ASC`;

            const result = await sql.query(query, params);

            await logActivity('prospects_viewed', 'Prospects', null, {
                count: result.rows.length,
                status: statusFilter || 'all'
            });

            return res.status(200).json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
        }

        // GET single prospect
        if (req.method === 'GET' && req.query.id) {
            const id = parseInt(req.query.id);
            const result = await sql`SELECT * FROM prospects WHERE id = ${id}`;

            if (result.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Prospect not found', 404);
            }

            await logActivity('prospect_viewed', 'Prospect', id, {
                company: result.rows[0].company_name
            });

            return res.status(200).json({
                success: true,
                data: result.rows[0]
            });
        }

        // POST - Create new prospect
        if (req.method === 'POST') {
            const requiredFields = ['company_name'];
            const validation = validateRequiredFields(req.body, requiredFields);
            if (!validation.valid) {
                return sendErrorResponse(res, 'VALIDATION_ERROR', validation.message, 400);
            }

            const {
                company_name,
                contact_person,
                email,
                phone,
                website,
                address,
                city,
                state,
                zip,
                status,
                last_contacted,
                next_followup,
                nofa_recipient_id,
                source,
                notes
            } = req.body;

            const result = await sql`
                INSERT INTO prospects (
                    company_name, contact_person, email, phone, website,
                    address, city, state, zip,
                    status, last_contacted, next_followup,
                    nofa_recipient_id, source, notes
                )
                VALUES (
                    ${company_name}, ${contact_person || null}, ${email || null}, ${phone || null}, ${website || null},
                    ${address || null}, ${city || null}, ${state || null}, ${zip || null},
                    ${status || 'not_contacted'}, ${last_contacted || null}, ${next_followup || null},
                    ${nofa_recipient_id || null}, ${source || 'manual'}, ${notes || null}
                )
                RETURNING *
            `;

            // If created from NOFA recipient, mark the recipient as prospect
            if (nofa_recipient_id) {
                await sql`
                    UPDATE nofa_recipients 
                    SET is_prospect = true 
                    WHERE id = ${nofa_recipient_id}
                `;
            }

            await logActivity('prospect_created', 'Prospect', result.rows[0].id, {
                company: company_name,
                source: source || 'manual'
            });

            return res.status(201).json({
                success: true,
                data: result.rows[0],
                message: 'Prospect added successfully'
            });
        }

        // PUT - Update prospect
        if (req.method === 'PUT' && req.query.id) {
            const id = parseInt(req.query.id);
            
            const {
                company_name,
                contact_person,
                email,
                phone,
                website,
                address,
                city,
                state,
                zip,
                status,
                last_contacted,
                next_followup,
                notes
            } = req.body;

            const result = await sql`
                UPDATE prospects
                SET 
                    company_name = COALESCE(${company_name}, company_name),
                    contact_person = COALESCE(${contact_person}, contact_person),
                    email = COALESCE(${email}, email),
                    phone = COALESCE(${phone}, phone),
                    website = COALESCE(${website}, website),
                    address = COALESCE(${address}, address),
                    city = COALESCE(${city}, city),
                    state = COALESCE(${state}, state),
                    zip = COALESCE(${zip}, zip),
                    status = COALESCE(${status}, status),
                    last_contacted = COALESCE(${last_contacted}, last_contacted),
                    next_followup = COALESCE(${next_followup}, next_followup),
                    notes = COALESCE(${notes}, notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (result.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Prospect not found', 404);
            }

            await logActivity('prospect_updated', 'Prospect', id, {
                company: result.rows[0].company_name,
                changes: Object.keys(req.body)
            });

            return res.status(200).json({
                success: true,
                data: result.rows[0],
                message: 'Prospect updated successfully'
            });
        }

        // DELETE - Delete prospect
        if (req.method === 'DELETE' && req.query.id) {
            const id = parseInt(req.query.id);
            
            // Get prospect info before deleting
            const prospect = await sql`
                SELECT company_name, nofa_recipient_id 
                FROM prospects 
                WHERE id = ${id}
            `;
            
            if (prospect.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Prospect not found', 404);
            }

            // If linked to NOFA recipient, unmark as prospect
            if (prospect.rows[0].nofa_recipient_id) {
                await sql`
                    UPDATE nofa_recipients 
                    SET is_prospect = false 
                    WHERE id = ${prospect.rows[0].nofa_recipient_id}
                `;
            }

            await sql`DELETE FROM prospects WHERE id = ${id}`;

            await logActivity('prospect_deleted', 'Prospect', id, {
                company: prospect.rows[0].company_name
            });

            return res.status(200).json({
                success: true,
                message: 'Prospect deleted successfully'
            });
        }

        return sendErrorResponse(res, 'INVALID_REQUEST', 'Invalid request', 400);

    } catch (error) {
        console.error('Prospects API Error:', error);
        return sendErrorResponse(res, 'SERVER_ERROR', 'Failed to process request', 500);
    }
};
