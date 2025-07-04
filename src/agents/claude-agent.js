const { BaseAgent, Task } = require('./base-agent');

/**
 * Claude Agent - Claude Pro API를 사용하는 에이전트
 * 팀 리더십, 복잡한 코딩, 전략적 계획 수립에 특화
 */
class ClaudeAgent extends BaseAgent {
    constructor(config) {
        super(config);
        
        // Claude 특화 설정
        this.model = config.model || 'claude-3-sonnet';
        this.apiKey = config.apiKey || null;
        this.apiBaseUrl = 'https://api.anthropic.com/v1/messages';
        
        // Claude 특화 능력 기본값
        if (!this.capabilities || this.capabilities.length === 0) {
            this.capabilities = ['planning', 'strategic_thinking', 'coordination', 'complex_coding'];
        }
        
        // API 호출 통계
        this.metrics = {
            ...this.metrics,
            apiCalls: 0,
            totalTokensUsed: 0,
            averageResponseTime: 0,
            tasksCompleted: 0,
            totalExecutionTime: 0
        };
    }

    /**
     * Claude Agent 초기화
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        if (!this.apiKey) {
            throw new Error('Claude API key is required');
        }

        try {
            // API 연결 검증
            const isValid = await this.validateApiConnection();
            if (!isValid) {
                throw new Error('Failed to validate Claude API connection');
            }

            this.isInitialized = true;
            this.status = 'ready';
            
            this.emit('initialized');
        } catch (error) {
            this.status = 'error';
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 태스크 실행
     * @param {Task} task - 실행할 태스크
     * @returns {Promise<Object>} 실행 결과
     */
    async executeTask(task) {
        const startTime = Date.now();
        
        try {
            this.emit('task_started', task);
            
            // 프롬프트 생성
            const prompt = this.generatePrompt(task);
            
            // Claude API 호출
            const response = await this.callClaudeAPI(prompt);
            
            // 응답 처리
            const result = this.processResponse(response, task);
            
            // 실행 시간 기록
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, response.usage);
            
            this.emit('task_completed', task, result);
            
            return {
                success: true,
                data: result,
                executionTime,
                model: this.model
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            this.emit('task_failed', task, error);
            
            return {
                success: false,
                error: error.message,
                executionTime,
                model: this.model
            };
        }
    }

    /**
     * 태스크별 프롬프트 생성
     * @param {Task} task - 태스크
     * @returns {string} 생성된 프롬프트
     */
    generatePrompt(task) {
        const baseContext = `You are a Claude Pro agent specialized in ${this.capabilities.join(', ')}.`;
        const roleContext = `Your role is: ${this.role}.`;
        
        let specificInstructions = '';
        
        switch (task.type) {
            case 'planning':
                specificInstructions = `Create a comprehensive execution plan for the following project. 
                Focus on strategic planning, resource allocation, and timeline estimation.
                Consider dependencies, risks, and mitigation strategies.`;
                break;
                
            case 'complex_coding':
                specificInstructions = `Design and implement a solution for the following complex coding task.
                Focus on architectural patterns, code quality, and scalability.
                Provide detailed implementation with best practices.`;
                break;
                
            case 'coordination':
                specificInstructions = `Coordinate and manage the following team-related task.
                Focus on team leadership, task distribution, and communication strategies.
                Ensure efficient workflow and resource utilization.`;
                break;
                
            case 'research':
                specificInstructions = `Conduct thorough research on the following topic.
                Provide comprehensive analysis with multiple perspectives.
                Include recommendations based on findings.`;
                break;
                
            default:
                specificInstructions = `Analyze and complete the following task using your expertise.
                Apply best practices and provide detailed reasoning for your approach.`;
        }
        
        const taskDescription = `Task: ${task.description}`;
        
        let taskData = '';
        if (task.data && Object.keys(task.data).length > 0) {
            taskData = `Additional context: ${JSON.stringify(task.data, null, 2)}`;
        }
        
        const outputFormat = `
        Please provide your response in JSON format with the following structure:
        {
            "analysis": "Your analysis of the task",
            "approach": "Your planned approach",
            "result": "The main result/output",
            "reasoning": "Explanation of your reasoning",
            "recommendations": "Additional recommendations if applicable"
        }`;
        
        return [
            baseContext,
            roleContext,
            specificInstructions,
            taskDescription,
            taskData,
            outputFormat
        ].filter(Boolean).join('\n\n');
    }

