/**
 * Tests for Form Validation
 * Tests validation functions from form-validation.js
 */

// Skip these tests until form-validation.js is created
describe.skip('Form Validation', () => {
    describe('Validation Rules', () => {
        test('required rule should validate non-empty values', () => {
            expect(window.validationRules.required('test')).toBe(true);
            expect(window.validationRules.required('')).toBe(false);
            expect(window.validationRules.required(null)).toBe(false);
            expect(window.validationRules.required(undefined)).toBe(false);
        });

        test('email rule should validate email format', () => {
            expect(window.validationRules.email('test@example.com')).toBe(true);
            expect(window.validationRules.email('user.name@domain.co.uk')).toBe(true);
            expect(window.validationRules.email('invalid')).toBe(false);
            expect(window.validationRules.email('invalid@')).toBe(false);
            expect(window.validationRules.email('@domain.com')).toBe(false);
        });

        test('phone rule should validate phone format', () => {
            expect(window.validationRules.phone('515-555-1234')).toBe(true);
            expect(window.validationRules.phone('(515) 555-1234')).toBe(true);
            expect(window.validationRules.phone('5155551234')).toBe(true);
            expect(window.validationRules.phone('abc')).toBe(false);
            expect(window.validationRules.phone('123')).toBe(false);
        });

        test('minLength rule should validate minimum length', () => {
            const minLength5 = window.validationRules.minLength(5);
            expect(minLength5('12345')).toBe(true);
            expect(minLength5('123456')).toBe(true);
            expect(minLength5('1234')).toBe(false);
        });

        test('maxLength rule should validate maximum length', () => {
            const maxLength10 = window.validationRules.maxLength(10);
            expect(maxLength10('1234567890')).toBe(true);
            expect(maxLength10('123456789')).toBe(true);
            expect(maxLength10('12345678901')).toBe(false);
        });

        test('number rule should validate numeric values', () => {
            expect(window.validationRules.number('123')).toBe(true);
            expect(window.validationRules.number('123.45')).toBe(true);
            expect(window.validationRules.number('-123')).toBe(true);
            expect(window.validationRules.number('abc')).toBe(false);
            expect(window.validationRules.number('12a3')).toBe(false);
        });

        test('min rule should validate minimum value', () => {
            const min10 = window.validationRules.min(10);
            expect(min10('10')).toBe(true);
            expect(min10('15')).toBe(true);
            expect(min10('9')).toBe(false);
        });

        test('max rule should validate maximum value', () => {
            const max100 = window.validationRules.max(100);
            expect(max100('100')).toBe(true);
            expect(max100('50')).toBe(true);
            expect(max100('101')).toBe(false);
        });

        test('url rule should validate URL format', () => {
            expect(window.validationRules.url('https://example.com')).toBe(true);
            expect(window.validationRules.url('http://test.org/page')).toBe(true);
            expect(window.validationRules.url('ftp://files.com')).toBe(true);
            expect(window.validationRules.url('invalid')).toBe(false);
            expect(window.validationRules.url('not a url')).toBe(false);
        });

        test('date rule should validate date format', () => {
            expect(window.validationRules.date('2026-02-04')).toBe(true);
            expect(window.validationRules.date('01/15/2026')).toBe(true);
            expect(window.validationRules.date('invalid')).toBe(false);
            expect(window.validationRules.date('2026-13-45')).toBe(false);
        });
    });

    describe('Error Messages', () => {
        test('should return correct error message for each rule', () => {
            expect(window.validationMessages.required).toBe('This field is required');
            expect(window.validationMessages.email).toBe('Please enter a valid email address');
            expect(window.validationMessages.phone).toBe('Please enter a valid phone number');
            expect(window.validationMessages.number).toBe('Please enter a valid number');
            expect(window.validationMessages.url).toBe('Please enter a valid URL');
            expect(window.validationMessages.date).toBe('Please enter a valid date');
        });

        test('should handle dynamic error messages', () => {
            expect(window.validationMessages.minLength(5)).toContain('at least 5');
            expect(window.validationMessages.maxLength(10)).toContain('at most 10');
            expect(window.validationMessages.min(10)).toContain('at least 10');
            expect(window.validationMessages.max(100)).toContain('at most 100');
        });
    });
});
