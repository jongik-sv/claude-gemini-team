// Jest 글로벌 설정 - 모든 테스트 실행 전 한 번 실행

module.exports = async () => {
    console.log('🧪 테스트 환경 초기화 중...');
    
    // 테스트용 임시 디렉터리 생성
    const fs = require('fs').promises;
    const path = require('path');
    
    const testDirs = [
        'tests/tmp',
        'tests/tmp/shared',
        'tests/tmp/shared/states',
        'tests/tmp/shared/results',
        'tests/tmp/shared/workflows'
    ];
    
    for (const dir of testDirs) {
        try {
            await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
        } catch (error) {
            // 디렉터리가 이미 존재하는 경우 무시
        }
    }
    
    // 테스트용 설정 파일 생성
    const testConfig = {
        team: {
            maxSize: 5,
            defaultRoles: ['leader', 'senior_developer', 'researcher', 'developer'],
            colors: {
                test_leader: 'blue',
                test_developer: 'green'
            }
        },
        communication: {
            messageTimeout: 5000,
            retryAttempts: 2
        },
        performance: {
            maxConcurrentTasks: 3,
            taskTimeout: 10000
        }
    };
    
    await fs.writeFile(
        path.join(process.cwd(), 'tests/tmp/test-config.json'),
        JSON.stringify(testConfig, null, 2)
    );
    
    console.log('✅ 테스트 환경 초기화 완료');
};