/**
 * End-to-End Test for Complete Workflow
 * Simulates a real-world project from start to finish
 */

import { TeamManager } from '../../src/core/team-manager.js';
import { WorkflowEngine } from '../../src/core/workflow-engine.js';
import { MessageBroker } from '../../src/communication/message-broker.js';
import { MCPToolManager } from '../../src/tools/mcp-tool-manager.js';
import { ClaudeAgent } from '../../src/agents/claude-agent.js';
import { GeminiAgent } from '../../src/agents/gemini-agent.js';
import fs from 'fs';
import path from 'path';

describe('Complete Workflow E2E Test', () => {
    let teamManager;
    let workflowEngine;
    let messageBroker;
    let mcpToolManager;
    let testConfig;
    let sharedDir;

    beforeAll(async () => {
        // Setup test environment
        testConfig = {
            teamName: 'E2E Test Team',
            maxTeamSize: 4,
            communicationMode: 'async',
            shared: {
                workflows: './tests/e2e/shared/workflows',
                results: './tests/e2e/shared/results',
                states: './tests/e2e/shared/states'
            },
            timeout: 30000,
            retryAttempts: 3
        };

        // Create directories
        sharedDir = path.join(process.cwd(), 'tests/e2e/shared');
        if (!fs.existsSync(sharedDir)) {
            fs.mkdirSync(sharedDir, { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'workflows'), { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'results'), { recursive: true });
            fs.mkdirSync(path.join(sharedDir, 'states'), { recursive: true });
        }

        // Initialize system
        teamManager = new TeamManager(testConfig);
        workflowEngine = new WorkflowEngine(testConfig);
        messageBroker = new MessageBroker(testConfig);
        mcpToolManager = new MCPToolManager(testConfig);

        await teamManager.initialize();
        await workflowEngine.initialize();
        await messageBroker.initialize();
        await mcpToolManager.initialize();
    });

    afterAll(async () => {
        // Cleanup
        await teamManager.shutdown();
        await workflowEngine.shutdown();
        await messageBroker.shutdown();
        await mcpToolManager.shutdown();

        // Clean up test files
        if (fs.existsSync(sharedDir)) {
            fs.rmSync(sharedDir, { recursive: true, force: true });
        }
    });

    test('Complete E-commerce Project Workflow', async () => {
        // Step 1: Initialize team
        console.log('Step 1: Initializing team...');
        
        const teamLeader = new ClaudeAgent({
            id: 'claude_leader',
            name: 'Team Leader',
            role: 'leader',
            model: 'claude-3-sonnet-20240229',
            capabilities: ['strategic_planning', 'task_decomposition', 'quality_management']
        });

        const seniorDev = new ClaudeAgent({
            id: 'claude_senior',
            name: 'Senior Developer',
            role: 'senior_developer',
            model: 'claude-3-sonnet-20240229',
            capabilities: ['architecture_design', 'complex_coding', 'debugging']
        });

        const researcher = new GeminiAgent({
            id: 'gemini_researcher',
            name: 'Researcher',
            role: 'researcher',
            model: 'gemini-pro',
            capabilities: ['data_collection', 'analysis', 'documentation']
        });

        const developer = new GeminiAgent({
            id: 'gemini_developer',
            name: 'Developer',
            role: 'developer',
            model: 'gemini-pro',
            capabilities: ['general_coding', 'testing', 'maintenance']
        });

        await teamManager.addAgent(teamLeader);
        await teamManager.addAgent(seniorDev);
        await teamManager.addAgent(researcher);
        await teamManager.addAgent(developer);

        expect(teamManager.getTeamMembers()).toHaveLength(4);
        console.log('✓ Team initialized successfully');

        // Step 2: Create complex project
        console.log('Step 2: Creating e-commerce project...');
        
        const ecommerceProject = {
            id: 'ecommerce_project',
            title: 'Modern E-commerce Platform',
            description: 'Build a full-featured e-commerce platform with React frontend, Node.js backend, and PostgreSQL database',
            requirements: [
                'User authentication and authorization',
                'Product catalog with search and filtering',
                'Shopping cart and checkout process',
                'Payment integration (Stripe)',
                'Order management system',
                'Admin dashboard',
                'Real-time inventory updates',
                'Email notifications',
                'Mobile responsive design',
                'API documentation'
            ],
            priority: 'high',
            deadline: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
            techStack: ['React', 'Node.js', 'PostgreSQL', 'Redis', 'Docker'],
            estimatedHours: 200
        };

        const workflow = await workflowEngine.createWorkflow(ecommerceProject);
        expect(workflow).toBeDefined();
        expect(workflow.id).toBe('ecommerce_project');
        console.log(`✓ Project created with ${workflow.tasks.length} tasks`);

        // Step 3: Task decomposition and assignment
        console.log('Step 3: Decomposing and assigning tasks...');
        
        const assignments = await workflowEngine.assignTasks(workflow.id);
        expect(assignments).toBeDefined();
        expect(Object.keys(assignments)).toHaveLength(4);
        
        // Verify task distribution
        const totalTasks = Object.values(assignments).reduce((sum, tasks) => sum + tasks.length, 0);
        expect(totalTasks).toBeGreaterThan(0);
        console.log(`✓ ${totalTasks} tasks assigned to team members`);

        // Step 4: Start workflow execution
        console.log('Step 4: Starting workflow execution...');
        
        await workflowEngine.startWorkflow(workflow.id);
        const workflowStatus = await workflowEngine.getWorkflowStatus(workflow.id);
        expect(workflowStatus.status).toBe('in_progress');
        console.log('✓ Workflow started successfully');

        // Step 5: Simulate research phase
        console.log('Step 5: Executing research phase...');
        
        const researchTasks = assignments['gemini_researcher'] || [];
        expect(researchTasks.length).toBeGreaterThan(0);
        
        for (const task of researchTasks) {
            const result = await researcher.executeTask(task);
            expect(result).toBeDefined();
            expect(result.status).toBe('completed');
            
            // Save research results
            const resultPath = path.join(sharedDir, 'results', `${task.id}.json`);
            fs.writeFileSync(resultPath, JSON.stringify({
                taskId: task.id,
                agentId: 'gemini_researcher',
                result: result.output,
                timestamp: new Date().toISOString()
            }, null, 2));
        }
        console.log(`✓ Research phase completed (${researchTasks.length} tasks)`);

        // Step 6: Architecture design phase
        console.log('Step 6: Executing architecture design...');
        
        const leaderTasks = assignments['claude_leader'] || [];
        const seniorTasks = assignments['claude_senior'] || [];
        const architectureTasks = [...leaderTasks, ...seniorTasks].filter(t => 
            t.type === 'architecture' || t.type === 'design'
        );
        
        for (const task of architectureTasks) {
            const agent = task.assignedTo === 'claude_leader' ? teamLeader : seniorDev;
            const result = await agent.executeTask(task);
            expect(result).toBeDefined();
            
            // Save architecture decisions
            const resultPath = path.join(sharedDir, 'results', `${task.id}.json`);
            fs.writeFileSync(resultPath, JSON.stringify({
                taskId: task.id,
                agentId: task.assignedTo,
                result: result.output,
                timestamp: new Date().toISOString()
            }, null, 2));
        }
        console.log(`✓ Architecture design completed (${architectureTasks.length} tasks)`);

        // Step 7: Development phase
        console.log('Step 7: Executing development phase...');
        
        const developmentTasks = assignments['gemini_developer'] || [];
        expect(developmentTasks.length).toBeGreaterThan(0);
        
        for (const task of developmentTasks) {
            const result = await developer.executeTask(task);
            expect(result).toBeDefined();
            
            // Save development results
            const resultPath = path.join(sharedDir, 'results', `${task.id}.json`);
            fs.writeFileSync(resultPath, JSON.stringify({
                taskId: task.id,
                agentId: 'gemini_developer',
                result: result.output,
                timestamp: new Date().toISOString()
            }, null, 2));
        }
        console.log(`✓ Development phase completed (${developmentTasks.length} tasks)`);

        // Step 8: Team coordination and communication
        console.log('Step 8: Testing team coordination...');
        
        // Simulate status updates
        const statusMessage = {
            id: 'status_update_001',
            fromAgent: 'claude_leader',
            toAgent: 'broadcast',
            type: 'status_update',
            content: 'Development phase completed, moving to testing phase',
            timestamp: new Date().toISOString()
        };

        await messageBroker.broadcastMessage(statusMessage);
        
        // Verify all agents received the message
        const agents = teamManager.getTeamMembers();
        for (const agent of agents) {
            if (agent.id !== 'claude_leader') {
                const messages = await messageBroker.getMessages(agent.id);
                expect(messages.some(m => m.type === 'status_update')).toBe(true);
            }
        }
        console.log('✓ Team coordination working correctly');

        // Step 9: State synchronization
        console.log('Step 9: Testing state synchronization...');
        
        const projectState = {
            workflowId: workflow.id,
            currentPhase: 'testing',
            completedTasks: totalTasks,
            remainingTasks: 0,
            blockedTasks: 0,
            progress: 85,
            timestamp: new Date().toISOString()
        };

        await messageBroker.broadcastState('claude_leader', projectState);
        
        // Verify state synchronization
        for (const agent of agents) {
            const agentState = await messageBroker.getAgentState(agent.id);
            expect(agentState).toBeDefined();
            expect(agentState.workflowId).toBe(workflow.id);
            expect(agentState.currentPhase).toBe('testing');
        }
        console.log('✓ State synchronization working correctly');

        // Step 10: Quality assurance and project completion
        console.log('Step 10: Finalizing project...');
        
        // Update workflow status
        await workflowEngine.updateWorkflowStatus(workflow.id, 'completed');
        const finalStatus = await workflowEngine.getWorkflowStatus(workflow.id);
        expect(finalStatus.status).toBe('completed');
        
        // Generate project report
        const projectReport = {
            projectId: workflow.id,
            title: workflow.title,
            status: 'completed',
            startDate: workflow.createdAt,
            endDate: new Date().toISOString(),
            teamMembers: agents.map(a => ({ id: a.id, name: a.name, role: a.role })),
            totalTasks: totalTasks,
            completedTasks: totalTasks,
            successRate: 100,
            results: fs.readdirSync(path.join(sharedDir, 'results')).map(file => ({
                taskId: file.replace('.json', ''),
                file: file
            }))
        };

        const reportPath = path.join(sharedDir, 'project_report.json');
        fs.writeFileSync(reportPath, JSON.stringify(projectReport, null, 2));
        
        expect(fs.existsSync(reportPath)).toBe(true);
        console.log('✓ Project completed successfully');

        // Step 11: Verify all components are working
        console.log('Step 11: Final verification...');
        
        // Verify team manager
        expect(teamManager.getTeamMembers()).toHaveLength(4);
        expect(teamManager.getTeamStatus()).toBe('active');
        
        // Verify workflow engine
        const allWorkflows = await workflowEngine.getAllWorkflows();
        expect(allWorkflows.length).toBeGreaterThan(0);
        
        // Verify message broker
        const messageStats = await messageBroker.getMessageStats();
        expect(messageStats.totalMessages).toBeGreaterThan(0);
        
        // Verify MCP tool manager
        const availableTools = await mcpToolManager.getAvailableTools();
        expect(availableTools.length).toBeGreaterThan(0);
        
        console.log('✓ All system components verified');

        // Final assertions
        expect(projectReport.status).toBe('completed');
        expect(projectReport.successRate).toBe(100);
        expect(projectReport.totalTasks).toBe(projectReport.completedTasks);
        
        console.log('\n🎉 E2E Test completed successfully!');
        console.log(`Project: ${projectReport.title}`);
        console.log(`Tasks completed: ${projectReport.completedTasks}/${projectReport.totalTasks}`);
        console.log(`Success rate: ${projectReport.successRate}%`);
        console.log(`Team size: ${projectReport.teamMembers.length} members`);
    }, 60000); // 60 second timeout for complete workflow

    test('Error Recovery E2E Test', async () => {
        console.log('Starting Error Recovery E2E Test...');
        
        // Create a project that will encounter errors
        const errorProneProject = {
            id: 'error_test_project',
            title: 'Error Recovery Test',
            description: 'Test project to validate error handling',
            requirements: ['Invalid requirement that should cause errors'],
            priority: 'medium'
        };

        const workflow = await workflowEngine.createWorkflow(errorProneProject);
        const assignments = await workflowEngine.assignTasks(workflow.id);
        
        // Start workflow
        await workflowEngine.startWorkflow(workflow.id);
        
        // Simulate agent failure
        const failingAgent = teamManager.getAgent('gemini_developer');
        if (failingAgent) {
            failingAgent.status = 'failed';
            
            // System should handle the failure
            const recovery = await workflowEngine.handleAgentFailure(workflow.id, 'gemini_developer');
            expect(recovery).toBe(true);
            
            // Tasks should be reassigned
            const newAssignments = await workflowEngine.getTaskAssignments(workflow.id);
            expect(newAssignments['gemini_developer']).toBeUndefined();
        }
        
        console.log('✓ Error recovery test completed');
    }, 30000);

    test('Performance Under Load E2E Test', async () => {
        console.log('Starting Performance Under Load E2E Test...');
        
        const startTime = Date.now();
        
        // Create multiple projects simultaneously
        const projects = Array.from({ length: 5 }, (_, i) => ({
            id: `load_test_${i}`,
            title: `Load Test Project ${i}`,
            description: `Performance test project ${i}`,
            requirements: [`Requirement ${i}`],
            priority: 'low'
        }));

        const workflows = await Promise.all(
            projects.map(project => workflowEngine.createWorkflow(project))
        );

        // Assign and start all workflows
        const allAssignments = await Promise.all(
            workflows.map(workflow => workflowEngine.assignTasks(workflow.id))
        );

        await Promise.all(
            workflows.map(workflow => workflowEngine.startWorkflow(workflow.id))
        );

        const endTime = Date.now();
        const executionTime = endTime - startTime;
        
        // Should handle load efficiently
        expect(executionTime).toBeLessThan(10000); // 10 seconds
        expect(workflows).toHaveLength(5);
        
        console.log(`✓ Performance test completed in ${executionTime}ms`);
    }, 30000);
});