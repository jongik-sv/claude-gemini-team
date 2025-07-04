# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This repository contains the design and documentation for a Claude-Gemini multi-agent collaboration system. The system implements an orchestrator-worker pattern where Claude Pro serves as the master orchestrator and team leader, while Gemini Free agents serve as specialized workers.

## Architecture Overview

The system follows a layered architecture with 5 main components:

### Control Layer
- **Team Leader (Claude)**: Strategic planning, task decomposition, and quality management
- **Workflow Engine**: Manages task execution pipelines and dependencies  
- **Task Allocator**: Intelligent task distribution based on agent capabilities

### Agent Layer
- **Senior Developer (Claude)**: Complex coding, architecture design, debugging
- **Researcher (Gemini)**: Data collection, analysis, documentation
- **Developer (Gemini)**: General coding, testing, maintenance
- **Communication Protocol**: Agent-to-agent message exchange system

### Communication Layer
- **Message Queue**: Asynchronous message processing with priority handling
- **File System**: Structured data exchange via JSON/YAML files
- **Redis Store**: Distributed state management and caching

### Tool Layer
- **MCP Orchestrator**: Manages Model Context Protocol tool integrations
- **Available MCP Tools**: yahoo-finance, alpha-vantage, supabase, fetch, naver-search, exa, sequential-thinking, dart-mcp

### Visualization Layer
- **Log Visualizer**: Color-coded real-time logging by agent
- **Progress Visualizer**: Team status dashboard with progress bars
- **WebSocket Server**: Real-time web interface updates

## Key Design Patterns

### Task Classification Matrix
Tasks are classified by:
- Complexity (low/medium/high)
- Safety requirements (low/medium/high)  
- Time sensitivity (low/medium/high)
- Multimodal needs (boolean)

High complexity or safety tasks → Claude Pro
Multimodal or time-sensitive tasks → Gemini Free
Other tasks → Load-balanced assignment

### Communication Protocol
- Standard message format with header/payload/metadata structure
- Correlation IDs for workflow tracking
- Priority-based message routing
- Automatic retry and dead letter queue handling

### State Management
- Distributed state with local/remote synchronization
- Event-driven state updates with real-time broadcasting
- Three-way merge conflict resolution
- Version-based optimistic locking

## File Structure

This is a documentation-only repository. The proposed implementation structure is:

```
src/
├── core/           # TeamManager, WorkflowEngine, CommunicationProtocol
├── agents/         # Claude and Gemini agent implementations  
├── tools/          # MCP tool orchestration and conflict resolution
├── visualization/  # Real-time logging and progress display
└── utils/          # File management and state synchronization

config/             # Team configuration and MCP tool definitions
shared/             # Cross-agent file exchange (workflows/results/states)
tests/              # Unit and integration test suites
```

## Development Workflow

### Team Initialization
1. Configure 4-member team with role-based capabilities
2. Set up MCP tool connections per agent specialization
3. Initialize shared file system and Redis state store
4. Start WebSocket server for real-time monitoring

### Project Execution
1. Team leader analyzes project and creates execution plan
2. Tasks distributed based on classification matrix
3. Agents execute tasks with assigned MCP tools
4. Real-time progress monitoring with color-coded logs
5. Results integrated and quality-checked by team leader

### Quality Assurance
- Schema-based task and message validation
- Performance tracking with metrics collection
- Error handling with circuit breakers and fallbacks
- Security validation for all agent interactions

## MCP Tool Integration

The system leverages multiple MCP servers for specialized capabilities:
- **Financial data**: yahoo-finance-mcp, alpha-vantage-mcp
- **Web research**: fetch-mcp, naver-search-mcp, exa
- **Data management**: supabase
- **Analysis**: sequential-thinking, dart-mcp

Each agent is assigned tools based on their role and current task requirements.

## Code Standards

- **JavaScript/Node.js** with ES6+ async/await patterns
- **PascalCase** for classes, **camelCase** for functions/variables
- **Agent IDs** in snake_case (claude_leader, kim_senior, etc.)
- **Structured error handling** with custom error classes
- **JSDoc documentation** for all public methods
- **Performance tracking** with execution timers
- **Security validation** for all inputs and API calls

## Key Implementation Considerations

### Concurrency Management
- Semaphore-based concurrency limiting (max 3 concurrent tasks)
- Promise.allSettled for parallel task execution
- Timeout handling for all agent operations

### Memory Management  
- Active stream tracking with proper cleanup
- Redis-based result caching with configurable TTL
- Garbage collection optimization for long-running processes

### Monitoring & Observability
- Structured logging with Winston
- Prometheus metrics collection
- Real-time WebSocket event streaming
- Health checks for all system components