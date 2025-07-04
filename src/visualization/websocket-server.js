/**
 * WebSocket Server for Real-time Monitoring
 * Provides real-time data streaming to web clients
 */

import { WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import http from 'http';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

export class RealtimeMonitoringServer extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            port: config.port || 8080,
            host: config.host || 'localhost',
            enableCors: config.enableCors !== false,
            maxConnections: config.maxConnections || 100,
            heartbeatInterval: config.heartbeatInterval || 30000,
            staticPath: config.staticPath || path.join(process.cwd(), 'public')
        };
        
        this.server = null;
        this.wss = null;
        this.clients = new Map();
        this.isRunning = false;
        this.heartbeatTimer = null;
        
        this.setupMessageHandlers();
    }

    setupMessageHandlers() {
        this.messageHandlers = {
            'subscribe': this.handleSubscribe.bind(this),
            'unsubscribe': this.handleUnsubscribe.bind(this),
            'get_status': this.handleGetStatus.bind(this),
            'get_history': this.handleGetHistory.bind(this),
            'ping': this.handlePing.bind(this)
        };
    }

    async start() {
        if (this.isRunning) {
            throw new Error('Server is already running');
        }

        try {
            // Create HTTP server
            this.server = http.createServer((req, res) => {
                this.handleHttpRequest(req, res);
            });

            // Create WebSocket server
            this.wss = new WebSocketServer({ 
                server: this.server,
                maxPayload: 1024 * 1024 // 1MB max payload
            });

            // Setup WebSocket event handlers
            this.wss.on('connection', (ws, req) => {
                this.handleNewConnection(ws, req);
            });

            // Start HTTP server
            await new Promise((resolve, reject) => {
                this.server.listen(this.config.port, this.config.host, (err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });

            this.isRunning = true;
            this.startHeartbeat();
            
            console.log(chalk.green(`🌐 Monitoring server started on http://${this.config.host}:${this.config.port}`));
            this.emit('server_started', { host: this.config.host, port: this.config.port });

        } catch (error) {
            console.error(chalk.red('❌ Failed to start monitoring server:'), error.message);
            throw error;
        }
    }

    async stop() {
        if (!this.isRunning) return;

        this.isRunning = false;
        this.stopHeartbeat();

        // Close all client connections
        this.clients.forEach((client, ws) => {
            ws.close(1000, 'Server shutting down');
        });
        this.clients.clear();

        // Close WebSocket server
        if (this.wss) {
            this.wss.close();
        }

        // Close HTTP server
        if (this.server) {
            await new Promise((resolve) => {
                this.server.close(resolve);
            });
        }

        console.log(chalk.yellow('🛑 Monitoring server stopped'));
        this.emit('server_stopped');
    }

    handleHttpRequest(req, res) {
        // Enable CORS if configured
        if (this.config.enableCors) {
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        }

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Serve static files or API endpoints
        if (req.url === '/api/status') {
            this.handleStatusAPI(req, res);
        } else if (req.url === '/api/stats') {
            this.handleStatsAPI(req, res);
        } else {
            this.handleStaticFile(req, res);
        }
    }

    handleStatusAPI(req, res) {
        const status = {
            server: 'running',
            connections: this.clients.size,
            uptime: process.uptime(),
            timestamp: new Date().toISOString()
        };

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(status, null, 2));
    }

    handleStatsAPI(req, res) {
        const stats = {
            clients: this.clients.size,
            maxConnections: this.config.maxConnections,
            messagesSent: this.messagesSent || 0,
            messagesReceived: this.messagesReceived || 0,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        };

        res.setHeader('Content-Type', 'application/json');
        res.writeHead(200);
        res.end(JSON.stringify(stats, null, 2));
    }

    handleStaticFile(req, res) {
        let filePath = req.url === '/' ? '/index.html' : req.url;
        filePath = path.join(this.config.staticPath, filePath);

        // Security check - prevent path traversal
        if (!filePath.startsWith(this.config.staticPath)) {
            res.writeHead(403);
            res.end('Forbidden');
            return;
        }

        fs.readFile(filePath, (err, content) => {
            if (err) {
                if (err.code === 'ENOENT') {
                    res.writeHead(404);
                    res.end('Not Found');
                } else {
                    res.writeHead(500);
                    res.end('Internal Server Error');
                }
                return;
            }

            // Set content type based on file extension
            const ext = path.extname(filePath);
            const contentType = this.getContentType(ext);
            
            res.setHeader('Content-Type', contentType);
            res.writeHead(200);
            res.end(content);
        });
    }

    getContentType(ext) {
        const types = {
            '.html': 'text/html',
            '.js': 'application/javascript',
            '.css': 'text/css',
            '.json': 'application/json',
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.gif': 'image/gif',
            '.svg': 'image/svg+xml'
        };
        return types[ext] || 'text/plain';
    }

    handleNewConnection(ws, req) {
        if (this.clients.size >= this.config.maxConnections) {
            ws.close(1008, 'Max connections exceeded');
            return;
        }

        const clientId = this.generateClientId();
        const clientInfo = {
            id: clientId,
            ip: req.socket.remoteAddress,
            userAgent: req.headers['user-agent'],
            connectedAt: new Date(),
            subscriptions: new Set(),
            lastPing: Date.now()
        };

        this.clients.set(ws, clientInfo);

        console.log(chalk.blue(`👤 New client connected: ${clientId} (${this.clients.size}/${this.config.maxConnections})`));

        // Setup message handler
        ws.on('message', (data) => {
            this.handleClientMessage(ws, data);
        });

        // Handle disconnection
        ws.on('close', (code, reason) => {
            this.handleClientDisconnect(ws, code, reason);
        });

        // Handle errors
        ws.on('error', (error) => {
            console.error(chalk.red(`WebSocket error for client ${clientId}:`), error.message);
        });

        // Send welcome message
        this.sendToClient(ws, {
            type: 'welcome',
            clientId: clientId,
            serverTime: new Date().toISOString()
        });

        this.emit('client_connected', clientInfo);
    }

    handleClientMessage(ws, data) {
        this.messagesReceived = (this.messagesReceived || 0) + 1;

        try {
            const message = JSON.parse(data.toString());
            const client = this.clients.get(ws);
            
            if (!client) return;

            client.lastPing = Date.now();

            const handler = this.messageHandlers[message.type];
            if (handler) {
                handler(ws, message);
            } else {
                this.sendToClient(ws, {
                    type: 'error',
                    message: `Unknown message type: ${message.type}`
                });
            }

        } catch (error) {
            console.error(chalk.red('Error parsing client message:'), error.message);
            this.sendToClient(ws, {
                type: 'error',
                message: 'Invalid JSON message'
            });
        }
    }

    handleClientDisconnect(ws, code, reason) {
        const client = this.clients.get(ws);
        if (client) {
            console.log(chalk.yellow(`👤 Client disconnected: ${client.id} (code: ${code})`));
            this.clients.delete(ws);
            this.emit('client_disconnected', client);
        }
    }

    handleSubscribe(ws, message) {
        const client = this.clients.get(ws);
        if (!client) return;

        const { events } = message;
        if (Array.isArray(events)) {
            events.forEach(event => client.subscriptions.add(event));
        }

        this.sendToClient(ws, {
            type: 'subscribed',
            events: Array.from(client.subscriptions)
        });
    }

    handleUnsubscribe(ws, message) {
        const client = this.clients.get(ws);
        if (!client) return;

        const { events } = message;
        if (Array.isArray(events)) {
            events.forEach(event => client.subscriptions.delete(event));
        }

        this.sendToClient(ws, {
            type: 'unsubscribed',
            events: Array.from(client.subscriptions)
        });
    }

    handleGetStatus(ws, message) {
        this.sendToClient(ws, {
            type: 'status',
            data: this.getSystemStatus()
        });
    }

    handleGetHistory(ws, message) {
        this.sendToClient(ws, {
            type: 'history',
            data: this.getHistoryData(message.filter)
        });
    }

    handlePing(ws, message) {
        this.sendToClient(ws, {
            type: 'pong',
            timestamp: new Date().toISOString()
        });
    }

    sendToClient(ws, data) {
        if (ws.readyState === ws.OPEN) {
            try {
                ws.send(JSON.stringify(data));
                this.messagesSent = (this.messagesSent || 0) + 1;
            } catch (error) {
                console.error(chalk.red('Error sending to client:'), error.message);
            }
        }
    }

    broadcast(eventType, data) {
        const message = {
            type: 'event',
            eventType,
            data,
            timestamp: new Date().toISOString()
        };

        this.clients.forEach((client, ws) => {
            if (client.subscriptions.has(eventType) || client.subscriptions.has('*')) {
                this.sendToClient(ws, message);
            }
        });

        this.emit('broadcast', { eventType, data, clientCount: this.clients.size });
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startHeartbeat() {
        this.heartbeatTimer = setInterval(() => {
            const now = Date.now();
            
            this.clients.forEach((client, ws) => {
                // Check if client is still alive
                if (now - client.lastPing > this.config.heartbeatInterval * 2) {
                    console.log(chalk.yellow(`💔 Client ${client.id} timed out`));
                    ws.close(1001, 'Timeout');
                    return;
                }

                // Send ping
                this.sendToClient(ws, { type: 'ping' });
            });
        }, this.config.heartbeatInterval);
    }

    stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    getSystemStatus() {
        return {
            server: 'running',
            connections: this.clients.size,
            uptime: process.uptime(),
            memory: process.memoryUsage(),
            timestamp: new Date().toISOString()
        };
    }

    getHistoryData(filter = {}) {
        // This would connect to your actual data source
        // For now, return mock data
        return {
            logs: [],
            workflows: [],
            agents: [],
            filter
        };
    }

    // Integration methods for team system
    onAgentStatusChanged(agentId, status, data = {}) {
        this.broadcast('agent_status_changed', {
            agentId,
            status,
            ...data
        });
    }

    onTaskStarted(agentId, taskId, taskTitle) {
        this.broadcast('task_started', {
            agentId,
            taskId,
            taskTitle,
            timestamp: new Date().toISOString()
        });
    }

    onTaskCompleted(agentId, taskId, taskTitle, duration) {
        this.broadcast('task_completed', {
            agentId,
            taskId,
            taskTitle,
            duration,
            timestamp: new Date().toISOString()
        });
    }

    onTaskFailed(agentId, taskId, taskTitle, error) {
        this.broadcast('task_failed', {
            agentId,
            taskId,
            taskTitle,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }

    onWorkflowStarted(workflowId, title, totalTasks) {
        this.broadcast('workflow_started', {
            workflowId,
            title,
            totalTasks,
            timestamp: new Date().toISOString()
        });
    }

    onWorkflowCompleted(workflowId, title, duration) {
        this.broadcast('workflow_completed', {
            workflowId,
            title,
            duration,
            timestamp: new Date().toISOString()
        });
    }

    onLogMessage(agentId, level, message, data) {
        this.broadcast('log_message', {
            agentId,
            level,
            message,
            data,
            timestamp: new Date().toISOString()
        });
    }

    onSystemEvent(eventType, data) {
        this.broadcast('system_event', {
            eventType,
            data,
            timestamp: new Date().toISOString()
        });
    }

    getConnectionStats() {
        return {
            totalConnections: this.clients.size,
            maxConnections: this.config.maxConnections,
            messagesSent: this.messagesSent || 0,
            messagesReceived: this.messagesReceived || 0,
            clients: Array.from(this.clients.values()).map(client => ({
                id: client.id,
                ip: client.ip,
                connectedAt: client.connectedAt,
                subscriptions: Array.from(client.subscriptions),
                lastPing: client.lastPing
            }))
        };
    }
}