export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      useESM: true,
      tsconfig: { module: 'NodeNext', moduleResolution: 'NodeNext' },
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
};
