#!/usr/bin/env node

const { TeamManager } = require('./core/team-manager');
const { TeamLogVisualizer } = require('./visualization/log-visualizer');
const { WorkflowEngine } = require('./core/workflow-engine');
const { MCPToolOrchestrator } = require('./tools/mcp-orchestrator');
const chalk = require('chalk');

/**
 * Claude-Gemini 팀 협업 시스템 메인 클래스
 */
class ClaudeGeminiTeamSystem {
    constructor() {
        this.teamManager = new TeamManager();
        this.logVisualizer = new TeamLogVisualizer();
        this.workflowEngine = new WorkflowEngine();
        this.toolOrchestrator = new MCPToolOrchestrator();
        
        this.isInitialized = false;
    }

    /**
     * 팀 초기화 - 4명의 기본 팀원 설정
     */
    async initializeTeam() {
        if (this.isInitialized) {
            return;
        }

        console.log(chalk.bold.magenta('🚀 Claude-Gemini 팀 협업 시스템 초기화 중...'));
        
        try {
            // 팀장 Claude 설정
            await this.teamManager.addTeamMember({
                id: 'claude_leader',
                name: '팀장',
                role: 'leader',
                capabilities: ['planning', 'coordination', 'quality_assurance'],
                color: 'blue',
                mcpEndpoint: 'claude://claude-3-5-sonnet'
            });

            // 김선임 Claude 설정
            await this.teamManager.addTeamMember({
                id: 'kim_senior',
                name: '김선임',
                role: 'senior_developer',
                capabilities: ['complex_coding', 'architecture', 'debugging'],
                color: 'cyan',
                mcpEndpoint: 'claude://claude-3-5-sonnet'
            });

            // 이조사 Gemini 설정
            await this.teamManager.addTeamMember({
                id: 'lee_researcher',
                name: '이조사',
                role: 'researcher',
                capabilities: ['data_collection', 'analysis', 'documentation'],
                color: 'green',
                mcpEndpoint: 'file:///mnt/c/Project/llm_mcp/gemini-cli-mcp'
            });

            // 박개발 Gemini 설정
            await this.teamManager.addTeamMember({
                id: 'park_developer',
                name: '박개발',
                role: 'developer',
                capabilities: ['coding', 'testing', 'maintenance'],
                color: 'yellow',
                mcpEndpoint: 'file:///mnt/c/Project/llm_mcp/gemini-cli-mcp'
            });

            this.isInitialized = true;
            console.log(chalk.bold.green('✅ 팀 초기화 완료'));
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 팀 초기화 실패:'), error.message);
            throw error;
        }
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
            await this.toolOrchestrator.assignToolToAgent(
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
            const teamStatus = this.teamManager.getTeamStatus();
            this.logVisualizer.displayTeamStatus(teamStatus);
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