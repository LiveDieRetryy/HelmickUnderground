/**
 * Activity Log API
 * Tracks all admin actions (CRUD operations) for audit trail
 */

import { sql } from '@vercel/postgres';

/**
 * Log an admin activity
 * @param {string} action - Type of action (create, read, update, delete)
 * @param {string} resource - Resource type (customer, project, invoice, submission, etc.)
 * @param {number} resourceId - ID of the resource
 * @param {string} adminEmail - Email of admin who performed the action
 * @param {object} details - Additional details about the action
 */
export async function logActivity(action, resource, resourceId, adminEmail, details = {}) {
    try {
        await sql`
            INSERT INTO activity_log (action, resource, resource_id, admin_email, details, timestamp)
            VALUES (${action}, ${resource}, ${resourceId}, ${adminEmail}, ${JSON.stringify(details)}, NOW())
        `;
    } catch (error) {
        console.error('Error logging activity:', error);
        // Don't throw - logging should not break the main operation
    }
}

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        // Create table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                action VARCHAR(50) NOT NULL,
                resource VARCHAR(100) NOT NULL,
                resource_id INTEGER NOT NULL,
                admin_email VARCHAR(255) NOT NULL,
                details JSONB,
                timestamp TIMESTAMP DEFAULT NOW(),
                ip_address VARCHAR(45),
                user_agent TEXT
            )
        `;

        // Create index for efficient querying
        await sql`
            CREATE INDEX IF NOT EXISTS idx_activity_log_timestamp ON activity_log(timestamp DESC)
        `;
        await sql`
            CREATE INDEX IF NOT EXISTS idx_activity_log_resource ON activity_log(resource, resource_id)
        `;
        await sql`
            CREATE INDEX IF NOT EXISTS idx_activity_log_admin ON activity_log(admin_email)
        `;

        if (req.method === 'GET') {
            const { resource, action, adminEmail, limit = 100, offset = 0 } = req.query;

            // Build filters
            const filters = [];
            if (resource) filters.push(sql`resource = ${resource}`);
            if (action) filters.push(sql`action = ${action}`);
            if (adminEmail) filters.push(sql`admin_email = ${adminEmail}`);

            // Get logs with filters
            let result;
            if (filters.length > 0) {
                result = await sql`
                    SELECT * FROM activity_log
                    WHERE ${filters.reduce((acc, filter, idx) => 
                        idx === 0 ? filter : sql`${acc} AND ${filter}`
                    )}
                    ORDER BY timestamp DESC
                    LIMIT ${parseInt(limit)}
                    OFFSET ${parseInt(offset)}
                `;
            } else {
                result = await sql`
                    SELECT * FROM activity_log
                    ORDER BY timestamp DESC
                    LIMIT ${parseInt(limit)}
                    OFFSET ${parseInt(offset)}
                `;
            }

            // Get total count with same filters
            let countResult;
            if (filters.length > 0) {
                countResult = await sql`
                    SELECT COUNT(*)::integer as count FROM activity_log
                    WHERE ${filters.reduce((acc, filter, idx) => 
                        idx === 0 ? filter : sql`${acc} AND ${filter}`
                    )}
                `;
            } else {
                countResult = await sql`
                    SELECT COUNT(*)::integer as count FROM activity_log
                `;
            }
            
            const total = countResult.rows[0].count;

            return res.status(200).json({
                logs: result.rows,
                total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
        }

        if (req.method === 'POST') {
            const { action, resource, resourceId, adminEmail, details } = req.body;

            if (!action || !resource || !resourceId || !adminEmail) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Get IP and user agent from request
            const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress;
            const userAgent = req.headers['user-agent'];

            const result = await sql`
                INSERT INTO activity_log (action, resource, resource_id, admin_email, details, ip_address, user_agent, timestamp)
                VALUES (${action}, ${resource}, ${resourceId}, ${adminEmail}, ${JSON.stringify(details || {})}, ${ip}, ${userAgent}, NOW())
                RETURNING *
            `;

            return res.status(201).json(result.rows[0]);
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Activity log API error:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
}
