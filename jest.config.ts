import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  collectCoverageFrom: ['src/**/*.ts', '!src/types/**'],
  coverageDirectory: 'coverage',
  setupFiles: ['<rootDir>/tests/setup.ts'],
};

export default config;