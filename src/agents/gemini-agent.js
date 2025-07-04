const { BaseAgent, Task } = require('./base-agent');
const { ResponseParser } = require('../utils/response-parser');
const fetch = require('node-fetch');
const { execSync, spawn } = require('child_process');
const fs = require('fs').promises;
const path = require('path');
require('dotenv').config();

/**
 * Gemini Agent - Google Gemini API를 사용하는 에이전트
 * 연구, 데이터 수집, 분석, 문서화에 특화
 */
class GeminiAgent extends BaseAgent {
    constructor(config) {
        super(config);
        
        // Gemini 특화 설정
        this.model = config.model || 'gemini-2.5-flash';
        this.cliPath = config.cliPath || process.env.GEMINI_CLI_PATH || 'gemini';
        this.useLocalCLI = config.useLocalCLI !== false; // 기본값 true
        this.apiKey = config.apiKey || process.env.GEMINI_API_KEY || null;
        this.apiBaseUrl = config.apiBaseUrl || process.env.GEMINI_API_URL || 'https://generativelanguage.googleapis.com/v1beta/models';
        
        // 응답 파서 초기화
        this.responseParser = new ResponseParser();
        
        // Gemini 특화 능력 기본값
        if (!this.capabilities || this.capabilities.length === 0) {
            this.capabilities = ['research', 'data_collection', 'analysis', 'documentation'];
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
        
        // Gemini 특화 기능
        this.supportsMultimodal = this.model.includes('vision') || this.model.includes('pro');
        this.maxTokens = 32768;
    }

    /**
     * Gemini Agent 초기화
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
                    console.log(`✅ 로컬 Gemini CLI 사용: ${this.cliPath}`);
                    this.isInitialized = true;
                    this.status = 'ready';
                    this.emit('initialized');
                    return;
                }
                console.log('⚠️  로컬 Gemini CLI를 찾을 수 없습니다. API 모드로 전환합니다.');
            }

            // API 모드 폴백
            if (!this.apiKey) {
                throw new Error('Gemini API key is required when CLI is not available');
            }

            const isValid = await this.validateApiConnection();
            if (!isValid) {
                throw new Error('Failed to validate Gemini API connection');
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
            // Gemini CLI 버전 확인
            const result = execSync(`${this.cliPath} --version`, { 
                encoding: 'utf8', 
                timeout: 5000,
                stdio: 'pipe'
            });
            
            console.log(`🔍 Gemini CLI 버전: ${result.trim()}`);
            return true;
        } catch (error) {
            console.log(`❌ Gemini CLI 확인 실패: ${error.message}`);
            return false;
        }
    }

    /**
     * 로컬 CLI를 통한 Gemini 호출
     * @param {string} prompt - 전송할 프롬프트
     * @returns {Promise<string>} Gemini 응답
     */
    async callLocalCLI(prompt) {
        const startTime = Date.now();
        
        try {
            // 임시 파일에 프롬프트 저장
            const tempDir = path.join(__dirname, '../../temp');
            await fs.mkdir(tempDir, { recursive: true });
            
            const promptFile = path.join(tempDir, `gemini_prompt_${Date.now()}.txt`);
            await fs.writeFile(promptFile, prompt);

            // Gemini CLI 실행
            const command = `${this.cliPath} --model ${this.model} --file "${promptFile}"`;
            const result = execSync(command, { 
                encoding: 'utf8', 
                timeout: 30000,
                maxBuffer: 1024 * 1024 * 10 // 10MB
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
            throw new Error(`Gemini CLI execution failed: ${error.message}`);
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
            const parsed = this.responseParser.parseResponse(response, 'gemini');
            
            // 응답 분석 로깅 (상세 모드에서만)
            if (process.env.VERBOSE_PARSING === 'true') {
                this.responseParser.displayParsedResponse(parsed);
            }

            // JSON 데이터가 있는 경우 우선 사용
            if (parsed.structure.hasJson && parsed.content.json.length > 0) {
                const primaryJson = parsed.content.json.find(json => json.valid);
                if (primaryJson) {
                    return {
                        analysis: 'Structured JSON response from Gemini CLI',
                        result: primaryJson.parsed,
                        insights: `Parsed ${primaryJson.type} data with ${Object.keys(primaryJson.parsed).length} properties`,
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
                    analysis: 'Code response from Gemini CLI',
                    result: {
                        code: primaryCode.code,
                        language: primaryCode.language,
                        lineCount: primaryCode.lineCount,
                        allCodeBlocks: parsed.content.codeBlocks
                    },
                    insights: `Generated ${primaryCode.language} code with ${primaryCode.lineCount} lines`,
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
                    analysis: 'Structured markdown response from Gemini CLI',
                    result: {
                        text: parsed.content.text,
                        headers: parsed.content.headers,
                        lists: parsed.content.lists,
                        tables: parsed.content.tables
                    },
                    insights: `Structured content with ${parsed.content.headers.length} sections`,
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
                analysis: 'Text response from Gemini CLI',
                result: parsed.content.text || response,
                insights: `Plain text response (${parsed.content.metadata.wordCount} words, ${parsed.content.metadata.sentiment} sentiment)`,
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
            throw new Error(`Failed to process Gemini CLI response: ${error.message}`);
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
                response = await this.callGeminiAPI(prompt);
                result = this.processResponse(response, task);
            }
            
            // 실행 시간 기록
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, response?.usageMetadata);
            
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
     * 태스크별 프롬프트 생성
     * @param {Task} task - 태스크
     * @returns {string} 생성된 프롬프트
     */
    generatePrompt(task) {
        const baseContext = `You are a Gemini AI agent specialized in ${this.capabilities.join(', ')}.`;
        const roleContext = `Your role is: ${this.role}.`;
        
        let specificInstructions = '';
        
        switch (task.type) {
            case 'research':
                specificInstructions = `Research the following topic using a systematic approach.
                Focus on gathering comprehensive information from multiple perspectives.
                Provide credible sources and detailed analysis.`;
                break;
                
            case 'documentation':
                specificInstructions = `Create comprehensive documentation for the following topic.
                Focus on clear structure, detailed explanations, and practical examples.
                Ensure the documentation is accessible and well-organized.`;
                break;
                
            case 'data_collection':
                specificInstructions = `Collect and organize data using efficient methods.
                Focus on accuracy, completeness, and systematic categorization.
                Provide summaries and insights from the collected data.`;
                break;
                
            case 'analysis':
                specificInstructions = `Perform thorough analysis of the provided information.
                Focus on identifying patterns, trends, and actionable insights.
                Provide evidence-based conclusions and recommendations.`;
                break;
                
            default:
                specificInstructions = `Analyze and complete the following task using your expertise.
                Apply systematic thinking and provide detailed reasoning for your approach.`;
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
            "sources": "Relevant sources or references (if applicable)",
            "insights": "Key insights or recommendations"
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
     * Gemini API 호출
     * @param {string|Object} prompt - 전송할 프롬프트 (텍스트 또는 멀티모달)
     * @returns {Promise<Object>} API 응답
     */
    async callGeminiAPI(prompt) {
        const startTime = Date.now();
        
        // 프롬프트가 문자열이면 기본 텍스트 형태로, 객체면 멀티모달로 처리
        const contents = typeof prompt === 'string' 
            ? [{ parts: [{ text: prompt }] }]
            : this.formatMultimodalContent(prompt);

        const requestBody = {
            contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 4000,
                topK: 40,
                topP: 0.95
            },
            safetySettings: [
                {
                    category: "HARM_CATEGORY_HARASSMENT",
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                },
                {
                    category: "HARM_CATEGORY_HATE_SPEECH", 
                    threshold: "BLOCK_MEDIUM_AND_ABOVE"
                }
            ]
        };

        const url = `${this.apiBaseUrl}/${this.model}:generateContent?key=${this.apiKey}`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
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
            if (data.usageMetadata) {
                this.metrics.totalTokensUsed += 
                    (data.usageMetadata.promptTokenCount || 0) + 
                    (data.usageMetadata.candidatesTokenCount || 0);
            }

            return data;
            
        } catch (error) {
            this.emit('api_error', error);
            throw error;
        }
    }

    /**
     * 멀티모달 콘텐츠 형식화
     * @param {Object} content - 텍스트와 이미지가 포함된 콘텐츠
     * @returns {Array} Gemini API 형식의 콘텐츠
     */
    formatMultimodalContent(content) {
        const parts = [];
        
        if (content.text) {
            parts.push({ text: content.text });
        }
        
        if (content.images && content.images.length > 0) {
            content.images.forEach(imageData => {
                // Base64 데이터에서 MIME 타입과 데이터 추출
                const matches = imageData.match(/^data:([^;]+);base64,(.+)$/);
                if (matches) {
                    parts.push({
                        inlineData: {
                            mimeType: matches[1],
                            data: matches[2]
                        }
                    });
                }
            });
        }
        
        return [{ parts }];
    }

    /**
     * API 응답 처리
     * @param {Object} response - Gemini API 응답
     * @param {Task} task - 원본 태스크
     * @returns {Object} 처리된 결과
     */
    processResponse(response, task) {
        try {
            if (!response.candidates || response.candidates.length === 0) {
                throw new Error('No candidates in Gemini API response');
            }
            
            const content = response.candidates[0].content.parts[0].text;
            
            // JSON 응답 파싱 시도
            try {
                return JSON.parse(content);
            } catch (parseError) {
                // JSON 파싱 실패시 텍스트 응답으로 처리
                return {
                    analysis: 'Response received',
                    result: content,
                    insights: 'Raw text response from Gemini API',
                    format: 'text'
                };
            }
        } catch (error) {
            throw new Error(`Failed to process Gemini API response: ${error.message}`);
        }
    }

    /**
     * 멀티모달 콘텐츠 처리
     * @param {Object} content - 텍스트와 이미지가 포함된 콘텐츠
     * @returns {Promise<string>} 처리된 결과
     */
    async processMultimodalContent(content) {
        const response = await this.callGeminiAPI(content);
        const processedResponse = this.processResponse(response);
        return processedResponse.result || 
               response.candidates[0].content.parts[0].text;
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
            this.metrics.totalTokensUsed += 
                (usage.promptTokenCount || 0) + 
                (usage.candidatesTokenCount || 0);
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
            await this.callGeminiAPI('Test connection');
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
        const geminiStrengths = {
            'research': 0.95,
            'data_collection': 0.90,
            'documentation': 0.85,
            'analysis': 0.90,
            'multimodal': 0.95,
            'coding': 0.70,
            'testing': 0.75,
            'debugging': 0.65,
            'complex_coding': 0.50,
            'architecture': 0.55
        };

        return geminiStrengths[capability] || 0.3;
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
            isInitialized: this.isInitialized,
            supportsMultimodal: this.supportsMultimodal
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
            this.supportsMultimodal = this.model.includes('vision') || this.model.includes('pro');
        }
        
        super.updateConfig(newConfig);
    }

    /**
     * 태스크 실행 구현
     */
    async executeTaskImplementation(task) {
        try {
            // 모의 실행 - 실제 구현에서는 Gemini API 호출
            const result = {
                status: 'completed',
                output: {
                    taskId: task.id,
                    type: task.type,
                    description: task.description,
                    result: `Gemini agent completed ${task.type} task: ${task.description}`,
                    executedBy: this.id,
                    timestamp: new Date().toISOString(),
                    mockData: this.generateMockResult(task)
                },
                metadata: {
                    model: this.model,
                    tokensUsed: Math.floor(Math.random() * 1000) + 100,
                    responseTime: Math.floor(Math.random() * 2000) + 500
                }
            };

            // 통계 업데이트
            this.metrics.tasksCompleted++;
            this.metrics.apiCalls++;
            this.metrics.totalTokensUsed += result.metadata.tokensUsed;

            return result;
        } catch (error) {
            throw new Error(`Gemini API execution failed: ${error.message}`);
        }
    }

    /**
     * 태스크 타입별 모의 결과 생성
     */
    generateMockResult(task) {
        const mockResults = {
            research: {
                findings: [
                    'Market research indicates strong demand for the proposed features',
                    'Competitive analysis shows opportunities for differentiation',
                    'User feedback suggests prioritizing mobile responsiveness'
                ],
                sources: ['Industry reports', 'User surveys', 'Competitor analysis'],
                recommendations: 'Proceed with development focusing on core features first'
            },
            analysis: {
                metrics: {
                    complexity: task.complexity || 'medium',
                    estimatedTime: task.estimatedTime || 3600000,
                    riskLevel: 'low'
                },
                insights: 'Analysis completed successfully with actionable insights'
            },
            documentation: {
                sections: ['Overview', 'Implementation', 'Testing', 'Deployment'],
                pages: Math.floor(Math.random() * 20) + 5,
                format: 'markdown'
            },
            default: {
                message: `Task ${task.type} completed successfully`,
                details: task.description
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

module.exports = { GeminiAgent };