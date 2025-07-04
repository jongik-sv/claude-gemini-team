# TDD 개발 규칙

## Test-Driven Development (TDD) 개발 방침

이 프로젝트는 **테스트 주도 개발(TDD)** 방식을 따릅니다. 모든 새로운 기능과 버그 수정은 TDD 사이클을 준수해야 합니다.

## TDD 사이클: Red-Green-Refactor

### 🔴 Red: 실패하는 테스트 작성
1. **기능 명세 이해**: 구현할 기능의 요구사항을 명확히 파악
2. **테스트 케이스 작성**: 예상 동작을 검증하는 테스트 작성
3. **테스트 실행**: 테스트가 실패하는지 확인 (아직 구현되지 않았으므로)

### 🟢 Green: 테스트를 통과하는 최소한의 코드 작성
1. **최소 구현**: 테스트를 통과시키는 가장 간단한 코드 작성
2. **테스트 실행**: 모든 테스트가 통과하는지 확인
3. **기능 검증**: 작성된 코드가 요구사항을 만족하는지 확인

### 🔵 Refactor: 코드 개선
1. **코드 정리**: 중복 제거, 가독성 향상, 구조 개선
2. **테스트 유지**: 리팩터링 중에도 모든 테스트가 통과해야 함
3. **성능 최적화**: 필요시 성능 개선 (테스트로 검증)

## 테스트 작성 규칙

### 1. 테스트 파일 구조
```
tests/
├── unit/                    # 단위 테스트
│   ├── core/
│   │   ├── team-manager.test.js
│   │   └── workflow-engine.test.js
│   ├── agents/
│   │   ├── base-agent.test.js
│   │   ├── claude-agent.test.js
│   │   └── gemini-agent.test.js
│   └── utils/
└── integration/             # 통합 테스트
    ├── team-collaboration.test.js
    └── end-to-end.test.js
```

### 2. 테스트 명명 규칙
- **파일명**: `{모듈명}.test.js`
- **테스트 설명**: `should {expected behavior} when {condition}`
- **그룹화**: `describe` 블록으로 관련 테스트 그룹화

### 3. 테스트 구조 (AAA 패턴)
```javascript
test('should add team member when valid config provided', async () => {
    // Arrange (준비)
    const teamManager = new TeamManager();
    const memberConfig = {
        id: 'test_member',
        name: 'Test Member',
        role: 'developer',
        mcpEndpoint: 'test://endpoint'
    };

    // Act (실행)
    const result = await teamManager.addTeamMember(memberConfig);

    // Assert (검증)
    expect(result.id).toBe('test_member');
    expect(teamManager.getTeamSize()).toBe(1);
});
```

### 4. 모킹 규칙
- **외부 의존성**: 모든 외부 API, 파일 시스템, 네트워크 호출 모킹
- **시간 의존성**: `Date.now()`, `setTimeout` 등 시간 관련 함수 모킹
- **랜덤성**: 랜덤 값 생성 함수 모킹으로 예측 가능한 테스트 작성

```javascript
// 예시: 파일 시스템 모킹
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));
```

## 코드 커버리지 요구사항

### 최소 커버리지 기준
- **라인 커버리지**: 85% 이상
- **함수 커버리지**: 85% 이상
- **브랜치 커버리지**: 80% 이상
- **구문 커버리지**: 85% 이상

### 커버리지 예외
다음 코드는 커버리지 계산에서 제외 가능:
- 에러 핸들링의 극단적인 케이스
- 외부 라이브러리 래퍼
- 로깅 및 디버그 코드
- 설정 파일 로더

## 테스트 유형별 가이드라인

### 1. 단위 테스트 (Unit Tests)
```javascript
// 개별 클래스/함수의 동작 검증
describe('TeamManager', () => {
    let teamManager;

    beforeEach(() => {
        teamManager = new TeamManager();
    });

    test('should initialize with empty team', () => {
        expect(teamManager.getTeamSize()).toBe(0);
    });

    test('should add member with valid configuration', async () => {
        const config = createValidMemberConfig();
        const member = await teamManager.addTeamMember(config);
        
        expect(member).toBeDefined();
        expect(teamManager.getTeamSize()).toBe(1);
    });
});
```

### 2. 통합 테스트 (Integration Tests)
```javascript
// 여러 컴포넌트 간의 상호작용 검증
describe('Team Collaboration Integration', () => {
    test('should execute project with team coordination', async () => {
        const teamSystem = new ClaudeGeminiTeamSystem();
        await teamSystem.initializeTeam();
        
        const result = await teamSystem.executeProject('Test Project');
        
        expect(result.success).toBe(true);
        expect(result.teamParticipation).toHaveLength(4);
    });
});
```

