/**
 * Integration Tests for Team Workflow
 * Tests the complete workflow from team initialization to task execution
 */

import { TeamManager } from '../../src/core/team-manager.js';
import { WorkflowEngine } from '../../src/core/workflow-engine.js';
import { MessageBroker } from '../../src/communication/message-broker.js';
import { MCPToolManager } from '../../src/tools/mcp-tool-manager.js';
import { ClaudeAgent } from '../../src/agents/claude-agent.js';
import { GeminiAgent } from '../../src/agents/gemini-agent.js';
import { Task } from '../../src/agents/base-agent.js';
import fs from 'fs';
import path from 'path';

describe('Team Workflow Integration Tests', () => {
    let teamManager;
    let workflowEngine;
    let messageBroker;
    let mcpToolManager;
    let testConfig;
    let sharedDir;

    beforeAll(async () => {
        // Setup test configuration
        testConfig = {
            teamName: 'Test Team',
            maxTeamSize: 4,
            communicationMode: 'async',
            shared: {
                workflows: './tests/shared/workflows',
                results: './tests/shared/results', 
                states: './tests/shared/states'
            }
        };

        // Create shared directories
        sharedDir = path.join(process.cwd(), 'tests/shared');
        if (!fs.existsSync(sharedDir)) {
            fs.mkdirSync(sharedDir, { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'workflows'), { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'results'), { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'states'), { recursive: true });
        }

        // Initialize core components
        teamManager = new TeamManager(testConfig);
        workflowEngine = new WorkflowEngine(testConfig);
        messageBroker = new MessageBroker(testConfig);
        mcpToolManager = new MCPToolManager(testConfig);
    });

    afterAll(async () => {
        // Clean up test files
        if (fs.existsSync(sharedDir)) {
            fs.rmSync(sharedDir, { recursive: true, force: true });
        }
    });

    describe('Team Initialization and Setup', () => {
        test('should initialize complete team with all agents', async () => {
            // Add team leader (Claude)
            const teamLeader = new ClaudeAgent({
                id: 'claude_leader',
                name: 'Team Leader',
                role: 'leader',
                model: 'claude-3-sonnet-20240229',
                capabilities: ['strategic_planning', 'task_decomposition', 'quality_management']
            });

            const success1 = await teamManager.addAgent(teamLeader);
            expect(success1).toBe(true);

            // Add senior developer (Claude)
            const seniorDev = new ClaudeAgent({
                id: 'claude_senior',
                name: 'Senior Developer',
                role: 'senior_developer',
                model: 'claude-3-sonnet-20240229',
                capabilities: ['architecture_design', 'complex_coding', 'debugging']
            });

            const success2 = await teamManager.addAgent(seniorDev);
            expect(success2).toBe(true);

            // Add researcher (Gemini)
            const researcher = new GeminiAgent({
                id: 'gemini_researcher',
                name: 'Researcher',
                role: 'researcher',
                model: 'gemini-pro',
                capabilities: ['data_collection', 'analysis', 'documentation']
            });

            const success3 = await teamManager.addAgent(researcher);
            expect(success3).toBe(true);

            // Add developer (Gemini)
            const developer = new GeminiAgent({
                id: 'gemini_developer',
                name: 'Developer',
                role: 'developer',
                model: 'gemini-pro',
                capabilities: ['general_coding', 'testing', 'maintenance']
            });

            const success4 = await teamManager.addAgent(developer);
            expect(success4).toBe(true);

            // Verify team composition
            const teamMembers = teamManager.getTeamMembers();
            expect(teamMembers).toHaveLength(4);
            expect(teamMembers.map(m => m.id)).toContain('claude_leader');
            expect(teamMembers.map(m => m.id)).toContain('claude_senior');
            expect(teamMembers.map(m => m.id)).toContain('gemini_researcher');
            expect(teamMembers.map(m => m.id)).toContain('gemini_developer');
        });

        test('should establish communication channels between agents', async () => {
            const agents = teamManager.getTeamMembers();
            
            // Test message sending between agents
            const testMessage = {
                id: 'test_msg_001',
                fromAgent: 'claude_leader',
                toAgent: 'gemini_researcher',
                type: 'task_assignment',
                content: 'Please research the latest web technologies',
                timestamp: new Date().toISOString()
            };

            const success = await messageBroker.sendMessage(testMessage);
            expect(success).toBe(true);

            // Verify message was received
            const messages = await messageBroker.getMessages('gemini_researcher');
            expect(messages).toHaveLength(1);
            expect(messages[0].content).toBe('Please research the latest web technologies');
        });
    });

    describe('Task Creation and Distribution', () => {
        test('should create and classify tasks correctly', async () => {
            const projectTask = {
                id: 'project_001',
                title: 'Build React Dashboard',
                description: 'Create a modern dashboard with real-time data visualization',
                requirements: [
                    'React 18 with hooks',
                    'Chart.js integration',
                    'Real-time WebSocket updates',
                    'Responsive design'
                ],
                priority: 'high',
                deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            };

            const workflow = await workflowEngine.createWorkflow(projectTask);
            expect(workflow).toBeDefined();
            expect(workflow.id).toBe('project_001');
            expect(workflow.tasks).toHaveLength(4); // Should decompose into subtasks
            
            // Verify task classification
            const tasks = workflow.tasks;
            expect(tasks.some(t => t.type === 'architecture')).toBe(true);
            expect(tasks.some(t => t.type === 'development')).toBe(true);
            expect(tasks.some(t => t.type === 'testing')).toBe(true);
        });

        test('should distribute tasks based on agent capabilities', async () => {
            const workflow = await workflowEngine.getWorkflow('project_001');
            const assignments = await workflowEngine.assignTasks(workflow.id);
            
            expect(assignments).toBeDefined();
            expect(Object.keys(assignments)).toHaveLength(4); // All agents should get tasks
            
            // Verify strategic tasks go to team leader
            const leaderTasks = assignments['claude_leader'] || [];
            expect(leaderTasks.some(t => t.type === 'architecture')).toBe(true);
            
            // Verify development tasks go to appropriate agents
            const seniorTasks = assignments['claude_senior'] || [];
            const devTasks = assignments['gemini_developer'] || [];
            expect(seniorTasks.length + devTasks.length).toBeGreaterThan(0);
            
            // Verify research tasks go to researcher
            const researchTasks = assignments['gemini_researcher'] || [];
            expect(researchTasks.some(t => t.type === 'research')).toBe(true);
        });
    });

    describe('Task Execution and Coordination', () => {
        test('should execute tasks with proper coordination', async () => {
            const workflow = await workflowEngine.getWorkflow('project_001');
            const assignments = await workflowEngine.getTaskAssignments(workflow.id);
            
            // Start workflow execution
            await workflowEngine.startWorkflow(workflow.id);
            
            // Simulate task execution by each agent
            const agents = teamManager.getTeamMembers();
            const executionPromises = [];
            
            for (const agent of agents) {
                const agentTasks = assignments[agent.id] || [];
                for (const task of agentTasks) {
                    const taskObj = new Task({
                        id: task.id,
                        type: task.type,
                        description: task.description,
                        priority: task.priority,
                        data: task.data
                    });
                    
                    const promise = agent.executeTask(taskObj);
                    executionPromises.push(promise);
                }
            }
            
            // Wait for all tasks to complete
            const results = await Promise.allSettled(executionPromises);
            
            // Verify execution results
            const successfulTasks = results.filter(r => r.status === 'fulfilled');
            expect(successfulTasks.length).toBeGreaterThan(0);
            
            // Verify workflow status
            const updatedWorkflow = await workflowEngine.getWorkflow('project_001');
            expect(updatedWorkflow.status).toBe('in_progress');
        });

        test('should handle task dependencies correctly', async () => {
            // Create a workflow with dependencies
            const dependentTask = {
                id: 'dependent_001',
                title: 'API Integration',
                description: 'Integrate with external API after database setup',
                dependencies: ['database_setup'],
                priority: 'medium'
            };

            const workflow = await workflowEngine.createWorkflow(dependentTask);
            expect(workflow).toBeDefined();
            
            // Verify dependency handling
            const taskGraph = await workflowEngine.getTaskGraph(workflow.id);
            expect(taskGraph).toBeDefined();
            expect(taskGraph.dependencies).toBeDefined();
        });
    });

    describe('Communication and State Management', () => {
        test('should synchronize state across agents', async () => {
            const initialState = {
                workflowId: 'project_001',
                currentPhase: 'development',
                completedTasks: [],
                blockedTasks: [],
                timestamp: new Date().toISOString()
            };

            // Update state from team leader
            await messageBroker.broadcastState('claude_leader', initialState);
            
            // Verify all agents received the state update
            const agents = teamManager.getTeamMembers();
            for (const agent of agents) {
                const agentState = await messageBroker.getAgentState(agent.id);
                expect(agentState).toBeDefined();
                expect(agentState.workflowId).toBe('project_001');
                expect(agentState.currentPhase).toBe('development');
            }
        });

        test('should handle message priority and ordering', async () => {
            const messages = [
                {
                    id: 'msg_001',
                    fromAgent: 'claude_leader',
                    toAgent: 'gemini_developer',
                    type: 'task_assignment',
                    priority: 'high',
                    content: 'High priority task',
                    timestamp: new Date().toISOString()
                },
                {
                    id: 'msg_002',
                    fromAgent: 'claude_leader',
                    toAgent: 'gemini_developer',
                    type: 'info',
                    priority: 'low',
                    content: 'Low priority info',
                    timestamp: new Date().toISOString()
                }
            ];

            // Send messages
            for (const msg of messages) {
                await messageBroker.sendMessage(msg);
            }

            // Verify priority ordering
            const receivedMessages = await messageBroker.getMessages('gemini_developer');
            expect(receivedMessages).toHaveLength(3); // Including previous test message
            
            // High priority message should be processed first
            const highPriorityMsg = receivedMessages.find(m => m.priority === 'high');
            expect(highPriorityMsg).toBeDefined();
            expect(highPriorityMsg.content).toBe('High priority task');
        });
    });

    describe('Error Handling and Recovery', () => {
        test('should handle agent failures gracefully', async () => {
            // Simulate agent failure
            const failingAgent = teamManager.getAgent('gemini_developer');
            if (failingAgent) {
                failingAgent.status = 'failed';
                
                // Workflow should reassign tasks
                const workflow = await workflowEngine.getWorkflow('project_001');
                const newAssignments = await workflowEngine.reassignTasks(workflow.id);
                
                expect(newAssignments).toBeDefined();
                expect(newAssignments['gemini_developer']).toBeUndefined();
            }
        });

        test('should handle communication failures', async () => {
            // Test message retry mechanism
            const unreliableMessage = {
                id: 'unreliable_msg_001',
                fromAgent: 'claude_leader',
                toAgent: 'non_existent_agent',
                type: 'task_assignment',
                content: 'This should fail',
                timestamp: new Date().toISOString()
            };

            const success = await messageBroker.sendMessage(unreliableMessage);
            expect(success).toBe(false);
            
            // Verify message is added to dead letter queue
            const deadLetterMessages = await messageBroker.getDeadLetterMessages();
            expect(deadLetterMessages.length).toBeGreaterThan(0);
        });
    });

    describe('Performance and Concurrency', () => {
        test('should handle concurrent task execution', async () => {
            const concurrentTasks = Array.from({ length: 5 }, (_, i) => ({
                id: `concurrent_${i}`,
                title: `Concurrent Task ${i}`,
                description: `Task ${i} for concurrency testing`,
                priority: 'medium'
            }));

            const workflows = await Promise.all(
                concurrentTasks.map(task => workflowEngine.createWorkflow(task))
            );

            expect(workflows).toHaveLength(5);
            workflows.forEach((workflow, index) => {
                expect(workflow.id).toBe(`concurrent_${index}`);
            });
        });

        test('should maintain performance under load', async () => {
            const startTime = Date.now();
            
            // Create multiple workflows rapidly
            const loadTasks = Array.from({ length: 10 }, (_, i) => ({
                id: `load_test_${i}`,
                title: `Load Test ${i}`,
                description: `Performance test task ${i}`,
                priority: 'low'
            }));

            await Promise.all(
                loadTasks.map(task => workflowEngine.createWorkflow(task))
            );

            const endTime = Date.now();
            const executionTime = endTime - startTime;
            
            // Should complete within reasonable time (5 seconds)
            expect(executionTime).toBeLessThan(5000);
        });
    });

    describe('File-based Data Exchange', () => {
        test('should save and load workflow data', async () => {
            const workflow = await workflowEngine.getWorkflow('project_001');
            const filePath = path.join(sharedDir, 'workflows', `${workflow.id}.json`);
            
            // Save workflow to file
            await workflowEngine.saveWorkflow(workflow.id, filePath);
            expect(fs.existsSync(filePath)).toBe(true);
            
            // Load workflow from file
            const loadedWorkflow = await workflowEngine.loadWorkflow(filePath);
            expect(loadedWorkflow).toBeDefined();
            expect(loadedWorkflow.id).toBe(workflow.id);
            expect(loadedWorkflow.title).toBe(workflow.title);
        });

        test('should handle result file exchange', async () => {
            const testResult = {
                taskId: 'test_task_001',
                agentId: 'claude_leader',
                result: 'Task completed successfully',
                timestamp: new Date().toISOString(),
                metrics: {
                    executionTime: 1500,
                    memoryUsage: 50,
                    cpuUsage: 15
                }
            };

            const resultPath = path.join(sharedDir, 'results', `${testResult.taskId}.json`);
            
            // Save result
            fs.writeFileSync(resultPath, JSON.stringify(testResult, null, 2));
            expect(fs.existsSync(resultPath)).toBe(true);
            
            // Load and verify result
            const loadedResult = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
            expect(loadedResult.taskId).toBe(testResult.taskId);
            expect(loadedResult.agentId).toBe(testResult.agentId);
            expect(loadedResult.result).toBe(testResult.result);
        });
    });
});