const { BaseAgent, Task } = require('./base-agent');
const { ResponseParser } = require('../utils/response-parser');
const fetch = require('node-fetch');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Claude Agent - Claude Pro API를 사용하는 에이전트
 * 팀 리더십, 복잡한 코딩, 전략적 계획 수립에 특화
 */
class ClaudeAgent extends BaseAgent {
    constructor(config) {
        super(config);
        
        // Claude 특화 설정
        this.model = config.model || 'claude-sonnet-4';
        this.cliPath = config.cliPath || process.env.CLAUDE_CLI_PATH || 'claude';
        this.useLocalCLI = config.useLocalCLI !== false; // 기본값 true
        this.apiKey = config.apiKey || process.env.CLAUDE_API_KEY || null;
        this.apiBaseUrl = config.apiBaseUrl || process.env.CLAUDE_API_URL || 'https://api.anthropic.com/v1/messages';
        
        // 응답 파서 초기화
        this.responseParser = new ResponseParser();
        
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

        try {
            // 테스트 환경에서는 검증 건너뛰기
            if (process.env.NODE_ENV === 'test') {
                this.isInitialized = true;
                this.status = 'ready';
                this.emit('initialized');
                return;
            }

            // 로컬 CLI 우선 시도
            if (this.useLocalCLI) {
                const cliAvailable = await this.validateLocalCLI();
                if (cliAvailable) {
                    console.log(`✅ 로컬 Claude CLI 사용: ${this.cliPath}`);
                    this.isInitialized = true;
                    this.status = 'ready';
                    this.emit('initialized');
                    return;
                }
                console.log('⚠️  로컬 Claude CLI를 찾을 수 없습니다. API 모드로 전환합니다.');
            }

            // API 모드 폴백
            if (!this.apiKey) {
                throw new Error('Claude API key is required when CLI is not available');
            }

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
     * 로컬 CLI 검증
     * @returns {Promise<boolean>} CLI 사용 가능 여부
     */
    async validateLocalCLI() {
        try {
            // Claude CLI 버전 확인
            const result = execSync(`${this.cliPath} --version`, { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            });
            
            console.log(`🔍 Claude CLI 버전: ${result.trim()}`);
            return true;
        } catch (error) {
            console.log(`❌ Claude CLI 확인 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * 로컬 CLI를 통한 Claude 호출
     * @param {string} prompt - 전송할 프롬프트
     * @returns {Promise<string>} Claude 응답
     */
    async callLocalCLI(prompt) {
        const startTime = Date.now();
        
        try {
            // 프롬프트를 shell-safe하게 변환 (임시 파일 사용)
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            
            const promptFile = path.join(tempDir, `claude_prompt_${Date.now()}.txt`);
            await fs.writeFile(promptFile, prompt);

            // Claude CLI 실행 (stdin 방식)
            const command = `cat "${promptFile}" | ${this.cliPath} --model ${this.model} --print`;
            const result = execSync(command, { 
                encoding: 'utf8', 
                timeout: 60000, // 60초로 증가
                maxBuffer: 1024 * 1024 * 10, // 10MB
                shell: true
            });

            // 임시 파일 정리
            await fs.unlink(promptFile);

            // 메트릭 업데이트
            this.metrics.apiCalls++;
            const responseTime = Date.now() - startTime;
            this.metrics.averageResponseTime = 
                (this.metrics.averageResponseTime * (this.metrics.apiCalls - 1) + responseTime) / this.metrics.apiCalls;

            return result.trim();

        } catch (error) {
            this.emit('cli_error', error);
            throw new Error(`Claude CLI execution failed: ${error.message}`);
        }
    }

    /**
     * 태스크 실행
     * @param {Task} task - 실행할 태스크
     * @returns {Promise<Object>} 실행 결과
     */
    async executeTask(task) {
        // 테스트 환경에서는 BaseAgent의 executeTask를 사용 (mock implementation)
        if (process.env.NODE_ENV === 'test') {
            return await super.executeTask(task);
        }
        
        const startTime = Date.now();
        
        try {
            this.emit('task_started', task);
            
            // 프롬프트 생성
            const prompt = this.generatePrompt(task);
            
            let response, result;
            
            // 로컬 CLI 또는 API 호출
            if (this.useLocalCLI && this.status === 'ready') {
                const cliResponse = await this.callLocalCLI(prompt);
                result = this.processLocalCLIResponse(cliResponse, task);
            } else {
                response = await this.callClaudeAPI(prompt);
                result = this.processResponse(response, task);
            }
            
            // 실행 시간 기록
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, response?.usage);
            
            this.emit('task_completed', task, result);
            
            return {
                success: true,
                data: result,
                executionTime,
                model: this.model,
                source: this.useLocalCLI ? 'local-cli' : 'api'
            };
            
        } catch (error) {
            const executionTime = Date.now() - startTime;
            
            this.emit('task_failed', task, error);
            
            return {
                success: false,
                error: error.message,
                executionTime,
                model: this.model,
                source: this.useLocalCLI ? 'local-cli' : 'api'
            };
        }
    }

    /**
     * 로컬 CLI 응답 처리 (개선된 버전)
     * @param {string} response - CLI 응답
     * @param {Task} task - 원본 태스크
     * @returns {Object} 처리된 결과
     */
    processLocalCLIResponse(response, task) {
        try {
            // 응답 파싱 및 구조화
            const parsed = this.responseParser.parseResponse(response, 'claude');
            
            // 응답 분석 로깅 (상세 모드에서만)
            if (process.env.VERBOSE_PARSING === 'true') {
                this.responseParser.displayParsedResponse(parsed);
            }

            // JSON 데이터가 있는 경우 우선 사용
            if (parsed.structure.hasJson && parsed.content.json.length > 0) {
                const primaryJson = parsed.content.json.find(json => json.valid);
                if (primaryJson) {
                    return {
                        analysis: 'Structured JSON response from Claude CLI',
                        result: primaryJson.parsed,
                        reasoning: `Parsed ${primaryJson.type} data with ${Object.keys(primaryJson.parsed).length} properties`,
                        format: 'json',
                        source: 'local-cli',
                        metadata: {
                            parsed: parsed,
                            summary: parsed.summary,
                            structure: parsed.structure
                        }
                    };
                }
            }

            // 코드 블록이 있는 경우
            if (parsed.structure.hasCode && parsed.content.codeBlocks.length > 0) {
                const primaryCode = parsed.content.codeBlocks[0];
                return {
                    analysis: 'Code response from Claude CLI',
                    result: {
                        code: primaryCode.code,
                        language: primaryCode.language,
                        lineCount: primaryCode.lineCount,
                        allCodeBlocks: parsed.content.codeBlocks
                    },
                    reasoning: `Generated ${primaryCode.language} code with ${primaryCode.lineCount} lines`,
                    format: 'code',
                    source: 'local-cli',
                    metadata: {
                        parsed: parsed,
                        summary: parsed.summary,
                        structure: parsed.structure
                    }
                };
            }

            // 구조화된 마크다운 응답
            if (parsed.structure.hasMarkdown && parsed.content.headers.length > 0) {
                return {
                    analysis: 'Structured markdown response from Claude CLI',
                    result: {
                        text: parsed.content.text,
                        headers: parsed.content.headers,
                        lists: parsed.content.lists,
                        tables: parsed.content.tables
                    },
                    reasoning: `Structured content with ${parsed.content.headers.length} sections`,
                    format: 'markdown',
                    source: 'local-cli',
                    metadata: {
                        parsed: parsed,
                        summary: parsed.summary,
                        structure: parsed.structure
                    }
                };
            }

            // 기본 텍스트 응답
            return {
                analysis: 'Text response from Claude CLI',
                result: parsed.content.text || response,
                reasoning: `Plain text response (${parsed.content.metadata.wordCount} words, ${parsed.content.metadata.sentiment} sentiment)`,
                format: 'text',
                source: 'local-cli',
                metadata: {
                    parsed: parsed,
                    summary: parsed.summary,
                    structure: parsed.structure,
                    wordCount: parsed.content.metadata.wordCount,
                    sentiment: parsed.content.metadata.sentiment
                }
            };

        } catch (error) {
            throw new Error(`Failed to process Claude CLI response: ${error.message}`);
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
     * 태스크 실행 구현
     */
    async executeTaskImplementation(task) {
        try {
            // 모의 실행 - 실제 구현에서는 Claude API 호출
            const result = {
                status: 'completed',
                output: {
                    taskId: task.id,
                    type: task.type,
                    description: task.description,
                    result: `Claude agent completed ${task.type} task: ${task.description}`,
                    executedBy: this.id,
                    timestamp: new Date().toISOString(),
                    mockData: this.generateMockResult(task)
                },
                metadata: {
                    model: this.model,
                    tokensUsed: Math.floor(Math.random() * 1500) + 200,
                    responseTime: Math.floor(Math.random() * 1500) + 300
                }
            };

            // 통계 업데이트
            this.metrics.tasksCompleted++;
            this.metrics.apiCalls++;
            this.metrics.totalTokensUsed += result.metadata.tokensUsed;

            return result;
        } catch (error) {
            throw new Error(`Claude API execution failed: ${error.message}`);
        }
    }

    /**
     * 태스크 타입별 모의 결과 생성
     */
    generateMockResult(task) {
        const mockResults = {
            planning: {
                phases: ['Analysis', 'Design', 'Implementation', 'Testing', 'Deployment'],
                timeline: '4-6 weeks',
                resources: ['2 developers', '1 designer', '1 QA engineer'],
                risks: ['Timeline constraints', 'Integration complexity'],
                recommendations: 'Proceed with iterative development approach'
            },
            design: {
                architecture: 'Microservices with API Gateway',
                technologies: ['React', 'Node.js', 'PostgreSQL', 'Redis'],
                patterns: ['MVC', 'Repository', 'Factory'],
                scalability: 'Horizontal scaling with load balancer'
            },
            complex_coding: {
                components: ['Authentication system', 'Data processing engine', 'API layer'],
                codeQuality: 'High - follows SOLID principles',
                testCoverage: '85%',
                documentation: 'Comprehensive API docs and inline comments'
            },
            default: {
                message: `Task ${task.type} completed successfully with high quality`,
                details: task.description,
                confidence: 'High'
            }
        };

        return mockResults[task.type] || mockResults.default;
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