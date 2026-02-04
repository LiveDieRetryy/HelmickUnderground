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
            CREATE TABLE IF NOT EXISTS customers (
                id BIGSERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                type VARCHAR(50) NOT NULL,
                contact_person VARCHAR(255),
                phone VARCHAR(50) NOT NULL,
                email VARCHAR(255),
                preferred_contact VARCHAR(50),
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(2),
                zip VARCHAR(20),
                notes TEXT,
                custom_line_items JSONB DEFAULT '[]',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `;

        const action = req.query.action || 'all';

        // GET all customers
        if (req.method === 'GET' && action === 'all') {
            const { rows } = await sql`
                SELECT * FROM customers 
                ORDER BY name ASC
            `;
            return res.status(200).json(rows);
        }

        // GET single customer by ID
        if (req.method === 'GET' && action === 'get') {
            const { id } = req.query;
            const { rows } = await sql`
                SELECT * FROM customers 
                WHERE id = ${id}
            `;
            if (rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }
            return res.status(200).json(rows[0]);
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
                custom_line_items
            } = req.body;

            const { rows } = await sql`
                INSERT INTO customers (
                    name, type, contact_person, phone, email, 
                    preferred_contact, address, city, state, zip, 
                    notes, custom_line_items
                )
                VALUES (
                    ${name}, ${type}, ${contact_person}, ${phone}, ${email},
                    ${preferred_contact}, ${address}, ${city}, ${state}, ${zip},
                    ${notes}, ${JSON.stringify(custom_line_items || [])}
                )
                RETURNING *
            `;

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
                custom_line_items
            } = req.body;

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
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ${id}
                RETURNING *
            `;

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }

            return res.status(200).json(rows[0]);
        }

        // DELETE customer
        if (req.method === 'DELETE') {
            const { id } = req.query;

            const { rows } = await sql`
                DELETE FROM customers 
                WHERE id = ${id}
                RETURNING *
            `;

            if (rows.length === 0) {
                return res.status(404).json({ error: 'Customer not found' });
            }

            return res.status(200).json({ message: 'Customer deleted successfully' });
        }

        return res.status(400).json({ error: 'Invalid request' });

    } catch (error) {
        console.error('Database error:', error);
        return res.status(500).json({ error: 'Database error', details: error.message });
    }
};
