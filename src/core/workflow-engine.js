const EventEmitter = require('events');
const { Task } = require('../agents/base-agent');
const chalk = require('chalk');

/**
 * 워크플로우 엔진 - 태스크 분해, 분배, 실행 관리
 */
class WorkflowEngine extends EventEmitter {
    constructor() {
        super();
        
        // 활성 워크플로우 저장소
        this.activeWorkflows = new Map();
        
        // 태스크 관리
        this.taskQueue = new Map(); // 대기 중인 태스크
        this.completedTasks = new Map(); // 완료된 태스크
        this.failedTasks = new Map(); // 실패한 태스크
        
        // 태스크 분류 및 우선순위 매트릭스
        this.taskClassification = {
            'planning': { priority: 5, complexity: 'high', role: 'leader' },
            'research': { priority: 4, complexity: 'medium', role: 'researcher' },
            'complex_coding': { priority: 5, complexity: 'high', role: 'senior_developer' },
            'implementation': { priority: 3, complexity: 'medium', role: 'developer' },
            'testing': { priority: 3, complexity: 'low', role: 'developer' },
            'documentation': { priority: 2, complexity: 'low', role: 'developer' },
            'deployment': { priority: 4, complexity: 'medium', role: 'senior_developer' }
        };
        
        // 설정
        this.maxConcurrentTasks = 10;
        this.defaultEstimatedTime = 3600000; // 1시간
    }

    /**
     * 실행 계획 생성
     * @param {string} assigneeId - 계획 담당자 ID
     * @param {string} projectDescription - 프로젝트 설명
     * @returns {Object} 실행 계획
     */
    async createExecutionPlan(assigneeId, projectDescription) {
        const planId = `plan_${Date.now()}`;
        
        // 프로젝트 복잡도 분석
        const complexity = this.analyzeProjectComplexity(projectDescription);
        
        // 표준 개발 단계
        const phases = ['planning', 'research', 'implementation', 'testing', 'deployment'];
        
        // 예상 소요 시간 계산
        const estimatedDuration = this.calculateEstimatedDuration(complexity, phases);
        
        const plan = {
            id: planId,
            description: projectDescription,
            assignedBy: assigneeId,
            phases,
            complexity,
            estimatedDuration,
            createdAt: new Date(),
            status: 'created'
        };
        
        // 워크플로우 저장
        this.activeWorkflows.set(planId, plan);
        
        // 이벤트 발행
        this.emit('plan_created', plan);
        
        return plan;
    }

    /**
     * 태스크 분배
     * @param {Object} plan - 실행 계획
     * @returns {Array<Task>} 분배된 태스크 목록
     */
    async distributeTasks(plan) {
        const tasks = [];
        let previousTaskId = null;
        
        for (let i = 0; i < plan.phases.length; i++) {
            const phase = plan.phases[i];
            const taskConfig = this.createTaskConfig(phase, plan, previousTaskId);
            
            const task = new Task(taskConfig);
            tasks.push(task);
            
            // 다음 태스크의 의존성으로 현재 태스크 설정
            previousTaskId = task.id;
            
            // 태스크 큐에 추가
            await this.addTask(task);
        }
        
        return tasks;
    }

    /**
     * 태스크 설정 생성
     * @param {string} phase - 개발 단계
     * @param {Object} plan - 실행 계획
     * @param {string} previousTaskId - 이전 태스크 ID
     * @returns {Object} 태스크 설정
     */
    createTaskConfig(phase, plan, previousTaskId) {
        const classification = this.taskClassification[phase];
        const taskId = `${plan.id}_${phase}_${Date.now()}`;
        
        return {
            id: taskId,
            type: phase,
            description: `${phase} for ${plan.description}`,
            priority: classification.priority,
            complexity: classification.complexity,
            dependencies: previousTaskId ? [previousTaskId] : [],
            estimatedTime: this.defaultEstimatedTime,
            metadata: {
                workflowId: plan.id,
                phase,
                preferredRole: classification.role
            }
        };
    }

    /**
     * 태스크 추가
     * @param {Task} task - 추가할 태스크
     */
    async addTask(task) {
        if (this.taskQueue.has(task.id)) {
            throw new Error(`Task with ID ${task.id} already exists`);
        }
        
        this.taskQueue.set(task.id, task);
        this.emit('task_added', task);
    }

