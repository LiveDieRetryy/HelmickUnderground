/**
 * Jest Configuration
 * Testing framework configuration for Helmick Underground LLC
 */

module.exports = {
    // Test environment
    testEnvironment: 'node',
    
    // Test file patterns
    testMatch: [
        '**/tests/**/*.test.js',
        '**/__tests__/**/*.js'
    ],
    
    // Coverage collection
    collectCoverageFrom: [
        'admin/**/*.js',
        'api/**/*.js',
        '!admin/**/*.html',
        '!api/**/node_modules/**',
        '!**/tests/**',
        '!**/__tests__/**'
    ],
    
    // Coverage thresholds
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    
    // Setup files
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // Module paths
    moduleDirectories: ['node_modules', '<rootDir>'],
    
    // Verbose output
    verbose: true,
    
    // Timeout for tests (10 seconds)
    testTimeout: 10000
};
