/**
 * Real-time Log Visualizer with Agent Color Coding
 * Provides colored, structured logging for multi-agent system
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';

export class LogVisualizer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            maxLogHistory: config.maxLogHistory || 1000,
            timestampFormat: config.timestampFormat || 'HH:mm:ss',
            showAgentIcons: config.showAgentIcons !== false,
            enableColors: config.enableColors !== false,
            logLevel: config.logLevel || 'info'
        };
        
        this.logHistory = [];
        this.agentColors = new Map();
        this.logLevels = {
            error: 0,
            warn: 1,
            info: 2,
            debug: 3,
            trace: 4
        };
        
        this.setupAgentColors();
        this.setupLogFormatters();
    }

    setupAgentColors() {
        // Predefined color scheme for different agent types
        this.agentColorScheme = {
            'claude_leader': chalk.cyan.bold,
            'claude_senior': chalk.blue.bold,
            'gemini_researcher': chalk.green.bold,
            'gemini_developer': chalk.yellow.bold,
            'system': chalk.magenta.bold,
            'workflow': chalk.red.bold,
            'tool': chalk.gray.bold
        };
        
        // Agent icons for better visual distinction
        this.agentIcons = {
            'claude_leader': '👑',
            'claude_senior': '🏗️',
            'gemini_researcher': '🔍',
            'gemini_developer': '💻',
            'system': '⚙️',
            'workflow': '🔄',
            'tool': '🔧'
        };
    }

    setupLogFormatters() {
        this.levelFormatters = {
            error: chalk.red.bold,
            warn: chalk.yellow.bold,
            info: chalk.white,
            debug: chalk.gray,
            trace: chalk.dim
        };
        
        this.levelIcons = {
            error: '❌',
            warn: '⚠️',
            info: 'ℹ️',
            debug: '🐛',
            trace: '👀'
        };
    }

    getAgentColor(agentId) {
        if (!this.agentColors.has(agentId)) {
            // Auto-assign color if not predefined
            const colors = [
                chalk.cyan, chalk.blue, chalk.green, chalk.yellow,
                chalk.magenta, chalk.red, chalk.white, chalk.gray
            ];
            const colorIndex = this.agentColors.size % colors.length;
            this.agentColors.set(agentId, colors[colorIndex]);
        }
        
        return this.agentColorScheme[agentId] || this.agentColors.get(agentId);
    }

    getTimestamp() {
        const now = new Date();
        return chalk.dim(`[${now.toTimeString().split(' ')[0]}]`);
    }

    formatLogLevel(level) {
        const formatter = this.levelFormatters[level] || chalk.white;
        const icon = this.levelIcons[level] || '';
        return formatter(`${icon} ${level.toUpperCase()}`);
    }

    formatAgentLabel(agentId) {
        const color = this.getAgentColor(agentId);
        const icon = this.config.showAgentIcons ? (this.agentIcons[agentId] || '🤖') : '';
        const label = `${icon} ${agentId}`.trim();
        return color(`[${label}]`);
    }

    shouldLog(level) {
        const currentLevel = this.logLevels[this.config.logLevel] || 2;
        const messageLevel = this.logLevels[level] || 2;
        return messageLevel <= currentLevel;
    }

    log(agentId, level, message, data = null) {
        if (!this.shouldLog(level)) return;

        const timestamp = this.getTimestamp();
        const levelLabel = this.formatLogLevel(level);
        const agentLabel = this.formatAgentLabel(agentId);
        
        let formattedMessage = `${timestamp} ${levelLabel} ${agentLabel} ${message}`;
        
        // Add structured data if provided
        if (data && typeof data === 'object') {
            const dataStr = JSON.stringify(data, null, 2);
            formattedMessage += `\n${chalk.dim(dataStr)}`;
        }

        console.log(formattedMessage);
        
        // Store in history
        this.addToHistory({
            timestamp: new Date(),
            agentId,
            level,
            message,
            data,
            formatted: formattedMessage
        });

        // Emit log event for external listeners
        this.emit('log', { agentId, level, message, data });
    }

    addToHistory(logEntry) {
        this.logHistory.push(logEntry);
        
        // Maintain history size limit
        if (this.logHistory.length > this.config.maxLogHistory) {
            this.logHistory.shift();
        }
    }

    // Convenience methods for different log levels
    error(agentId, message, data) {
        this.log(agentId, 'error', message, data);
    }

    warn(agentId, message, data) {
        this.log(agentId, 'warn', message, data);
    }

    info(agentId, message, data) {
        this.log(agentId, 'info', message, data);
    }

    debug(agentId, message, data) {
        this.log(agentId, 'debug', message, data);
    }

    trace(agentId, message, data) {
        this.log(agentId, 'trace', message, data);
    }

    // Task-specific logging methods
    taskStarted(agentId, taskId, taskTitle) {
        this.info(agentId, `🚀 Started task: ${taskTitle}`, { taskId });
    }

    taskCompleted(agentId, taskId, taskTitle, duration) {
        this.info(agentId, `✅ Completed task: ${taskTitle} (${duration}ms)`, { taskId, duration });
    }

    taskFailed(agentId, taskId, taskTitle, error) {
        this.error(agentId, `❌ Failed task: ${taskTitle}`, { taskId, error: error.message });
    }

    agentStatusChanged(agentId, oldStatus, newStatus) {
        this.info(agentId, `🔄 Status changed: ${oldStatus} → ${newStatus}`);
    }

    messageReceived(agentId, fromAgent, messageType) {
        this.debug(agentId, `📨 Received ${messageType} from ${fromAgent}`);
    }

    messageSent(agentId, toAgent, messageType) {
        this.debug(agentId, `📤 Sent ${messageType} to ${toAgent}`);
    }

    // System events
    systemStarted() {
        this.info('system', '🌟 Multi-agent system started');
    }

    systemStopped() {
        this.info('system', '🛑 Multi-agent system stopped');
    }

    workflowStarted(workflowId, title) {
        this.info('workflow', `🎬 Started workflow: ${title}`, { workflowId });
    }

    workflowCompleted(workflowId, title, duration) {
        this.info('workflow', `🎉 Completed workflow: ${title} (${duration}ms)`, { workflowId, duration });
    }

    toolExecuted(agentId, toolName, method, duration) {
        this.debug(agentId, `🔧 Used tool ${toolName}.${method} (${duration}ms)`);
    }

    // Display methods
    showBanner() {
        const banner = [
            '',
            chalk.cyan.bold('╔══════════════════════════════════════════════════════════════╗'),
            chalk.cyan.bold('║') + chalk.white.bold('              Claude-Gemini Team Collaboration               ') + chalk.cyan.bold('║'),
            chalk.cyan.bold('║') + chalk.white('                     Real-time Monitor                        ') + chalk.cyan.bold('║'),
            chalk.cyan.bold('╚══════════════════════════════════════════════════════════════╝'),
            ''
        ];
        
        banner.forEach(line => console.log(line));
    }

    showAgentLegend() {
        console.log(chalk.white.bold('\n📋 Agent Legend:'));
        console.log(chalk.dim('─'.repeat(50)));
        
        Object.entries(this.agentColorScheme).forEach(([agentId, colorFn]) => {
            const icon = this.agentIcons[agentId] || '🤖';
            const label = colorFn(`${icon} ${agentId}`);
            console.log(`  ${label}`);
        });
        
        console.log('');
    }

    showLogLevels() {
        console.log(chalk.white.bold('\n📊 Log Levels:'));
        console.log(chalk.dim('─'.repeat(50)));
        
        Object.entries(this.levelFormatters).forEach(([level, formatter]) => {
            const icon = this.levelIcons[level] || '';
            console.log(`  ${formatter(`${icon} ${level.toUpperCase()}`)}`);
        });
        
        console.log('');
    }

    getLogHistory(filter = {}) {
        let filtered = this.logHistory;
        
        if (filter.agentId) {
            filtered = filtered.filter(log => log.agentId === filter.agentId);
        }
        
        if (filter.level) {
            filtered = filtered.filter(log => log.level === filter.level);
        }
        
        if (filter.since) {
            filtered = filtered.filter(log => log.timestamp >= filter.since);
        }
        
        return filtered;
    }

    exportLogs(format = 'json') {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `team-logs-${timestamp}.${format}`;
        
        if (format === 'json') {
            return {
                filename,
                content: JSON.stringify(this.logHistory, null, 2)
            };
        } else if (format === 'text') {
            const content = this.logHistory
                .map(log => `${log.timestamp.toISOString()} [${log.level.toUpperCase()}] [${log.agentId}] ${log.message}`)
                .join('\n');
            
            return { filename, content };
        }
        
        throw new Error(`Unsupported export format: ${format}`);
    }

    clear() {
        console.clear();
        this.showBanner();
    }

    getStats() {
        const stats = {
            totalLogs: this.logHistory.length,
            logsByLevel: {},
            logsByAgent: {},
            timeRange: {
                earliest: null,
                latest: null
            }
        };
        
        // Calculate statistics
        this.logHistory.forEach(log => {
            // By level
            stats.logsByLevel[log.level] = (stats.logsByLevel[log.level] || 0) + 1;
            
            // By agent
            stats.logsByAgent[log.agentId] = (stats.logsByAgent[log.agentId] || 0) + 1;
            
            // Time range
            if (!stats.timeRange.earliest || log.timestamp < stats.timeRange.earliest) {
                stats.timeRange.earliest = log.timestamp;
            }
            if (!stats.timeRange.latest || log.timestamp > stats.timeRange.latest) {
                stats.timeRange.latest = log.timestamp;
            }
        });
        
        return stats;
    }
}