    /**
     * 다음 실행할 태스크 조회
     * @returns {Task|null} 다음 태스크 또는 null
     */
    getNextTask() {
        const availableTasks = Array.from(this.taskQueue.values())
            .filter(task => this.areDependendenciesMet(task))
            .sort((a, b) => b.priority - a.priority); // 우선순위 내림차순
        
        return availableTasks[0] || null;
    }

    /**
     * 의존성 충족 여부 확인
     * @param {Task} task - 확인할 태스크
     * @returns {boolean} 의존성 충족 여부
     */
    areDependendenciesMet(task) {
        return task.dependencies.every(depId => 
            this.completedTasks.has(depId)
        );
    }

    /**
     * 태스크 완료 처리
     * @param {string} taskId - 완료된 태스크 ID
     * @param {Object} result - 태스크 결과
     */
    markTaskCompleted(taskId, result) {
        const task = this.taskQueue.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found in queue`);
        }
        
        task.complete(result);
        
        // 큐에서 완료로 이동
        this.taskQueue.delete(taskId);
        this.completedTasks.set(taskId, task);
        
        this.emit('task_completed', taskId, result);
    }

    /**
     * 태스크 실패 처리
     * @param {string} taskId - 실패한 태스크 ID
     * @param {Error} error - 실패 원인
     */
    markTaskFailed(taskId, error) {
        const task = this.taskQueue.get(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found in queue`);
        }
        
        task.fail(error);
        
        // 큐에서 실패로 이동
        this.taskQueue.delete(taskId);
        this.failedTasks.set(taskId, task);
        
        this.emit('task_failed', taskId, error);
    }

    /**
     * 결과 통합
     * @param {string} integrator - 통합 담당자 ID
     * @param {Array} results - Promise.allSettled 결과
     * @returns {Object} 통합된 결과
     */
    async integrateResults(integrator, results) {
        const successful = results.filter(r => r.status === 'fulfilled');
        const failed = results.filter(r => r.status === 'rejected');
        
        const integration = {
            success: failed.length === 0,
            total: results.length,
            successful: successful.length,
            failed: failed.length,
            results: successful.map(r => r.value),
            failures: failed.map(r => r.reason),
            summary: this.generateSummary(successful, failed),
            integratedBy: integrator,
            timestamp: new Date()
        };
        
        this.emit('results_integrated', integration);
        
        return integration;
    }

    /**
     * 결과 요약 생성
     * @param {Array} successful - 성공한 결과
     * @param {Array} failed - 실패한 결과
     * @returns {string} 요약
     */
    generateSummary(successful, failed) {
        if (failed.length === 0) {
            return `All ${successful.length} tasks completed successfully`;
        } else if (successful.length === 0) {
            return `All ${failed.length} tasks failed`;
        } else {
            return `${successful.length} tasks succeeded, ${failed.length} tasks failed`;
        }
    }

    /**
     * 워크플로우 상태 조회
     * @returns {Object} 워크플로우 상태
     */
    getWorkflowStatus() {
        const totalTasks = this.taskQueue.size + this.completedTasks.size + this.failedTasks.size;
        const completedTasks = this.completedTasks.size;
        const pendingTasks = this.taskQueue.size;
        const failedTasks = this.failedTasks.size;
        
        return {
            totalTasks,
            completedTasks,
            pendingTasks,
            failedTasks,
            progress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
            activeWorkflows: this.activeWorkflows.size,
            timestamp: new Date()
        };
    }

    /**
     * 활성 태스크 수 조회
     * @returns {number} 활성 태스크 수
     */
    getActiveTaskCount() {
        return this.taskQueue.size;
    }

    /**
     * 에이전트에 태스크 할당
     * @param {Task} task - 할당할 태스크
     * @param {Array} availableAgents - 사용 가능한 에이전트 목록
     * @returns {Object} 할당 결과
     */
    assignTaskToAgent(task, availableAgents) {
        let bestAgent = null;
        let bestScore = 0;
        
        for (const agent of availableAgents) {
            const score = this.calculateAgentScore(task, agent);
            
            if (score > bestScore) {
                bestScore = score;
                bestAgent = agent;
            }
        }
        
        return {
            agentId: bestAgent?.id || null,
            confidence: bestScore,
            reasoning: this.generateAssignmentReasoning(task, bestAgent, bestScore)
        };
    }

    /**
     * 에이전트 적합성 점수 계산
     * @param {Task} task - 태스크
     * @param {Object} agent - 에이전트
     * @returns {number} 적합성 점수 (0-1)
     */
    calculateAgentScore(task, agent) {
        let score = 0;
        
        // 역할 매칭 (50점)
        let preferredRole = task.metadata?.preferredRole;
        
        // metadata에 preferredRole이 없으면 task classification에서 가져오기
        if (!preferredRole && this.taskClassification[task.type]) {
            preferredRole = this.taskClassification[task.type].role;
        }
        
        if (preferredRole && agent.role === preferredRole) {
            score += 0.5;
        }
        
        // 능력 매칭 (30점)
        const requiredCapabilities = this.getRequiredCapabilities(task.type);
        if (agent.capabilities) {
            const matchingCapabilities = requiredCapabilities.filter(cap => 
                agent.capabilities.includes(cap)
            );
            score += (matchingCapabilities.length / Math.max(requiredCapabilities.length, 1)) * 0.3;
        }
        
        // 작업 부하 (20점) - 낮을수록 좋음
        const workloadScore = (100 - (agent.workload || 0)) / 100;
        score += workloadScore * 0.2;
        
        return Math.min(score, 1);
    }

    /**
     * 태스크 타입별 필요 능력 조회
     * @param {string} taskType - 태스크 타입
     * @returns {Array<string>} 필요 능력 목록
     */
    getRequiredCapabilities(taskType) {
        const capabilityMap = {
            'planning': ['planning', 'strategic_thinking', 'coordination'],
            'research': ['research', 'data_collection', 'analysis'],
            'complex_coding': ['complex_coding', 'architecture', 'debugging'],
            'implementation': ['coding', 'programming'],
            'testing': ['testing', 'quality_assurance'],
            'documentation': ['documentation', 'writing'],
            'deployment': ['deployment', 'devops', 'system_administration']
        };
        
        return capabilityMap[taskType] || ['general'];
    }

    /**
     * 할당 근거 생성
     * @param {Task} task - 태스크
     * @param {Object} agent - 선택된 에이전트
     * @param {number} score - 적합성 점수
     * @returns {string} 할당 근거
     */
    generateAssignmentReasoning(task, agent, score) {
        if (!agent) {
            return 'No suitable agent found';
        }
        
        return `Assigned to ${agent.id} (score: ${(score * 100).toFixed(1)}%) - ` +
               `Role match: ${agent.role}, Workload: ${agent.workload || 0}%`;
    }

    /**
     * 프로젝트 복잡도 분석
     * @param {string} description - 프로젝트 설명
     * @returns {string} 복잡도 (low, medium, high)
     */
    analyzeProjectComplexity(description) {
        const complexWords = ['complex', 'advanced', 'enterprise', 'distributed', 'microservice'];
        const simpleWords = ['simple', 'basic', 'minimal', 'prototype'];
        
        const lowerDesc = description.toLowerCase();
        
        if (complexWords.some(word => lowerDesc.includes(word))) {
            return 'high';
        } else if (simpleWords.some(word => lowerDesc.includes(word))) {
            return 'low';
        } else {
            return 'medium';
        }
    }

    /**
     * 예상 소요 시간 계산
     * @param {string} complexity - 복잡도
     * @param {Array<string>} phases - 개발 단계
     * @returns {number} 예상 소요 시간 (밀리초)
     */
    calculateEstimatedDuration(complexity, phases) {
        const baseTimePerPhase = {
            'low': 2 * 3600000,      // 2시간
            'medium': 4 * 3600000,   // 4시간
            'high': 8 * 3600000      // 8시간
        };
        
        const baseTime = baseTimePerPhase[complexity] || baseTimePerPhase.medium;
        return baseTime * phases.length;
    }

    /**
     * 워크플로우 정리
     * @param {string} workflowId - 워크플로우 ID
     */
    cleanupWorkflow(workflowId) {
        // 완료된 워크플로우 정리
        this.activeWorkflows.delete(workflowId);
        
        // 관련 태스크들 정리 (선택적)
        const relatedTasks = Array.from(this.completedTasks.values())
            .filter(task => task.metadata?.workflowId === workflowId);
        
        this.emit('workflow_cleaned', workflowId, relatedTasks.length);
    }
}

module.exports = { WorkflowEngine };