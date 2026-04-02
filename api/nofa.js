const { sql } = require('@vercel/postgres');
const { sendErrorResponse, validateRequiredFields, withErrorHandling } = require('../lib/error-handler');
const { requireAuth } = require('../lib/auth-middleware');
const { requireCsrfToken } = require('../lib/csrf-middleware');
const { enforceRateLimit } = require('../lib/rate-limiter');
const { logActivity } = require('./activity-log');

/**
 * Combined NOFA API Handler
 * Manages both NOFA Recipients and Prospects
 * 
 * RECIPIENTS:
 * @endpoint GET /api/nofa?type=recipients&action=all
 * @endpoint GET /api/nofa?type=recipients&id=123
 * @endpoint POST /api/nofa?type=recipients
 * @endpoint PUT /api/nofa?type=recipients&id=123
 * @endpoint DELETE /api/nofa?type=recipients&id=123
 * 
 * PROSPECTS:
 * @endpoint GET /api/nofa?type=prospects&action=all
 * @endpoint GET /api/nofa?type=prospects&id=123
 * @endpoint POST /api/nofa?type=prospects
 * @endpoint PUT /api/nofa?type=prospects&id=123
 * @endpoint DELETE /api/nofa?type=prospects&id=123
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

    const type = req.query.type;

    if (type === 'recipients') {
        return handleRecipients(req, res);
    } else if (type === 'prospects') {
        return handleProspects(req, res);
    } else {
        return sendErrorResponse(res, 'INVALID_REQUEST', 'Missing or invalid type parameter (recipients or prospects)', 400);
    }
};

/**
 * Handle NOFA Recipients operations
 */
async function handleRecipients(req, res) {
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

        // GET all recipients
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
                company_name, contact_person, email, phone, website,
                funding_amount, grant_program, award_date,
                address, city, state, zip, county, latitude, longitude,
                service_area, project_description, status, notes
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
                company_name, contact_person, email, phone, website,
                funding_amount, grant_program, award_date,
                address, city, state, zip, county, latitude, longitude,
                service_area, project_description, status, is_prospect, notes
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
}

/**
 * Handle Prospects operations
 */
async function handleProspects(req, res) {
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
                company_name, contact_person, email, phone, website,
                address, city, state, zip,
                status, last_contacted, next_followup,
                nofa_recipient_id, source, notes
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
                company_name, contact_person, email, phone, website,
                address, city, state, zip,
                status, last_contacted, next_followup, notes
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
}
