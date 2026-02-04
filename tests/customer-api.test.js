/**
 * Integration Tests for Customer API
 * Tests API endpoints with mocked database
 */

const httpMocks = require('node-mocks-http');

// Mock @vercel/postgres
const mockQuery = jest.fn();
jest.mock('@vercel/postgres', () => ({
    sql: mockQuery
}));

// Skip these tests - require full module system setup
describe.skip('Customer API Integration', () => {
    let req, res;

    beforeEach(() => {
        req = httpMocks.createRequest();
        res = httpMocks.createResponse();
        jest.clearAllMocks();
        
        // Mock successful table creation
        mockQuery.mockResolvedValue({ rows: [] });
    });

    describe('GET /api/customers', () => {
        test('should return all customers with pagination', async () => {
            const mockCustomers = [
                { id: 1, name: 'Customer 1', type: 'residential', phone: '515-555-0001' },
                { id: 2, name: 'Customer 2', type: 'commercial', phone: '515-555-0002' }
            ];

            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [{ count: '2' }] }) // Count
                .mockResolvedValueOnce({ rows: mockCustomers }); // Customers

            req.method = 'GET';
            req.query = { action: 'all', page: '1', limit: '25' };

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.customers).toHaveLength(2);
            expect(data.pagination.totalCount).toBe(2);
        });

        test('should return single customer by ID', async () => {
            const mockCustomer = { 
                id: 1, 
                name: 'Test Customer', 
                type: 'residential',
                phone: '515-555-0001'
            };

            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [mockCustomer] }); // Customer

            req.method = 'GET';
            req.query = { id: '1' };

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.name).toBe('Test Customer');
        });

        test('should return 404 for non-existent customer', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [] }); // No customer found

            req.method = 'GET';
            req.query = { id: '999' };

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(404);
            const data = JSON.parse(res._getData());
            expect(data.success).toBe(false);
            expect(data.error).toBe('NOT_FOUND');
        });
    });

    describe('POST /api/customers', () => {
        test('should create new customer', async () => {
            const newCustomer = {
                name: 'New Customer',
                type: 'commercial',
                phone: '515-555-0003',
                email: 'new@example.com',
                city: 'Des Moines',
                state: 'IA'
            };

            const createdCustomer = { id: 3, ...newCustomer };

            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [createdCustomer] }); // Insert

            req.method = 'POST';
            req.body = newCustomer;

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(201);
            const data = JSON.parse(res._getData());
            expect(data.id).toBe(3);
            expect(data.name).toBe('New Customer');
        });
    });

    describe('PUT /api/customers', () => {
        test('should update existing customer', async () => {
            const updatedCustomer = {
                id: 1,
                name: 'Updated Customer',
                type: 'residential',
                phone: '515-555-9999',
                email: 'updated@example.com'
            };

            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [updatedCustomer] }); // Update

            req.method = 'PUT';
            req.query = { id: '1' };
            req.body = updatedCustomer;

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.name).toBe('Updated Customer');
            expect(data.phone).toBe('515-555-9999');
        });
    });

    describe('DELETE /api/customers', () => {
        test('should delete existing customer', async () => {
            mockQuery
                .mockResolvedValueOnce({ rows: [] }) // Table creation
                .mockResolvedValueOnce({ rows: [] }) // Index 1
                .mockResolvedValueOnce({ rows: [] }) // Index 2
                .mockResolvedValueOnce({ rows: [] }) // Index 3
                .mockResolvedValueOnce({ rows: [{ id: 1 }] }); // Delete

            req.method = 'DELETE';
            req.query = { id: '1' };

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(200);
            const data = JSON.parse(res._getData());
            expect(data.message).toContain('deleted successfully');
        });
    });

    describe('Error Handling', () => {
        test('should handle database errors', async () => {
            mockQuery.mockRejectedValue(new Error('Database connection failed'));

            req.method = 'GET';
            req.query = { action: 'all' };

            const handler = require('../api/customers');
            await handler(req, res);

            expect(res.statusCode).toBe(500);
            const data = JSON.parse(res._getData());
            expect(data.success).toBe(false);
            expect(data.error).toBe('DATABASE_ERROR');
        });
    });
});
