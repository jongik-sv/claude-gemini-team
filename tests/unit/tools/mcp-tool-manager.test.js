const { MCPToolManager, MCPTool } = require('../../../src/tools/mcp-tool-manager');
const EventEmitter = require('events');

describe('MCPTool', () => {
    describe('생성자', () => {
        test('should create MCP tool with valid config', () => {
            const config = {
                name: 'file_operations',
                description: 'File system operations tool',
                methods: ['read', 'write', 'list'],
                endpoint: 'http://localhost:8080/mcp',
                capabilities: ['file_access']
            };
            
            const tool = new MCPTool(config);
            
            expect(tool.name).toBe('file_operations');
            expect(tool.description).toBe('File system operations tool');
            expect(tool.methods).toEqual(['read', 'write', 'list']);
            expect(tool.endpoint).toBe('http://localhost:8080/mcp');
            expect(tool.capabilities).toEqual(['file_access']);
            expect(tool.status).toBe('disconnected');
        });

        test('should generate unique tool ID', () => {
            const config = { name: 'test_tool', methods: ['test'] };
            const tool1 = new MCPTool(config);
            const tool2 = new MCPTool(config);
            
            expect(tool1.id).not.toBe(tool2.id);
        });
    });

    describe('connect', () => {
        test('should connect to MCP endpoint successfully', async () => {
            const tool = new MCPTool({
                name: 'test_tool',
                methods: ['test'],
                endpoint: 'http://localhost:8080/mcp'
            });
            
            // Mock successful connection
            tool.makeRequest = jest.fn().mockResolvedValue({
                jsonrpc: '2.0',
                result: { status: 'connected' }
            });
            
            await tool.connect();
            
            expect(tool.status).toBe('connected');
            expect(tool.connectedAt).toBeInstanceOf(Date);
        });

        test('should handle connection failure', async () => {
            const tool = new MCPTool({
                name: 'test_tool',
                methods: ['test'],
                endpoint: 'http://localhost:8080/mcp'
            });
            
            tool.makeRequest = jest.fn().mockRejectedValue(new Error('Connection failed'));
            
            await expect(tool.connect()).rejects.toThrow('Connection failed');
            expect(tool.status).toBe('error');
        });
    });

    describe('execute', () => {
        test('should execute tool method successfully', async () => {
            const tool = new MCPTool({
                name: 'file_tool',
                methods: ['read'],
                endpoint: 'http://localhost:8080/mcp'
            });
            
            tool.status = 'connected';
            tool.makeRequest = jest.fn().mockResolvedValue({
                jsonrpc: '2.0',
                result: { content: 'file content' }
            });
            
            const result = await tool.execute('read', { path: '/test.txt' });
            
            expect(result).toEqual({ content: 'file content' });
            expect(tool.makeRequest).toHaveBeenCalledWith('read', { path: '/test.txt' });
        });

        test('should throw error when not connected', async () => {
            const tool = new MCPTool({
                name: 'test_tool',
                methods: ['test']
            });
            
            await expect(tool.execute('test', {})).rejects.toThrow('Tool not connected');
        });

        test('should throw error for unsupported method', async () => {
            const tool = new MCPTool({
                name: 'test_tool',
                methods: ['read']
            });
            
            tool.status = 'connected';
            
            await expect(tool.execute('write', {})).rejects.toThrow('Method write not supported');
        });
    });

    describe('disconnect', () => {
        test('should disconnect from MCP endpoint', async () => {
            const tool = new MCPTool({
                name: 'test_tool',
                methods: ['test']
            });
            
            tool.status = 'connected';
            tool.makeRequest = jest.fn().mockResolvedValue({
                jsonrpc: '2.0',
                result: { status: 'disconnected' }
            });
            
            await tool.disconnect();
            
            expect(tool.status).toBe('disconnected');
        });
    });
});

