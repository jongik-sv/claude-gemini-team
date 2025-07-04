const EventEmitter = require('events');

/**
 * 메시지 클래스 - 에이전트 간 통신을 위한 메시지
 */
class Message {
    constructor(config) {
        this.id = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.type = config.type;
        this.from = config.from;
        this.to = config.to;
        this.data = config.data || {};
        this.timestamp = new Date();
        this.status = 'pending';
        this.acknowledgedAt = null;
    }

    /**
     * 메시지 수신 확인
     */
    acknowledge() {
        this.status = 'acknowledged';
        this.acknowledgedAt = new Date();
    }

    /**
     * JSON 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            type: this.type,
            from: this.from,
            to: this.to,
            data: this.data,
            timestamp: this.timestamp,
            status: this.status,
            acknowledgedAt: this.acknowledgedAt
        };
    }
}

/**
 * 메시지 브로커 - 에이전트 간 통신 관리
 */
class MessageBroker extends EventEmitter {
    constructor() {
        super();
        
        // 구독자 관리
        this.subscribers = new Map(); // agentId -> { messageTypes, handler }
        
        // 메시지 관리
        this.messageQueue = new Map(); // messageId -> message
        this.messageHistory = new Map(); // messageId -> message
        
        // 상태 관리
        this.isRunning = false;
        this.processingInterval = null;
        this.processingIntervalMs = 100; // 100ms마다 메시지 처리
    }

    /**
     * 에이전트 구독 등록
     * @param {string} agentId - 에이전트 ID
     * @param {Array<string>} messageTypes - 구독할 메시지 타입 목록
     * @param {EventEmitter} handler - 메시지 핸들러 (EventEmitter)
     */
    subscribe(agentId, messageTypes, handler) {
        this.subscribers.set(agentId, {
            messageTypes,
            handler
        });
        
        this.emit('subscriber_added', agentId);
    }

    /**
     * 에이전트 구독 해제
     * @param {string} agentId - 에이전트 ID
     */
    unsubscribe(agentId) {
        this.subscribers.delete(agentId);
        this.emit('subscriber_removed', agentId);
    }

    /**
     * 메시지 발행
     * @param {Message} message - 발행할 메시지
     */
    async publish(message) {
        // 메시지 큐에 추가
        this.messageQueue.set(message.id, message);
        
        // 메시지 히스토리에 추가
        this.messageHistory.set(message.id, message);
        
        this.emit('message_published', message);
    }

    /**
     * 브로드캐스트 메시지 발송
     * @param {Message} message - 브로드캐스트할 메시지
     */
    async broadcast(message) {
        for (const [agentId, subscription] of this.subscribers) {
            if (subscription.messageTypes.includes(message.type)) {
                const clonedMessage = new Message({
                    type: message.type,
                    from: message.from,
                    to: agentId,
                    data: message.data
                });
                
                // 즉시 전달
                subscription.handler.emit('message', clonedMessage);
                clonedMessage.status = 'delivered';
            }
        }
        
        this.emit('message_broadcasted', message);
    }

    /**
     * 메시지 브로커 시작
     */
    async start() {
        if (this.isRunning) {
            return;
        }
        
        this.isRunning = true;
        
        // 메시지 처리 루프 시작
        this.processingInterval = setInterval(() => {
            this.processMessages();
        }, this.processingIntervalMs);
        
        this.emit('started');
    }

    /**
     * 메시지 브로커 중지
     */
    async stop() {
        if (!this.isRunning) {
            return;
        }
        
        this.isRunning = false;
        
        if (this.processingInterval) {
            clearInterval(this.processingInterval);
            this.processingInterval = null;
        }
        
        this.emit('stopped');
    }

    /**
     * 메시지 처리
     */
    processMessages() {
        const messages = Array.from(this.messageQueue.values());
        
        for (const message of messages) {
            if (message.status === 'pending') {
                this.deliverMessage(message);
                this.messageQueue.delete(message.id);
            }
        }
    }

    /**
     * 메시지 전달
     * @param {Message} message - 전달할 메시지
     */
    deliverMessage(message) {
        const subscription = this.subscribers.get(message.to);
        
        if (!subscription) {
            message.status = 'failed';
            this.emit('message_delivery_failed', message, 'Recipient not found');
            return;
        }
        
        if (!subscription.messageTypes.includes(message.type)) {
            message.status = 'failed';
            this.emit('message_delivery_failed', message, 'Message type not subscribed');
            return;
        }
        
        // 메시지 전달
        subscription.handler.emit('message', message);
        message.status = 'delivered';
        
        this.emit('message_delivered', message);
    }

    /**
     * 에이전트별 메시지 히스토리 조회
     * @param {string} agentId - 에이전트 ID
     * @returns {Array<Message>} 메시지 히스토리
     */
    getMessageHistory(agentId) {
        return Array.from(this.messageHistory.values())
            .filter(message => message.from === agentId || message.to === agentId)
            .sort((a, b) => a.timestamp - b.timestamp);
    }

    /**
     * 큐 상태 조회
     * @returns {Object} 큐 상태
     */
    getQueueStatus() {
        return {
            queueSize: this.messageQueue.size,
            subscriberCount: this.subscribers.size,
            isRunning: this.isRunning,
            totalMessages: this.messageHistory.size,
            timestamp: new Date()
        };
    }

    /**
     * 메시지 타입별 통계 조회
     * @returns {Object} 메시지 타입별 통계
     */
    getMessageStats() {
        const stats = {};
        
        for (const message of this.messageHistory.values()) {
            if (!stats[message.type]) {
                stats[message.type] = {
                    total: 0,
                    delivered: 0,
                    failed: 0,
                    pending: 0
                };
            }
            
            stats[message.type].total++;
            stats[message.type][message.status]++;
        }
        
        return stats;
    }

    /**
     * 정리 작업
     */
    cleanup() {
        // 오래된 메시지 히스토리 정리 (24시간 이전)
        const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000);
        
        for (const [messageId, message] of this.messageHistory) {
            if (message.timestamp < cutoffTime) {
                this.messageHistory.delete(messageId);
            }
        }
        
        this.emit('history_cleaned', this.messageHistory.size);
    }
}

module.exports = { MessageBroker, Message };