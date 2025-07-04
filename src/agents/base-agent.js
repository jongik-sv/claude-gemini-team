const EventEmitter = require('events');
const chalk = require('chalk');

/**
 * 태스크 정의 클래스
 */
class Task {
    constructor(config) {
        this.id = config.id;
        this.type = config.type;
        this.description = config.description;
        this.data = config.data || {}; // 추가 데이터
        this.priority = config.priority || 3; // 1-5
        this.complexity = config.complexity || 'medium'; // low, medium, high
        this.dependencies = config.dependencies || [];
        this.assignee = config.assignee || null;
        this.status = 'pending'; // pending, in_progress, completed, failed
        this.progress = 0; // 0-100
        this.result = null;
        this.error = null;
        this.createdAt = new Date();
        this.startedAt = null;
        this.completedAt = null;
        this.estimatedTime = config.estimatedTime || 0;
        this.actualTime = 0;
        this.metadata = config.metadata || {};
    }

    /**
     * 태스크 시작
     */
    start() {
        this.status = 'in_progress';
        this.startedAt = new Date();
        this.progress = 5;
    }

    /**
     * 진행률 업데이트
     */
    updateProgress(progress) {
        this.progress = Math.max(0, Math.min(100, progress));
    }

    /**
     * 태스크 완료
     */
    complete(result) {
        this.status = 'completed';
        this.completedAt = new Date();
        this.progress = 100;
        this.result = result;
        this.actualTime = this.completedAt - this.startedAt;
    }

    /**
     * 태스크 실패
     */
    fail(error) {
        this.status = 'failed';
        this.completedAt = new Date();
        this.error = error;
        this.actualTime = this.completedAt - this.startedAt;
    }

    /**
     * 태스크 정보를 JSON으로 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            description: this.description,
            priority: this.priority,
            complexity: this.complexity,
            dependencies: this.dependencies,
            assignee: this.assignee,
            status: this.status,
            progress: this.progress,
            result: this.result,
            error: this.error?.message || this.error,
            createdAt: this.createdAt,
            startedAt: this.startedAt,
            completedAt: this.completedAt,
            estimatedTime: this.estimatedTime,
            actualTime: this.actualTime,
            metadata: this.metadata
        };
    }
}

/**
 * 기본 에이전트 클래스 - 모든 AI 에이전트의 베이스 클래스
 */
class BaseAgent extends EventEmitter {
    constructor(config) {
        super();
        
        this.id = config.id;
        this.name = config.name;
        this.role = config.role;
        this.capabilities = config.capabilities || [];
        this.model = config.model || 'unknown';
        this.endpoint = config.endpoint;
        this.color = config.color || 'white';
        
        // 상태 관리
        this.status = 'idle'; // idle, busy, error, offline
        this.currentTask = null;
        this.taskQueue = [];
        this.workload = 0;
        this.isInitialized = false;
        
        // 성능 추적
        this.performance = {
            tasksCompleted: 0,
            tasksSucceeded: 0,
            tasksFailed: 0,
            totalExecutionTime: 0,
            averageExecutionTime: 0,
            successRate: 100
        };
        
        // 도구 관리
        this.availableTools = new Map();
        this.activeConnections = new Map();
        
        // 설정
        this.maxConcurrentTasks = 1;
        this.taskTimeout = 300000; // 5분
        this.heartbeatInterval = 30000; // 30초
        
        this.setupEventHandlers();
        this.startHeartbeat();
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        this.on('task_started', (task) => {
            this.log(`작업 시작: ${task.description}`, 'info');
        });

        this.on('task_progress', (task, progress) => {
            this.log(`작업 진행: ${task.description} (${progress}%)`, 'info');
        });

        this.on('task_completed', (task) => {
            this.log(`작업 완료: ${task.description}`, 'success');
            this.updatePerformance(task, true);
        });

        this.on('task_failed', (task, error) => {
            this.log(`작업 실패: ${task.description} - ${error.message}`, 'error');
            this.updatePerformance(task, false);
        });
    }