describe('MCPToolManager', () => {
    let manager;

    beforeEach(() => {
        manager = new MCPToolManager();
    });

    afterEach(async () => {
        await manager.shutdown();
    });

    describe('생성자', () => {
        test('should initialize with empty state', () => {
            expect(manager.tools).toBeDefined();
            expect(manager.toolRegistry).toBeDefined();
            expect(manager.isInitialized).toBe(false);
        });
    });

    describe('initialize', () => {
        test('should initialize tool manager', async () => {
            await manager.initialize();
            
            expect(manager.isInitialized).toBe(true);
        });

        test('should emit initialized event', async () => {
            const eventHandler = jest.fn();
            manager.on('initialized', eventHandler);
            
            await manager.initialize();
            
            expect(eventHandler).toHaveBeenCalled();
        });
    });

    describe('registerTool', () => {
        test('should register new MCP tool', async () => {
            await manager.initialize();
            
            const toolConfig = {
                name: 'file_operations',
                methods: ['read', 'write'],
                endpoint: 'http://localhost:8080/mcp'
            };
            
            const tool = await manager.registerTool(toolConfig);
            
            expect(manager.tools.has(tool.id)).toBe(true);
            expect(manager.toolRegistry.has('file_operations')).toBe(true);
        });

        test('should emit tool_registered event', async () => {
            await manager.initialize();
            
            const eventHandler = jest.fn();
            manager.on('tool_registered', eventHandler);
            
            const toolConfig = {
                name: 'test_tool',
                methods: ['test']
            };
            
            const tool = await manager.registerTool(toolConfig);
            
            expect(eventHandler).toHaveBeenCalledWith(tool);
        });

        test('should reject duplicate tool names', async () => {
            await manager.initialize();
            
            const toolConfig = {
                name: 'duplicate_tool',
                methods: ['test']
            };
            
            await manager.registerTool(toolConfig);
            
            await expect(manager.registerTool(toolConfig)).rejects.toThrow('Tool duplicate_tool already registered');
        });
    });

    describe('unregisterTool', () => {
        test('should unregister existing tool', async () => {
            await manager.initialize();
            
            const toolConfig = {
                name: 'temp_tool',
                methods: ['test']
            };
            
            const tool = await manager.registerTool(toolConfig);
            await manager.unregisterTool('temp_tool');
            
            expect(manager.toolRegistry.has('temp_tool')).toBe(false);
            expect(manager.tools.has(tool.id)).toBe(false);
        });

        test('should throw error for non-existent tool', async () => {
            await manager.initialize();
            
            await expect(manager.unregisterTool('non_existent')).rejects.toThrow('Tool non_existent not found');
        });
    });

    describe('getTool', () => {
        test('should return tool by name', async () => {
            await manager.initialize();
            
            const toolConfig = {
                name: 'test_tool',
                methods: ['test']
            };
            
            const registeredTool = await manager.registerTool(toolConfig);
            const retrievedTool = manager.getTool('test_tool');
            
            expect(retrievedTool.id).toBe(registeredTool.id);
        });

        test('should return null for non-existent tool', async () => {
            await manager.initialize();
            
            const tool = manager.getTool('non_existent');
            
            expect(tool).toBeNull();
        });
    });

    describe('connectAll', () => {
        test('should connect all registered tools', async () => {
            await manager.initialize();
            
            const tool1 = await manager.registerTool({
                name: 'tool1',
                methods: ['test']
            });
            
            const tool2 = await manager.registerTool({
                name: 'tool2',
                methods: ['test']
            });
            
            // Mock successful connections
            tool1.connect = jest.fn().mockResolvedValue();
            tool2.connect = jest.fn().mockResolvedValue();
            
            await manager.connectAll();
            
            expect(tool1.connect).toHaveBeenCalled();
            expect(tool2.connect).toHaveBeenCalled();
        });
    });

    describe('disconnectAll', () => {
        test('should disconnect all connected tools', async () => {
            await manager.initialize();
            
            const tool1 = await manager.registerTool({
                name: 'tool1',
                methods: ['test']
            });
            
            tool1.status = 'connected';
            tool1.disconnect = jest.fn().mockResolvedValue();
            
            await manager.disconnectAll();
            
            expect(tool1.disconnect).toHaveBeenCalled();
        });
    });

    describe('executeTool', () => {
        test('should execute tool method by name', async () => {
            await manager.initialize();
            
            const tool = await manager.registerTool({
                name: 'execution_tool',
                methods: ['test']
            });
            
            tool.execute = jest.fn().mockResolvedValue({ result: 'success' });
            
            const result = await manager.executeTool('execution_tool', 'test', { param: 'value' });
            
            expect(result).toEqual({ result: 'success' });
            expect(tool.execute).toHaveBeenCalledWith('test', { param: 'value' });
        });

        test('should throw error for non-existent tool', async () => {
            await manager.initialize();
            
            await expect(manager.executeTool('non_existent', 'test', {})).rejects.toThrow('Tool non_existent not found');
        });
    });

    describe('getAvailableTools', () => {
        test('should return list of available tools', async () => {
            await manager.initialize();
            
            await manager.registerTool({ name: 'tool1', methods: ['test'] });
            await manager.registerTool({ name: 'tool2', methods: ['test'] });
            
            const tools = manager.getAvailableTools();
            
            // 기본 도구 2개 + 추가한 도구 2개 = 총 4개
            expect(tools).toHaveLength(4);
            expect(tools.map(t => t.name)).toContain('tool1');
            expect(tools.map(t => t.name)).toContain('tool2');
            expect(tools.map(t => t.name)).toContain('file_system');
            expect(tools.map(t => t.name)).toContain('web_search');
        });
    });

    describe('getToolsByCapability', () => {
        test('should return tools with specific capability', async () => {
            await manager.initialize();
            
            await manager.registerTool({
                name: 'file_tool',
                methods: ['read'],
                capabilities: ['file_access']
            });
            
            await manager.registerTool({
                name: 'web_tool',
                methods: ['fetch'],
                capabilities: ['network_access']
            });
            
            const fileTools = manager.getToolsByCapability('file_access');
            
            // 기본 파일 시스템 도구 + 추가한 파일 도구 = 2개
            expect(fileTools).toHaveLength(2);
            expect(fileTools.map(t => t.name)).toContain('file_tool');
            expect(fileTools.map(t => t.name)).toContain('file_system');
        });
    });

    describe('getToolStatus', () => {
        test('should return tool manager status', async () => {
            await manager.initialize();
            
            await manager.registerTool({ name: 'tool1', methods: ['test'] });
            await manager.registerTool({ name: 'tool2', methods: ['test'] });
            
            const status = manager.getToolStatus();
            
            // 기본 도구 2개 + 추가한 도구 2개 = 총 4개
            expect(status.totalTools).toBe(4);
            expect(status.connectedTools).toBe(0);
            expect(status.isInitialized).toBe(true);
        });
    });
});