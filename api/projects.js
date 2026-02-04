import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Check if database is configured
    if (!process.env.POSTGRES_URL && !process.env.POSTGRES_PRISMA_URL) {
        return res.status(503).json({ 
            error: 'Database not configured. Please add Vercel Postgres to your project.' 
        });
    }

    try {
        // Create projects table if it doesn't exist
        await sql`
            CREATE TABLE IF NOT EXISTS projects (
                id BIGSERIAL PRIMARY KEY,
                project_number VARCHAR(100) UNIQUE NOT NULL,
                customer_id VARCHAR(255) NOT NULL,
                project_name VARCHAR(255) NOT NULL,
                job_address TEXT,
                job_city VARCHAR(100),
                job_state VARCHAR(2),
                description TEXT,
                status VARCHAR(50) DEFAULT 'accepted',
                start_date DATE,
                estimated_completion DATE,
                actual_completion DATE,
                total_estimate DECIMAL(10,2),
                total_billed DECIMAL(10,2) DEFAULT 0,
                prints JSONB DEFAULT '[]',
                redlines JSONB DEFAULT '[]',
                notes TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        // Add columns if they don't exist (for existing tables)
        await sql`
            DO $$ 
            BEGIN 
                BEGIN
                    ALTER TABLE projects ADD COLUMN IF NOT EXISTS prints JSONB DEFAULT '[]';
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
                BEGIN
                    ALTER TABLE projects ADD COLUMN IF NOT EXISTS redlines JSONB DEFAULT '[]';
                EXCEPTION
                    WHEN duplicate_column THEN NULL;
                END;
            END $$;
        `;

        // Handle GET request
        if (req.method === 'GET') {
            const { customer_id, project_id, status } = req.query;

            if (project_id) {
                // Get single project
                const result = await sql`
                    SELECT * FROM projects 
                    WHERE id = ${project_id}
                `;
                
                if (result.rows.length === 0) {
                    return res.status(404).json({ error: 'Project not found' });
                }
                
                return res.status(200).json(result.rows[0]);
            } else if (customer_id) {
                // Get projects for customer with optional status filter
                let query;
                if (status) {
                    query = await sql`
                        SELECT * FROM projects 
                        WHERE customer_id = ${customer_id} AND status = ${status}
                        ORDER BY created_at DESC
                    `;
                } else {
                    query = await sql`
                        SELECT * FROM projects 
                        WHERE customer_id = ${customer_id}
                        ORDER BY created_at DESC
                    `;
                }
                
                return res.status(200).json(query.rows);
            } else {
                // Get all projects
                const result = await sql`
                    SELECT * FROM projects 
                    ORDER BY created_at DESC
                `;
                return res.status(200).json(result.rows);
            }
        }

        // Handle POST request (create new project)
        if (req.method === 'POST') {
            const {
                project_number,
                customer_id,
                project_name,
                job_address,
                job_city,
                job_state,
                description,
                status,
                start_date,
                estimated_completion,
                total_estimate,
                notes
            } = req.body;

            // Validate required fields
            if (!project_number || !customer_id || !project_name) {
                return res.status(400).json({ 
                    error: 'Missing required fields: project_number, customer_id, and project_name are required' 
                });
            }

            const result = await sql`
                INSERT INTO projects (
                    project_number, customer_id, project_name, job_address, 
                    job_city, job_state, description, status, start_date, 
                    estimated_completion, total_estimate, notes
                )
                VALUES (
                    ${project_number}, ${customer_id}, ${project_name}, ${job_address || null},
                    ${job_city || null}, ${job_state || null}, ${description || null}, ${status || 'accepted'}, 
                    ${start_date || null}, ${estimated_completion || null}, ${total_estimate || 0}, ${notes || null}
                )
                RETURNING *
            `;

            return res.status(201).json(result.rows[0]);
        }

        // Handle PUT request (update project)
        if (req.method === 'PUT') {
            const { project_id } = req.query;
            
            if (!project_id) {
                return res.status(400).json({ error: 'Project ID is required' });
            }

            const {
                project_name,
                job_address,
                job_city,
                job_state,
                description,
                status,
                start_date,
                estimated_completion,
                actual_completion,
                total_estimate,
                total_billed,
                prints,
                redlines,
                notes
            } = req.body;

            const result = await sql`
                UPDATE projects 
                SET 
                    project_name = COALESCE(${project_name}, project_name),
                    job_address = COALESCE(${job_address}, job_address),
                    job_city = COALESCE(${job_city}, job_city),
                    job_state = COALESCE(${job_state}, job_state),
                    description = COALESCE(${description}, description),
                    status = COALESCE(${status}, status),
                    start_date = COALESCE(${start_date}, start_date),
                    estimated_completion = COALESCE(${estimated_completion}, estimated_completion),
                    actual_completion = COALESCE(${actual_completion}, actual_completion),
                    total_estimate = COALESCE(${total_estimate}, total_estimate),
                    total_billed = COALESCE(${total_billed}, total_billed),
                    prints = COALESCE(${prints ? JSON.stringify(prints) : null}::jsonb, prints),
                    redlines = COALESCE(${redlines ? JSON.stringify(redlines) : null}::jsonb, redlines),
                    notes = COALESCE(${notes}, notes),
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${project_id}
                RETURNING *
            `;

            if (result.rows.length === 0) {
                return res.status(404).json({ error: 'Project not found' });
            }

            return res.status(200).json(result.rows[0]);
        }

        // Handle DELETE request
        if (req.method === 'DELETE') {
            const { project_id } = req.query;
            
            if (!project_id) {
                return res.status(400).json({ error: 'Project ID is required' });
            }

            await sql`
                DELETE FROM projects 
                WHERE id = ${project_id}
            `;

            return res.status(200).json({ message: 'Project deleted successfully' });
        }

        return res.status(405).json({ error: 'Method not allowed' });

    } catch (error) {
        console.error('Projects API error:', error);
        return res.status(500).json({ 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
}
