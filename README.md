# 🤖 Claude-Gemini Team Collaboration System

<div align="center">

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D18.0.0-green.svg)
![License](https://img.shields.io/badge/license-MIT-yellow.svg)
![Tests](https://img.shields.io/badge/tests-161%20passing-brightgreen.svg)
![Coverage](https://img.shields.io/badge/coverage-84%25-brightgreen.svg)

**Advanced Multi-Agent AI Collaboration System**

*Orchestrate Claude and Gemini AI agents for complex software development projects*

[🚀 Quick Start](#-quick-start) • [📖 Documentation](#-documentation) • [🎥 Demo](#-demo) • [🛠️ Features](#-features) • [🤝 Contributing](#-contributing)

</div>

---

## 🌟 Overview

Claude-Gemini Team is a cutting-edge multi-agent collaboration system that combines the strategic capabilities of Claude AI with the versatile skills of Gemini AI. This system orchestrates AI agents to work together seamlessly on complex software development projects, from planning and architecture to implementation and testing.

### 🎯 Key Highlights

- **🧠 AI-Powered Project Analysis**: Intelligent project breakdown using Claude Sonnet 4 and Gemini 2.5 Flash
- **🔧 Local CLI Integration**: Supports locally installed Claude and Gemini CLI tools with API fallback
- **📊 Real-time Visualization**: Web and CLI dashboards with live monitoring
- **🔄 Smart Workflow Engine**: AI-driven task generation with realistic time estimates and role assignments
- **🌐 WebSocket Integration**: Real-time communication and state synchronization
- **📋 Intelligent Task Distribution**: Context-aware assignment based on agent capabilities and project type
- **🛠️ MCP Tool Ecosystem**: Extensible tool integration via Model Context Protocol
- **🧪 Test-Driven Development**: 161 tests with 84% coverage ensuring reliability

## 🚀 Quick Start

### Prerequisites
- **Node.js** 18.0.0+
- **npm** 8.0.0+
- **Modern Browser** (Chrome 80+, Firefox 75+)

### Installation
```bash
# Clone the repository
git clone https://github.com/your-username/claude-gemini-team.git
cd claude-gemini-team

# Install dependencies
npm install

# Start web dashboard
npm run web-dashboard
```

### First Run
```bash
# Launch integrated dashboard (CLI + Web)
npm run full-dashboard

# Or start a project directly
npm start "Build a modern e-commerce platform"
```

**🌐 Open your browser to `http://localhost:8080` for the web dashboard!**

## 🛠️ Features

### 🤖 Multi-Agent Architecture
- **Team Leader (Claude)**: Strategic planning, task decomposition, quality management
- **Senior Developer (Claude)**: Complex coding, architecture design, debugging
- **Researcher (Gemini)**: Data collection, analysis, documentation
- **Developer (Gemini)**: General coding, testing, maintenance

### 📊 Advanced Visualization
- **Real-time Web Dashboard**: HTML5 + WebSocket for instant updates
- **CLI Interface**: Terminal-based monitoring with keyboard controls
- **Progress Tracking**: Visual progress bars, success rates, performance metrics
- **Color-coded Agents**: Intuitive visual distinction for different AI agents

### 🔄 Intelligent Workflow Management
- **Dynamic Task Distribution**: AI-driven task assignment based on complexity and capabilities
- **Dependency Resolution**: Automatic handling of task dependencies and prerequisites
- **State Synchronization**: Real-time state management across all agents
- **Error Recovery**: Automatic failover and task reassignment

### 🌐 Modern Tech Stack
- **Backend**: Node.js, WebSocket, Redis (optional)
- **Frontend**: HTML5, CSS3, JavaScript, WebSocket
- **Testing**: Jest with comprehensive unit, integration, and E2E tests
- **Tools**: ESLint, Commander.js, Chalk for CLI

## 📖 Documentation

### 📚 Core Documentation
- **[📋 Usage Guide](./USAGE_GUIDE.md)** - Comprehensive usage instructions
- **[🏗️ Architecture Guide](./DESIGN_DOCUMENT.md)** - System design and architecture
- **[💻 Code Guidelines](./CODE_GUIDELINES.md)** - Development standards
- **[🧪 TDD Rules](./TDD_RULES.md)** - Test-driven development practices

### 🎮 Command Reference
```bash
# Dashboard Commands
npm run dashboard          # CLI dashboard with keyboard controls
npm run web-dashboard      # Web-based real-time dashboard  
npm run full-dashboard     # Integrated CLI + Web dashboard

# Monitoring Commands
npm run monitor           # Advanced monitoring with real-time updates

# AI Workflow Testing
npm run test-ai-workflow   # Test AI-powered project analysis and task generation

# Local CLI Commands
npm run test-cli          # Test local Claude/Gemini CLI connectivity
npm run setup-api         # Interactive API key configuration
npm run api-status        # Check API connection status
npm run monitor-simple    # Simple monitoring interface

# Project Management
npm start "project description"  # Start a new project
npm run add-member              # Add new team member
npm run status                  # Check system status

# Development & Testing
npm test                  # Run all tests
npm run test:unit        # Unit tests only
npm run test:integration # Integration tests
npm run lint             # Code quality check
```

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Control Layer                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│   Team Leader   │ Workflow Engine │     Task Allocator          │
│    (Claude)     │                 │                             │
└─────────────────┴─────────────────┴─────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Layer                             │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ Senior Developer│   Researcher    │      Developer              │
│    (Claude)     │   (Gemini)      │     (Gemini)                │
└─────────────────┴─────────────────┴─────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                   Communication Layer                          │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Message Queue  │  File System    │    Redis Store              │
└─────────────────┴─────────────────┴─────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                      Tool Layer                                │
├─────────────────┬─────────────────┬─────────────────────────────┤
│ MCP Orchestrator│   Supabase      │    External APIs            │
└─────────────────┴─────────────────┴─────────────────────────────┘
                            │
┌─────────────────────────────────────────────────────────────────┐
│                  Visualization Layer                           │
├─────────────────┬─────────────────┬─────────────────────────────┤
│  Log Visualizer │Progress Tracker │   WebSocket Server          │
└─────────────────┴─────────────────┴─────────────────────────────┘
```

### Core Components
- **🧠 TeamManager**: Agent coordination and team composition
- **⚡ WorkflowEngine**: Task decomposition and distribution
- **📡 MessageBroker**: Inter-agent communication protocol
- **🔧 MCPToolManager**: External tool integration
- **📊 Visualization Layer**: Real-time dashboards and monitoring

## 🎥 Demo Screenshots

### Web Dashboard
![Web Dashboard Preview](https://via.placeholder.com/800x400/1a1a1a/ffffff?text=Web+Dashboard+%E2%80%A2+Real-time+Agent+Monitoring)
*Real-time web dashboard with agent status, progress tracking, and live logs*

### CLI Interface  
![CLI Dashboard Preview](https://via.placeholder.com/800x400/000000/00ff00?text=CLI+Dashboard+%E2%80%A2+Terminal+Interface)
*Terminal-based dashboard with keyboard controls and color-coded output*

### Team Collaboration
![Team Workflow Preview](https://via.placeholder.com/800x400/2d2d2d/64b5f6?text=Multi-Agent+Workflow+%E2%80%A2+Task+Distribution)
*Multi-agent collaboration in action with task distribution and real-time updates*

## 📊 Project Statistics

- **📝 Total Code Lines**: 15,000+
- **🧪 Test Coverage**: 84% (161 tests passing)
- **🎯 Core Components**: 7 major systems
- **🔧 CLI Commands**: 12 specialized commands
- **🌐 Web Features**: Real-time WebSocket dashboard
- **⚡ Performance**: <2s average response time

## 🛠️ MCP Tool Integration

The system integrates with multiple MCP (Model Context Protocol) tools:

### 💰 Financial Analysis
- **yahoo-finance-mcp**: Stock data and market analysis
- **alpha-vantage-mcp**: Real-time market data
- **dart-mcp**: Corporate disclosure information

### 🔍 Research & Search
- **naver-search-mcp**: Korean web search capabilities
- **exa-mcp**: Academic papers and research materials
- **fetch-mcp**: Web scraping and data extraction

### 💾 Data Management
- **supabase-mcp**: Database management and operations
- **sequential-thinking**: Step-by-step problem solving

## 🧪 Testing & Quality

### Test Coverage
```bash
npm run test:all    # Complete test suite with coverage
npm run test:unit   # Unit tests (84% coverage)
npm run test:integration # Integration tests
npm run test:e2e    # End-to-end tests
```

### Quality Metrics
- **Unit Tests**: 161 tests passing
- **Coverage**: 84% statements, 70% branches
- **Integration Tests**: 14 scenarios
- **E2E Tests**: Complete workflow validation

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guidelines](./CONTRIBUTING.md) for details.

### Development Setup
```bash
# Fork and clone
git clone https://github.com/your-username/claude-gemini-team.git
cd claude-gemini-team

# Install dependencies
npm install

# Run tests
npm test

# Start development
npm run dev
```

### 🧪 Testing
```bash
npm run test:all    # Complete test suite with coverage
npm run test:watch  # Watch mode for development
npm run lint:fix    # Auto-fix code style issues
```

## 📋 Roadmap

### ✅ Completed (v1.0)
- [x] Multi-agent orchestration system
- [x] Real-time web and CLI dashboards
- [x] WebSocket-based communication
- [x] Comprehensive testing suite
- [x] MCP tool integration

### 🔄 In Progress (v1.1)
- [ ] Performance optimization
- [ ] Advanced error recovery
- [ ] Plugin system for custom agents
- [ ] Cloud deployment support

### 🎯 Planned (v2.0)
- [ ] Machine learning task optimization
- [ ] Advanced analytics dashboard
- [ ] Multi-project management
- [ ] Enterprise features

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- **Anthropic** for Claude AI capabilities
- **Google** for Gemini AI integration  
- **Open Source Community** for essential tools and libraries
- **Contributors** who helped shape this project

## 📞 Support

- **🐛 Bug Reports**: [GitHub Issues](https://github.com/your-username/claude-gemini-team/issues)
- **💡 Feature Requests**: [GitHub Discussions](https://github.com/your-username/claude-gemini-team/discussions)
- **📚 Documentation**: [Usage Guide](./USAGE_GUIDE.md)
- **💬 Community**: Join our development community

---

<div align="center">

**⭐ Star this repo if you find it useful! ⭐**

Made with ❤️ by the Claude-Gemini Team

[🔝 Back to top](#-claude-gemini-team-collaboration-system)

</div>