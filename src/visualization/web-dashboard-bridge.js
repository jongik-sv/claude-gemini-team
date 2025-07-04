/**
 * Bridge between Team System and Web Dashboard
 * Connects existing visualization system with WebSocket server
 */

const { RealtimeMonitoringServer } = require('./websocket-server.js');
const { Dashboard } = require('./dashboard.js');
const { EventEmitter } = require('events');
const chalk = require('chalk');

class WebDashboardBridge extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            webPort: config.webPort || 8080,
            webHost: config.webHost || 'localhost',
            enableWebDashboard: config.enableWebDashboard !== false,
            enableCLIDashboard: config.enableCLIDashboard !== false,
            syncMode: config.syncMode || 'bidirectional', // 'web-only', 'cli-only', 'bidirectional'
            ...config
        };

        this.webServer = null;
        this.cliDashboard = null;
        this.isRunning = false;
        
        this.setupComponents();
    }

    setupComponents() {
        // Initialize web server if enabled
        if (this.config.enableWebDashboard) {
            this.webServer = new RealtimeMonitoringServer({
                port: this.config.webPort,
                host: this.config.webHost,
                enableCors: true,
                maxConnections: 100
            });
            
            this.setupWebServerEvents();
        }

        // Initialize CLI dashboard if enabled
        if (this.config.enableCLIDashboard) {
            this.cliDashboard = new Dashboard({
                mode: 'combined',
                refreshInterval: 2000,
                enableKeyboard: false, // Controlled by bridge
                logs: { logLevel: 'info' },
                progress: { showETA: true }
            });
            
            this.setupCLIDashboardEvents();
        }
    }

    setupWebServerEvents() {
        this.webServer.on('server_started', (info) => {
            console.log(chalk.green(`🌐 Web dashboard available at http://${info.host}:${info.port}`));
            this.emit('web_dashboard_started', info);
        });

        this.webServer.on('client_connected', (client) => {
            console.log(chalk.blue(`👤 Web client connected: ${client.id}`));
            this.emit('web_client_connected', client);
            
            // Send current state to new client
            this.sendCurrentStateToWebClients();
        });

        this.webServer.on('client_disconnected', (client) => {
            console.log(chalk.yellow(`👤 Web client disconnected: ${client.id}`));
            this.emit('web_client_disconnected', client);
        });
    }

    setupCLIDashboardEvents() {
        this.cliDashboard.on('dashboard_started', () => {
            console.log(chalk.green('📊 CLI dashboard started'));
            this.emit('cli_dashboard_started');
        });

        this.cliDashboard.on('log', (logData) => {
            // Forward logs to web clients
            if (this.webServer && this.config.syncMode !== 'cli-only') {
                this.webServer.onLogMessage(
                    logData.agentId,
                    logData.level,
                    logData.message,
                    logData.data
                );
            }
        });

        this.cliDashboard.on('agent_updated', (agentId, agent) => {
            // Forward agent updates to web clients
            if (this.webServer && this.config.syncMode !== 'cli-only') {
                this.webServer.onAgentStatusChanged(agentId, agent.status, {
                    currentTask: agent.currentTask,
                    workload: agent.workload,
                    tasksCompleted: agent.tasksCompleted,
                    performance: agent.performance
                });
            }
        });

        this.cliDashboard.on('workflow_updated', (workflowId, workflow) => {
            // Forward workflow updates to web clients
            if (this.webServer && this.config.syncMode !== 'cli-only') {
                if (workflow.status === 'completed') {
                    this.webServer.onWorkflowCompleted(
                        workflowId,
                        workflow.title,
                        workflow.endTime - workflow.startTime
                    );
                }
            }
        });
    }

    async start() {
        if (this.isRunning) {
            throw new Error('Bridge is already running');
        }

        try {
            // Start web server
            if (this.webServer) {
                await this.webServer.start();
            }

            // Start CLI dashboard
            if (this.cliDashboard) {
                this.cliDashboard.start();
            }

            this.isRunning = true;
            console.log(chalk.green('🌉 Dashboard bridge started successfully'));
            this.emit('bridge_started');

        } catch (error) {
            console.error(chalk.red('❌ Failed to start dashboard bridge:'), error.message);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;

        // Stop web server
        if (this.webServer) {
            await this.webServer.stop();
        }

        // Stop CLI dashboard
        if (this.cliDashboard) {
            this.cliDashboard.stop();
        }

        console.log(chalk.yellow('🌉 Dashboard bridge stopped'));
        this.emit('bridge_stopped');
    }

    // Agent management methods
    addAgent(agentId, name, role, capabilities = []) {
        if (this.cliDashboard) {
            this.cliDashboard.addAgent(agentId, name, role);
        }

        if (this.webServer) {
            this.webServer.onSystemEvent('agent_added', {
                agentId,
                name,
                role,
                capabilities,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('agent_added', { agentId, name, role, capabilities });
    }

    removeAgent(agentId) {
        if (this.webServer) {
            this.webServer.onSystemEvent('agent_removed', {
                agentId,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('agent_removed', { agentId });
    }

    // Workflow management methods
    addWorkflow(workflowId, title, totalTasks = 0) {
        if (this.cliDashboard) {
            this.cliDashboard.addWorkflow(workflowId, title, totalTasks);
        }

        if (this.webServer) {
            this.webServer.onWorkflowStarted(workflowId, title, totalTasks);
        }

        this.emit('workflow_added', { workflowId, title, totalTasks });
    }

    updateWorkflowProgress(workflowId, progress) {
        if (this.webServer) {
            this.webServer.onSystemEvent('workflow_progress', {
                workflowId,
                ...progress,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('workflow_progress', { workflowId, ...progress });
    }

    completeWorkflow(workflowId, title, duration) {
        if (this.cliDashboard) {
            this.cliDashboard.workflowCompleted(workflowId, title, duration);
        }

        if (this.webServer) {
            this.webServer.onWorkflowCompleted(workflowId, title, duration);
        }

        this.emit('workflow_completed', { workflowId, title, duration });
    }

    // Task event methods
    onTaskStarted(agentId, taskId, taskTitle) {
        if (this.cliDashboard) {
            this.cliDashboard.onTaskStarted(agentId, taskId, taskTitle);
        }

        if (this.webServer) {
            this.webServer.onTaskStarted(agentId, taskId, taskTitle);
        }

        this.emit('task_started', { agentId, taskId, taskTitle });
    }

    onTaskCompleted(agentId, taskId, taskTitle, duration) {
        if (this.cliDashboard) {
            this.cliDashboard.onTaskCompleted(agentId, taskId, taskTitle, duration);
        }

        if (this.webServer) {
            this.webServer.onTaskCompleted(agentId, taskId, taskTitle, duration);
        }

        this.emit('task_completed', { agentId, taskId, taskTitle, duration });
    }

    onTaskFailed(agentId, taskId, taskTitle, error) {
        if (this.cliDashboard) {
            this.cliDashboard.onTaskFailed(agentId, taskId, taskTitle, error);
        }

        if (this.webServer) {
            this.webServer.onTaskFailed(agentId, taskId, taskTitle, error);
        }

        this.emit('task_failed', { agentId, taskId, taskTitle, error });
    }

    // Agent status methods
    onAgentStatusChanged(agentId, oldStatus, newStatus, data = {}) {
        if (this.cliDashboard) {
            this.cliDashboard.onAgentStatusChanged(agentId, oldStatus, newStatus);
        }

        if (this.webServer) {
            this.webServer.onAgentStatusChanged(agentId, newStatus, data);
        }

        this.emit('agent_status_changed', { agentId, oldStatus, newStatus, data });
    }

    // Message exchange tracking
    onMessageExchange(fromAgent, toAgent, messageType, content = null) {
        if (this.cliDashboard) {
            this.cliDashboard.onMessageExchange(fromAgent, toAgent, messageType);
        }

        if (this.webServer) {
            this.webServer.onSystemEvent('message_exchange', {
                fromAgent,
                toAgent,
                messageType,
                content,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('message_exchange', { fromAgent, toAgent, messageType, content });
    }

    // Logging methods
    log(agentId, level, message, data = null) {
        if (this.cliDashboard) {
            this.cliDashboard.log(agentId, level, message, data);
        }

        if (this.webServer) {
            this.webServer.onLogMessage(agentId, level, message, data);
        }

        this.emit('log', { agentId, level, message, data });
    }

    error(agentId, message, data = null) {
        this.log(agentId, 'error', message, data);
    }

    warn(agentId, message, data = null) {
        this.log(agentId, 'warn', message, data);
    }

    info(agentId, message, data = null) {
        this.log(agentId, 'info', message, data);
    }

    debug(agentId, message, data = null) {
        this.log(agentId, 'debug', message, data);
    }

    // System lifecycle methods
    systemStarted() {
        if (this.cliDashboard) {
            this.cliDashboard.systemStarted();
        }

        if (this.webServer) {
            this.webServer.onSystemEvent('system_started', {
                timestamp: new Date().toISOString(),
                version: '1.0.0',
                mode: this.config.syncMode
            });
        }

        this.emit('system_started');
    }

    systemStopped() {
        if (this.cliDashboard) {
            this.cliDashboard.systemStopped();
        }

        if (this.webServer) {
            this.webServer.onSystemEvent('system_stopped', {
                timestamp: new Date().toISOString()
            });
        }

        this.emit('system_stopped');
    }

    // MCP tool integration
    onToolExecuted(agentId, toolName, method, duration, result = null) {
        const message = `🔧 Used ${toolName}.${method} (${duration}ms)`;
        
        this.debug(agentId, message, {
            toolName,
            method,
            duration,
            result: result ? 'success' : 'failed'
        });

        if (this.webServer) {
            this.webServer.onSystemEvent('tool_executed', {
                agentId,
                toolName,
                method,
                duration,
                success: !!result,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('tool_executed', { agentId, toolName, method, duration, result });
    }

    // Performance monitoring
    onPerformanceMetric(agentId, metric, value, unit = '') {
        this.debug(agentId, `📊 ${metric}: ${value}${unit}`, {
            metric,
            value,
            unit
        });

        if (this.webServer) {
            this.webServer.onSystemEvent('performance_metric', {
                agentId,
                metric,
                value,
                unit,
                timestamp: new Date().toISOString()
            });
        }

        this.emit('performance_metric', { agentId, metric, value, unit });
    }

    // Data export and statistics
    getStatistics() {
        const stats = {
            bridge: {
                isRunning: this.isRunning,
                mode: this.config.syncMode,
                webEnabled: !!this.webServer,
                cliEnabled: !!this.cliDashboard
            }
        };

        if (this.cliDashboard) {
            stats.cli = this.cliDashboard.getStats();
        }

        if (this.webServer) {
            stats.web = this.webServer.getConnectionStats();
        }

        return stats;
    }

    exportData(format = 'json') {
        const stats = this.getStatistics();
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `dashboard-bridge-export-${timestamp}.${format}`;

        if (format === 'json') {
            return {
                filename,
                content: JSON.stringify(stats, null, 2)
            };
        }

        throw new Error(`Unsupported export format: ${format}`);
    }

    sendCurrentStateToWebClients() {
        if (!this.webServer || !this.cliDashboard) return;

        try {
            const stats = this.cliDashboard.getStats();
            
            // Send current agents state
            if (stats.progress && stats.progress.agents) {
                stats.progress.agents.forEach(agent => {
                    this.webServer.onAgentStatusChanged(agent.id, agent.status, {
                        currentTask: agent.currentTask,
                        workload: agent.workload,
                        tasksCompleted: agent.tasksCompleted,
                        performance: agent.performance
                    });
                });
            }

            // Send current workflows state
            if (stats.progress && stats.progress.workflows) {
                stats.progress.workflows.forEach(workflow => {
                    this.webServer.onWorkflowStarted(workflow.id, workflow.title, workflow.totalTasks);
                });
            }

            // Send recent logs
            if (stats.logs && stats.logs.logHistory) {
                const recentLogs = stats.logs.logHistory.slice(-10);
                recentLogs.forEach(log => {
                    this.webServer.onLogMessage(log.agentId, log.level, log.message, log.data);
                });
            }

        } catch (error) {
            console.error(chalk.red('Error sending current state to web clients:'), error.message);
        }
    }

    // CLI dashboard control methods (for external control)
    switchCLIView(view) {
        if (this.cliDashboard) {
            this.cliDashboard.switchView(view);
        }
    }

    clearCLIScreen() {
        if (this.cliDashboard) {
            this.cliDashboard.clearScreen();
        }
    }

    exportCLIData() {
        if (this.cliDashboard) {
            return this.cliDashboard.exportData();
        }
        return null;
    }

    // Health check methods
    async healthCheck() {
        const health = {
            bridge: this.isRunning,
            web: false,
            cli: false,
            timestamp: new Date().toISOString()
        };

        if (this.webServer) {
            health.web = this.webServer.isRunning;
            health.webConnections = this.webServer.clients ? this.webServer.clients.size : 0;
        }

        if (this.cliDashboard) {
            health.cli = this.cliDashboard.isRunning;
        }

        return health;
    }
}

module.exports = { WebDashboardBridge };