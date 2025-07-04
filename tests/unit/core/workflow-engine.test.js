const { WorkflowEngine } = require('../../../src/core/workflow-engine');
const { Task } = require('../../../src/agents/base-agent');
const {
    createValidTask,
    createPlanningTask,
    createResearchTask,
    createComplexCodingTask
} = require('../../helpers/factories');

describe('WorkflowEngine', () => {
    let workflowEngine;

    beforeEach(() => {
        workflowEngine = new WorkflowEngine();
    });

    describe('생성자', () => {
        test('should initialize with empty state', () => {
            expect(workflowEngine.activeWorkflows).toBeDefined();
            expect(workflowEngine.taskQueue).toBeDefined();
            expect(workflowEngine.completedTasks).toBeDefined();
            expect(workflowEngine.getActiveTaskCount()).toBe(0);
        });
    });

    describe('createExecutionPlan', () => {
        test('should create execution plan for simple project', async () => {
            const projectDescription = 'Build a simple web application';
            const assigneeId = 'claude_leader';

            const plan = await workflowEngine.createExecutionPlan(assigneeId, projectDescription);

            expect(plan).toBeDefined();
            expect(plan.id).toBeDefined();
            expect(plan.description).toBe(projectDescription);
            expect(plan.phases).toBeInstanceOf(Array);
            expect(plan.phases.length).toBeGreaterThan(0);
            expect(plan.estimatedDuration).toBeGreaterThan(0);
        });

        test('should include phases in execution plan', async () => {
            const plan = await workflowEngine.createExecutionPlan('claude_leader', 'Test project');

            expect(plan.phases).toContain('planning');
            expect(plan.phases).toContain('implementation');
            expect(plan.phases).toContain('testing');
            expect(plan.phases).toContain('deployment');
        });

        test('should emit plan_created event', async () => {
            const eventHandler = jest.fn();
            workflowEngine.on('plan_created', eventHandler);

            const plan = await workflowEngine.createExecutionPlan('claude_leader', 'Test project');

            expect(eventHandler).toHaveBeenCalledWith(plan);
        });
    });

    describe('distributeTasks', () => {
        test('should distribute tasks from execution plan', async () => {
            const plan = {
                id: 'plan_001',
                description: 'Test project',
                phases: ['planning', 'implementation', 'testing'],
                complexity: 'medium'
            };

            const tasks = await workflowEngine.distributeTasks(plan);

            expect(tasks).toBeInstanceOf(Array);
            expect(tasks.length).toBeGreaterThan(0);
            expect(tasks[0]).toBeInstanceOf(Task);
            expect(tasks.every(task => task.id)).toBe(true);
        });

        test('should create tasks with proper priorities', async () => {
            const plan = {
                id: 'plan_001',
                description: 'Test project',
                phases: ['planning', 'implementation', 'testing'],
                complexity: 'high'
            };

            const tasks = await workflowEngine.distributeTasks(plan);
            const planningTask = tasks.find(t => t.type === 'planning');

            expect(planningTask.priority).toBe(5); // 계획은 최고 우선순위
        });

        test('should set task dependencies correctly', async () => {
            const plan = {
                id: 'plan_001',
                description: 'Test project',
                phases: ['planning', 'implementation', 'testing'],
                complexity: 'medium'
            };

            const tasks = await workflowEngine.distributeTasks(plan);
            const implementationTask = tasks.find(t => t.type === 'implementation');

            expect(implementationTask.dependencies).toContain(
                tasks.find(t => t.type === 'planning').id
            );
        });
    });

    describe('addTask', () => {
        test('should add task to queue', async () => {
            const task = new Task(createValidTask());

            await workflowEngine.addTask(task);

            expect(workflowEngine.taskQueue.has(task.id)).toBe(true);
            expect(workflowEngine.getActiveTaskCount()).toBe(1);
        });

        test('should emit task_added event', async () => {
            const task = new Task(createValidTask());
            const eventHandler = jest.fn();
            workflowEngine.on('task_added', eventHandler);

            await workflowEngine.addTask(task);

            expect(eventHandler).toHaveBeenCalledWith(task);
        });

        test('should reject duplicate task IDs', async () => {
            const task1 = new Task(createValidTask({ id: 'duplicate_task' }));
            const task2 = new Task(createValidTask({ id: 'duplicate_task' }));

            await workflowEngine.addTask(task1);

            await expect(workflowEngine.addTask(task2)).rejects.toThrow('Task with ID duplicate_task already exists');
        });
    });

    describe('getNextTask', () => {
        test('should return highest priority available task', async () => {
            const lowPriorityTask = new Task(createValidTask({ id: 'low', priority: 1 }));
            const highPriorityTask = new Task(createValidTask({ id: 'high', priority: 5 }));

            await workflowEngine.addTask(lowPriorityTask);
            await workflowEngine.addTask(highPriorityTask);

            const nextTask = workflowEngine.getNextTask();

            expect(nextTask.id).toBe('high');
        });

        test('should respect task dependencies', async () => {
            const dependentTask = new Task(createValidTask({ 
                id: 'dependent', 
                dependencies: ['prerequisite'] 
            }));
            const prerequisiteTask = new Task(createValidTask({ id: 'prerequisite' }));

            await workflowEngine.addTask(dependentTask);
            await workflowEngine.addTask(prerequisiteTask);

            const nextTask = workflowEngine.getNextTask();

            expect(nextTask.id).toBe('prerequisite');
        });

        test('should return null when no tasks available', () => {
            const nextTask = workflowEngine.getNextTask();

            expect(nextTask).toBeNull();
        });
    });

    describe('markTaskCompleted', () => {
        test('should move task from queue to completed', async () => {
            const task = new Task(createValidTask());
            await workflowEngine.addTask(task);

            workflowEngine.markTaskCompleted(task.id, { result: 'success' });

            expect(workflowEngine.taskQueue.has(task.id)).toBe(false);
            expect(workflowEngine.completedTasks.has(task.id)).toBe(true);
        });

        test('should emit task_completed event', async () => {
            const task = new Task(createValidTask());
            await workflowEngine.addTask(task);

            const eventHandler = jest.fn();
            workflowEngine.on('task_completed', eventHandler);

            workflowEngine.markTaskCompleted(task.id, { result: 'success' });

            expect(eventHandler).toHaveBeenCalledWith(task.id, { result: 'success' });
        });
    });

    describe('integrateResults', () => {
        test('should integrate multiple task results', async () => {
            const results = [
                { status: 'fulfilled', value: { type: 'planning', result: 'plan created' } },
                { status: 'fulfilled', value: { type: 'implementation', result: 'code written' } },
                { status: 'fulfilled', value: { type: 'testing', result: 'tests passed' } }
            ];

            const integrated = await workflowEngine.integrateResults('claude_leader', results);

            expect(integrated.success).toBe(true);
            expect(integrated.results).toHaveLength(3);
            expect(integrated.summary).toBeDefined();
        });

        test('should handle failed results', async () => {
            const results = [
                { status: 'fulfilled', value: { type: 'planning', result: 'plan created' } },
                { status: 'rejected', reason: new Error('Implementation failed') }
            ];

            const integrated = await workflowEngine.integrateResults('claude_leader', results);

            expect(integrated.success).toBe(false);
            expect(integrated.failures).toHaveLength(1);
        });
    });

    describe('getWorkflowStatus', () => {
        test('should return current workflow status', async () => {
            const task1 = new Task(createValidTask({ id: 'task1' }));
            const task2 = new Task(createValidTask({ id: 'task2' }));
            
            await workflowEngine.addTask(task1);
            await workflowEngine.addTask(task2);
            workflowEngine.markTaskCompleted('task1', { result: 'done' });

            const status = workflowEngine.getWorkflowStatus();

            expect(status.totalTasks).toBe(2);
            expect(status.completedTasks).toBe(1);
            expect(status.pendingTasks).toBe(1);
            expect(status.progress).toBe(50);
        });
    });

    describe('assignTaskToAgent', () => {
        test('should assign task to appropriate agent', async () => {
            const task = new Task(createPlanningTask());
            await workflowEngine.addTask(task);

            const mockAgents = [
                { id: 'claude_leader', role: 'leader', capabilities: ['planning'] },
                { id: 'dev1', role: 'developer', capabilities: ['coding'] }
            ];

            const assignment = workflowEngine.assignTaskToAgent(task, mockAgents);

            expect(assignment.agentId).toBe('claude_leader');
            expect(assignment.confidence).toBeGreaterThan(0.5);
        });

        test('should consider agent workload', async () => {
            const task = new Task(createValidTask());
            
            const mockAgents = [
                { id: 'busy_agent', capabilities: ['coding'], workload: 90 },
                { id: 'free_agent', capabilities: ['coding'], workload: 20 }
            ];

            const assignment = workflowEngine.assignTaskToAgent(task, mockAgents);

            expect(assignment.agentId).toBe('free_agent');
        });
    });

    describe('workflow orchestration', () => {
        test('should execute complete workflow', async () => {
            const projectDescription = 'Build simple calculator';
            
            // 1. 계획 생성
            const plan = await workflowEngine.createExecutionPlan('claude_leader', projectDescription);
            
            // 2. 태스크 분배
            const tasks = await workflowEngine.distributeTasks(plan);
            
            // 3. 워크플로우 상태 확인
            const status = workflowEngine.getWorkflowStatus();

            expect(plan.id).toBeDefined();
            expect(tasks.length).toBeGreaterThan(0);
            expect(status.totalTasks).toBe(tasks.length);
            expect(status.progress).toBe(0);
        });
    });
});