const { MessageBroker, Message } = require('../../../src/communication/message-broker');
const EventEmitter = require('events');

describe('Message', () => {
    describe('생성자', () => {
        test('should create message with valid config', () => {
            const config = {
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'gemini_worker',
                data: { taskId: 'task_001' }
            };
            
            const message = new Message(config);
            
            expect(message.id).toBeDefined();
            expect(message.type).toBe('task_assignment');
            expect(message.from).toBe('claude_leader');
            expect(message.to).toBe('gemini_worker');
            expect(message.data).toEqual({ taskId: 'task_001' });
            expect(message.timestamp).toBeInstanceOf(Date);
            expect(message.status).toBe('pending');
        });

        test('should generate unique message IDs', () => {
            const msg1 = new Message({ type: 'test', from: 'a', to: 'b' });
            const msg2 = new Message({ type: 'test', from: 'a', to: 'b' });
            
            expect(msg1.id).not.toBe(msg2.id);
        });
    });

    describe('acknowledge', () => {
        test('should mark message as acknowledged', () => {
            const message = new Message({ type: 'test', from: 'a', to: 'b' });
            
            message.acknowledge();
            
            expect(message.status).toBe('acknowledged');
            expect(message.acknowledgedAt).toBeInstanceOf(Date);
        });
    });

    describe('toJSON', () => {
        test('should serialize message correctly', () => {
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'gemini_worker',
                data: { test: 'data' }
            });
            
            const json = message.toJSON();
            
            expect(json.id).toBe(message.id);
            expect(json.type).toBe('task_assignment');
            expect(json.data).toEqual({ test: 'data' });
            expect(json.timestamp).toBeInstanceOf(Date);
        });
    });
});

