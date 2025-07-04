/**
 * Progress Visualizer for Team Dashboard
 * Shows real-time progress bars and team status
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';

export class ProgressVisualizer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            refreshInterval: config.refreshInterval || 1000,
            barWidth: config.barWidth || 40,
            showPercentage: config.showPercentage !== false,
            showETA: config.showETA !== false,
            enableAnimations: config.enableAnimations !== false
        };
        
        this.workflows = new Map();
        this.agents = new Map();
        this.systemStats = {
            startTime: Date.now(),
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            activeTasks: 0
        };
        
        this.isRunning = false;
        this.setupProgressChars();
    }

    setupProgressChars() {
        this.progressChars = {
            complete: '█',
            partial: '▓',
            empty: '░',
            current: '▶'
        };
        
        this.statusIcons = {
            idle: '😴',
            working: '⚡',
            completed: '✅',
            failed: '❌',
            blocked: '⏸️'
        };
    }

    // Workflow progress tracking
    addWorkflow(workflowId, title, totalTasks = 0) {
        this.workflows.set(workflowId, {
            id: workflowId,
            title,
            totalTasks,
            completedTasks: 0,
            failedTasks: 0,
            activeTasks: 0,
            startTime: Date.now(),
            status: 'active',
            tasks: new Map()
        });
        
        this.systemStats.totalTasks += totalTasks;
        this.emit('workflow_added', workflowId);
    }

    updateWorkflowProgress(workflowId, progress) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return;

        Object.assign(workflow, progress);
        this.emit('workflow_updated', workflowId, workflow);
    }

    completeWorkflow(workflowId) {
        const workflow = this.workflows.get(workflowId);
        if (!workflow) return;

        workflow.status = 'completed';
        workflow.endTime = Date.now();
        this.emit('workflow_completed', workflowId, workflow);
    }

    // Agent status tracking
    addAgent(agentId, name, role) {
        this.agents.set(agentId, {
            id: agentId,
            name,
            role,
            status: 'idle',
            currentTask: null,
            tasksCompleted: 0,
            tasksFailed: 0,
            workload: 0,
            performance: { successRate: 100, avgTime: 0 },
            lastActivity: Date.now()
        });
        
        this.emit('agent_added', agentId);
    }

    updateAgentStatus(agentId, status, taskInfo = null) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        agent.status = status;
        agent.currentTask = taskInfo;
        agent.lastActivity = Date.now();
        
        this.emit('agent_updated', agentId, agent);
    }

    updateAgentStats(agentId, stats) {
        const agent = this.agents.get(agentId);
        if (!agent) return;

        Object.assign(agent, stats);
        this.emit('agent_stats_updated', agentId, agent);
    }

    // Progress bar rendering
    renderProgressBar(current, total, label = '', color = chalk.cyan) {
        if (total === 0) return '';
        
        const percentage = Math.min(100, Math.round((current / total) * 100));
        const filled = Math.round((current / total) * this.config.barWidth);
        const empty = this.config.barWidth - filled;
        
        const filledBar = color(this.progressChars.complete.repeat(filled));
        const emptyBar = chalk.gray(this.progressChars.empty.repeat(empty));
        
        let bar = `${filledBar}${emptyBar}`;
        
        if (this.config.showPercentage) {
            bar += ` ${percentage}%`;
        }
        
        if (label) {
            bar = `${label.padEnd(20)} ${bar}`;
        }
        
        return bar;
    }

    // Dashboard rendering
    renderSystemOverview() {
        const uptime = this.formatDuration(Date.now() - this.systemStats.startTime);
        const totalTasks = this.systemStats.totalTasks;
        const completedTasks = this.systemStats.completedTasks;
        const failedTasks = this.systemStats.failedTasks;
        const activeTasks = this.systemStats.activeTasks;
        
        const lines = [
            chalk.blue.bold('═'.repeat(80)),
            chalk.white.bold(' 🌟 System Overview'),
            chalk.blue('─'.repeat(80)),
            `  Uptime: ${chalk.green(uptime)}`,
            `  Total Tasks: ${chalk.cyan(totalTasks)}`,
            `  Completed: ${chalk.green(completedTasks)} | Active: ${chalk.yellow(activeTasks)} | Failed: ${chalk.red(failedTasks)}`,
            ''
        ];
        
        if (totalTasks > 0) {
            const progressBar = this.renderProgressBar(
                completedTasks, 
                totalTasks, 
                'Overall Progress',
                chalk.green
            );
            lines.push(`  ${progressBar}`);
            lines.push('');
        }
        
        return lines.join('\n');
    }

    renderWorkflowStatus() {
        if (this.workflows.size === 0) return '';
        
        const lines = [
            chalk.yellow.bold(' 🔄 Active Workflows'),
            chalk.yellow('─'.repeat(80))
        ];
        
        this.workflows.forEach(workflow => {
            const duration = this.formatDuration(Date.now() - workflow.startTime);
            const statusIcon = workflow.status === 'completed' ? '✅' : '🔄';
            
            lines.push(`  ${statusIcon} ${workflow.title} (${duration})`);
            
            if (workflow.totalTasks > 0) {
                const progressBar = this.renderProgressBar(
                    workflow.completedTasks,
                    workflow.totalTasks,
                    '    Progress',
                    chalk.cyan
                );
                lines.push(`  ${progressBar}`);
                
                if (workflow.failedTasks > 0) {
                    lines.push(`    ${chalk.red('Failed:')} ${workflow.failedTasks}`);
                }
            }
            
            lines.push('');
        });
        
        return lines.join('\n');
    }

    renderAgentStatus() {
        if (this.agents.size === 0) return '';
        
        const lines = [
            chalk.green.bold(' 👥 Team Status'),
            chalk.green('─'.repeat(80))
        ];
        
        this.agents.forEach(agent => {
            const statusIcon = this.statusIcons[agent.status] || '🤖';
            const workloadBar = this.renderWorkloadBar(agent.workload);
            
            lines.push(`  ${statusIcon} ${agent.name} (${agent.role})`);
            lines.push(`    Status: ${this.formatAgentStatus(agent.status)}`);
            lines.push(`    Workload: ${workloadBar}`);
            
            if (agent.currentTask) {
                lines.push(`    Current: ${chalk.cyan(agent.currentTask.title || agent.currentTask.id)}`);
            }
            
            lines.push(`    Completed: ${chalk.green(agent.tasksCompleted)} | Failed: ${chalk.red(agent.tasksFailed)}`);
            lines.push(`    Success Rate: ${this.formatSuccessRate(agent.performance.successRate)}`);
            lines.push('');
        });
        
        return lines.join('\n');
    }

    renderWorkloadBar(workload) {
        const maxWorkload = 100;
        let color = chalk.green;
        
        if (workload > 70) color = chalk.red;
        else if (workload > 50) color = chalk.yellow;
        
        return this.renderProgressBar(workload, maxWorkload, '', color);
    }

    formatAgentStatus(status) {
        const statusColors = {
            idle: chalk.gray,
            working: chalk.yellow,
            completed: chalk.green,
            failed: chalk.red,
            blocked: chalk.magenta
        };
        
        const color = statusColors[status] || chalk.white;
        return color(status.toUpperCase());
    }

    formatSuccessRate(rate) {
        if (rate >= 90) return chalk.green(`${rate}%`);
        if (rate >= 70) return chalk.yellow(`${rate}%`);
        return chalk.red(`${rate}%`);
    }

    formatDuration(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    // Real-time dashboard
    startDashboard() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.dashboardInterval = setInterval(() => {
            this.refreshDashboard();
        }, this.config.refreshInterval);
        
        this.emit('dashboard_started');
    }

    stopDashboard() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.dashboardInterval) {
            clearInterval(this.dashboardInterval);
        }
        
        this.emit('dashboard_stopped');
    }

    refreshDashboard() {
        if (!this.isRunning) return;
        
        // Clear screen and move cursor to top
        process.stdout.write('\x1b[2J\x1b[H');
        
        const dashboard = [
            this.renderSystemOverview(),
            this.renderWorkflowStatus(),
            this.renderAgentStatus(),
            chalk.dim('Press Ctrl+C to exit | Last updated: ' + new Date().toLocaleTimeString())
        ].join('\n');
        
        console.log(dashboard);
        this.emit('dashboard_refreshed');
    }

    // Task event handlers
    onTaskStarted(agentId, taskId, taskTitle) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.updateAgentStatus(agentId, 'working', { id: taskId, title: taskTitle });
            agent.workload = Math.min(100, agent.workload + 20);
        }
        
        this.systemStats.activeTasks++;
    }

    onTaskCompleted(agentId, taskId, duration) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.updateAgentStatus(agentId, 'completed');
            agent.tasksCompleted++;
            agent.workload = Math.max(0, agent.workload - 20);
            
            // Update performance metrics
            const newAvgTime = (agent.performance.avgTime + duration) / 2;
            agent.performance.avgTime = newAvgTime;
            
            const totalTasks = agent.tasksCompleted + agent.tasksFailed;
            agent.performance.successRate = Math.round((agent.tasksCompleted / totalTasks) * 100);
        }
        
        this.systemStats.completedTasks++;
        this.systemStats.activeTasks = Math.max(0, this.systemStats.activeTasks - 1);
    }

    onTaskFailed(agentId, taskId, error) {
        const agent = this.agents.get(agentId);
        if (agent) {
            this.updateAgentStatus(agentId, 'failed');
            agent.tasksFailed++;
            agent.workload = Math.max(0, agent.workload - 20);
            
            const totalTasks = agent.tasksCompleted + agent.tasksFailed;
            agent.performance.successRate = Math.round((agent.tasksCompleted / totalTasks) * 100);
        }
        
        this.systemStats.failedTasks++;
        this.systemStats.activeTasks = Math.max(0, this.systemStats.activeTasks - 1);
    }

    // Statistics and export
    getStatistics() {
        const stats = {
            system: { ...this.systemStats },
            workflows: Array.from(this.workflows.values()),
            agents: Array.from(this.agents.values()),
            summary: {
                totalWorkflows: this.workflows.size,
                activeWorkflows: Array.from(this.workflows.values()).filter(w => w.status === 'active').length,
                totalAgents: this.agents.size,
                activeAgents: Array.from(this.agents.values()).filter(a => a.status === 'working').length,
                overallSuccessRate: this.calculateOverallSuccessRate()
            }
        };
        
        return stats;
    }

    calculateOverallSuccessRate() {
        const agents = Array.from(this.agents.values());
        if (agents.length === 0) return 100;
        
        const totalCompleted = agents.reduce((sum, agent) => sum + agent.tasksCompleted, 0);
        const totalFailed = agents.reduce((sum, agent) => sum + agent.tasksFailed, 0);
        const total = totalCompleted + totalFailed;
        
        return total > 0 ? Math.round((totalCompleted / total) * 100) : 100;
    }

    exportProgress(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `progress-report-${timestamp}.${format}`;
        const stats = this.getStatistics();
        
        if (format === 'json') {
            return {
                filename,
                content: JSON.stringify(stats, null, 2)
            };
        } else if (format === 'csv') {
            // Generate CSV format for agents
            const headers = ['Agent ID', 'Name', 'Role', 'Status', 'Tasks Completed', 'Tasks Failed', 'Success Rate', 'Workload'];
            const rows = stats.agents.map(agent => [
                agent.id,
                agent.name,
                agent.role,
                agent.status,
                agent.tasksCompleted,
                agent.tasksFailed,
                agent.performance.successRate,
                agent.workload
            ]);
            
            const csvContent = [headers, ...rows].map(row => row.join(',')).join('\n');
            
            return { filename, content: csvContent };
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }

    reset() {
        this.workflows.clear();
        this.agents.clear();
        this.systemStats = {
            startTime: Date.now(),
            totalTasks: 0,
            completedTasks: 0,
            failedTasks: 0,
            activeTasks: 0
        };
        
        this.emit('reset');
    }
}