const { GeminiAgent } = require('../../../src/agents/gemini-agent');
const { BaseAgent, Task } = require('../../../src/agents/base-agent');
const EventEmitter = require('events');

describe('GeminiAgent', () => {
    let agent;

    beforeEach(() => {
        agent = new GeminiAgent({
            id: 'gemini_researcher',
            role: 'researcher',
            capabilities: ['research', 'data_collection', 'analysis', 'documentation']
        });
    });

    afterEach(async () => {
        if (agent && agent.isRunning) {
            await agent.stop();
        }
    });

    describe('생성자', () => {
        test('should create Gemini agent with correct default values', () => {
            expect(agent).toBeInstanceOf(BaseAgent);
            expect(agent.id).toBe('gemini_researcher');
            expect(agent.role).toBe('researcher');
            expect(agent.capabilities).toContain('research');
            expect(agent.capabilities).toContain('data_collection');
            expect(agent.model).toBe('gemini-pro');
            expect(agent.apiKey).toBeNull();
        });

        test('should allow custom configuration', () => {
            const customAgent = new GeminiAgent({
                id: 'gemini_developer',
                role: 'developer',
                model: 'gemini-pro-vision',
                capabilities: ['coding', 'testing'],
                apiKey: 'test-key'
            });

            expect(customAgent.id).toBe('gemini_developer');
            expect(customAgent.role).toBe('developer');
            expect(customAgent.model).toBe('gemini-pro-vision');
            expect(customAgent.apiKey).toBe('test-key');
        });
    });

    describe('initialize', () => {
        test('should initialize Gemini API client', async () => {
            // Mock API 설정
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            
            await agent.initialize();
            
            expect(agent.isInitialized).toBe(true);
            expect(agent.validateApiConnection).toHaveBeenCalled();
        });

        test('should throw error without API key', async () => {
            await expect(agent.initialize()).rejects.toThrow('Gemini API key is required');
        });

        test('should emit initialized event', async () => {
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            
            const eventHandler = jest.fn();
            agent.on('initialized', eventHandler);
            
            await agent.initialize();
            
            expect(eventHandler).toHaveBeenCalled();
        });
    });

    describe('executeTask', () => {
        beforeEach(async () => {
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            agent.callGeminiAPI = jest.fn();
            await agent.initialize();
        });

        test('should execute research task with data collection focus', async () => {
            const task = new Task({
                id: 'research_001',
                type: 'research',
                description: 'Research latest web technologies',
                data: { topic: 'React 18 features' }
            });

            const mockResponse = {
                research: {
                    findings: ['Concurrent features', 'Automatic batching', 'Suspense improvements'],
                    sources: ['https://react.dev', 'https://github.com/facebook/react'],
                    methodology: 'Systematic literature review'
                },
                analysis: 'React 18 introduces significant performance improvements'
            };

            agent.callGeminiAPI.mockResolvedValue({
                candidates: [{ 
                    content: { 
                        parts: [{ text: JSON.stringify(mockResponse) }] 
                    } 
                }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.research).toBeDefined();
            expect(result.data.research.findings).toHaveLength(3);
            expect(agent.callGeminiAPI).toHaveBeenCalledWith(
                expect.stringContaining('Research the following topic')
            );
        });

        test('should execute documentation task with comprehensive approach', async () => {
            const task = new Task({
                id: 'doc_001',
                type: 'documentation',
                description: 'Create API documentation',
                data: { apiEndpoints: ['GET /users', 'POST /users', 'DELETE /users'] }
            });

            const mockResponse = {
                documentation: {
                    overview: 'User Management API Documentation',
                    endpoints: [
                        { method: 'GET', path: '/users', description: 'Retrieve all users' },
                        { method: 'POST', path: '/users', description: 'Create new user' },
                        { method: 'DELETE', path: '/users', description: 'Delete user' }
                    ],
                    examples: ['curl examples', 'response schemas']
                },
                structure: 'RESTful API documentation format'
            };

            agent.callGeminiAPI.mockResolvedValue({
                candidates: [{ 
                    content: { 
                        parts: [{ text: JSON.stringify(mockResponse) }] 
                    } 
                }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.documentation).toBeDefined();
            expect(result.data.documentation.endpoints).toHaveLength(3);
        });

        test('should execute data collection task efficiently', async () => {
            const task = new Task({
                id: 'collect_001',
                type: 'data_collection',
                description: 'Collect user feedback data',
                data: { sources: ['surveys', 'reviews', 'support tickets'] }
            });

            const mockResponse = {
                collection: {
                    totalItems: 150,
                    categories: ['positive', 'negative', 'neutral'],
                    summary: 'User satisfaction analysis',
                    metrics: { avgRating: 4.2, responseRate: 0.78 }
                },
                insights: 'Users appreciate new features but request better documentation'
            };

            agent.callGeminiAPI.mockResolvedValue({
                candidates: [{ 
                    content: { 
                        parts: [{ text: JSON.stringify(mockResponse) }] 
                    } 
                }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.collection).toBeDefined();
            expect(result.data.collection.totalItems).toBe(150);
        });

        test('should handle API errors gracefully', async () => {
            const task = new Task({
                id: 'test_001',
                type: 'research',
                description: 'Test error handling'
            });

            agent.callGeminiAPI.mockRejectedValue(new Error('API quota exceeded'));

            const result = await agent.executeTask(task);

            expect(result.success).toBe(false);
            expect(result.error).toContain('API quota exceeded');
        });
    });

    describe('generatePrompt', () => {
        test('should generate research prompt with systematic approach', () => {
            const task = new Task({
                type: 'research',
                description: 'Research market trends',
                data: { industry: 'technology', timeframe: '2024' }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Research the following topic');
            expect(prompt).toContain('systematic approach');
            expect(prompt).toContain('Research market trends');
            expect(prompt).toContain('"industry": "technology"');
        });

        test('should generate documentation prompt with structure focus', () => {
            const task = new Task({
                type: 'documentation',
                description: 'Document software architecture',
                data: { components: ['frontend', 'backend', 'database'] }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Create comprehensive documentation');
            expect(prompt).toContain('clear structure');
            expect(prompt).toContain('Document software architecture');
            expect(prompt).toContain('"components"');
        });

        test('should generate data collection prompt with efficiency focus', () => {
            const task = new Task({
                type: 'data_collection',
                description: 'Collect performance metrics',
                data: { metrics: ['response_time', 'throughput'] }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Collect and organize data');
            expect(prompt).toContain('efficient methods');
            expect(prompt).toContain('Collect performance metrics');
        });

        test('should generate general prompt for unknown task types', () => {
            const task = new Task({
                type: 'unknown_type',
                description: 'Unknown task',
                data: {}
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Analyze and complete');
            expect(prompt).toContain('Unknown task');
        });
    });

    describe('callGeminiAPI', () => {
        beforeEach(() => {
            agent.apiKey = 'test-api-key';
        });

        test('should make API call with correct parameters', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    candidates: [{ 
                        content: { 
                            parts: [{ text: 'Test response' }] 
                        } 
                    }],
                    usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 }
                })
            });

            global.fetch = mockFetch;

            const response = await agent.callGeminiAPI('Test prompt');

            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('https://generativelanguage.googleapis.com'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json'
                    }),
                    body: expect.stringContaining('Test prompt')
                })
            );

            expect(response.candidates).toBeDefined();
        });

        test('should handle API errors', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                json: jest.fn().mockResolvedValue({
                    error: { message: 'Quota exceeded' }
                })
            });

            global.fetch = mockFetch;

            await expect(agent.callGeminiAPI('Test prompt')).rejects.toThrow('Quota exceeded');
        });

        test('should track API usage', async () => {
            const mockResponse = {
                candidates: [{ 
                    content: { 
                        parts: [{ text: 'Test response' }] 
                    } 
                }],
                usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 }
            };
            
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse)
            });

            global.fetch = mockFetch;

            const response = await agent.callGeminiAPI('Test prompt');

            expect(response.usageMetadata).toEqual({ promptTokenCount: 50, candidatesTokenCount: 25 });
            expect(agent.metrics.totalTokensUsed).toBe(75);
            expect(agent.metrics.apiCalls).toBe(1);
        });
    });

    describe('validateApiConnection', () => {
        test('should validate API connection successfully', async () => {
            agent.apiKey = 'test-api-key';
            agent.callGeminiAPI = jest.fn().mockResolvedValue({
                candidates: [{ 
                    content: { 
                        parts: [{ text: 'API connection test successful' }] 
                    } 
                }]
            });

            const isValid = await agent.validateApiConnection();

            expect(isValid).toBe(true);
            expect(agent.callGeminiAPI).toHaveBeenCalledWith('Test connection');
        });

        test('should handle API connection failure', async () => {
            agent.apiKey = 'invalid-key';
            agent.callGeminiAPI = jest.fn().mockRejectedValue(new Error('Invalid API key'));

            const isValid = await agent.validateApiConnection();

            expect(isValid).toBe(false);
        });
    });

    describe('getCapabilityScore', () => {
        test('should return high score for research tasks', () => {
            const score = agent.getCapabilityScore('research');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return high score for data collection tasks', () => {
            const score = agent.getCapabilityScore('data_collection');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return high score for documentation tasks', () => {
            const score = agent.getCapabilityScore('documentation');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return medium score for coding tasks', () => {
            const score = agent.getCapabilityScore('coding');
            expect(score).toBeGreaterThanOrEqual(0.6);
            expect(score).toBeLessThan(0.8);
        });

        test('should return low score for complex coding tasks', () => {
            const score = agent.getCapabilityScore('complex_coding');
            expect(score).toBeLessThan(0.6);
        });

        test('should return low score for unknown capabilities', () => {
            const score = agent.getCapabilityScore('unknown_capability');
            expect(score).toBeLessThan(0.5);
        });
    });

    describe('processMultimodalContent', () => {
        test('should handle text and image content', async () => {
            agent.apiKey = 'test-api-key';
            
            const content = {
                text: 'Analyze this image',
                images: ['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...']
            };

            const mockResponse = {
                candidates: [{ 
                    content: { 
                        parts: [{ text: 'Image analysis results' }] 
                    } 
                }]
            };

            agent.callGeminiAPI = jest.fn().mockResolvedValue(mockResponse);

            const result = await agent.processMultimodalContent(content);

            expect(result).toEqual('Image analysis results');
            expect(agent.callGeminiAPI).toHaveBeenCalledWith(
                expect.objectContaining({
                    text: 'Analyze this image',
                    images: expect.arrayContaining(['data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ...'])
                })
            );
        });
    });

    describe('agent status and metrics', () => {
        test('should track execution statistics', async () => {
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            
            // Mock the callGeminiAPI to return usage information
            const mockApiResponse = {
                candidates: [{ 
                    content: { 
                        parts: [{ text: JSON.stringify({ result: 'success' }) }] 
                    } 
                }],
                usageMetadata: { promptTokenCount: 50, candidatesTokenCount: 25 }
            };
            agent.callGeminiAPI = jest.fn().mockImplementation(async () => {
                // Manually increment apiCalls since we're mocking the method
                agent.metrics.apiCalls++;
                return mockApiResponse;
            });

            await agent.initialize();

            const task = new Task({
                id: 'stat_test',
                type: 'research',
                description: 'Statistics test'
            });

            await agent.executeTask(task);

            const status = agent.getStatus();

            expect(status.tasksCompleted).toBe(1);
            expect(status.totalTokensUsed).toBe(75);
            expect(status.apiCalls).toBe(1);
            expect(status.isInitialized).toBe(true);
        });
    });
});