describe('MessageBroker', () => {
    let broker;

    beforeEach(() => {
        broker = new MessageBroker();
    });

    afterEach(async () => {
        if (broker && broker.isRunning) {
            await broker.stop();
        }
    });

    describe('생성자', () => {
        test('should initialize with empty state', () => {
            expect(broker.subscribers).toBeDefined();
            expect(broker.messageQueue).toBeDefined();
            expect(broker.messageHistory).toBeDefined();
            expect(broker.isRunning).toBe(false);
        });
    });

    describe('subscribe', () => {
        test('should subscribe agent to message types', () => {
            const mockAgent = new EventEmitter();
            mockAgent.id = 'test_agent';
            
            broker.subscribe('test_agent', ['task_assignment', 'status_update'], mockAgent);
            
            expect(broker.subscribers.has('test_agent')).toBe(true);
            const subscription = broker.subscribers.get('test_agent');
            expect(subscription.messageTypes).toContain('task_assignment');
            expect(subscription.messageTypes).toContain('status_update');
            expect(subscription.handler).toBe(mockAgent);
        });

        test('should emit subscriber_added event', () => {
            const eventHandler = jest.fn();
            broker.on('subscriber_added', eventHandler);
            
            const mockAgent = new EventEmitter();
            mockAgent.id = 'test_agent';
            
            broker.subscribe('test_agent', ['task_assignment'], mockAgent);
            
            expect(eventHandler).toHaveBeenCalledWith('test_agent');
        });
    });

    describe('unsubscribe', () => {
        test('should remove subscriber', () => {
            const mockAgent = new EventEmitter();
            mockAgent.id = 'test_agent';
            
            broker.subscribe('test_agent', ['task_assignment'], mockAgent);
            broker.unsubscribe('test_agent');
            
            expect(broker.subscribers.has('test_agent')).toBe(false);
        });
    });

    describe('publish', () => {
        test('should add message to queue', async () => {
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'gemini_worker',
                data: { taskId: 'task_001' }
            });
            
            await broker.publish(message);
            
            expect(broker.messageQueue.size).toBe(1);
            expect(broker.messageHistory.has(message.id)).toBe(true);
        });

        test('should emit message_published event', async () => {
            const eventHandler = jest.fn();
            broker.on('message_published', eventHandler);
            
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'gemini_worker'
            });
            
            await broker.publish(message);
            
            expect(eventHandler).toHaveBeenCalledWith(message);
        });
    });

    describe('broadcast', () => {
        test('should send message to all subscribers', async () => {
            const mockAgent1 = new EventEmitter();
            mockAgent1.id = 'agent1';
            const handler1 = jest.fn();
            mockAgent1.on('message', handler1);
            
            const mockAgent2 = new EventEmitter();
            mockAgent2.id = 'agent2';
            const handler2 = jest.fn();
            mockAgent2.on('message', handler2);
            
            broker.subscribe('agent1', ['broadcast'], mockAgent1);
            broker.subscribe('agent2', ['broadcast'], mockAgent2);
            
            const message = new Message({
                type: 'broadcast',
                from: 'system',
                to: 'all'
            });
            
            await broker.broadcast(message);
            
            expect(handler1).toHaveBeenCalled();
            expect(handler2).toHaveBeenCalled();
            
            // 메시지 타입과 데이터가 올바른지 확인
            const receivedMessage1 = handler1.mock.calls[0][0];
            const receivedMessage2 = handler2.mock.calls[0][0];
            
            expect(receivedMessage1.type).toBe('broadcast');
            expect(receivedMessage1.from).toBe('system');
            expect(receivedMessage1.to).toBe('agent1');
            
            expect(receivedMessage2.type).toBe('broadcast');
            expect(receivedMessage2.from).toBe('system');
            expect(receivedMessage2.to).toBe('agent2');
        });
    });

    describe('start', () => {
        test('should start message processing', async () => {
            await broker.start();
            
            expect(broker.isRunning).toBe(true);
        });

        test('should emit started event', async () => {
            const eventHandler = jest.fn();
            broker.on('started', eventHandler);
            
            await broker.start();
            
            expect(eventHandler).toHaveBeenCalled();
        });
    });

    describe('stop', () => {
        test('should stop message processing', async () => {
            await broker.start();
            await broker.stop();
            
            expect(broker.isRunning).toBe(false);
        });
    });

    describe('message processing', () => {
        afterEach(async () => {
            if (broker.isRunning) {
                await broker.stop();
            }
        });

        test('should process messages in queue', async () => {
            const mockAgent = new EventEmitter();
            mockAgent.id = 'test_agent';
            const messageHandler = jest.fn();
            mockAgent.on('message', messageHandler);
            
            broker.subscribe('test_agent', ['task_assignment'], mockAgent);
            await broker.start();
            
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'test_agent',
                data: { taskId: 'task_001' }
            });
            
            await broker.publish(message);
            
            // 메시지 처리를 위한 충분한 대기 시간
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(messageHandler).toHaveBeenCalled();
            const receivedMessage = messageHandler.mock.calls[0][0];
            expect(receivedMessage.type).toBe('task_assignment');
            expect(receivedMessage.from).toBe('claude_leader');
            expect(receivedMessage.to).toBe('test_agent');
            expect(receivedMessage.status).toBe('delivered');
        });

        test('should handle undeliverable messages', async () => {
            await broker.start();
            
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'non_existent_agent',
                data: { taskId: 'task_001' }
            });
            
            await broker.publish(message);
            
            // 메시지 처리를 위한 충분한 대기 시간
            await new Promise(resolve => setTimeout(resolve, 150));
            
            expect(message.status).toBe('failed');
        });
    });

    describe('getMessageHistory', () => {
        test('should return message history for agent', async () => {
            const message1 = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'test_agent'
            });
            
            const message2 = new Message({
                type: 'status_update',
                from: 'test_agent',
                to: 'claude_leader'
            });
            
            await broker.publish(message1);
            await broker.publish(message2);
            
            const history = broker.getMessageHistory('test_agent');
            
            expect(history).toHaveLength(2);
            expect(history.some(msg => msg.id === message1.id)).toBe(true);
            expect(history.some(msg => msg.id === message2.id)).toBe(true);
        });
    });

    describe('getQueueStatus', () => {
        test('should return queue status', async () => {
            const message = new Message({
                type: 'task_assignment',
                from: 'claude_leader',
                to: 'test_agent'
            });
            
            await broker.publish(message);
            
            const status = broker.getQueueStatus();
            
            expect(status.queueSize).toBe(1);
            expect(status.subscriberCount).toBe(0);
            expect(status.isRunning).toBe(false);
            expect(status.totalMessages).toBe(1);
        });
    });
});