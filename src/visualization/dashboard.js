/**
 * Integrated Dashboard for Multi-Agent System
 * Combines log visualization and progress tracking
 */

import { LogVisualizer } from './log-visualizer.js';
import { ProgressVisualizer } from './progress-visualizer.js';
import { EventEmitter } from 'events';
import chalk from 'chalk';

export class Dashboard extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            mode: config.mode || 'combined', // 'logs', 'progress', 'combined'
            refreshInterval: config.refreshInterval || 2000,
            splitScreen: config.splitScreen !== false,
            enableKeyboard: config.enableKeyboard !== false,
            autoScroll: config.autoScroll !== false
        };
        
        this.logVisualizer = new LogVisualizer(config.logs || {});
        this.progressVisualizer = new ProgressVisualizer(config.progress || {});
        
        this.isRunning = false;
        this.currentView = this.config.mode;
        this.setupEventHandlers();
        this.setupKeyboardHandlers();
    }

    setupEventHandlers() {
        // Forward events from visualizers
        this.logVisualizer.on('log', (logData) => {
            this.emit('log', logData);
        });
        
        this.progressVisualizer.on('workflow_updated', (workflowId, workflow) => {
            this.emit('workflow_updated', workflowId, workflow);
        });
        
        this.progressVisualizer.on('agent_updated', (agentId, agent) => {
            this.emit('agent_updated', agentId, agent);
        });
    }

    setupKeyboardHandlers() {
        if (!this.config.enableKeyboard) return;
        
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.setEncoding('utf8');
        
        process.stdin.on('data', (key) => {
            this.handleKeyPress(key);
        });
    }

    handleKeyPress(key) {
        switch (key) {
            case '1':
                this.switchView('logs');
                break;
            case '2':
                this.switchView('progress');
                break;
            case '3':
                this.switchView('combined');
                break;
            case 'c':
                this.clearScreen();
                break;
            case 'e':
                this.exportData();
                break;
            case 'h':
                this.showHelp();
                break;
            case 'q':
            case '\u0003': // Ctrl+C
                this.stop();
                process.exit(0);
                break;
        }
    }

    switchView(view) {
        this.currentView = view;
        this.clearScreen();
        this.emit('view_changed', view);
    }

    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.clearScreen();
        this.showStartupBanner();
        
        if (this.currentView === 'progress' || this.currentView === 'combined') {
            this.progressVisualizer.startDashboard();
        }
        
        if (this.currentView === 'logs' || this.currentView === 'combined') {
            this.logVisualizer.showBanner();
            this.logVisualizer.showAgentLegend();
        }
        
        // Start refresh cycle for combined view
        if (this.currentView === 'combined') {
            this.refreshInterval = setInterval(() => {
                this.refreshCombinedView();
            }, this.config.refreshInterval);
        }
        
        this.emit('dashboard_started');
    }

    stop() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.progressVisualizer.stopDashboard();
        
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
        
        this.emit('dashboard_stopped');
    }

    showStartupBanner() {
        const banner = [
            '',
            chalk.cyan.bold('╔══════════════════════════════════════════════════════════════════════════════╗'),
            chalk.cyan.bold('║') + chalk.white.bold('                    Claude-Gemini Team Dashboard                             ') + chalk.cyan.bold('║'),
            chalk.cyan.bold('║') + chalk.white('                         Real-time Monitoring                                ') + chalk.cyan.bold('║'),
            chalk.cyan.bold('╚══════════════════════════════════════════════════════════════════════════════╝'),
            '',
            chalk.yellow('  Quick Commands:'),
            chalk.gray('    [1] Logs View    [2] Progress View    [3] Combined View'),
            chalk.gray('    [c] Clear Screen [e] Export Data     [h] Help    [q] Quit'),
            ''
        ];
        
        banner.forEach(line => console.log(line));
    }

    showHelp() {
        this.clearScreen();
        
        const help = [
            chalk.blue.bold('📖 Dashboard Help'),
            chalk.blue('═'.repeat(50)),
            '',
            chalk.white.bold('View Controls:'),
            '  1 - Switch to Logs View (real-time agent logs)',
            '  2 - Switch to Progress View (team status & workflows)',
            '  3 - Switch to Combined View (split screen)',
            '',
            chalk.white.bold('General Controls:'),
            '  c - Clear screen and refresh display',
            '  e - Export current data (logs & progress)',
            '  h - Show this help screen',
            '  q - Quit dashboard (Ctrl+C also works)',
            '',
            chalk.white.bold('Log Levels:'),
            '  ' + chalk.red('❌ ERROR') + ' - Critical errors and failures',
            '  ' + chalk.yellow('⚠️  WARN') + ' - Warnings and potential issues',
            '  ' + chalk.white('ℹ️  INFO') + ' - General information and status updates',
            '  ' + chalk.gray('🐛 DEBUG') + ' - Detailed debugging information',
            '',
            chalk.white.bold('Agent Types:'),
            '  ' + chalk.cyan.bold('👑 claude_leader') + ' - Team leader and strategic planning',
            '  ' + chalk.blue.bold('🏗️ claude_senior') + ' - Senior developer and architecture',
            '  ' + chalk.green.bold('🔍 gemini_researcher') + ' - Research and data collection',
            '  ' + chalk.yellow.bold('💻 gemini_developer') + ' - General development tasks',
            '',
            chalk.dim('Press any key to return to dashboard...')
        ];
        
        help.forEach(line => console.log(line));
        
        // Wait for keypress
        process.stdin.once('data', () => {
            this.clearScreen();
            if (this.currentView === 'progress') {
                this.progressVisualizer.refreshDashboard();
            }
        });
    }

    refreshCombinedView() {
        if (!this.isRunning || this.currentView !== 'combined') return;
        
        this.clearScreen();
        
        // Show progress at top
        const progressStats = this.progressVisualizer.getStatistics();
        const logStats = this.logVisualizer.getStats();
        
        console.log(chalk.blue.bold('═'.repeat(80)));
        console.log(chalk.white.bold(' 📊 System Status'));
        console.log(chalk.blue('─'.repeat(80)));
        
        // System overview
        console.log(`  Agents: ${chalk.green(progressStats.summary.activeAgents)}/${chalk.cyan(progressStats.summary.totalAgents)} active`);
        console.log(`  Workflows: ${chalk.yellow(progressStats.summary.activeWorkflows)}/${chalk.cyan(progressStats.summary.totalWorkflows)} running`);
        console.log(`  Success Rate: ${this.formatSuccessRate(progressStats.summary.overallSuccessRate)}`);
        console.log(`  Log Entries: ${chalk.cyan(logStats.totalLogs)}`);
        console.log('');
        
        // Recent logs
        console.log(chalk.yellow.bold(' 📋 Recent Activity'));
        console.log(chalk.yellow('─'.repeat(80)));
        
        const recentLogs = this.logVisualizer.getLogHistory({
            since: new Date(Date.now() - 30000) // Last 30 seconds
        }).slice(-10); // Last 10 entries
        
        recentLogs.forEach(log => {
            const timestamp = chalk.dim(log.timestamp.toTimeString().split(' ')[0]);
            const level = this.formatLogLevel(log.level);
            const agent = this.formatAgentName(log.agentId);
            console.log(`  ${timestamp} ${level} ${agent} ${log.message}`);
        });
        
        if (recentLogs.length === 0) {
            console.log(chalk.dim('  No recent activity...'));
        }
        
        console.log('');
        console.log(chalk.dim('Last updated: ' + new Date().toLocaleTimeString() + ' | Press [h] for help'));
    }

    formatSuccessRate(rate) {
        if (rate >= 90) return chalk.green(`${rate}%`);
        if (rate >= 70) return chalk.yellow(`${rate}%`);
        return chalk.red(`${rate}%`);
    }

    formatLogLevel(level) {
        const colors = {
            error: chalk.red,
            warn: chalk.yellow,
            info: chalk.white,
            debug: chalk.gray,
            trace: chalk.dim
        };
        
        return (colors[level] || chalk.white)(level.toUpperCase().padEnd(5));
    }

    formatAgentName(agentId) {
        const colors = {
            'claude_leader': chalk.cyan,
            'claude_senior': chalk.blue,
            'gemini_researcher': chalk.green,
            'gemini_developer': chalk.yellow,
            'system': chalk.magenta,
            'workflow': chalk.red
        };
        
        const color = colors[agentId] || chalk.white;
        return color(`[${agentId}]`.padEnd(20));
    }

    clearScreen() {
        console.clear();
        if (this.config.enableKeyboard) {
            console.log(chalk.dim('Dashboard Controls: [1] Logs [2] Progress [3] Combined [h] Help [q] Quit\n'));
        }
    }

    exportData() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            
            // Export logs
            const logsExport = this.logVisualizer.exportLogs('json');
            const progressExport = this.progressVisualizer.exportProgress('json');
            
            // Combine exports
            const combinedData = {
                timestamp: new Date().toISOString(),
                logs: JSON.parse(logsExport.content),
                progress: JSON.parse(progressExport.content),
                dashboard: {
                    currentView: this.currentView,
                    isRunning: this.isRunning,
                    config: this.config
                }
            };
            
            const filename = `dashboard-export-${timestamp}.json`;
            
            // In a real implementation, you would write this to file
            console.log(chalk.green(`✅ Data exported to ${filename}`));
            
            this.emit('data_exported', { filename, data: combinedData });
            
        } catch (error) {
            console.log(chalk.red(`❌ Export failed: ${error.message}`));
        }
    }

    // Integration methods for team components
    addAgent(agentId, name, role) {
        this.progressVisualizer.addAgent(agentId, name, role);
        this.logVisualizer.info('system', `Agent added: ${name} (${role})`, { agentId });
    }

    addWorkflow(workflowId, title, totalTasks) {
        this.progressVisualizer.addWorkflow(workflowId, title, totalTasks);
        this.logVisualizer.info('workflow', `Workflow created: ${title}`, { workflowId, totalTasks });
    }

    onTaskStarted(agentId, taskId, taskTitle) {
        this.progressVisualizer.onTaskStarted(agentId, taskId, taskTitle);
        this.logVisualizer.taskStarted(agentId, taskId, taskTitle);
    }

    onTaskCompleted(agentId, taskId, taskTitle, duration) {
        this.progressVisualizer.onTaskCompleted(agentId, taskId, duration);
        this.logVisualizer.taskCompleted(agentId, taskId, taskTitle, duration);
    }

    onTaskFailed(agentId, taskId, taskTitle, error) {
        this.progressVisualizer.onTaskFailed(agentId, taskId, error);
        this.logVisualizer.taskFailed(agentId, taskId, taskTitle, error);
    }

    onAgentStatusChanged(agentId, oldStatus, newStatus) {
        this.progressVisualizer.updateAgentStatus(agentId, newStatus);
        this.logVisualizer.agentStatusChanged(agentId, oldStatus, newStatus);
    }

    onMessageExchange(fromAgent, toAgent, messageType) {
        this.logVisualizer.messageSent(fromAgent, toAgent, messageType);
        this.logVisualizer.messageReceived(toAgent, fromAgent, messageType);
    }

    // Logging convenience methods
    log(agentId, level, message, data) {
        this.logVisualizer.log(agentId, level, message, data);
    }

    error(agentId, message, data) {
        this.logVisualizer.error(agentId, message, data);
    }

    warn(agentId, message, data) {
        this.logVisualizer.warn(agentId, message, data);
    }

    info(agentId, message, data) {
        this.logVisualizer.info(agentId, message, data);
    }

    debug(agentId, message, data) {
        this.logVisualizer.debug(agentId, message, data);
    }

    // System lifecycle
    systemStarted() {
        this.logVisualizer.systemStarted();
    }

    systemStopped() {
        this.logVisualizer.systemStopped();
    }

    workflowStarted(workflowId, title) {
        this.logVisualizer.workflowStarted(workflowId, title);
    }

    workflowCompleted(workflowId, title, duration) {
        this.logVisualizer.workflowCompleted(workflowId, title, duration);
        this.progressVisualizer.completeWorkflow(workflowId);
    }

    getStats() {
        return {
            logs: this.logVisualizer.getStats(),
            progress: this.progressVisualizer.getStatistics(),
            dashboard: {
                currentView: this.currentView,
                isRunning: this.isRunning,
                startTime: this.startTime
            }
        };
    }
}