/**
 * Tests for Error Handler Utility
 * Tests standardized error handling functions
 */

const {
    ERROR_TYPES,
    createErrorResponse,
    sendErrorResponse,
    validateRequiredFields,
    validateEmail,
    validatePhone
} = require('../api/error-handler');

describe('Error Handler', () => {
    describe('ERROR_TYPES', () => {
        test('should have all error types defined', () => {
            expect(ERROR_TYPES.VALIDATION_ERROR).toBeDefined();
            expect(ERROR_TYPES.AUTHENTICATION_ERROR).toBeDefined();
            expect(ERROR_TYPES.AUTHORIZATION_ERROR).toBeDefined();
            expect(ERROR_TYPES.NOT_FOUND).toBeDefined();
            expect(ERROR_TYPES.CONFLICT).toBeDefined();
            expect(ERROR_TYPES.RATE_LIMIT).toBeDefined();
            expect(ERROR_TYPES.DATABASE_ERROR).toBeDefined();
            expect(ERROR_TYPES.INTERNAL_ERROR).toBeDefined();
            expect(ERROR_TYPES.SERVICE_UNAVAILABLE).toBeDefined();
        });

        test('should have correct status codes', () => {
            expect(ERROR_TYPES.VALIDATION_ERROR.code).toBe(400);
            expect(ERROR_TYPES.AUTHENTICATION_ERROR.code).toBe(401);
            expect(ERROR_TYPES.AUTHORIZATION_ERROR.code).toBe(403);
            expect(ERROR_TYPES.NOT_FOUND.code).toBe(404);
            expect(ERROR_TYPES.CONFLICT.code).toBe(409);
            expect(ERROR_TYPES.RATE_LIMIT.code).toBe(429);
            expect(ERROR_TYPES.DATABASE_ERROR.code).toBe(500);
            expect(ERROR_TYPES.INTERNAL_ERROR.code).toBe(500);
            expect(ERROR_TYPES.SERVICE_UNAVAILABLE.code).toBe(503);
        });
    });

    describe('createErrorResponse', () => {
        test('should create error response with default message', () => {
            const response = createErrorResponse('NOT_FOUND');
            
            expect(response.success).toBe(false);
            expect(response.error).toBe('NOT_FOUND');
            expect(response.message).toBe('Resource not found');
            expect(response.statusCode).toBe(404);
            expect(response.timestamp).toBeDefined();
        });

        test('should create error response with custom message', () => {
            const response = createErrorResponse('NOT_FOUND', 'Customer not found');
            
            expect(response.message).toBe('Customer not found');
        });

        test('should include details in development mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'development';
            
            const error = new Error('Test error');
            const response = createErrorResponse('INTERNAL_ERROR', null, error);
            
            expect(response.details).toBe('Test error');
            expect(response.stack).toBeDefined();
            
            process.env.NODE_ENV = originalEnv;
        });

        test('should not include details in production mode', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const error = new Error('Test error');
            const response = createErrorResponse('INTERNAL_ERROR', null, error);
            
            expect(response.details).toBeUndefined();
            expect(response.stack).toBeUndefined();
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('sendErrorResponse', () => {
        test('should send error response with correct status code', () => {
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };

            sendErrorResponse(mockRes, 'NOT_FOUND', 'Customer not found');

            expect(mockRes.status).toHaveBeenCalledWith(404);
            expect(mockRes.json).toHaveBeenCalledWith(
                expect.objectContaining({
                    success: false,
                    error: 'NOT_FOUND',
                    message: 'Customer not found',
                    statusCode: 404
                })
            );
        });

        test('should log error to console', () => {
            const mockRes = {
                status: jest.fn().mockReturnThis(),
                json: jest.fn()
            };
            const consoleSpy = jest.spyOn(console, 'error');

            sendErrorResponse(mockRes, 'DATABASE_ERROR', 'Database connection failed');

            expect(consoleSpy).toHaveBeenCalled();
        });
    });

    describe('validateRequiredFields', () => {
        test('should not throw when all required fields present', () => {
            const body = { name: 'John', email: 'john@example.com', phone: '555-0123' };
            
            expect(() => {
                validateRequiredFields(body, ['name', 'email', 'phone']);
            }).not.toThrow();
        });

        test('should throw when required field missing', () => {
            const body = { name: 'John', email: 'john@example.com' };
            
            expect(() => {
                validateRequiredFields(body, ['name', 'email', 'phone']);
            }).toThrow('Missing required fields: phone');
        });

        test('should throw when multiple required fields missing', () => {
            const body = { name: 'John' };
            
            expect(() => {
                validateRequiredFields(body, ['name', 'email', 'phone']);
            }).toThrow('Missing required fields: email, phone');
        });
    });

    describe('validateEmail', () => {
        test('should validate correct email format', () => {
            expect(validateEmail('test@example.com')).toBe(true);
            expect(validateEmail('user.name@domain.co.uk')).toBe(true);
            expect(validateEmail('first+last@example.org')).toBe(true);
        });

        test('should reject invalid email format', () => {
            expect(validateEmail('invalid')).toBe(false);
            expect(validateEmail('invalid@')).toBe(false);
            expect(validateEmail('@domain.com')).toBe(false);
            expect(validateEmail('user@.com')).toBe(false);
            expect(validateEmail('user space@domain.com')).toBe(false);
        });
    });

    describe('validatePhone', () => {
        test('should validate correct phone format', () => {
            expect(validatePhone('555-123-4567')).toBe(true);
            expect(validatePhone('(515) 555-1234')).toBe(true);
            expect(validatePhone('5155551234')).toBe(true);
            expect(validatePhone('515 555 1234')).toBe(true);
        });

        test('should reject invalid phone format', () => {
            expect(validatePhone('123')).toBe(false);
            expect(validatePhone('abc-def-ghij')).toBe(false);
            expect(validatePhone('')).toBe(false);
        });
    });
});
