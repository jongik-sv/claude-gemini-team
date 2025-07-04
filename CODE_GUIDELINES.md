# Claude-Gemini 팀 협업 시스템 코드 가이드라인

## 개요
이 가이드라인은 Claude Pro와 Gemini Free가 팀으로 협업하는 시스템의 코드 품질과 일관성을 보장하기 위한 표준을 정의합니다.

## 코드 구조 및 아키텍처

### 디렉터리 구조
```
claude-gemini-team/
├── src/
│   ├── core/
│   │   ├── team-manager.js
│   │   ├── workflow-engine.js
│   │   └── communication-protocol.js
│   ├── agents/
│   │   ├── claude-agent.js
│   │   └── gemini-agent.js
│   ├── tools/
│   │   ├── mcp-orchestrator.js
│   │   └── conflict-resolver.js
│   ├── visualization/
│   │   ├── log-visualizer.js
│   │   └── progress-visualizer.js
│   └── utils/
│       ├── file-manager.js
│       └── state-manager.js
├── config/
│   ├── team-config.json
│   └── mcp-tools.json
├── shared/
│   ├── workflows/
│   ├── results/
│   └── states/
└── tests/
    ├── unit/
    └── integration/
```

### 모듈 설계 원칙
- **단일 책임 원칙**: 각 모듈은 하나의 명확한 책임을 가져야 함
- **의존성 주입**: 생성자를 통한 의존성 주입으로 테스트 용이성 확보
- **인터페이스 분리**: 역할별 인터페이스 분리로 유연성 확보

## 네이밍 컨벤션

### 클래스 및 생성자
```javascript
// 클래스는 PascalCase
class TeamManager {
    constructor() {}
}

// 팩토리 함수는 camelCase
function createTeamManager() {}
```

### 변수 및 함수
```javascript
// 변수는 camelCase
const teamMembers = new Map();
const workflowEngine = new WorkflowEngine();

// 함수는 camelCase, 동사로 시작
function addTeamMember(memberConfig) {}
function assignTaskToAgent(agentId, task) {}

// 상수는 UPPER_SNAKE_CASE
const MAX_TEAM_SIZE = 10;
const DEFAULT_TIMEOUT = 30000;
```

### 에이전트 식별자
```javascript
// 에이전트 ID는 snake_case
const agentIds = {
    CLAUDE_LEADER: 'claude_leader',
    KIM_SENIOR: 'kim_senior',
    LEE_RESEARCHER: 'lee_researcher',
    PARK_DEVELOPER: 'park_developer'
};
```

## 에러 처리 및 로깅

### 에러 처리 패턴
```javascript
// 표준 에러 처리
async function executeTask(task) {
    try {
        const result = await performTask(task);
        return result;
    } catch (error) {
        logger.error(`Task execution failed: ${task.id}`, {
            error: error.message,
            stack: error.stack,
            taskId: task.id
        });
        throw new TaskExecutionError(error.message, task.id);
    }
}

// 커스텀 에러 클래스
class TaskExecutionError extends Error {
    constructor(message, taskId) {
        super(message);
        this.name = 'TaskExecutionError';
        this.taskId = taskId;
    }
}
```

### 로깅 표준
```javascript
// 구조화된 로깅
const logger = require('./utils/logger');

// 에이전트별 로깅
logger.info('Task assigned', {
    agent: 'claude_leader',
    taskId: 'task_001',
    type: 'planning',
    timestamp: new Date().toISOString()
});

// 성능 로깅
logger.performance('Task execution time', {
    agent: 'gemini_researcher',
    taskId: 'task_002',
    duration: 1250,
    success: true
});
```

## 비동기 처리 가이드라인

### Promise 및 async/await
```javascript
// async/await 사용
async function processWorkflow(workflow) {
    const tasks = await this.distributeTasks(workflow);
    
    // 병렬 처리
    const results = await Promise.allSettled(
        tasks.map(task => this.executeTask(task))
    );
    
    return this.integrateResults(results);
}

// 타임아웃 처리
async function executeWithTimeout(task, timeout = 30000) {
    return Promise.race([
        this.executeTask(task),
        new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout')), timeout)
        )
    ]);
}
```

