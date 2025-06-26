module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/integration/**/*.test.ts', '**/jest-tests/**/*.test.ts'],
    transform: {
        '^.+\\.tsx?$': [
            'ts-jest',
            {
                tsconfig: 'tests/tsconfig.json',
            },
        ],
        '^.+\\.jsx?$': 'babel-jest', // Use babel-jest for .js and .jsx files
    },
    transformIgnorePatterns: [
        // Allow transpiling specific problematic ESM modules in node_modules
        '/node_modules/',
    ],
    moduleNameMapper: {
        '^@graphprotocol/graph-ts$': '<rootDir>/tests/__mocks__/@graphprotocol/graph-ts.ts',
        '^../../generated/schema$': '<rootDir>/tests/__mocks__/generated/schema.ts',
        '^../../generated/templates/cToken/cToken$': '<rootDir>/tests/__mocks__/generated/templates/cToken/cToken.ts',
    },
};