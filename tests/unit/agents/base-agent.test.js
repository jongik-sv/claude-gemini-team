const { BaseAgent, Task } = require('../../../src/agents/base-agent');
const {
    createValidTask,
    createValidMemberConfig,
    invalidTaskConfigs
} = require('../../helpers/factories');

// 콘솔 출력은 setup.js에서 모킹됨

// BaseAgent를 상속받는 테스트용 에이전트
class TestAgent extends BaseAgent {
    async onInitialize() {
        this.initialized = true;
    }

    async executeTaskImplementation(task) {
        // 태스크 타입에 따른 시뮬레이션
        task.updateProgress(30);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        task.updateProgress(70);
        await new Promise(resolve => setTimeout(resolve, 100));
        
        return {
            type: 'test_result',
            content: `Processed ${task.type} task: ${task.description}`,
            timestamp: new Date()
        };
    }

    // 테스트용으로 필요한 도구 목록을 간단하게 반환
    getRequiredTools(task) {
        return []; // 테스트에서는 도구가 필요하지 않음
    }
}

describe('Task', () => {
    describe('생성자', () => {
        test('should create task with valid config', () => {
            const config = createValidTask();
            const task = new Task(config);

            expect(task.id).toBe(config.id);
            expect(task.type).toBe(config.type);
            expect(task.description).toBe(config.description);
            expect(task.priority).toBe(config.priority);
            expect(task.status).toBe('pending');
            expect(task.progress).toBe(0);
        });

        test('should set default values for optional fields', () => {
            const config = {
                id: 'test_task',
                type: 'coding',
                description: 'Test task'
            };
            const task = new Task(config);

            expect(task.priority).toBe(3);
            expect(task.complexity).toBe('medium');
            expect(task.dependencies).toEqual([]);
            expect(task.estimatedTime).toBe(0);
        });
    });

    describe('start', () => {
        test('should update status and set start time', (done) => {
            const task = new Task(createValidTask());
            const beforeStart = new Date();
            
            // 약간의 지연을 두고 테스트
            setTimeout(() => {
                task.start();
                
                expect(task.status).toBe('in_progress');
                expect(task.startedAt).toBeInstanceOf(Date);
                expect(task.startedAt.getTime()).toBeGreaterThanOrEqual(beforeStart.getTime());
                expect(task.progress).toBe(5);
                done();
            }, 1);
        });
    });

    describe('updateProgress', () => {
        test('should update progress within valid range', () => {
            const task = new Task(createValidTask());
            
            task.updateProgress(50);
            expect(task.progress).toBe(50);
            
            // 범위 제한 테스트
            task.updateProgress(150);
            expect(task.progress).toBe(100);
            
            task.updateProgress(-10);
            expect(task.progress).toBe(0);
        });
    });

    describe('complete', () => {
        test('should complete task with result', (done) => {
            const task = new Task(createValidTask());
            task.start();
            
            setTimeout(() => {
                const result = { output: 'test result' };
                task.complete(result);
                
                expect(task.status).toBe('completed');
                expect(task.progress).toBe(100);
                expect(task.result).toBe(result);
                expect(task.completedAt).toBeInstanceOf(Date);
                expect(task.actualTime).toBeGreaterThan(0);
                done();
            }, 10);
        });
    });

    describe('fail', () => {
        test('should fail task with error', (done) => {
            const task = new Task(createValidTask());
            task.start();
            
            setTimeout(() => {
                const error = new Error('Test error');
                task.fail(error);
                
                expect(task.status).toBe('failed');
                expect(task.error).toBe(error);
                expect(task.completedAt).toBeInstanceOf(Date);
                expect(task.actualTime).toBeGreaterThan(0);
                done();
            }, 10);
        });
    });

    describe('toJSON', () => {
        test('should serialize task correctly', (done) => {
            const task = new Task(createValidTask());
            task.start();
            
            setTimeout(() => {
                task.complete({ result: 'success' });
                
                const json = task.toJSON();
                
                expect(json.id).toBe(task.id);
                expect(json.status).toBe('completed');
                expect(json.result).toEqual({ result: 'success' });
                expect(json.actualTime).toBeGreaterThan(0);
                done();
            }, 10);
        });
    });
});

