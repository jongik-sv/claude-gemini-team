const { ClaudeAgent } = require('../../../src/agents/claude-agent');
const { BaseAgent, Task } = require('../../../src/agents/base-agent');
const EventEmitter = require('events');

describe('ClaudeAgent', () => {
    let agent;

    beforeEach(() => {
        agent = new ClaudeAgent({
            id: 'claude_leader',
            role: 'leader',
            capabilities: ['planning', 'strategic_thinking', 'coordination', 'complex_coding']
        });
    });

    afterEach(async () => {
        if (agent && agent.isRunning) {
            await agent.stop();
        }
    });

    describe('생성자', () => {
        test('should create Claude agent with correct default values', () => {
            expect(agent).toBeInstanceOf(BaseAgent);
            expect(agent.id).toBe('claude_leader');
            expect(agent.role).toBe('leader');
            expect(agent.capabilities).toContain('planning');
            expect(agent.capabilities).toContain('strategic_thinking');
            expect(agent.model).toBe('claude-3-sonnet');
            expect(agent.apiKey).toBeNull();
        });

        test('should allow custom configuration', () => {
            const customAgent = new ClaudeAgent({
                id: 'claude_senior',
                role: 'senior_developer',
                model: 'claude-3-opus',
                capabilities: ['complex_coding', 'architecture'],
                apiKey: 'test-key'
            });

            expect(customAgent.id).toBe('claude_senior');
            expect(customAgent.role).toBe('senior_developer');
            expect(customAgent.model).toBe('claude-3-opus');
            expect(customAgent.apiKey).toBe('test-key');
        });
    });

    describe('initialize', () => {
        test('should initialize Claude API client', async () => {
            // Mock API 설정
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            
            await agent.initialize();
            
            expect(agent.isInitialized).toBe(true);
            expect(agent.validateApiConnection).toHaveBeenCalled();
        });

        test('should throw error without API key', async () => {
            await expect(agent.initialize()).rejects.toThrow('Claude API key is required');
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
            agent.callClaudeAPI = jest.fn();
            await agent.initialize();
        });

        test('should execute planning task with strategic approach', async () => {
            const task = new Task({
                id: 'plan_001',
                type: 'planning',
                description: 'Create project execution plan',
                data: { projectDescription: 'Build a web application' }
            });

            const mockResponse = {
                plan: {
                    phases: ['analysis', 'design', 'implementation', 'testing'],
                    estimatedDuration: '4 weeks',
                    resources: ['frontend', 'backend', 'database']
                },
                reasoning: 'Strategic breakdown based on complexity analysis'
            };

            agent.callClaudeAPI.mockResolvedValue({
                content: [{ text: JSON.stringify(mockResponse) }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.plan).toBeDefined();
            expect(result.data.plan.phases).toHaveLength(4);
            expect(agent.callClaudeAPI).toHaveBeenCalledWith(
                expect.stringContaining('Create a comprehensive execution plan')
            );
        });

        test('should execute complex coding task with architectural considerations', async () => {
            const task = new Task({
                id: 'code_001',
                type: 'complex_coding',
                description: 'Design microservices architecture',
                data: { requirements: 'Scalable e-commerce platform' }
            });

            const mockResponse = {
                architecture: {
                    services: ['user-service', 'product-service', 'order-service'],
                    patterns: ['API Gateway', 'Event Sourcing', 'CQRS'],
                    technologies: ['Node.js', 'PostgreSQL', 'Redis']
                },
                codeGeneration: {
                    files: ['api-gateway.js', 'user-service.js'],
                    documentation: 'Architecture decision records'
                }
            };

            agent.callClaudeAPI.mockResolvedValue({
                content: [{ text: JSON.stringify(mockResponse) }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.architecture).toBeDefined();
            expect(result.data.codeGeneration).toBeDefined();
            expect(agent.callClaudeAPI).toHaveBeenCalledWith(
                expect.stringContaining('Design and implement')
            );
        });

        test('should execute coordination task with team management', async () => {
            const task = new Task({
                id: 'coord_001',
                type: 'coordination',
                description: 'Coordinate team tasks',
                data: { 
                    teamMembers: ['kim_senior', 'lee_researcher', 'park_developer'],
                    currentTasks: ['task1', 'task2', 'task3']
                }
            });

            const mockResponse = {
                coordination: {
                    taskAssignments: {
                        'kim_senior': 'task1',
                        'lee_researcher': 'task2',
                        'park_developer': 'task3'
                    },
                    dependencies: ['task2 -> task1', 'task3 -> task1'],
                    timeline: '2 weeks'
                },
                communication: 'Daily standup meetings recommended'
            };

            agent.callClaudeAPI.mockResolvedValue({
                content: [{ text: JSON.stringify(mockResponse) }]
            });

            const result = await agent.executeTask(task);

            expect(result.success).toBe(true);
            expect(result.data.coordination).toBeDefined();
            expect(result.data.coordination.taskAssignments).toBeDefined();
            expect(Object.keys(result.data.coordination.taskAssignments)).toHaveLength(3);
        });

        test('should handle API errors gracefully', async () => {
            const task = new Task({
                id: 'test_001',
                type: 'planning',
                description: 'Test error handling'
            });

            agent.callClaudeAPI.mockRejectedValue(new Error('API rate limit exceeded'));

            const result = await agent.executeTask(task);

            expect(result.success).toBe(false);
            expect(result.error).toContain('API rate limit exceeded');
        });
    });

    describe('generatePrompt', () => {
        test('should generate planning prompt with strategic context', () => {
            const task = new Task({
                type: 'planning',
                description: 'Project planning task',
                data: { context: 'web development' }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Create a comprehensive execution plan');
            expect(prompt).toContain('strategic planning');
            expect(prompt).toContain('Project planning task');
            expect(prompt).toContain('"context": "web development"');
        });

        test('should generate complex coding prompt with architecture focus', () => {
            const task = new Task({
                type: 'complex_coding',
                description: 'Implement microservices',
                data: { technology: 'Node.js' }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Design and implement');
            expect(prompt).toContain('architectural patterns');
            expect(prompt).toContain('Implement microservices');
            expect(prompt).toContain('"technology": "Node.js"');
        });

        test('should generate coordination prompt with team management focus', () => {
            const task = new Task({
                type: 'coordination',
                description: 'Manage team workflow',
                data: { teamSize: 4 }
            });

            const prompt = agent.generatePrompt(task);

            expect(prompt).toContain('Coordinate and manage');
            expect(prompt).toContain('team leadership');
            expect(prompt).toContain('Manage team workflow');
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

    describe('callClaudeAPI', () => {
        beforeEach(() => {
            agent.apiKey = 'test-api-key';
        });

        test('should make API call with correct parameters', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue({
                    content: [{ text: 'Test response' }],
                    usage: { input_tokens: 100, output_tokens: 50 }
                })
            });

            global.fetch = mockFetch;

            const response = await agent.callClaudeAPI('Test prompt');

            expect(mockFetch).toHaveBeenCalledWith(
                'https://api.anthropic.com/v1/messages',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'x-api-key': 'test-api-key',
                        'anthropic-version': '2023-06-01'
                    }),
                    body: expect.stringContaining('Test prompt')
                })
            );

            expect(response.content[0].text).toBe('Test response');
        });

        test('should handle API errors', async () => {
            const mockFetch = jest.fn().mockResolvedValue({
                ok: false,
                status: 429,
                json: jest.fn().mockResolvedValue({
                    error: { message: 'Rate limit exceeded' }
                })
            });

            global.fetch = mockFetch;

            await expect(agent.callClaudeAPI('Test prompt')).rejects.toThrow('Rate limit exceeded');
        });

        test('should track API usage', async () => {
            const mockResponse = {
                content: [{ text: 'Test response' }],
                usage: { input_tokens: 100, output_tokens: 50 }
            };
            
            const mockFetch = jest.fn().mockResolvedValue({
                ok: true,
                json: jest.fn().mockResolvedValue(mockResponse)
            });

            global.fetch = mockFetch;

            const response = await agent.callClaudeAPI('Test prompt');

            expect(response.usage).toEqual({ input_tokens: 100, output_tokens: 50 });
            expect(agent.metrics.totalTokensUsed).toBe(150);
            expect(agent.metrics.apiCalls).toBe(1);
        });
    });

    describe('validateApiConnection', () => {
        test('should validate API connection successfully', async () => {
            agent.apiKey = 'test-api-key';
            agent.callClaudeAPI = jest.fn().mockResolvedValue({
                content: [{ text: 'API connection test successful' }]
            });

            const isValid = await agent.validateApiConnection();

            expect(isValid).toBe(true);
            expect(agent.callClaudeAPI).toHaveBeenCalledWith('Test connection');
        });

        test('should handle API connection failure', async () => {
            agent.apiKey = 'invalid-key';
            agent.callClaudeAPI = jest.fn().mockRejectedValue(new Error('Invalid API key'));

            const isValid = await agent.validateApiConnection();

            expect(isValid).toBe(false);
        });
    });

    describe('getCapabilityScore', () => {
        test('should return high score for planning tasks', () => {
            const score = agent.getCapabilityScore('planning');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return high score for complex coding tasks', () => {
            const score = agent.getCapabilityScore('complex_coding');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return high score for coordination tasks', () => {
            const score = agent.getCapabilityScore('coordination');
            expect(score).toBeGreaterThan(0.8);
        });

        test('should return medium score for research tasks', () => {
            const score = agent.getCapabilityScore('research');
            expect(score).toBeGreaterThanOrEqual(0.6);
            expect(score).toBeLessThan(0.8);
        });

        test('should return low score for unknown capabilities', () => {
            const score = agent.getCapabilityScore('unknown_capability');
            expect(score).toBeLessThan(0.5);
        });
    });

    describe('agent status and metrics', () => {
        test('should track execution statistics', async () => {
            agent.apiKey = 'test-api-key';
            agent.validateApiConnection = jest.fn().mockResolvedValue(true);
            
            // Mock the callClaudeAPI to return usage information and track calls
            const mockApiResponse = {
                content: [{ text: JSON.stringify({ result: 'success' }) }],
                usage: { input_tokens: 100, output_tokens: 50 }
            };
            agent.callClaudeAPI = jest.fn().mockImplementation(async () => {
                // Manually increment apiCalls since we're mocking the method
                agent.metrics.apiCalls++;
                return mockApiResponse;
            });

            await agent.initialize();

            const task = new Task({
                id: 'stat_test',
                type: 'planning',
                description: 'Statistics test'
            });

            await agent.executeTask(task);

            const status = agent.getStatus();

            expect(status.tasksCompleted).toBe(1);
            expect(status.totalTokensUsed).toBe(150);
            expect(status.apiCalls).toBe(1);
            expect(status.isInitialized).toBe(true);
        });
    });
});