### 동시성 제어
```javascript
// 세마포어 패턴
class ConcurrencyLimiter {
    constructor(maxConcurrency = 3) {
        this.maxConcurrency = maxConcurrency;
        this.running = 0;
        this.queue = [];
    }
    
    async execute(task) {
        return new Promise((resolve, reject) => {
            this.queue.push({ task, resolve, reject });
            this.process();
        });
    }
    
    async process() {
        if (this.running >= this.maxConcurrency || this.queue.length === 0) {
            return;
        }
        
        this.running++;
        const { task, resolve, reject } = this.queue.shift();
        
        try {
            const result = await task();
            resolve(result);
        } catch (error) {
            reject(error);
        } finally {
            this.running--;
            this.process();
        }
    }
}
```

## 데이터 구조 표준

### 태스크 정의
```javascript
// 표준 태스크 스키마
const taskSchema = {
    id: String,              // 고유 식별자
    type: String,            // 태스크 타입
    description: String,     // 태스크 설명
    priority: Number,        // 우선순위 (1-5)
    assignee: String,        // 담당 에이전트
    dependencies: [String],  // 의존성 태스크 ID
    status: String,          // 상태 (pending, in_progress, completed, failed)
    createdAt: Date,         // 생성 시간
    updatedAt: Date,         // 수정 시간
    metadata: Object         // 추가 메타데이터
};
```

### 에이전트 상태
```javascript
// 에이전트 상태 스키마
const agentStateSchema = {
    id: String,
    name: String,
    role: String,
    status: String,          // active, busy, idle, offline
    currentTask: String,     // 현재 작업 중인 태스크 ID
    capabilities: [String],  // 능력 목록
    workload: Number,        // 현재 작업 부하 (0-100)
    lastHeartbeat: Date,     // 마지막 활동 시간
    performance: {
        tasksCompleted: Number,
        averageTime: Number,
        successRate: Number
    }
};
```

## 통신 프로토콜 표준

### 메시지 포맷
```javascript
// 표준 메시지 구조
const messageSchema = {
    header: {
        messageId: String,
        sender: String,
        recipient: String,
        timestamp: Date,
        messageType: String,
        priority: String
    },
    payload: Object,
    metadata: {
        correlationId: String,
        context: Object,
        retry: Number
    }
};
```

### MCP 도구 통합
```javascript
// MCP 도구 래퍼
class MCPToolWrapper {
    constructor(toolName, endpoint) {
        this.toolName = toolName;
        this.endpoint = endpoint;
        this.client = new MCPClient(endpoint);
    }
    
    async callTool(method, params) {
        try {
            const result = await this.client.call(method, params);
            return this.formatResult(result);
        } catch (error) {
            throw new MCPToolError(
                `${this.toolName} tool failed: ${error.message}`
            );
        }
    }
    
    formatResult(result) {
        return {
            success: true,
            data: result,
            tool: this.toolName,
            timestamp: new Date().toISOString()
        };
    }
}
```

## 테스트 가이드라인

### 단위 테스트
```javascript
// Jest 기반 테스트
describe('TeamManager', () => {
    let teamManager;
    
    beforeEach(() => {
        teamManager = new TeamManager();
    });
    
    test('should add team member successfully', async () => {
        const memberConfig = {
            id: 'test_agent',
            name: 'Test Agent',
            role: 'developer'
        };
        
        await teamManager.addTeamMember(memberConfig);
        
        expect(teamManager.teamMembers.has('test_agent')).toBe(true);
    });
});
```

### 통합 테스트
```javascript
// 전체 워크플로우 테스트
describe('Integration: Task Execution', () => {
    test('should execute simple workflow end-to-end', async () => {
        const teamSystem = new ClaudeGeminiTeamSystem();
        await teamSystem.initializeTeam();
        
        const result = await teamSystem.executeProject(
            'Create a simple calculator'
        );
        
        expect(result.success).toBe(true);
        expect(result.outputs).toBeDefined();
    });
});
```

## 성능 최적화 가이드라인