describe('BaseAgent', () => {
    let agent;

    beforeEach(() => {
        const config = createValidMemberConfig();
        agent = new TestAgent(config);
    });

    describe('생성자', () => {
        test('should create agent with valid config', () => {
            expect(agent.id).toBe('test_member');
            expect(agent.name).toBe('Test Member');
            expect(agent.role).toBe('developer');
            expect(agent.capabilities).toContain('coding');
            expect(agent.status).toBe('idle');
            expect(agent.isInitialized).toBe(false);
        });

        test('should set default values', () => {
            const config = {
                id: 'minimal_agent',
                name: 'Minimal Agent',
                role: 'developer'
            };
            const minimalAgent = new TestAgent(config);

            expect(minimalAgent.capabilities).toEqual([]);
            expect(minimalAgent.color).toBe('white');
            expect(minimalAgent.maxConcurrentTasks).toBe(1);
        });
    });

    describe('initialize', () => {
        test('should initialize agent successfully', async () => {
            await agent.initialize();
            
            expect(agent.isInitialized).toBe(true);
            expect(agent.status).toBe('idle');
            expect(agent.initialized).toBe(true); // TestAgent 특정 플래그
        });

        test('should emit initialized event', async () => {
            const eventHandler = jest.fn();
            agent.on('initialized', eventHandler);
            
            await agent.initialize();
            
            expect(eventHandler).toHaveBeenCalled();
        });

        test('should not initialize twice', async () => {
            await agent.initialize();
            const firstInitTime = agent.isInitialized;
            
            await agent.initialize();
            
            expect(agent.isInitialized).toBe(firstInitTime);
        });

        test('should handle initialization error', async () => {
            // 초기화 실패를 시뮬레이션
            agent.onInitialize = jest.fn().mockRejectedValue(new Error('Init failed'));
            
            await expect(agent.initialize()).rejects.toThrow('Init failed');
            expect(agent.status).toBe('error');
            expect(agent.isInitialized).toBe(false);
        });
    });

    describe('executeTask', () => {
        beforeEach(async () => {
            await agent.initialize();
        });

        test('should execute task successfully', async () => {
            const task = new Task(createValidTask());
            
            const result = await agent.executeTask(task);
            
            expect(task.status).toBe('completed');
            expect(task.progress).toBe(100);
            expect(result.type).toBe('test_result');
            expect(result.content).toContain('Processed coding task');
            expect(agent.status).toBe('idle');
            expect(agent.currentTask).toBeNull();
        });

        test('should emit task events', async () => {
            const task = new Task(createValidTask());
            const startHandler = jest.fn();
            const progressHandler = jest.fn();
            const completedHandler = jest.fn();
            
            agent.on('task_started', startHandler);
            agent.on('task_progress', progressHandler);
            agent.on('task_completed', completedHandler);
            
            await agent.executeTask(task);
            
            expect(startHandler).toHaveBeenCalledWith(task);
            expect(progressHandler).toHaveBeenCalled();
            expect(completedHandler).toHaveBeenCalledWith(task);
        });

        test('should handle task timeout', async () => {
            const task = new Task(createValidTask());
            agent.taskTimeout = 50; // 50ms 타임아웃
            
            // executeTaskImplementation을 오래 걸리도록 모킹
            agent.executeTaskImplementation = jest.fn(() => 
                new Promise(resolve => setTimeout(resolve, 200))
            );
            
            await expect(agent.executeTask(task)).rejects.toThrow('Task timeout');
            expect(task.status).toBe('failed');
            expect(agent.status).toBe('idle');
        }, 1000);

        test('should handle task execution error', async () => {
            const task = new Task(createValidTask());
            const error = new Error('Execution failed');
            
            agent.executeTaskImplementation = jest.fn().mockRejectedValue(error);
            
            await expect(agent.executeTask(task)).rejects.toThrow('Execution failed');
            expect(task.status).toBe('failed');
            expect(task.error).toBe(error);
        });

        test('should update agent status during execution', async () => {
            const task = new Task(createValidTask());
            let statusDuringExecution;
            
            agent.executeTaskImplementation = jest.fn(async () => {
                statusDuringExecution = agent.status;
                return { result: 'success' };
            });
            
            await agent.executeTask(task);
            
            expect(statusDuringExecution).toBe('busy');
            expect(agent.status).toBe('idle');
        });
    });

    describe('도구 관리', () => {
        beforeEach(async () => {
            await agent.initialize();
        });

        test('should add tool successfully', async () => {
            const mockTool = {
                execute: jest.fn().mockResolvedValue('tool result')
            };
            
            await agent.addTool('test_tool', mockTool);
            
            expect(agent.availableTools.has('test_tool')).toBe(true);
            expect(agent.availableTools.get('test_tool')).toBe(mockTool);
        });

        test('should emit tool_added event', async () => {
            const eventHandler = jest.fn();
            agent.on('tool_added', eventHandler);
            
            const mockTool = { execute: jest.fn() };
            await agent.addTool('test_tool', mockTool);
            
            expect(eventHandler).toHaveBeenCalledWith('test_tool');
        });

        test('should remove tool successfully', () => {
            const mockTool = { execute: jest.fn() };
            agent.availableTools.set('test_tool', mockTool);
            
            agent.removeTool('test_tool');
            
            expect(agent.availableTools.has('test_tool')).toBe(false);
        });

        test('should use tool successfully', async () => {
            const mockTool = {
                execute: jest.fn().mockResolvedValue('tool result')
            };
            agent.availableTools.set('test_tool', mockTool);
            
            const result = await agent.useTool('test_tool', 'arg1', 'arg2');
            
            expect(result).toBe('tool result');
            expect(mockTool.execute).toHaveBeenCalledWith('arg1', 'arg2');
        });

        test('should throw error for non-existent tool', async () => {
            await expect(
                agent.useTool('non_existent_tool')
            ).rejects.toThrow('Tool not available: non_existent_tool');
        });

        test('should handle tool execution error', async () => {
            const mockTool = {
                execute: jest.fn().mockRejectedValue(new Error('Tool failed'))
            };
            agent.availableTools.set('failing_tool', mockTool);
            
            await expect(
                agent.useTool('failing_tool')
            ).rejects.toThrow('Tool failed');
        });
    });

    describe('성능 추적', () => {
        beforeEach(async () => {
            await agent.initialize();
        });

        test('should update performance on successful task', () => {
            const task = new Task(createValidTask());
            task.actualTime = 5000;
            
            agent.updatePerformance(task, true);
            
            expect(agent.performance.tasksCompleted).toBe(1);
            expect(agent.performance.tasksSucceeded).toBe(1);
            expect(agent.performance.tasksFailed).toBe(0);
            expect(agent.performance.successRate).toBe(100);
            expect(agent.performance.totalExecutionTime).toBe(5000);
        });

        test('should update performance on failed task', () => {
            const task = new Task(createValidTask());
            task.actualTime = 3000;
            
            agent.updatePerformance(task, false);
            
            expect(agent.performance.tasksCompleted).toBe(1);
            expect(agent.performance.tasksSucceeded).toBe(0);
            expect(agent.performance.tasksFailed).toBe(1);
            expect(agent.performance.successRate).toBe(0);
        });

        test('should calculate average execution time', () => {
            const task1 = new Task(createValidTask());
            task1.actualTime = 4000;
            const task2 = new Task(createValidTask());
            task2.actualTime = 6000;
            
            agent.updatePerformance(task1, true);
            agent.updatePerformance(task2, true);
            
            expect(agent.performance.averageExecutionTime).toBe(5000);
        });
    });

    describe('상태 관리', () => {
        test('should update workload correctly', () => {
            const eventHandler = jest.fn();
            agent.on('workload_changed', eventHandler);
            
            agent.updateWorkload(75);
            
            expect(agent.workload).toBe(75);
            expect(eventHandler).toHaveBeenCalledWith(75);
        });

        test('should check capability correctly', () => {
            expect(agent.hasCapability('coding')).toBe(true);
            expect(agent.hasCapability('testing')).toBe(true);
            expect(agent.hasCapability('invalid')).toBe(false);
        });

        test('should check availability correctly', () => {
            agent.status = 'idle';
            agent.workload = 50;
            expect(agent.isAvailable()).toBe(true);
            
            agent.status = 'busy';
            expect(agent.isAvailable()).toBe(false);
            
            agent.status = 'idle';
            agent.workload = 90;
            expect(agent.isAvailable()).toBe(false);
        });
    });

    describe('하트비트', () => {
        test('should emit heartbeat events', (done) => {
            agent.heartbeatInterval = 100; // 100ms로 설정
            
            agent.on('heartbeat', (data) => {
                expect(data.id).toBe(agent.id);
                expect(data.status).toBe(agent.status);
                expect(data.workload).toBe(agent.workload);
                expect(data.timestamp).toBeInstanceOf(Date);
                done();
            });
            
            agent.startHeartbeat();
        });
    });

    describe('shutdown', () => {
        test('should shutdown agent gracefully', async () => {
            await agent.initialize();
            const eventHandler = jest.fn();
            agent.on('shutdown', eventHandler);
            
            // 진행 중인 작업 시뮬레이션
            const task = new Task(createValidTask());
            agent.currentTask = task;
            
            await agent.shutdown();
            
            expect(agent.status).toBe('offline');
            expect(eventHandler).toHaveBeenCalled();
            expect(task.status).toBe('failed');
        });

        test('should close all connections', async () => {
            const mockConnection = { close: jest.fn() };
            agent.activeConnections.set('test_connection', mockConnection);
            
            await agent.shutdown();
            
            expect(mockConnection.close).toHaveBeenCalled();
        });
    });

    describe('toJSON', () => {
        test('should serialize agent correctly', () => {
            const json = agent.toJSON();
            
            expect(json.id).toBe(agent.id);
            expect(json.name).toBe(agent.name);
            expect(json.role).toBe(agent.role);
            expect(json.capabilities).toEqual(agent.capabilities);
            expect(json.status).toBe(agent.status);
            expect(json.workload).toBe(agent.workload);
            expect(json.isInitialized).toBe(agent.isInitialized);
        });
    });
});