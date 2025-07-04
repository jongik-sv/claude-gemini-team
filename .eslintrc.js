module.exports = {
    env: {
        browser: false,
        commonjs: true,
        es6: true,
        node: true,
        jest: true
    },
    extends: [
        'eslint:recommended'
    ],
    globals: {
        Atomics: 'readonly',
        SharedArrayBuffer: 'readonly'
    },
    parserOptions: {
        ecmaVersion: 2020,
        sourceType: 'module'
    },
    rules: {
        // 코드 품질
        'complexity': ['error', 10],
        'max-depth': ['error', 4],
        'max-lines': ['error', 500],
        'max-params': ['error', 5],
        'no-console': 'off', // CLI 도구이므로 console 사용 허용
        'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
        
        // 스타일 가이드
        'indent': ['error', 4],
        'quotes': ['error', 'single'],
        'semi': ['error', 'always'],
        'comma-dangle': ['error', 'never'],
        
        // 베스트 프랙티스
        'no-var': 'error',
        'prefer-const': 'error',
        'prefer-arrow-callback': 'error',
        'arrow-spacing': 'error',
        'no-duplicate-imports': 'error',
        
        // 에러 방지
        'no-undef': 'error',
        'no-unreachable': 'error',
        'no-unused-expressions': 'error',
        'no-useless-return': 'error'
    }
};