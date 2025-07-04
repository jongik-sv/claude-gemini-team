const EventEmitter = require('events');

/**
 * MCP 도구 클래스 - Model Context Protocol 도구 래퍼
 */
class MCPTool extends EventEmitter {
    constructor(config) {
        super();
        
        this.id = `mcp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.name = config.name;
        this.description = config.description || '';
        this.methods = config.methods || [];
        this.endpoint = config.endpoint || null;
        this.capabilities = config.capabilities || [];
        
        // 연결 상태
        this.status = 'disconnected';
        this.connectedAt = null;
        this.lastUsed = null;
        
        // 통계
        this.executionCount = 0;
        this.errorCount = 0;
        this.totalExecutionTime = 0;
    }

    /**
     * MCP 엔드포인트에 연결
     */
    async connect() {
        try {
            if (this.endpoint) {
                // MCP 프로토콜을 통한 연결 요청
                const response = await this.makeRequest('connect', {});
                
                if (response.result?.status === 'connected') {
                    this.status = 'connected';
                    this.connectedAt = new Date();
                    this.emit('connected');
                } else {
                    throw new Error('Connection failed: Invalid response');
                }
            } else {
                // 로컬 도구인 경우 즉시 연결
                this.status = 'connected';
                this.connectedAt = new Date();
                this.emit('connected');
            }
        } catch (error) {
            this.status = 'error';
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 도구 메서드 실행
     * @param {string} method - 실행할 메서드명
     * @param {Object} params - 메서드 파라미터
     * @returns {Promise<any>} 실행 결과
     */
    async execute(method, params = {}) {
        if (this.status !== 'connected') {
            throw new Error('Tool not connected');
        }

        if (!this.methods.includes(method)) {
            throw new Error(`Method ${method} not supported`);
        }

        const startTime = Date.now();
        
        try {
            this.emit('execution_start', { method, params });
            
            let result;
            if (this.endpoint) {
                // 원격 MCP 도구 실행
                const response = await this.makeRequest(method, params);
                result = response.result;
            } else {
                // 로컬 도구 실행 (구현 필요)
                result = await this.executeLocal(method, params);
            }
            
            // 통계 업데이트
            this.executionCount++;
            this.totalExecutionTime += Date.now() - startTime;
            this.lastUsed = new Date();
            
            this.emit('execution_complete', { method, params, result });
            
            return result;
        } catch (error) {
            this.errorCount++;
            this.emit('execution_error', { method, params, error });
            throw error;
        }
    }

    /**
     * MCP 요청 전송
     * @param {string} method - MCP 메서드
     * @param {Object} params - 파라미터
     * @returns {Promise<Object>} 응답
     */
    async makeRequest(method, params) {
        // 실제 구현에서는 HTTP 또는 WebSocket을 통해 MCP 서버와 통신
        // 여기서는 테스트를 위한 기본 구현
        const request = {
            jsonrpc: '2.0',
            id: Date.now(),
            method,
            params
        };

        // Mock implementation for testing
        if (this.mockRequest) {
            return await this.mockRequest(request);
        }

        // 실제 HTTP 요청 (fetch 또는 axios 사용)
        // const response = await fetch(this.endpoint, {
        //     method: 'POST',
        //     headers: { 'Content-Type': 'application/json' },
        //     body: JSON.stringify(request)
        // });
        // return await response.json();
        
        throw new Error('No real MCP endpoint implementation');
    }

    /**
     * 로컬 도구 실행
     * @param {string} method - 메서드명
     * @param {Object} params - 파라미터
     * @returns {Promise<any>} 실행 결과
     */
    async executeLocal(method, params) {
        // 로컬 도구별 구현
        throw new Error('Local execution not implemented');
    }

    /**
     * 연결 해제
     */
    async disconnect() {
        try {
            if (this.endpoint && this.status === 'connected') {
                await this.makeRequest('disconnect', {});
            }
            
            this.status = 'disconnected';
            this.connectedAt = null;
            this.emit('disconnected');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * 도구 상태 조회
     */
    getStatus() {
        return {
            id: this.id,
            name: this.name,
            status: this.status,
            connectedAt: this.connectedAt,
            lastUsed: this.lastUsed,
            executionCount: this.executionCount,
            errorCount: this.errorCount,
            averageExecutionTime: this.executionCount > 0 
                ? this.totalExecutionTime / this.executionCount 
                : 0,
            successRate: this.executionCount > 0 
                ? ((this.executionCount - this.errorCount) / this.executionCount) * 100 
                : 100
        };
    }

    /**
     * JSON 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            description: this.description,
            methods: this.methods,
            capabilities: this.capabilities,
            status: this.status,
            connectedAt: this.connectedAt,
            lastUsed: this.lastUsed
        };
    }
}

/**
 * MCP 도구 관리자 - Model Context Protocol 도구들을 관리
 */
class MCPToolManager extends EventEmitter {
    constructor() {
        super();
        
        // 도구 저장소
        this.tools = new Map(); // id -> MCPTool
        this.toolRegistry = new Map(); // name -> tool_id
        
        // 상태
        this.isInitialized = false;
        
        // 설정
        this.maxConcurrentExecutions = 10;
        this.defaultTimeout = 30000; // 30초
        
        // 활성 실행 추적
        this.activeExecutions = new Set();
    }

    /**
     * 도구 관리자 초기화
     */
    async initialize() {
        if (this.isInitialized) {
            return;
        }

        try {
            // MCP 프로토콜 초기화
            await this.initializeMCPProtocol();
            
            // 기본 도구들 로드
            await this.loadDefaultTools();
            
            this.isInitialized = true;
            this.emit('initialized');
        } catch (error) {
            this.emit('error', error);
            throw error;
        }
    }

    /**
     * MCP 프로토콜 초기화
     */
    async initializeMCPProtocol() {
        // MCP 클라이언트 초기화
        // 실제 구현에서는 MCP 클라이언트 라이브러리 사용
    }

    /**
     * 기본 도구들 로드
     */
    async loadDefaultTools() {
        // 기본 도구들 등록 (파일 시스템, 웹 검색 등)
        const defaultTools = [
            {
                name: 'file_system',
                description: 'File system operations',
                methods: ['read', 'write', 'list', 'delete'],
                capabilities: ['file_access']
            },
            {
                name: 'web_search',
                description: 'Web search capabilities',
                methods: ['search', 'fetch'],
                capabilities: ['network_access']
            }
        ];

        for (const toolConfig of defaultTools) {
            try {
                await this.registerTool(toolConfig);
            } catch (error) {
                // 기본 도구 로드 실패는 경고만 출력
                this.emit('warning', `Failed to load default tool ${toolConfig.name}: ${error.message}`);
            }
        }
    }

    /**
     * 도구 등록
     * @param {Object} toolConfig - 도구 설정
     * @returns {Promise<MCPTool>} 등록된 도구
     */
    async registerTool(toolConfig) {
        if (this.toolRegistry.has(toolConfig.name)) {
            throw new Error(`Tool ${toolConfig.name} already registered`);
        }

        const tool = new MCPTool(toolConfig);
        
        // 이벤트 리스너 등록
        tool.on('connected', () => this.emit('tool_connected', tool));
        tool.on('disconnected', () => this.emit('tool_disconnected', tool));
        tool.on('error', (error) => this.emit('tool_error', tool, error));
        
        // 저장소에 추가
        this.tools.set(tool.id, tool);
        this.toolRegistry.set(tool.name, tool.id);
        
        this.emit('tool_registered', tool);
        
        return tool;
    }

    /**
     * 도구 등록 해제
     * @param {string} toolName - 도구 이름
     */
    async unregisterTool(toolName) {
        const toolId = this.toolRegistry.get(toolName);
        if (!toolId) {
            throw new Error(`Tool ${toolName} not found`);
        }

        const tool = this.tools.get(toolId);
        
        // 연결된 경우 연결 해제
        if (tool.status === 'connected') {
            await tool.disconnect();
        }
        
        // 저장소에서 제거
        this.tools.delete(toolId);
        this.toolRegistry.delete(toolName);
        
        this.emit('tool_unregistered', tool);
    }

    /**
     * 도구 조회
     * @param {string} toolName - 도구 이름
     * @returns {MCPTool|null} 도구 또는 null
     */
    getTool(toolName) {
        const toolId = this.toolRegistry.get(toolName);
        return toolId ? this.tools.get(toolId) : null;
    }

    /**
     * 모든 도구 연결
     */
    async connectAll() {
        const tools = Array.from(this.tools.values());
        const connectionPromises = tools.map(tool => 
            tool.connect().catch(error => 
                this.emit('connection_error', tool, error)
            )
        );
        
        await Promise.allSettled(connectionPromises);
    }

    /**
     * 모든 도구 연결 해제
     */
    async disconnectAll() {
        const connectedTools = Array.from(this.tools.values())
            .filter(tool => tool.status === 'connected');
        
        const disconnectionPromises = connectedTools.map(tool => 
            tool.disconnect().catch(error => 
                this.emit('disconnection_error', tool, error)
            )
        );
        
        await Promise.allSettled(disconnectionPromises);
    }

    /**
     * 도구 실행
     * @param {string} toolName - 도구 이름
     * @param {string} method - 실행할 메서드
     * @param {Object} params - 파라미터
     * @returns {Promise<any>} 실행 결과
     */
    async executeTool(toolName, method, params = {}) {
        const tool = this.getTool(toolName);
        if (!tool) {
            throw new Error(`Tool ${toolName} not found`);
        }

        // 동시 실행 제한 확인
        if (this.activeExecutions.size >= this.maxConcurrentExecutions) {
            throw new Error('Maximum concurrent executions reached');
        }

        const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        this.activeExecutions.add(executionId);

        try {
            this.emit('execution_start', { toolName, method, params, executionId });
            
            const result = await tool.execute(method, params);
            
            this.emit('execution_complete', { toolName, method, params, result, executionId });
            
            return result;
        } catch (error) {
            this.emit('execution_error', { toolName, method, params, error, executionId });
            throw error;
        } finally {
            this.activeExecutions.delete(executionId);
        }
    }

    /**
     * 사용 가능한 도구 목록 조회
     * @returns {Array<Object>} 도구 목록
     */
    getAvailableTools() {
        return Array.from(this.tools.values()).map(tool => ({
            id: tool.id,
            name: tool.name,
            description: tool.description,
            methods: tool.methods,
            capabilities: tool.capabilities,
            status: tool.status
        }));
    }

    /**
     * 특정 기능을 가진 도구들 조회
     * @param {string} capability - 기능명
     * @returns {Array<MCPTool>} 도구 목록
     */
    getToolsByCapability(capability) {
        return Array.from(this.tools.values())
            .filter(tool => tool.capabilities.includes(capability));
    }

    /**
     * 도구 관리자 상태 조회
     * @returns {Object} 상태 정보
     */
    getToolStatus() {
        const tools = Array.from(this.tools.values());
        const connectedTools = tools.filter(tool => tool.status === 'connected');
        const errorTools = tools.filter(tool => tool.status === 'error');
        
        return {
            isInitialized: this.isInitialized,
            totalTools: tools.length,
            connectedTools: connectedTools.length,
            errorTools: errorTools.length,
            activeExecutions: this.activeExecutions.size,
            maxConcurrentExecutions: this.maxConcurrentExecutions,
            timestamp: new Date()
        };
    }

    /**
     * 도구별 사용 통계 조회
     * @returns {Object} 사용 통계
     */
    getUsageStats() {
        const stats = {};
        
        for (const tool of this.tools.values()) {
            stats[tool.name] = tool.getStatus();
        }
        
        return stats;
    }

    /**
     * 관리자 종료
     */
    async shutdown() {
        if (!this.isInitialized) {
            return;
        }

        // 모든 활성 실행 대기
        while (this.activeExecutions.size > 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 모든 도구 연결 해제
        await this.disconnectAll();
        
        // 상태 초기화
        this.tools.clear();
        this.toolRegistry.clear();
        this.activeExecutions.clear();
        this.isInitialized = false;
        
        this.emit('shutdown');
    }
}

module.exports = { MCPToolManager, MCPTool };