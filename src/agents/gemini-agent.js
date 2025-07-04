const { BaseAgent, Task } = require('./base-agent');

/**
 * Gemini Agent - Google Gemini API를 사용하는 에이전트
 * 연구, 데이터 수집, 분석, 문서화에 특화
 */
class GeminiAgent extends BaseAgent {
    constructor(config) {
        super(config);
        
        // Gemini 특화 설정
        this.model = config.model || 'gemini-pro';
        this.apiKey = config.apiKey || null;
        this.apiBaseUrl = 'https://generativelanguage.googleapis.com/v1beta/models';
        
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

        if (!this.apiKey) {
            throw new Error('Gemini API key is required');
        }

        try {
            // API 연결 검증
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
            
            // Gemini API 호출
            const response = await this.callGeminiAPI(prompt);
            
            // 응답 처리
            const result = this.processResponse(response, task);
            
            // 실행 시간 기록
            const executionTime = Date.now() - startTime;
            this.updateMetrics(executionTime, response.usageMetadata);
            
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