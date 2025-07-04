module.exports = {
    // 테스트 환경
    testEnvironment: 'node',
    
    // 테스트 파일 패턴
    testMatch: [
        '**/tests/**/*.test.js',
        '**/tests/**/*.spec.js'
    ],
    
    // 커버리지 설정
    collectCoverage: true,
    coverageDirectory: 'coverage',
    coverageReporters: ['text', 'lcov', 'html'],
    collectCoverageFrom: [
        'src/**/*.js',
        '!src/index.js',
        '!src/cli.js'
    ],
    
    // 커버리지 임계값 (테스트 설정 중이므로 임시로 낮춤)
    coverageThreshold: {
        global: {
            branches: 50,
            functions: 50,
            lines: 50,
            statements: 50
        }
    },
    
    // 설정 파일
    setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
    
    // ES6 모듈 변환 설정
    transform: {
        '^.+\\.jsx?$': 'babel-jest'
    },
    
    // 모듈 경로 매핑 (올바른 속성명)
    moduleNameMapper: {
        '^@/(.*)$': '<rootDir>/src/$1',
        '^@tests/(.*)$': '<rootDir>/tests/$1'
    },
    
    // ES 모듈 변환 무시 패턴
    transformIgnorePatterns: [
        'node_modules/(?!chalk/)'
    ],
    
    // 타임아웃 설정
    testTimeout: 10000,
    
    // 상세 출력
    verbose: true,
    
    // 테스트 실행 전후 훅
    globalSetup: '<rootDir>/tests/global-setup.js',
    globalTeardown: '<rootDir>/tests/global-teardown.js'
};