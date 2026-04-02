const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields, withErrorHandling } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');
const { logActivity } = require('./activity-log');

/**
 * NOFA Recipients API Handler
 * Manages NOFA-funded telecom/ISP companies in Iowa
 * 
 * @endpoint GET /api/nofa-recipients?action=all - Get all Iowa recipients
 * @endpoint GET /api/nofa-recipients?id=123 - Get single recipient
 * @endpoint POST /api/nofa-recipients - Create recipient
 * @endpoint PUT /api/nofa-recipients?id=123 - Update recipient
 * @endpoint DELETE /api/nofa-recipients?id=123 - Delete recipient
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
            CREATE TABLE IF NOT EXISTS nofa_recipients (
                id BIGSERIAL PRIMARY KEY,
                company_name VARCHAR(255) NOT NULL,
                contact_person VARCHAR(255),
                email VARCHAR(255),
                phone VARCHAR(50),
                website VARCHAR(255),
                
                funding_amount DECIMAL(12, 2),
                grant_program VARCHAR(100),
                award_date DATE,
                
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(2) DEFAULT 'IA',
                zip VARCHAR(20),
                county VARCHAR(100),
                latitude DECIMAL(10, 8),
                longitude DECIMAL(11, 8),
                
                service_area TEXT,
                project_description TEXT,
                
                status VARCHAR(50) DEFAULT 'not_contacted',
                is_prospect BOOLEAN DEFAULT false,
                notes TEXT,
                
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Create indexes
        await sql`CREATE INDEX IF NOT EXISTS idx_nofa_recipients_company ON nofa_recipients(company_name)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_nofa_recipients_status ON nofa_recipients(status)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_nofa_recipients_state ON nofa_recipients(state)`;
        await sql`CREATE INDEX IF NOT EXISTS idx_nofa_recipients_is_prospect ON nofa_recipients(is_prospect)`;

        const action = req.query.action || 'all';

        // GET all recipients (Iowa only by default)
        if (req.method === 'GET' && action === 'all') {
            const stateFilter = req.query.state || 'IA';
            const statusFilter = req.query.status;
            const isProspectFilter = req.query.is_prospect;

            let query = `SELECT * FROM nofa_recipients WHERE state = $1`;
            let params = [stateFilter];
            let paramCount = 1;

            if (statusFilter) {
                paramCount++;
                query += ` AND status = $${paramCount}`;
                params.push(statusFilter);
            }

            if (isProspectFilter !== undefined) {
                paramCount++;
                query += ` AND is_prospect = $${paramCount}`;
                params.push(isProspectFilter === 'true');
            }

            query += ` ORDER BY award_date DESC NULLS LAST, company_name ASC`;

            const result = await sql.query(query, params);

            await logActivity('nofa_recipients_viewed', 'NOFA Recipients', null, {
                count: result.rows.length,
                state: stateFilter
            });

            return res.status(200).json({
                success: true,
                data: result.rows,
                count: result.rows.length
            });
        }

        // GET single recipient
        if (req.method === 'GET' && req.query.id) {
            const id = parseInt(req.query.id);
            const result = await sql`SELECT * FROM nofa_recipients WHERE id = ${id}`;

            if (result.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Recipient not found', 404);
            }

            await logActivity('nofa_recipient_viewed', 'NOFA Recipient', id, {
                company: result.rows[0].company_name
            });

            return res.status(200).json({
                success: true,
                data: result.rows[0]
            });
        }

        // POST - Create new recipient
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
                funding_amount,
                grant_program,
                award_date,
                address,
                city,
                state,
                zip,
                county,
                latitude,
                longitude,
                service_area,
                project_description,
                status,
                notes
            } = req.body;

            const result = await sql`
                INSERT INTO nofa_recipients (
                    company_name, contact_person, email, phone, website,
                    funding_amount, grant_program, award_date,
                    address, city, state, zip, county, latitude, longitude,
                    service_area, project_description, status, notes
                )
                VALUES (
                    ${company_name}, ${contact_person || null}, ${email || null}, ${phone || null}, ${website || null},
                    ${funding_amount || null}, ${grant_program || null}, ${award_date || null},
                    ${address || null}, ${city || null}, ${state || 'IA'}, ${zip || null}, ${county || null},
                    ${latitude || null}, ${longitude || null},
                    ${service_area || null}, ${project_description || null}, ${status || 'not_contacted'}, ${notes || null}
                )
                RETURNING *
            `;

            await logActivity('nofa_recipient_created', 'NOFA Recipient', result.rows[0].id, {
                company: company_name,
                funding: funding_amount
            });

            return res.status(201).json({
                success: true,
                data: result.rows[0],
                message: 'Recipient added successfully'
            });
        }

        // PUT - Update recipient
        if (req.method === 'PUT' && req.query.id) {
            const id = parseInt(req.query.id);
            
            const {
                company_name,
                contact_person,
                email,
                phone,
                website,
                funding_amount,
                grant_program,
                award_date,
                address,
                city,
                state,
                zip,
                county,
                latitude,
                longitude,
                service_area,
                project_description,
                status,
                is_prospect,
                notes
            } = req.body;

            const result = await sql`
                UPDATE nofa_recipients
                SET 
                    company_name = COALESCE(${company_name}, company_name),
                    contact_person = COALESCE(${contact_person}, contact_person),
                    email = COALESCE(${email}, email),
                    phone = COALESCE(${phone}, phone),
                    website = COALESCE(${website}, website),
                    funding_amount = COALESCE(${funding_amount}, funding_amount),
                    grant_program = COALESCE(${grant_program}, grant_program),
                    award_date = COALESCE(${award_date}, award_date),
                    address = COALESCE(${address}, address),
                    city = COALESCE(${city}, city),
                    state = COALESCE(${state}, state),
                    zip = COALESCE(${zip}, zip),
                    county = COALESCE(${county}, county),
                    latitude = COALESCE(${latitude}, latitude),
                    longitude = COALESCE(${longitude}, longitude),
                    service_area = COALESCE(${service_area}, service_area),
                    project_description = COALESCE(${project_description}, project_description),
                    status = COALESCE(${status}, status),
                    is_prospect = COALESCE(${is_prospect}, is_prospect),
                    notes = COALESCE(${notes}, notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (result.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Recipient not found', 404);
            }

            await logActivity('nofa_recipient_updated', 'NOFA Recipient', id, {
                company: result.rows[0].company_name,
                changes: Object.keys(req.body)
            });

            return res.status(200).json({
                success: true,
                data: result.rows[0],
                message: 'Recipient updated successfully'
            });
        }

        // DELETE - Delete recipient
        if (req.method === 'DELETE' && req.query.id) {
            const id = parseInt(req.query.id);
            
            // Get recipient info before deleting for logging
            const recipient = await sql`SELECT company_name FROM nofa_recipients WHERE id = ${id}`;
            
            if (recipient.rows.length === 0) {
                return sendErrorResponse(res, 'NOT_FOUND', 'Recipient not found', 404);
            }

            await sql`DELETE FROM nofa_recipients WHERE id = ${id}`;

            await logActivity('nofa_recipient_deleted', 'NOFA Recipient', id, {
                company: recipient.rows[0].company_name
            });

            return res.status(200).json({
                success: true,
                message: 'Recipient deleted successfully'
            });
        }

        return sendErrorResponse(res, 'INVALID_REQUEST', 'Invalid request', 400);

    } catch (error) {
        console.error('NOFA Recipients API Error:', error);
        return sendErrorResponse(res, 'SERVER_ERROR', 'Failed to process request', 500);
    }
};
