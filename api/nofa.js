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
    } else if (type === 'scraper') {
        return handleScraper(req, res);
    } else {
        return sendErrorResponse(res, 'INVALID_REQUEST', 'Missing or invalid type parameter (recipients, prospects, or scraper)', 400);
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

/**
 * Handle Auto-Scraper operations
 * Fetches NOFA recipient data from government sources
 */
async function handleScraper(req, res) {
    if (req.method !== 'POST') {
        return sendErrorResponse(res, 'METHOD_NOT_ALLOWED', 'Only POST method allowed for scraper', 405);
    }

    const { source } = req.body;

    try {
        let results = {
            source: source || 'arcgis',
            imported: 0,
            errors: 0,
            details: []
        };

        // Scrape from requested source(s)
        if (source === 'arcgis' || source === 'all') {
            const arcgisResults = await scrapeArcGIS();
            results.imported += arcgisResults.imported;
            results.errors += arcgisResults.errors;
            results.details.push(...arcgisResults.details);
        }
        
        if (source === 'usaspending') {
            const usaSpendingResults = await scrapeUSASpending();
            results.imported += usaSpendingResults.imported;
            results.errors += usaSpendingResults.errors;
            results.details.push(...usaSpendingResults.details);
        }

        return res.status(200).json({
            success: true,
            data: results,
            message: `Imported ${results.imported} recipients from ${results.source}`
        });

    } catch (error) {
        console.error('Scraper error:', error);
        return sendErrorResponse(res, 'SERVER_ERROR', 'Scraper failed: ' + error.message, 500);
    }
}

/**
 * Scrape ArcGIS dashboard for NOFA recipients
 * Dashboard: https://www.arcgis.com/apps/dashboards/7a9f409f086c4036a71d9d1196f164ec
 */
async function scrapeArcGIS() {
    const https = require('https');
    
    const results = {
        imported: 0,
        errors: 0,
        details: [],
        source: 'ArcGIS Feature Service'
    };

    try {
        // ArcGIS Feature Service URL for NOFA009 Projects Layer
        // Layer 2 contains the project-level data with company names and totals
        const serviceUrl = 'services.arcgis.com';
        const servicePath = '/vPD5PVLI6sfkZ5E4/arcgis/rest/services/NOFA009_Awarded_Locations_view/FeatureServer/2/query';
        
        // Query all features with effective_date = '010926' (current awards)
        const query = new URLSearchParams({
            where: "effective_date = '010926'",
            outFields: '*',
            f: 'json',
            returnGeometry: 'true'
        });

        const fullPath = `${servicePath}?${query.toString()}`;
        
        console.log('Fetching from ArcGIS:', fullPath);

        // Make HTTPS request to ArcGIS REST API
        const data = await new Promise((resolve, reject) => {
            const options = {
                hostname: serviceUrl,
                path: fullPath,
                method: 'GET',
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json'
                }
            };

            https.get(options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error('Failed to parse JSON: ' + e.message));
                    }
                });
            }).on('error', reject);
        });

        if (!data.features || data.features.length === 0) {
            results.details.push({
                source: 'ArcGIS',
                status: 'No data found',
                message: 'The query returned no features'
            });
            return results;
        }

        console.log(`Found ${data.features.length} projects from ArcGIS`);

        // Process each feature
        for (const feature of data.features) {
            const attrs = feature.attributes;
            
            try {
                // Map technology code to readable name
                const techMap = {
                    50: 'Fiber',
                    61: 'Satellite',
                    70: 'Unlicensed Fixed Wireless',
                    71: 'Licensed Fixed Wireless'
                };
                
                // Extract funding amount (BEAD support is the federal grant amount)
                const fundingAmount = attrs.bead_support || null;
                const subgranteeMatch = attrs.subgrantee_match || null;
                const totalFunding = fundingAmount && subgranteeMatch 
                    ? fundingAmount + subgranteeMatch 
                    : fundingAmount;
                
                // Build comprehensive notes with all project details
                let notes = `Control ID: ${attrs.controlid}\n`;
                notes += `Technology: ${techMap[attrs.technology] || attrs.technology}\n`;
                notes += `Total Locations: ${attrs.total_locations || 0}, CAI: ${attrs.total_cai || 0}\n`;
                if (attrs.total_unserved) notes += `Unserved: ${attrs.total_unserved}, `;
                if (attrs.total_underserved) notes += `Underserved: ${attrs.total_underserved}\n`;
                if (attrs.download_speed_anticipated && attrs.upload_speed_anticipated) {
                    notes += `Speed: ${attrs.download_speed_anticipated}/${attrs.upload_speed_anticipated} Mbps\n`;
                }
                if (attrs.estimated_jobs) notes += `Est. Jobs: ${attrs.estimated_jobs}\n`;
                if (attrs.uei) notes += `UEI: ${attrs.uei}\n`;
                if (attrs.frn) notes += `FRN: ${attrs.frn}\n`;
                
                // Prepare recipient data
                const recipient = {
                    company_name: attrs.uei_name || 'Unknown',
                    funding_amount: totalFunding,
                    grant_program: 'NOFA 009 - Iowa Broadband',
                    award_date: '2025-09-04', // Posted 9/4/2025 according to metadata
                    city: attrs.project_name ? String(attrs.project_name).split(' - ')[0] : '',
                    state: 'IA',
                    county: attrs.county_name || null,
                    project_description: attrs.project_description || '',
                    service_area: attrs.project_name || '',
                    status: 'not_contacted',
                    is_prospect: false,
                    notes: notes.trim()
                };

                // Get geometry - calculate centroid of polygon and convert from Web Mercator to WGS84
                let latitude = null;
                let longitude = null;
                
                if (feature.geometry && feature.geometry.rings && feature.geometry.rings.length > 0) {
                    const ring = feature.geometry.rings[0];
                    if (ring && ring.length > 0) {
                        let sumX = 0, sumY = 0;
                        ring.forEach(point => {
                            sumX += point[0];
                            sumY += point[1];
                        });
                        const centerX = sumX / ring.length;
                        const centerY = sumY / ring.length;
                        
                        // Convert Web Mercator (EPSG:3857) to WGS84 (EPSG:4326)
                        longitude = (centerX / 20037508.34) * 180;
                        latitude = (Math.atan(Math.exp((centerY / 20037508.34) * Math.PI)) * 360 / Math.PI) - 90;
                    }
                }

                // Check if already exists
                const existing = await sql`
                    SELECT id FROM nofa_recipients 
                    WHERE company_name = ${recipient.company_name} 
                    AND grant_program = ${recipient.grant_program}
                `;

                if (existing.rows.length === 0) {
                    // Insert new recipient
                    await sql`
                        INSERT INTO nofa_recipients (
                            company_name, funding_amount, grant_program, award_date, 
                            city, state, county, project_description, service_area, 
                            status, is_prospect, notes, latitude, longitude
                        )
                        VALUES (
                            ${recipient.company_name}, ${recipient.funding_amount}, ${recipient.grant_program}, 
                            ${recipient.award_date}, ${recipient.city}, ${recipient.state}, ${recipient.county},
                            ${recipient.project_description}, ${recipient.service_area}, ${recipient.status}, 
                            ${recipient.is_prospect}, ${recipient.notes}, ${latitude}, ${longitude}
                        )
                    `;

                    results.imported++;
                    results.details.push({
                        company: recipient.company_name,
                        status: 'Imported',
                        project: attrs.project_name
                    });
                } else {
                    results.details.push({
                        company: recipient.company_name,
                        status: 'Already exists',
                        project: attrs.project_name
                    });
                }

            } catch (error) {
                console.error('Error processing feature:', attrs.uei_name, error);
                console.error('Feature data:', JSON.stringify(attrs).substring(0, 200));
                results.errors++;
                results.details.push({
                    company: attrs.uei_name || 'Unknown',
                    status: 'Error',
                    error: error.message
                });
            }
        }

        console.log(`ArcGIS import complete: ${results.imported} imported, ${results.errors} errors`);
        
    } catch (error) {
        console.error('ArcGIS scrape error:', error);
        results.errors++;
        results.details.push({
            source: 'ArcGIS API',
            status: 'Fatal error',
            error: error.message
        });
    }

    return results;
}

