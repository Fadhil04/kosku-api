module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/types/**', '!src/worker.ts'],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      lines: 70,
      functions: 70,
    },
  },
  setupFiles: ['<rootDir>/tests/setup.ts'],
  testTimeout: 30000, // integration test butuh waktu lebih lama
};
