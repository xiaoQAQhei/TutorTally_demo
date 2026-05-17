module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  // 匹配测试文件的相对路径与源文件保持一致
  moduleNameMapper: {
    // 从 src/utils/__tests__/ 中的测试文件 mock '../database' → 映射到 src/database
    '^../database$': '<rootDir>/src/database',
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
};
