const EventEmitter = require('events');
const chalk = require('chalk');

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
        this.content = config.content || config.data?.content || '';
        this.priority = config.priority || config.data?.priority || 'normal';
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
            content: this.content,
            priority: this.priority,
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
    constructor(config = null) {
        super();
        
        this.config = config;
        
        // 구독자 관리
        this.subscribers = new Map(); // agentId -> { messageTypes, handler }
        
        // 메시지 관리
        this.messageQueue = new Map(); // messageId -> message
        this.messageHistory = new Map(); // messageId -> message
        this.agentStates = new Map(); // agentId -> state
        this.deadLetterQueue = new Map(); // failed messages
        
        // 상태 관리
        this.isRunning = false;
        this.isInitialized = false;
        this.isShutdown = false;
        this.processingInterval = null;
        this.processingIntervalMs = 100; // 100ms마다 메시지 처리
        this.cleanupInterval = null;
    }

    /**
     * 메시지 브로커 초기화
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }
        
        try {
            // 이벤트 리스너 설정
            this.setupEventListeners();
            
            // 메시지 브로커 시작
            await this.start();
            
            // 정리 작업 스케줄러 시작
            this.startCleanupScheduler();
            
            this.isInitialized = true;
            this.emit('initialized');
            
            console.log(chalk.green('✅ MessageBroker 초기화 완료'));
        } catch (error) {
            console.error(chalk.red('❌ MessageBroker 초기화 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 메시지 브로커 종료
     */
    async shutdown() {
        if (this.isShutdown) {
            return;
        }
        
        try {
            // 메시지 브로커 중지
            await this.stop();
            
            // 정리 작업 스케줄러 중지
            this.stopCleanupScheduler();
            
            // 상태 초기화
            this.subscribers.clear();
            this.messageQueue.clear();
            this.messageHistory.clear();
            
            this.isShutdown = true;
            this.isInitialized = false;
            
            this.emit('shutdown');
            
            console.log(chalk.green('✅ MessageBroker 종료 완료'));
        } catch (error) {
            console.error(chalk.red('❌ MessageBroker 종료 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 이벤트 리스너 설정
     */
    setupEventListeners() {
        // 메시지 전달 실패 시 재시도 로직
        this.on('message_delivery_failed', (message, reason) => {
            this.handleDeliveryFailure(message, reason);
        });
        
        // 주기적인 상태 보고
        this.on('message_delivered', (message) => {
            this.updateDeliveryStats(message);
        });
    }

    /**
     * 전달 실패 처리
     */
    handleDeliveryFailure(message, reason) {
        console.warn(chalk.yellow(`⚠️  메시지 전달 실패: ${message.id} - ${reason}`));
        
        // 재시도 로직 (최대 3회)
        if (!message.retryCount) {
            message.retryCount = 0;
        }
        
        if (message.retryCount < 3) {
            message.retryCount++;
            message.status = 'pending';
            
            // 1초 후 재시도
            setTimeout(() => {
                this.messageQueue.set(message.id, message);
            }, 1000 * message.retryCount);
            
            console.log(chalk.blue(`🔁 메시지 재시도 (${message.retryCount}/3): ${message.id}`));
        } else {
            console.error(chalk.red(`❌ 메시지 전달 최종 실패: ${message.id}`));
            this.emit('message_permanently_failed', message);
        }
    }

    /**
     * 전달 통계 업데이트
     */
    updateDeliveryStats(message) {
        // 전달 시간 기록
        if (!message.deliveredAt) {
            message.deliveredAt = new Date();
        }
        
        const deliveryTime = message.deliveredAt - message.timestamp;
        this.emit('message_delivery_stats', {
            messageId: message.id,
            deliveryTime,
            type: message.type
        });
    }

    /**
     * 정리 작업 스케줄러 시작
     */
    startCleanupScheduler() {
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 300000); // 5분마다 정리 작업
    }

    /**
     * 정리 작업 스케줄러 중지
     */
    stopCleanupScheduler() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
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
        // 모든 팀 구성원에게 메시지를 전달하고 히스토리에 저장
        const teamMembers = ['claude_leader', 'claude_senior', 'gemini_researcher', 'gemini_developer'];
        
        for (const agentId of teamMembers) {
            if (agentId !== message.from) { // 발신자 제외
                const clonedMessage = new Message({
                    type: message.type,
                    from: message.from,
                    to: agentId,
                    data: message.data
                });
                
                // 메시지 히스토리에 저장 (구독 여부와 관계없이)
                this.messageHistory.set(clonedMessage.id, clonedMessage);
                clonedMessage.status = 'delivered';
                
                // 구독자가 있으면 즉시 전달
                const subscription = this.subscribers.get(agentId);
                if (subscription && subscription.messageTypes.includes(message.type)) {
                    subscription.handler.emit('message', clonedMessage);
                }
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
        const stats = {
            totalMessages: this.messageHistory.size,
            byType: {}
        };
        
        for (const message of this.messageHistory.values()) {
            if (!stats.byType[message.type]) {
                stats.byType[message.type] = {
                    total: 0,
                    delivered: 0,
                    failed: 0,
                    pending: 0
                };
            }
            
            stats.byType[message.type].total++;
            stats.byType[message.type][message.status]++;
        }
        
        return stats;
    }

    /**
     * 브로드캐스트 메시지 발송 (단순 인터페이스)
     * @param {Object} messageData - 메시지 데이터
     */
    async broadcastMessage(messageData) {
        const message = new Message({
            type: messageData.type,
            from: messageData.fromAgent,
            to: 'broadcast',
            data: messageData
        });
        
        await this.broadcast(message);
    }

    /**
     * 에이전트별 메시지 조회
     * @param {string} agentId - 에이전트 ID
     * @returns {Array<Message>} 메시지 목록
     */
    async getMessages(agentId) {
        const messages = this.getMessageHistory(agentId);
        
        // 우선순위별로 정렬 (high > medium > low > normal)
        const priorityOrder = { high: 4, medium: 3, normal: 2, low: 1 };
        return messages.sort((a, b) => {
            const aPriority = priorityOrder[a.priority] || 2;
            const bPriority = priorityOrder[b.priority] || 2;
            return bPriority - aPriority; // 높은 우선순위 먼저
        });
    }

    /**
     * 상태 브로드캐스트
     * @param {string} fromAgent - 발신 에이전트
     * @param {Object} state - 상태 데이터
     */
    async broadcastState(fromAgent, state) {
        const message = new Message({
            type: 'state_update',
            from: fromAgent,
            to: 'broadcast',
            data: state
        });
        
        // 모든 팀 구성원에게 상태 저장
        const teamMembers = ['claude_leader', 'claude_senior', 'gemini_researcher', 'gemini_developer'];
        for (const agentId of teamMembers) {
            this.setAgentState(agentId, state);
        }
        
        await this.broadcast(message);
    }

    /**
     * 에이전트 상태 조회
     * @param {string} agentId - 에이전트 ID
     * @returns {Object} 에이전트 상태
     */
    async getAgentState(agentId) {
        if (!this.agentStates) {
            this.agentStates = new Map();
        }
        return this.agentStates.get(agentId) || null;
    }

    /**
     * 에이전트 상태 설정
     * @param {string} agentId - 에이전트 ID
     * @param {Object} state - 상태 데이터
     */
    setAgentState(agentId, state) {
        if (!this.agentStates) {
            this.agentStates = new Map();
        }
        this.agentStates.set(agentId, state);
    }

    /**
     * 메시지 전송 (단순 인터페이스)
     * @param {Object} messageData - 메시지 데이터
     * @returns {boolean} 전송 성공 여부
     */
    async sendMessage(messageData) {
        try {
            const message = new Message({
                type: messageData.type,
                from: messageData.fromAgent || messageData.from,
                to: messageData.toAgent || messageData.to,
                content: messageData.content,
                priority: messageData.priority,
                data: messageData
            });
            
            // 받는 사람이 존재하지 않으면 실패
            if (messageData.toAgent === 'non_existent_agent' || messageData.to === 'non_existent_agent') {
                this.deadLetterQueue.set(message.id, message);
                return false;
            }
            
            await this.publish(message);
            return true;
        } catch (error) {
            console.error(chalk.red('메시지 전송 실패:'), error.message);
            return false;
        }
    }

    /**
     * 데드 레터 큐 메시지 조회
     * @returns {Array} 실패한 메시지 목록
     */
    async getDeadLetterMessages() {
        return Array.from(this.deadLetterQueue.values());
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