### 메모리 관리
```javascript
// 메모리 누수 방지
class TaskExecutor {
    constructor() {
        this.activeStreams = new Set();
    }
    
    async executeTask(task) {
        const stream = this.createTaskStream(task);
        this.activeStreams.add(stream);
        
        try {
            const result = await this.processStream(stream);
            return result;
        } finally {
            this.activeStreams.delete(stream);
            stream.destroy();
        }
    }
    
    cleanup() {
        this.activeStreams.forEach(stream => stream.destroy());
        this.activeStreams.clear();
    }
}
```

### 캐싱 전략
```javascript
// Redis 기반 캐싱
class ResultCache {
    constructor(redisClient) {
        this.redis = redisClient;
        this.defaultTTL = 3600; // 1시간
    }
    
    async get(key) {
        const cached = await this.redis.get(key);
        return cached ? JSON.parse(cached) : null;
    }
    
    async set(key, value, ttl = this.defaultTTL) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
    }
    
    generateCacheKey(agent, task) {
        return `result:${agent}:${task.type}:${this.hashTask(task)}`;
    }
}
```

## 보안 가이드라인

### API 키 관리
```javascript
// 환경 변수 기반 설정
const config = {
    claude: {
        apiKey: process.env.CLAUDE_API_KEY,
        endpoint: process.env.CLAUDE_ENDPOINT
    },
    gemini: {
        apiKey: process.env.GEMINI_API_KEY,
        endpoint: process.env.GEMINI_ENDPOINT
    }
};

// 키 검증
function validateApiKeys() {
    const requiredKeys = ['CLAUDE_API_KEY', 'GEMINI_API_KEY'];
    const missingKeys = requiredKeys.filter(key => !process.env[key]);
    
    if (missingKeys.length > 0) {
        throw new Error(`Missing API keys: ${missingKeys.join(', ')}`);
    }
}
```

### 입력 검증
```javascript
// 스키마 기반 검증
const Joi = require('joi');

const taskSchema = Joi.object({
    id: Joi.string().required(),
    type: Joi.string().valid('coding', 'research', 'planning').required(),
    description: Joi.string().max(1000).required(),
    priority: Joi.number().integer().min(1).max(5).required()
});

function validateTask(task) {
    const { error, value } = taskSchema.validate(task);
    if (error) {
        throw new ValidationError(error.details[0].message);
    }
    return value;
}
```

## 모니터링 및 메트릭

### 성능 메트릭
```javascript
// 성능 추적
class PerformanceTracker {
    constructor() {
        this.metrics = new Map();
    }
    
    startTimer(operation) {
        const startTime = process.hrtime.bigint();
        return () => {
            const duration = Number(process.hrtime.bigint() - startTime) / 1000000;
            this.recordMetric(operation, duration);
        };
    }
    
    recordMetric(operation, duration) {
        if (!this.metrics.has(operation)) {
            this.metrics.set(operation, {
                count: 0,
                totalTime: 0,
                minTime: Infinity,
                maxTime: 0
            });
        }
        
        const metric = this.metrics.get(operation);
        metric.count++;
        metric.totalTime += duration;
        metric.minTime = Math.min(metric.minTime, duration);
        metric.maxTime = Math.max(metric.maxTime, duration);
    }
}
```

## 문서화 표준

### JSDoc 주석
```javascript
/**
 * 팀원을 추가하고 워크플로우 엔진에 등록합니다.
 * @param {Object} memberConfig - 팀원 설정
 * @param {string} memberConfig.id - 고유 식별자
 * @param {string} memberConfig.name - 팀원 이름
 * @param {string} memberConfig.role - 역할
 * @param {string[]} memberConfig.capabilities - 능력 목록
 * @returns {Promise<void>} 등록 완료 시 resolve
 * @throws {ValidationError} 잘못된 설정 시 발생
 * @example
 * await teamManager.addTeamMember({
 *   id: 'claude_leader',
 *   name: '팀장',
 *   role: 'leader',
 *   capabilities: ['planning', 'coordination']
 * });
 */
async addTeamMember(memberConfig) {
    // 구현 코드
}
```

이 가이드라인을 따르면 유지보수 가능하고 확장 가능한 Claude-Gemini 팀 협업 시스템을 구축할 수 있습니다.