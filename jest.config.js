module.exports = {
    testEnvironment: 'node',
    testMatch: ['**/tests/integration/**/*.test.ts'],
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
        '/node_modules/(?!graphql-request|other-esm-module-if-needed)/',
    ],
};