    /**
     * 에이전트 초기화
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            this.log('에이전트 초기화 중...', 'info');
            
            // 하위 클래스에서 구현할 초기화 로직
            await this.onInitialize();
            
            this.isInitialized = true;
            this.status = 'idle';
            
            this.log('에이전트 초기화 완료', 'success');
            this.emit('initialized');
            
        } catch (error) {
            this.status = 'error';
            this.log(`초기화 실패: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 하위 클래스에서 구현할 초기화 로직
     */
    async onInitialize() {
        // 하위 클래스에서 구현
    }

    /**
     * 태스크 실행
     */
    async executeTask(task) {
        // 전처리
        await this.preprocessTask(task);
        
        try {
            // 태스크 시작
            task.start();
            this.currentTask = task;
            this.status = 'busy';
            this.emit('task_started', task);

            // 타임아웃 설정
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => reject(new Error('Task timeout')), this.taskTimeout);
            });

            // 실제 태스크 실행 (하위 클래스에서 구현)
            const executionPromise = this.executeTaskImplementation(task);
            
            // 타임아웃과 실행을 경쟁
            const result = await Promise.race([executionPromise, timeoutPromise]);
            
            // 태스크 완료
            task.complete(result);
            this.emit('task_completed', task);
            
            return result;
            
        } catch (error) {
            // 태스크 실패
            task.fail(error);
            this.emit('task_failed', task, error);
            throw error;
            
        } finally {
            // 후처리
            this.currentTask = null;
            this.status = 'idle';
            await this.postprocessTask(task);
        }
    }

    /**
     * 하위 클래스에서 구현할 태스크 실행 로직
     */
    async executeTaskImplementation(task) {
        throw new Error('executeTaskImplementation must be implemented by subclass');
    }

    /**
     * 태스크 전처리
     */
    async preprocessTask(task) {
        // 의존성 확인
        await this.checkDependencies(task);
        
        // 필요한 도구 확인
        await this.checkRequiredTools(task);
        
        // 리소스 할당
        await this.allocateResources(task);
    }

    /**
     * 태스크 후처리
     */
    async postprocessTask(task) {
        // 리소스 해제
        await this.releaseResources(task);
        
        // 결과 저장
        await this.saveTaskResult(task);
        
        // 성능 업데이트
        this.updateWorkload();
    }

    /**
     * 의존성 확인
     */
    async checkDependencies(task) {
        // 의존성 태스크들이 완료되었는지 확인
        for (const depId of task.dependencies) {
            // 실제 구현에서는 TaskManager에서 의존성 상태를 확인
            this.log(`의존성 확인: ${depId}`, 'debug');
        }
    }

    /**
     * 필요한 도구 확인
     */
    async checkRequiredTools(task) {
        // 테스트 환경에서는 도구 확인 건너뛰기
        if (process.env.NODE_ENV === 'test') {
            return;
        }
        
        const requiredTools = this.getRequiredTools(task);
        
        for (const tool of requiredTools) {
            if (!this.availableTools.has(tool)) {
                throw new Error(`Required tool not available: ${tool}`);
            }
        }
    }

    /**
     * 태스크에 필요한 도구 목록 반환
     */
    getRequiredTools(task) {
        // 태스크 타입에 따라 필요한 도구 결정
        const toolMap = {
            'research': ['web_search', 'data_analysis'],
            'coding': ['code_editor', 'compiler'],
            'planning': ['knowledge_base', 'reasoning'],
            'testing': ['test_framework', 'debugger']
        };
        
        return toolMap[task.type] || [];
    }

    /**
     * 리소스 할당
     */
    async allocateResources(task) {
        // CPU, 메모리 등 리소스 할당 로직
        this.updateWorkload(Math.min(this.workload + 20, 100));
    }

    /**
     * 리소스 해제
     */
    async releaseResources(task) {
        // 할당된 리소스 해제
        this.updateWorkload(Math.max(this.workload - 20, 0));
    }

    /**
     * 태스크 결과 저장
     */
    async saveTaskResult(task) {
        // 결과를 파일 시스템에 저장
        this.emit('task_result_saved', task);
    }

    /**
     * 도구 추가
     */
    async addTool(toolName, toolInstance) {
        this.availableTools.set(toolName, toolInstance);
        this.log(`도구 추가됨: ${toolName}`, 'info');
        this.emit('tool_added', toolName);
    }

    /**
     * 도구 제거
     */
    removeTool(toolName) {
        if (this.availableTools.delete(toolName)) {
            this.log(`도구 제거됨: ${toolName}`, 'info');
            this.emit('tool_removed', toolName);
        }
    }

    /**
     * 도구 사용
     */
    async useTool(toolName, ...args) {
        const tool = this.availableTools.get(toolName);
        if (!tool) {
            throw new Error(`Tool not available: ${toolName}`);
        }

        try {
            this.log(`도구 사용: ${toolName}`, 'debug');
            const result = await tool.execute(...args);
            this.emit('tool_used', toolName, result);
            return result;
        } catch (error) {
            this.log(`도구 사용 실패: ${toolName} - ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * 작업 부하 업데이트
     */
    updateWorkload(workload = null) {
        if (workload !== null) {
            this.workload = Math.max(0, Math.min(100, workload));
        }
        
        this.emit('workload_changed', this.workload);
    }

    /**
     * 성능 지표 업데이트
     */
    updatePerformance(task, success) {
        this.performance.tasksCompleted++;
        
        if (success) {
            this.performance.tasksSucceeded++;
        } else {
            this.performance.tasksFailed++;
        }
        
        this.performance.successRate = (this.performance.tasksSucceeded / this.performance.tasksCompleted) * 100;
        
        if (task.actualTime) {
            this.performance.totalExecutionTime += task.actualTime;
            this.performance.averageExecutionTime = this.performance.totalExecutionTime / this.performance.tasksCompleted;
        }
    }

    /**
     * 하트비트 시작
     */
    startHeartbeat() {
        setInterval(() => {
            this.emit('heartbeat', {
                id: this.id,
                status: this.status,
                workload: this.workload,
                timestamp: new Date()
            });
        }, this.heartbeatInterval);
    }

    /**
     * 능력 확인
     */
    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * 사용 가능 여부 확인
     */
    isAvailable() {
        return this.status === 'idle' && this.workload < 80;
    }

    /**
     * 로그 출력
     */
    log(message, level = 'info') {
        const timestamp = new Date().toLocaleTimeString();
        const colorFunc = this.getColorFunction();
        
        let icon = '';
        switch (level) {
            case 'success': icon = '✅'; break;
            case 'error': icon = '❌'; break;
            case 'warning': icon = '⚠️'; break;
            case 'debug': icon = '🔍'; break;
            default: icon = 'ℹ️';
        }
        
        console.log(`[${timestamp}] ${colorFunc(`[${this.name}]`)} ${icon} ${message}`);
        
        this.emit('log', {
            agent: this.id,
            message,
            level,
            timestamp: new Date()
        });
    }

    /**
     * 색상 함수 반환
     */
    getColorFunction() {
        const colorMap = {
            'blue': chalk.blue,
            'cyan': chalk.cyan,
            'green': chalk.green,
            'yellow': chalk.yellow,
            'red': chalk.red,
            'magenta': chalk.magenta
        };
        
        return colorMap[this.color] || chalk.white;
    }

    /**
     * 에이전트 정보를 JSON으로 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            capabilities: this.capabilities,
            model: this.model,
            endpoint: this.endpoint,
            color: this.color,
            status: this.status,
            currentTask: this.currentTask?.id || null,
            workload: this.workload,
            performance: this.performance,
            availableTools: Array.from(this.availableTools.keys()),
            isInitialized: this.isInitialized
        };
    }

    /**
     * 에이전트 종료
     */
    async shutdown() {
        this.log('에이전트 종료 중...', 'info');
        
        // 진행 중인 작업 중단
        if (this.currentTask) {
            this.currentTask.fail(new Error('Agent shutdown'));
        }
        
        // 연결 종료
        for (const [name, connection] of this.activeConnections) {
            try {
                await connection.close();
            } catch (error) {
                this.log(`연결 종료 실패: ${name}`, 'warning');
            }
        }
        
        this.status = 'offline';
        this.emit('shutdown');
        
        this.log('에이전트 종료 완료', 'info');
    }
}

module.exports = { BaseAgent, Task };