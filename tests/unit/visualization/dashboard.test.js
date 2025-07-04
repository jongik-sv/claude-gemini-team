/**
 * Unit Tests for Dashboard Visualization System
 */

import { Dashboard } from '../../../src/visualization/dashboard.js';
import { LogVisualizer } from '../../../src/visualization/log-visualizer.js';
import { ProgressVisualizer } from '../../../src/visualization/progress-visualizer.js';

describe('Dashboard Visualization System', () => {
    let dashboard;
    
    beforeEach(() => {
        dashboard = new Dashboard({
            enableKeyboard: false, // Disable for testing
            refreshInterval: 100,
            mode: 'combined'
        });
    });

    afterEach(() => {
        if (dashboard.isRunning) {
            dashboard.stop();
        }
    });

    describe('Dashboard Initialization', () => {
        test('should initialize with default configuration', () => {
            expect(dashboard).toBeDefined();
            expect(dashboard.logVisualizer).toBeInstanceOf(LogVisualizer);
            expect(dashboard.progressVisualizer).toBeInstanceOf(ProgressVisualizer);
            expect(dashboard.currentView).toBe('combined');
        });

        test('should initialize with custom configuration', () => {
            const customDashboard = new Dashboard({
                mode: 'logs',
                refreshInterval: 5000,
                enableKeyboard: false
            });
            
            expect(customDashboard.currentView).toBe('logs');
            expect(customDashboard.config.refreshInterval).toBe(5000);
        });
    });

    describe('Agent Management', () => {
        test('should add agents to progress visualizer', () => {
            dashboard.addAgent('test_agent', 'Test Agent', 'developer');
            
            const stats = dashboard.progressVisualizer.getStatistics();
            expect(stats.agents).toHaveLength(1);
            expect(stats.agents[0].id).toBe('test_agent');
            expect(stats.agents[0].name).toBe('Test Agent');
            expect(stats.agents[0].role).toBe('developer');
        });

        test('should handle multiple agents', () => {
            dashboard.addAgent('agent1', 'Agent One', 'leader');
            dashboard.addAgent('agent2', 'Agent Two', 'developer');
            dashboard.addAgent('agent3', 'Agent Three', 'researcher');
            
            const stats = dashboard.progressVisualizer.getStatistics();
            expect(stats.agents).toHaveLength(3);
            expect(stats.summary.totalAgents).toBe(3);
        });
    });

    describe('Workflow Management', () => {
        test('should add workflows to progress visualizer', () => {
            dashboard.addWorkflow('test_workflow', 'Test Workflow', 5);
            
            const stats = dashboard.progressVisualizer.getStatistics();
            expect(stats.workflows).toHaveLength(1);
            expect(stats.workflows[0].id).toBe('test_workflow');
            expect(stats.workflows[0].title).toBe('Test Workflow');
            expect(stats.workflows[0].totalTasks).toBe(5);
        });
    });

    describe('Task Event Handling', () => {
        beforeEach(() => {
            dashboard.addAgent('test_agent', 'Test Agent', 'developer');
        });

        test('should handle task started events', () => {
            dashboard.onTaskStarted('test_agent', 'task_001', 'Test Task');
            
            const stats = dashboard.progressVisualizer.getStatistics();
            const agent = stats.agents.find(a => a.id === 'test_agent');
            
            expect(agent.status).toBe('working');
            expect(agent.currentTask.id).toBe('task_001');
            expect(agent.currentTask.title).toBe('Test Task');
        });

        test('should handle task completed events', () => {
            dashboard.onTaskStarted('test_agent', 'task_001', 'Test Task');
            dashboard.onTaskCompleted('test_agent', 'task_001', 'Test Task', 1500);
            
            const stats = dashboard.progressVisualizer.getStatistics();
            const agent = stats.agents.find(a => a.id === 'test_agent');
            
            expect(agent.status).toBe('completed');
            expect(agent.tasksCompleted).toBe(1);
            expect(stats.system.completedTasks).toBe(1);
        });

        test('should handle task failed events', () => {
            const error = new Error('Task failed');
            dashboard.onTaskStarted('test_agent', 'task_001', 'Test Task');
            dashboard.onTaskFailed('test_agent', 'task_001', 'Test Task', error);
            
            const stats = dashboard.progressVisualizer.getStatistics();
            const agent = stats.agents.find(a => a.id === 'test_agent');
            
            expect(agent.status).toBe('failed');
            expect(agent.tasksFailed).toBe(1);
            expect(stats.system.failedTasks).toBe(1);
        });
    });

    describe('Logging Integration', () => {
        test('should log events through log visualizer', () => {
            const logHistory = dashboard.logVisualizer.getLogHistory();
            const initialLogCount = logHistory.length;
            
            dashboard.info('test_agent', 'Test message');
            
            const newLogHistory = dashboard.logVisualizer.getLogHistory();
            expect(newLogHistory).toHaveLength(initialLogCount + 1);
            
            const lastLog = newLogHistory[newLogHistory.length - 1];
            expect(lastLog.agentId).toBe('test_agent');
            expect(lastLog.level).toBe('info');
            expect(lastLog.message).toBe('Test message');
        });

        test('should log different levels correctly', () => {
            dashboard.error('test_agent', 'Error message');
            dashboard.warn('test_agent', 'Warning message');
            dashboard.debug('test_agent', 'Debug message');
            
            const logHistory = dashboard.logVisualizer.getLogHistory();
            const recentLogs = logHistory.slice(-3);
            
            expect(recentLogs[0].level).toBe('error');
            expect(recentLogs[1].level).toBe('warn');
            expect(recentLogs[2].level).toBe('debug');
        });
    });

    describe('Message Exchange Tracking', () => {
        test('should track message exchanges between agents', () => {
            const logHistory = dashboard.logVisualizer.getLogHistory();
            const initialLogCount = logHistory.length;
            
            dashboard.onMessageExchange('agent1', 'agent2', 'task_assignment');
            
            const newLogHistory = dashboard.logVisualizer.getLogHistory();
            expect(newLogHistory.length).toBeGreaterThan(initialLogCount);
            
            // Should have both sent and received logs
            const messageExchangeLogs = newLogHistory.filter(log => 
                log.message.includes('task_assignment')
            );
            expect(messageExchangeLogs.length).toBeGreaterThanOrEqual(1);
        });
    });

    describe('System Lifecycle Events', () => {
        test('should handle system started event', () => {
            const logHistory = dashboard.logVisualizer.getLogHistory();
            const initialLogCount = logHistory.length;
            
            dashboard.systemStarted();
            
            const newLogHistory = dashboard.logVisualizer.getLogHistory();
            expect(newLogHistory).toHaveLength(initialLogCount + 1);
            
            const lastLog = newLogHistory[newLogHistory.length - 1];
            expect(lastLog.agentId).toBe('system');
            expect(lastLog.message).toContain('started');
        });

        test('should handle workflow lifecycle events', () => {
            dashboard.workflowStarted('workflow_001', 'Test Workflow');
            dashboard.workflowCompleted('workflow_001', 'Test Workflow', 5000);
            
            const logHistory = dashboard.logVisualizer.getLogHistory();
            const workflowLogs = logHistory.filter(log => log.agentId === 'workflow');
            
            expect(workflowLogs.length).toBeGreaterThanOrEqual(2);
            expect(workflowLogs.some(log => log.message.includes('Started'))).toBe(true);
            expect(workflowLogs.some(log => log.message.includes('Completed'))).toBe(true);
        });
    });

    describe('Statistics and Export', () => {
        beforeEach(() => {
            dashboard.addAgent('agent1', 'Agent One', 'leader');
            dashboard.addWorkflow('workflow1', 'Workflow One', 3);
        });

        test('should provide comprehensive statistics', () => {
            const stats = dashboard.getStats();
            
            expect(stats).toHaveProperty('logs');
            expect(stats).toHaveProperty('progress');
            expect(stats).toHaveProperty('dashboard');
            
            expect(stats.progress.summary.totalAgents).toBe(1);
            expect(stats.progress.summary.totalWorkflows).toBe(1);
            expect(stats.logs.totalLogs).toBeGreaterThanOrEqual(0);
        });

        test('should calculate success rates correctly', () => {
            dashboard.onTaskStarted('agent1', 'task1', 'Task 1');
            dashboard.onTaskCompleted('agent1', 'task1', 'Task 1', 1000);
            
            dashboard.onTaskStarted('agent1', 'task2', 'Task 2');
            dashboard.onTaskCompleted('agent1', 'task2', 'Task 2', 1500);
            
            const stats = dashboard.getStats();
            expect(stats.progress.summary.overallSuccessRate).toBe(100);
        });

        test('should handle mixed success/failure rates', () => {
            dashboard.onTaskStarted('agent1', 'task1', 'Task 1');
            dashboard.onTaskCompleted('agent1', 'task1', 'Task 1', 1000);
            
            dashboard.onTaskStarted('agent1', 'task2', 'Task 2');
            dashboard.onTaskFailed('agent1', 'task2', 'Task 2', new Error('Failed'));
            
            const stats = dashboard.getStats();
            expect(stats.progress.summary.overallSuccessRate).toBe(50);
        });
    });

    describe('View Switching', () => {
        test('should switch between different views', () => {
            expect(dashboard.currentView).toBe('combined');
            
            dashboard.switchView('logs');
            expect(dashboard.currentView).toBe('logs');
            
            dashboard.switchView('progress');
            expect(dashboard.currentView).toBe('progress');
            
            dashboard.switchView('combined');
            expect(dashboard.currentView).toBe('combined');
        });

        test('should emit view change events', (done) => {
            dashboard.on('view_changed', (view) => {
                expect(view).toBe('logs');
                done();
            });
            
            dashboard.switchView('logs');
        });
    });

    describe('Dashboard Lifecycle', () => {
        test('should start and stop dashboard correctly', () => {
            expect(dashboard.isRunning).toBe(false);
            
            dashboard.start();
            expect(dashboard.isRunning).toBe(true);
            
            dashboard.stop();
            expect(dashboard.isRunning).toBe(false);
        });

        test('should emit lifecycle events', (done) => {
            let eventCount = 0;
            
            dashboard.on('dashboard_started', () => {
                eventCount++;
                if (eventCount === 2) done();
            });
            
            dashboard.on('dashboard_stopped', () => {
                eventCount++;
                if (eventCount === 2) done();
            });
            
            dashboard.start();
            dashboard.stop();
        });
    });
});