#!/usr/bin/env node

const { TeamManager } = require('./core/team-manager');
const { LogVisualizer } = require('./visualization/log-visualizer');
const { WorkflowEngine } = require('./core/workflow-engine');
const { MCPToolManager } = require('./tools/mcp-tool-manager');
const { ClaudeAgent } = require('./agents/claude-agent');
const { GeminiAgent } = require('./agents/gemini-agent');
const { ApiConfigManager } = require('./utils/api-config');
const chalk = require('chalk');

/**
 * Claude-Gemini 팀 협업 시스템 메인 클래스
 */
class ClaudeGeminiTeamSystem {
    constructor() {
        this.teamManager = new TeamManager();
        this.logVisualizer = new LogVisualizer();
        this.workflowEngine = new WorkflowEngine();
        this.toolManager = new MCPToolManager();
        this.apiConfig = new ApiConfigManager();
        
        this.isInitialized = false;
        this.realAiMode = false; // 실제 AI 사용 여부
    }

    /**
     * 팀 초기화 - 실제 AI 에이전트 또는 시뮬레이션 모드
     */
    async initializeTeam(useRealAI = false) {
        if (this.isInitialized) {
            return;
        }

        this.realAiMode = useRealAI;
        console.log(chalk.bold.magenta('🚀 Claude-Gemini 팀 협업 시스템 초기화 중...'));
        
        if (this.realAiMode) {
            console.log(chalk.blue('🤖 실제 AI 모드: Claude & Gemini API 연동'));
            // API 키 상태 확인
            this.apiConfig.displayApiStatus();
        } else {
            console.log(chalk.yellow('🎭 시뮬레이션 모드: Mock AI 에이전트'));
        }
        
        try {
            if (this.realAiMode) {
                await this.initializeRealAiAgents();
            } else {
                await this.initializeSimulationAgents();
            }

            this.isInitialized = true;
            console.log(chalk.bold.green('✅ 팀 초기화 완료'));
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 팀 초기화 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 실제 AI 에이전트 초기화
     */
    async initializeRealAiAgents() {
        const claudeConfig = this.apiConfig.getApiConfig('claude');
        const geminiConfig = this.apiConfig.getApiConfig('gemini');

        // Claude 팀장 (로컬 CLI 우선, API 폴백)
        const claudeLeader = new ClaudeAgent({
            id: 'claude_leader',
            name: '팀장',
            role: 'leader',
            capabilities: ['planning', 'coordination', 'quality_assurance', 'strategic_thinking'],
            color: 'blue',
            useLocalCLI: true,
            cliPath: process.env.CLAUDE_CLI_PATH || 'claude',
            apiKey: claudeConfig.apiKey,
            apiBaseUrl: claudeConfig.apiUrl,
            model: 'claude-sonnet-4'
        });

        // Claude 선임 개발자 (로컬 CLI 우선, API 폴백)
        const claudeSenior = new ClaudeAgent({
            id: 'kim_senior',
            name: '김선임',
            role: 'senior_developer',
            capabilities: ['complex_coding', 'architecture', 'debugging', 'code_review'],
            color: 'cyan',
            useLocalCLI: true,
            cliPath: process.env.CLAUDE_CLI_PATH || 'claude',
            apiKey: claudeConfig.apiKey,
            apiBaseUrl: claudeConfig.apiUrl,
            model: 'claude-sonnet-4'
        });

        // Gemini 연구원 (로컬 CLI 우선, API 폴백)
        const geminiResearcher = new GeminiAgent({
            id: 'lee_researcher',
            name: '이조사',
            role: 'researcher',
            capabilities: ['research', 'data_collection', 'analysis', 'documentation'],
            color: 'green',
            useLocalCLI: true,
            cliPath: process.env.GEMINI_CLI_PATH || 'gemini',
            apiKey: geminiConfig.apiKey,
            apiBaseUrl: geminiConfig.apiUrl,
            model: 'gemini-2.5-flash'
        });

        // Gemini 개발자 (로컬 CLI 우선, API 폴백)
        const geminiDeveloper = new GeminiAgent({
            id: 'park_developer',
            name: '박개발',
            role: 'developer',
            capabilities: ['coding', 'testing', 'maintenance', 'implementation'],
            color: 'yellow',
            useLocalCLI: true,
            cliPath: process.env.GEMINI_CLI_PATH || 'gemini',
            apiKey: geminiConfig.apiKey,
            apiBaseUrl: geminiConfig.apiUrl,
            model: 'gemini-2.5-flash'
        });

        // 에이전트 초기화 및 팀에 추가
        const agents = [claudeLeader, claudeSenior, geminiResearcher, geminiDeveloper];
        
        for (const agent of agents) {
            try {
                await agent.initialize();
                await this.teamManager.addAgent(agent);
                console.log(chalk.green(`✅ ${agent.name} (${agent.constructor.name}) 초기화 완료`));
            } catch (error) {
                console.warn(chalk.yellow(`⚠️  ${agent.name} 초기화 실패, 시뮬레이션 모드로 전환: ${error.message}`));
                // API 연결 실패시 기본 TeamMember로 대체
                await this.teamManager.addTeamMember({
                    id: agent.id,
                    name: agent.name,
                    role: agent.role,
                    capabilities: agent.capabilities,
                    color: agent.color,
                    mcpEndpoint: 'simulation://mock'
                });
            }
        }
    }

    /**
     * 시뮬레이션 에이전트 초기화 (기존 방식)
     */
    async initializeSimulationAgents() {
        // 팀장 Claude 설정
        await this.teamManager.addTeamMember({
            id: 'claude_leader',
            name: '팀장',
            role: 'leader',
            capabilities: ['planning', 'coordination', 'quality_assurance'],
            color: 'blue',
            mcpEndpoint: 'simulation://claude-3-5-sonnet'
        });

        // 김선임 Claude 설정
        await this.teamManager.addTeamMember({
            id: 'kim_senior',
            name: '김선임',
            role: 'senior_developer',
            capabilities: ['complex_coding', 'architecture', 'debugging'],
            color: 'cyan',
            mcpEndpoint: 'simulation://claude-3-5-sonnet'
        });

        // 이조사 Gemini 설정
        await this.teamManager.addTeamMember({
            id: 'lee_researcher',
            name: '이조사',
            role: 'researcher',
            capabilities: ['data_collection', 'analysis', 'documentation'],
            color: 'green',
            mcpEndpoint: 'simulation://gemini-1.5-flash'
        });

        // 박개발 Gemini 설정
        await this.teamManager.addTeamMember({
            id: 'park_developer',
            name: '박개발',
            role: 'developer',
            capabilities: ['coding', 'testing', 'maintenance'],
            color: 'yellow',
            mcpEndpoint: 'simulation://gemini-1.5-flash'
        });
    }

    /**
     * 프로젝트 실행
     * @param {string} projectDescription - 프로젝트 설명
     */
    async executeProject(projectDescription) {
        await this.initializeTeam();
        
        console.log(chalk.bold.magenta('🚀 프로젝트 시작'));
        console.log(chalk.cyan(`📋 프로젝트: ${projectDescription}`));
        
        try {
            // 1. 팀장이 프로젝트 분석 및 계획 수립
            const plan = await this.workflowEngine.createExecutionPlan(
                'claude_leader',
                projectDescription
            );

            // 2. 태스크 분배 및 병렬 실행
            const tasks = await this.workflowEngine.distributeTasks(plan);
            
            // 3. 실시간 진행 상황 모니터링
            this.startProgressMonitoring();
            
            // 4. 태스크 실행
            const results = await Promise.allSettled(
                tasks.map(task => this.executeTask(task))
            );

            // 5. 결과 통합 및 품질 검증
            const finalResult = await this.workflowEngine.integrateResults(
                'claude_leader',
                results
            );

            console.log(chalk.bold.green('🎉 프로젝트 완료!'));
            return finalResult;
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 프로젝트 실행 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 개별 태스크 실행
     * @param {Object} task - 실행할 태스크
     */
    async executeTask(task) {
        const agent = this.teamManager.getAgent(task.assignee);
        
        this.logVisualizer.displayRealtimeLog(
            `작업 시작: ${task.description}`,
            task.assignee
        );

        try {
            // MCP 도구 할당
            await this.toolManager.assignToolToAgent(
                task.assignee,
                task.type
            );

            // 작업 실행
            const result = await agent.executeTask(task);

            this.logVisualizer.displayRealtimeLog(
                `작업 완료: ${task.description}`,
                task.assignee
            );

            return result;
            
        } catch (error) {
            this.logVisualizer.displayRealtimeLog(
                `작업 실패: ${task.description} - ${error.message}`,
                task.assignee
            );
            throw error;
        }
    }

    /**
     * 진행 상황 모니터링 시작
     */
    startProgressMonitoring() {
        const intervalId = setInterval(() => {
            const teamStatus = this.teamManager.getTeamStatusDetailed();
            // 로그로 상태 출력 (LogVisualizer에 displayTeamStatus 메서드가 없으므로)
            this.logVisualizer.info('system', `팀 상태: ${teamStatus.activeMembers}/${teamStatus.totalMembers} 활성`, teamStatus);
        }, 5000);

        // 정리 함수 등록
        process.on('SIGINT', () => {
            clearInterval(intervalId);
            console.log(chalk.yellow('\n👋 시스템 종료 중...'));
            process.exit(0);
        });
    }

    /**
     * 시스템 상태 확인
     */
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            teamSize: this.teamManager.getTeamSize(),
            activeTasks: this.workflowEngine.getActiveTasks(),
            systemHealth: 'healthy'
        };
    }
}

// 메인 실행 함수
async function main() {
    const teamSystem = new ClaudeGeminiTeamSystem();
    
    try {
        await teamSystem.initializeTeam();
        
        // 예제 프로젝트 실행
        const projectDescription = process.argv[2] || 'AI 기반 웹 애플리케이션 개발';
        await teamSystem.executeProject(projectDescription);
        
    } catch (error) {
        console.error(chalk.bold.red('시스템 오류:'), error.message);
        process.exit(1);
    }
}

// 모듈로 사용될 때와 직접 실행될 때 구분
if (require.main === module) {
    main();
}

module.exports = { ClaudeGeminiTeamSystem };