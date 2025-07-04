/**
 * Unit Tests for WebSocket Server
 */

import { RealtimeMonitoringServer } from '../../../src/visualization/websocket-server.js';

describe('WebSocket Realtime Monitoring Server', () => {
    let server;
    let testConfig;

    beforeEach(() => {
        testConfig = {
            port: 8081, // Use different port for testing
            host: 'localhost',
            enableCors: true,
            maxConnections: 5,
            heartbeatInterval: 1000
        };
        
        server = new RealtimeMonitoringServer(testConfig);
    });

    afterEach(async () => {
        if (server && server.isRunning) {
            await server.stop();
        }
    });

    describe('Server Initialization', () => {
        test('should initialize with default configuration', () => {
            const defaultServer = new RealtimeMonitoringServer();
            
            expect(defaultServer.config.port).toBe(8080);
            expect(defaultServer.config.host).toBe('localhost');
            expect(defaultServer.config.enableCors).toBe(true);
            expect(defaultServer.config.maxConnections).toBe(100);
        });

        test('should initialize with custom configuration', () => {
            expect(server.config.port).toBe(8081);
            expect(server.config.host).toBe('localhost');
            expect(server.config.maxConnections).toBe(5);
            expect(server.config.heartbeatInterval).toBe(1000);
        });

        test('should start with proper initial state', () => {
            expect(server.isRunning).toBe(false);
            expect(server.clients).toBeInstanceOf(Map);
            expect(server.clients.size).toBe(0);
        });
    });

    describe('Server Lifecycle', () => {
        test('should start and stop server correctly', async () => {
            expect(server.isRunning).toBe(false);
            
            await server.start();
            expect(server.isRunning).toBe(true);
            expect(server.server).toBeDefined();
            expect(server.wss).toBeDefined();
            
            await server.stop();
            expect(server.isRunning).toBe(false);
        });

        test('should emit server lifecycle events', async () => {
            const startedPromise = new Promise(resolve => {
                server.once('server_started', resolve);
            });
            
            const stoppedPromise = new Promise(resolve => {
                server.once('server_stopped', resolve);
            });

            await server.start();
            const startedEvent = await startedPromise;
            expect(startedEvent.host).toBe('localhost');
            expect(startedEvent.port).toBe(8081);

            await server.stop();
            await stoppedPromise;
        });

        test('should throw error when starting already running server', async () => {
            await server.start();
            
            await expect(server.start()).rejects.toThrow('Server is already running');
            
            await server.stop();
        });
    });

    describe('Message Handlers', () => {
        test('should have all required message handlers', () => {
            expect(server.messageHandlers).toHaveProperty('subscribe');
            expect(server.messageHandlers).toHaveProperty('unsubscribe');
            expect(server.messageHandlers).toHaveProperty('get_status');
            expect(server.messageHandlers).toHaveProperty('get_history');
            expect(server.messageHandlers).toHaveProperty('ping');
        });

        test('should generate unique client IDs', () => {
            const id1 = server.generateClientId();
            const id2 = server.generateClientId();
            
            expect(id1).toMatch(/^client_\d+_[a-z0-9]+$/);
            expect(id2).toMatch(/^client_\d+_[a-z0-9]+$/);
            expect(id1).not.toBe(id2);
        });
    });

    describe('HTTP Request Handling', () => {
        test('should return correct content types', () => {
            expect(server.getContentType('.html')).toBe('text/html');
            expect(server.getContentType('.js')).toBe('application/javascript');
            expect(server.getContentType('.css')).toBe('text/css');
            expect(server.getContentType('.json')).toBe('application/json');
            expect(server.getContentType('.png')).toBe('image/png');
            expect(server.getContentType('.unknown')).toBe('text/plain');
        });
    });

    describe('Broadcasting', () => {
        beforeEach(async () => {
            await server.start();
        });

        test('should broadcast events to all clients', () => {
            const eventType = 'test_event';
            const data = { message: 'test message' };
            
            const broadcastSpy = jest.spyOn(server, 'emit');
            
            server.broadcast(eventType, data);
            
            expect(broadcastSpy).toHaveBeenCalledWith('broadcast', {
                eventType,
                data,
                clientCount: 0 // No clients connected
            });
        });

        test('should track broadcast statistics', () => {
            server.broadcast('test_event', { data: 'test' });
            
            // Should emit broadcast event even with no clients
            expect(server.listenerCount('broadcast')).toBe(0); // No listeners in test
        });
    });

    describe('System Status', () => {
        test('should return system status', () => {
            const status = server.getSystemStatus();
            
            expect(status).toHaveProperty('server', 'running');
            expect(status).toHaveProperty('connections', 0);
            expect(status).toHaveProperty('uptime');
            expect(status).toHaveProperty('memory');
            expect(status).toHaveProperty('timestamp');
            expect(typeof status.uptime).toBe('number');
            expect(typeof status.memory).toBe('object');
        });

        test('should return connection statistics', () => {
            const stats = server.getConnectionStats();
            
            expect(stats).toHaveProperty('totalConnections', 0);
            expect(stats).toHaveProperty('maxConnections', 5);
            expect(stats).toHaveProperty('messagesSent', 0);
            expect(stats).toHaveProperty('messagesReceived', 0);
            expect(stats).toHaveProperty('clients');
            expect(Array.isArray(stats.clients)).toBe(true);
        });
    });

    describe('Team System Integration', () => {
        beforeEach(async () => {
            await server.start();
        });

        test('should handle agent status changes', () => {
            const broadcastSpy = jest.spyOn(server, 'broadcast');
            
            server.onAgentStatusChanged('test_agent', 'working', {
                currentTask: 'test_task',
                workload: 50
            });
            
            expect(broadcastSpy).toHaveBeenCalledWith('agent_status_changed', {
                agentId: 'test_agent',
                status: 'working',
                currentTask: 'test_task',
                workload: 50
            });
        });

        test('should handle task events', () => {
            const broadcastSpy = jest.spyOn(server, 'broadcast');
            
            // Task started
            server.onTaskStarted('test_agent', 'task_001', 'Test Task');
            expect(broadcastSpy).toHaveBeenCalledWith('task_started', expect.objectContaining({
                agentId: 'test_agent',
                taskId: 'task_001',
                taskTitle: 'Test Task'
            }));

            // Task completed
            server.onTaskCompleted('test_agent', 'task_001', 'Test Task', 1500);
            expect(broadcastSpy).toHaveBeenCalledWith('task_completed', expect.objectContaining({
                agentId: 'test_agent',
                taskId: 'task_001',
                duration: 1500
            }));

            // Task failed
            const error = new Error('Task failed');
            server.onTaskFailed('test_agent', 'task_002', 'Failed Task', error);
            expect(broadcastSpy).toHaveBeenCalledWith('task_failed', expect.objectContaining({
                agentId: 'test_agent',
                taskId: 'task_002',
                error: 'Task failed'
            }));
        });

        test('should handle workflow events', () => {
            const broadcastSpy = jest.spyOn(server, 'broadcast');
            
            // Workflow started
            server.onWorkflowStarted('workflow_001', 'Test Workflow', 5);
            expect(broadcastSpy).toHaveBeenCalledWith('workflow_started', expect.objectContaining({
                workflowId: 'workflow_001',
                title: 'Test Workflow',
                totalTasks: 5
            }));

            // Workflow completed
            server.onWorkflowCompleted('workflow_001', 'Test Workflow', 10000);
            expect(broadcastSpy).toHaveBeenCalledWith('workflow_completed', expect.objectContaining({
                workflowId: 'workflow_001',
                title: 'Test Workflow',
                duration: 10000
            }));
        });

        test('should handle log messages', () => {
            const broadcastSpy = jest.spyOn(server, 'broadcast');
            
            server.onLogMessage('test_agent', 'info', 'Test log message', { extra: 'data' });
            
            expect(broadcastSpy).toHaveBeenCalledWith('log_message', expect.objectContaining({
                agentId: 'test_agent',
                level: 'info',
                message: 'Test log message',
                data: { extra: 'data' }
            }));
        });

        test('should handle system events', () => {
            const broadcastSpy = jest.spyOn(server, 'broadcast');
            
            server.onSystemEvent('system_started', { version: '1.0.0' });
            
            expect(broadcastSpy).toHaveBeenCalledWith('system_event', expect.objectContaining({
                eventType: 'system_started',
                data: { version: '1.0.0' }
            }));
        });
    });

    describe('Error Handling', () => {
        test('should handle invalid JSON messages gracefully', () => {
            // Mock WebSocket
            const mockWS = {
                readyState: 1, // OPEN
                send: jest.fn()
            };
            
            const invalidData = Buffer.from('invalid json');
            
            // Should not throw error
            expect(() => {
                server.handleClientMessage(mockWS, invalidData);
            }).not.toThrow();
            
            // Should send error response
            expect(mockWS.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'error',
                    message: 'Invalid JSON message'
                })
            );
        });

        test('should handle unknown message types', () => {
            const mockWS = {
                readyState: 1, // OPEN
                send: jest.fn()
            };
            
            const mockClient = {
                id: 'test_client',
                lastPing: Date.now()
            };
            
            server.clients.set(mockWS, mockClient);
            
            const unknownMessage = Buffer.from(JSON.stringify({
                type: 'unknown_type',
                data: 'test'
            }));
            
            server.handleClientMessage(mockWS, unknownMessage);
            
            expect(mockWS.send).toHaveBeenCalledWith(
                JSON.stringify({
                    type: 'error',
                    message: 'Unknown message type: unknown_type'
                })
            );
        });
    });

    describe('History Data', () => {
        test('should return mock history data', () => {
            const historyData = server.getHistoryData({ agentId: 'test_agent' });
            
            expect(historyData).toHaveProperty('logs');
            expect(historyData).toHaveProperty('workflows');
            expect(historyData).toHaveProperty('agents');
            expect(historyData).toHaveProperty('filter');
            expect(historyData.filter.agentId).toBe('test_agent');
        });
    });
});