export default {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.(t|j)s$': ['ts-jest', {
      useESM: true,
      tsconfig: { module: 'NodeNext', moduleResolution: 'NodeNext' },
    }],
  },
  extensionsToTreatAsEsm: ['.ts'],
  testEnvironment: 'node',
};