/**
 * Scrape USAspending.gov API for broadband awards in Iowa
 */
async function scrapeUSASpending() {
    const https = require('https');
    
    const results = {
        imported: 0,
        errors: 0,
        details: []
    };

    try {
        // USAspending.gov public API
        const apiUrl = 'api.usaspending.gov';
        const path = '/api/v2/search/spending_by_award/';
        
        const payload = JSON.stringify({
            filters: {
                keywords: ['broadband', 'fiber', 'BEAD', 'ReConnect', 'rural', 'telecommunications'],
                place_of_performance_locations: [
                    { country: 'USA', state: 'IA' }
                ],
                time_period: [
                    { start_date: '2020-01-01', end_date: '2026-12-31' }
                ],
                award_type_codes: ['02', '03', '04', '05']
            },
            fields: ['Award ID', 'Recipient Name', 'Award Amount', 'Start Date', 'Description', 'Awarding Agency'],
            limit: 100,
            page: 1
        });

        const options = {
            hostname: apiUrl,
            port: 443,
            path: path,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload)
            }
        };

        const data = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let body = '';
                res.on('data', (chunk) => { body += chunk; });
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(new Error('Failed to parse API response'));
                    }
                });
            });
            req.on('error', reject);
            req.write(payload);
            req.end();
        });
        
        if (data && data.results) {
            for (const award of data.results) {
                try {
                    const recipientName = award.recipient_name || award.Recipient_Name || award.recipient?.recipient_name;
                    if (!recipientName) continue;

                    const recipient = {
                        company_name: recipientName,
                        funding_amount: award.Award_Amount || award.total_obligation || award.federal_action_obligation,
                        grant_program: award.awarding_agency_name || award.awarding_agency?.toptier_agency?.name || 'Federal Grant',
                        award_date: award.period_of_performance_start_date || award.Start_Date,
                        project_description: award.description || award.Award_Description || 'Broadband deployment project',
                        address: award.recipient_location?.address_line1 || null,
                        city: award.recipient_location?.city_name || null,
                        state: 'IA',
                        zip: award.recipient_location?.zip5 || null,
                        county: award.recipient_location?.county_name || null,
                        status: 'not_contacted',
                        notes: `Imported from USAspending.gov API - Award ID: ${award.award_id || award.generated_internal_id || 'N/A'}`
                    };

                    // Check if already exists
                    const existing = await sql`
                        SELECT id FROM nofa_recipients 
                        WHERE LOWER(company_name) = LOWER(${recipient.company_name})
                        AND (funding_amount = ${recipient.funding_amount} OR funding_amount IS NULL)
                        LIMIT 1
                    `;

                    if (existing.rows.length === 0) {
                        await sql`
                            INSERT INTO nofa_recipients (
                                company_name, funding_amount, grant_program, award_date,
                                project_description, address, city, state, zip, county,
                                status, notes
                            )
                            VALUES (
                                ${recipient.company_name}, ${recipient.funding_amount}, 
                                ${recipient.grant_program}, ${recipient.award_date},
                                ${recipient.project_description}, ${recipient.address},
                                ${recipient.city}, ${recipient.state}, ${recipient.zip},
                                ${recipient.county}, ${recipient.status}, ${recipient.notes}
                            )
                        `;
                        results.imported++;
                        results.details.push({
                            source: 'USAspending.gov',
                            company: recipient.company_name,
                            amount: recipient.funding_amount,
                            status: 'imported'
                        });
                    } else {
                        results.details.push({
                            source: 'USAspending.gov',
                            company: recipient.company_name,
                            status: 'skipped (duplicate)'
                        });
                    }
                } catch (error) {
                    results.errors++;
                    console.error('Error processing award:', error);
                }
            }
        } else {
            results.details.push({
                source: 'USAspending.gov',
                status: 'No data returned from API',
                info: 'Try using CSV import for comprehensive data'
            });
        }
    } catch (error) {
        console.error('USAspending scrape error:', error);
        results.errors++;
        results.details.push({
            source: 'USAspending.gov',
            error: error.message,
            suggestion: 'API may be temporarily unavailable. Use CSV import instead.'
        });
    }

    return results;
}