### 3. E2E 테스트 (End-to-End Tests)
```javascript
// 전체 시스템의 워크플로우 검증
describe('Complete Workflow', () => {
    test('should complete full project lifecycle', async () => {
        // 실제 사용자 시나리오 시뮬레이션
        const cli = new CLI();
        const project = await cli.start('AI 웹앱 개발');
        
        expect(project.phases).toContain('완료');
        expect(project.deliverables).toBeDefined();
    });
});
```

## 테스트 실행 명령어

### 개발 중 테스트
```bash
# 모든 테스트 실행
npm test

# 워치 모드 (파일 변경 시 자동 실행)
npm run test:watch

# 특정 파일 테스트
npm test -- team-manager.test.js

# 커버리지 포함 실행
npm run test:coverage
```

### CI/CD 테스트
```bash
# 전체 테스트 (커버리지 포함)
npm run test:ci

# 린트 + 테스트 
npm run quality-check
```

## 테스트 작성 체크리스트

### ✅ 새 기능 개발 시
- [ ] 기능 명세서 작성
- [ ] 실패하는 테스트 작성
- [ ] 최소 구현으로 테스트 통과
- [ ] 엣지 케이스 테스트 추가
- [ ] 에러 처리 테스트 작성
- [ ] 코드 리팩터링 및 최적화
- [ ] 통합 테스트 작성 (필요시)

### ✅ 버그 수정 시  
- [ ] 버그 재현 테스트 작성
- [ ] 테스트가 실패하는지 확인
- [ ] 버그 수정
- [ ] 테스트 통과 확인
- [ ] 회귀 테스트 방지 검증

### ✅ 리팩터링 시
- [ ] 기존 테스트 모두 통과 확인
- [ ] 리팩터링 수행
- [ ] 테스트 재실행으로 동작 검증
- [ ] 성능 테스트 (필요시)

## 테스트 데이터 관리

### 테스트 픽스처
```javascript
// tests/fixtures/team-data.js
export const validMemberConfigs = {
    leader: {
        id: 'claude_leader',
        name: '팀장',
        role: 'leader',
        capabilities: ['planning', 'coordination'],
        mcpEndpoint: 'claude://test'
    },
    developer: {
        id: 'test_developer',
        name: '개발자',
        role: 'developer', 
        capabilities: ['coding', 'testing'],
        mcpEndpoint: 'gemini://test'
    }
};

export const invalidConfigs = {
    missingId: { name: 'Test', role: 'developer' },
    invalidRole: { id: 'test', name: 'Test', role: 'invalid' }
};
```

### 팩토리 함수
```javascript
// tests/helpers/factories.js
export function createTeamMember(overrides = {}) {
    return {
        id: 'test_member',
        name: 'Test Member',
        role: 'developer',
        capabilities: ['coding'],
        mcpEndpoint: 'test://endpoint',
        ...overrides
    };
}

export function createTask(overrides = {}) {
    return {
        id: 'test_task',
        type: 'coding',
        description: 'Test task',
        priority: 3,
        ...overrides
    };
}
```

## 성능 테스트

### 응답 시간 테스트
```javascript
test('should complete task within time limit', async () => {
    const startTime = Date.now();
    
    await agent.executeTask(createTask());
    
    const duration = Date.now() - startTime;
    expect(duration).toBeLessThan(5000); // 5초 이내
});
```

### 메모리 사용량 테스트
```javascript
test('should not leak memory during batch processing', async () => {
    const initialMemory = process.memoryUsage().heapUsed;
    
    for (let i = 0; i < 100; i++) {
        await agent.executeTask(createTask());
    }
    
    global.gc(); // 가비지 컬렉션 강제 실행
    const finalMemory = process.memoryUsage().heapUsed;
    
    expect(finalMemory - initialMemory).toBeLessThan(50 * 1024 * 1024); // 50MB 이내
});
```

## 지속적 통합 (CI) 요구사항

### 커밋 전 체크
- 모든 테스트 통과
- 린트 검사 통과  
- 커버리지 기준 충족
- 타입 검사 통과 (TypeScript 사용 시)

### PR 승인 조건
- 새로운 기능에 대한 테스트 포함
- 기존 테스트 모두 통과
- 코드 리뷰 승인
- 문서 업데이트 (필요시)

이 TDD 규칙을 준수하여 안정적이고 유지보수 가능한 코드를 작성해주세요.