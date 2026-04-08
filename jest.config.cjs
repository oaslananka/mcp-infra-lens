/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  roots: ['<rootDir>/test'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },
  reporters: [
    'default',
    [
      'jest-junit',
      {
        outputDirectory: 'coverage/test-results',
        outputName: 'junit.xml'
      }
    ]
  ],
  collectCoverageFrom: ['src/**/*.ts', '!src/mcp.ts', '!src/server-http.ts'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'lcov', 'html', 'cobertura'],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 75,
      lines: 75,
      statements: 75
    },
    './src/analyzer.ts': {
      lines: 85
    },
    './src/baseline.ts': {
      lines: 80
    },
    './src/collector.ts': {
      lines: 75
    }
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: '<rootDir>/tsconfig.test.json'
      }
    ]
  }
};
