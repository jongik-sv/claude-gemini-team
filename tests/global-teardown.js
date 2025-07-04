// Jest 글로벌 정리 - 모든 테스트 완료 후 한 번 실행

module.exports = async () => {
    console.log('🧹 테스트 환경 정리 중...');
    
    // 테스트용 임시 파일 정리
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
        // 임시 디렉터리 삭제
        const tmpDir = path.join(process.cwd(), 'tests/tmp');
        await fs.rmdir(tmpDir, { recursive: true });
    } catch (error) {
        // 파일이 없는 경우 무시
    }
    
    console.log('✅ 테스트 환경 정리 완료');
};