    /**
     * Claude API 호출
     * @param {string} prompt - 전송할 프롬프트
     * @returns {Promise<Object>} API 응답
     */
    async callClaudeAPI(prompt) {
        const startTime = Date.now();
        
        const requestBody = {
            model: this.model,
            max_tokens: 4000,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: 0.7
        };

        try {
            const response = await fetch(this.apiBaseUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': this.apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error?.message || `API error: ${response.status}`);
            }

            const data = await response.json();
            
            // API 호출 통계 업데이트
            this.metrics.apiCalls++;
            const responseTime = Date.now() - startTime;
            this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime * (this.metrics.apiCalls - 1) + responseTime) / this.metrics.apiCalls;

            // usage 정보가 있으면 토큰 사용량 업데이트
            if (data.usage) {
                this.metrics.totalTokensUsed += (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0);
            }

            return data;
            
        } catch (error) {
            this.emit('api_error', error);
            throw error;
        }
    }

    /**
     * API 응답 처리
     * @param {Object} response - Claude API 응답
     * @param {Task} task - 원본 태스크
     * @returns {Object} 처리된 결과
     */
    processResponse(response, task) {
        try {
            const content = response.content[0].text;
            
            // JSON 응답 파싱 시도
            try {
                return JSON.parse(content);
            } catch (parseError) {
                // JSON 파싱 실패시 텍스트 응답으로 처리
                return {
                    analysis: 'Response received',
                    result: content,
                    reasoning: 'Raw text response from Claude API',
                    format: 'text'
                };
            }
        } catch (error) {
            throw new Error(`Failed to process Claude API response: ${error.message}`);
        }
    }

    /**
     * 메트릭 업데이트
     * @param {number} executionTime - 실행 시간
     * @param {Object} usage - API 사용량 정보
     */
    updateMetrics(executionTime, usage) {
        this.metrics.tasksCompleted++;
        this.metrics.totalExecutionTime += executionTime;
        
        if (usage) {
            this.metrics.totalTokensUsed += (usage.input_tokens || 0) + (usage.output_tokens || 0);
        }
        
        this.metrics.averageExecutionTime = 
            this.metrics.totalExecutionTime / this.metrics.tasksCompleted;
    }

    /**
     * API 연결 검증
     * @returns {Promise<boolean>} 연결 유효성
     */
    async validateApiConnection() {
        try {
            await this.callClaudeAPI('Test connection');
            return true;
        } catch (error) {
            this.emit('connection_error', error);
            return false;
        }
    }

    /**
     * 특정 능력에 대한 점수 반환
     * @param {string} capability - 능력명
     * @returns {number} 능력 점수 (0-1)
     */
    getCapabilityScore(capability) {
        const claudeStrengths = {
            'planning': 0.95,
            'strategic_thinking': 0.95,
            'coordination': 0.90,
            'complex_coding': 0.85,
            'architecture': 0.85,
            'debugging': 0.80,
            'research': 0.75,
            'documentation': 0.70,
            'testing': 0.65
        };

        return claudeStrengths[capability] || 0.3;
    }

    /**
     * Agent 상태 조회
     * @returns {Object} 상태 정보
     */
    getStatus() {
        const baseStatus = super.getStatus ? super.getStatus() : {};
        return {
            ...baseStatus,
            model: this.model,
            apiCalls: this.metrics.apiCalls,
            totalTokensUsed: this.metrics.totalTokensUsed,
            averageResponseTime: this.metrics.averageResponseTime,
            hasApiKey: !!this.apiKey,
            tasksCompleted: this.metrics.tasksCompleted || 0,
            isInitialized: this.isInitialized
        };
    }

    /**
     * 설정 업데이트
     * @param {Object} newConfig - 새로운 설정
     */
    updateConfig(newConfig) {
        if (newConfig.apiKey) {
            this.apiKey = newConfig.apiKey;
        }
        
        if (newConfig.model) {
            this.model = newConfig.model;
        }
        
        super.updateConfig(newConfig);
    }

    /**
     * Agent 종료
     */
    async shutdown() {
        try {
            // API 연결 정리
            this.apiKey = null;
            
            await super.shutdown();
            
            this.emit('shutdown_complete');
        } catch (error) {
            this.emit('shutdown_error', error);
            throw error;
        }
    }
}

module.exports = { ClaudeAgent };