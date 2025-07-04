// Jest 테스트 환경 설정

// 전역 테스트 설정
global.console = {
    ...console,
    // 테스트 중 불필요한 로그 출력 제한
    log: jest.fn(), // 테스트 중 불필요한 로그 출력 제한
    debug: jest.fn(),
    info: jest.fn(),
    warn: console.warn, // 경고는 표시
    error: console.error // 에러는 표시
};

// 테스트 환경 변수 설정
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

// 타임아웃 설정
jest.setTimeout(10000);

// 각 테스트 전에 실행
beforeEach(() => {
    // 모든 모킹 함수 초기화
    jest.clearAllMocks();
    
    // 시간 모킹을 위한 실제 타이머 사용
    jest.useRealTimers();
});

// 각 테스트 후에 실행
afterEach(() => {
    // 메모리 정리
    if (global.gc) {
        global.gc();
    }
});

// 전체 테스트 완료 후 실행
afterAll(() => {
    // 리소스 정리
});