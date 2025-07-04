#!/usr/bin/env node

import { program } from 'commander';
import { ClaudeGeminiTeamSystem } from './index.js';
import { Dashboard } from './visualization/dashboard.js';
import { WebDashboardBridge } from './visualization/web-dashboard-bridge.js';
import chalk from 'chalk';

// CLI 버전 정보
program
    .version('1.0.0')
    .description('Claude-Gemini 팀 협업 시스템 CLI');

// 프로젝트 시작 명령
program
    .command('start')
    .description('프로젝트 시작')
    .argument('<project>', '프로젝트 설명')
    .option('-v, --verbose', '상세 로그 출력')
    .action(async (project, options) => {
        console.log(chalk.bold.blue('🚀 Claude-Gemini 팀 시스템 시작'));
        
        try {
            const teamSystem = new ClaudeGeminiTeamSystem();
            
            if (options.verbose) {
                console.log(chalk.gray('상세 로그 모드 활성화'));
            }
            
            await teamSystem.executeProject(project);
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 실행 실패:'), error.message);
            process.exit(1);
        }
    });

// 팀원 추가 명령
program
    .command('add-member')
    .description('팀원 추가')
    .requiredOption('-n, --name <name>', '팀원 이름')
    .requiredOption('-r, --role <role>', '역할 (leader, senior_developer, researcher, developer)')
    .requiredOption('-e, --endpoint <endpoint>', 'MCP 엔드포인트')
    .option('-c, --capabilities <capabilities>', '능력 목록 (쉼표로 구분)', 'coding,testing')
    .option('--color <color>', '터미널 색상', 'white')
    .action(async (options) => {
        console.log(chalk.bold.blue('👥 새 팀원 추가 중...'));
        
        try {
            const teamSystem = new ClaudeGeminiTeamSystem();
            await teamSystem.initializeTeam();
            
            const memberConfig = {
                id: options.name.toLowerCase().replace(/\s+/g, '_'),
                name: options.name,
                role: options.role,
                capabilities: options.capabilities.split(',').map(c => c.trim()),
                color: options.color,
                mcpEndpoint: options.endpoint
            };
            
            await teamSystem.teamManager.addTeamMember(memberConfig);
            
            console.log(chalk.bold.green(`✅ ${options.name} 팀원이 추가되었습니다.`));
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 팀원 추가 실패:'), error.message);
            process.exit(1);
        }
    });

// 실시간 모니터링 명령 (새로운 대시보드 사용)
program
    .command('monitor')
    .description('실시간 팀 상태 모니터링 (개선된 대시보드)')
    .option('-m, --mode <mode>', '표시 모드 (logs|progress|combined)', 'combined')
    .option('-i, --interval <ms>', '업데이트 간격 (밀리초)', '2000')
    .action(async (options) => {
        console.log(chalk.bold.blue('📊 고급 대시보드 시작 중...'));
        
        try {
            const dashboard = new Dashboard({
                mode: options.mode,
                refreshInterval: parseInt(options.interval),
                enableKeyboard: true,
                logs: { logLevel: 'info' },
                progress: { showETA: true }
            });
            
            // 팀 시스템 초기화
            const teamSystem = new ClaudeGeminiTeamSystem();
            await teamSystem.initializeTeam();
            
            // 대시보드에 팀원 등록
            const teamMembers = teamSystem.teamManager.getTeamMembers();
            teamMembers.forEach(member => {
                dashboard.addAgent(member.id, member.name, member.role);
            });
            
            // 대시보드 시작
            dashboard.start();
            
            // 시스템 이벤트 연결
            dashboard.systemStarted();
            
            // 정리 함수
            process.on('SIGINT', () => {
                dashboard.systemStopped();
                dashboard.stop();
                console.log(chalk.yellow('\n👋 대시보드 종료'));
                process.exit(0);
            });
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 대시보드 시작 실패:'), error.message);
            process.exit(1);
        }
    });

// 레거시 모니터링 명령 (간단한 버전)
program
    .command('monitor-simple')
    .description('간단한 실시간 팀 상태 모니터링')
    .option('-i, --interval <seconds>', '업데이트 간격 (초)', '5')
    .action(async (options) => {
        console.log(chalk.bold.blue('📊 간단 모니터링 시작'));
        console.log(chalk.gray('Ctrl+C로 종료할 수 있습니다.'));
        
        try {
            const teamSystem = new ClaudeGeminiTeamSystem();
            await teamSystem.initializeTeam();
            
            const interval = parseInt(options.interval) * 1000;
            
            const monitoringId = setInterval(() => {
                const status = teamSystem.getSystemStatus();
                
                console.clear();
                console.log(chalk.bold.magenta('='.repeat(60)));
                console.log(chalk.bold.magenta('         Claude-Gemini 팀 협업 시스템 상태'));
                console.log(chalk.bold.magenta('='.repeat(60)));
                
                console.log(chalk.cyan(`🏆 시스템 상태: ${status.systemHealth}`));
                console.log(chalk.cyan(`👥 팀 크기: ${status.teamSize}명`));
                console.log(chalk.cyan(`📋 활성 태스크: ${status.activeTasks}개`));
                console.log(chalk.cyan(`⏰ 마지막 업데이트: ${new Date().toLocaleTimeString()}`));
                
                console.log(chalk.bold.magenta('='.repeat(60)));
                
            }, interval);
            
            // 정리 함수
            process.on('SIGINT', () => {
                clearInterval(monitoringId);
                console.log(chalk.yellow('\n👋 모니터링 종료'));
                process.exit(0);
            });
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 모니터링 시작 실패:'), error.message);
            process.exit(1);
        }
    });

// 팀 상태 확인 명령
program
    .command('status')
    .description('현재 팀 상태 확인')
    .action(async () => {
        try {
            const teamSystem = new ClaudeGeminiTeamSystem();
            await teamSystem.initializeTeam();
            
            const status = teamSystem.getSystemStatus();
            
            console.log(chalk.bold.blue('📊 시스템 상태'));
            console.log('='.repeat(40));
            console.log(`초기화 상태: ${status.initialized ? '✅' : '❌'}`);
            console.log(`팀 크기: ${status.teamSize}명`);
            console.log(`활성 태스크: ${status.activeTasks}개`);
            console.log(`시스템 건강도: ${status.systemHealth}`);
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 상태 확인 실패:'), error.message);
            process.exit(1);
        }
    });

// 대시보드 전용 명령
program
    .command('dashboard')
    .description('고급 대시보드 시작 (키보드 컨트롤 포함)')
    .option('-m, --mode <mode>', '표시 모드: logs, progress, combined', 'combined')
    .option('--logs-level <level>', '로그 레벨: error, warn, info, debug, trace', 'info')
    .option('--no-keyboard', '키보드 컨트롤 비활성화')
    .action(async (options) => {
        console.log(chalk.bold.cyan('🚀 대시보드 시작 중...'));
        
        try {
            const dashboard = new Dashboard({
                mode: options.mode,
                refreshInterval: 2000,
                enableKeyboard: options.keyboard,
                logs: { 
                    logLevel: options.logsLevel,
                    showAgentIcons: true,
                    enableColors: true 
                },
                progress: { 
                    showETA: true,
                    showPercentage: true,
                    enableAnimations: true 
                }
            });
            
            console.log(chalk.gray('대시보드 설정 완료. 시작합니다...'));
            
            // 샘플 데이터로 시작 (실제로는 팀 시스템과 연결)
            dashboard.addAgent('claude_leader', 'Team Leader', 'leader');
            dashboard.addAgent('claude_senior', 'Senior Developer', 'senior_developer');
            dashboard.addAgent('gemini_researcher', 'Researcher', 'researcher');
            dashboard.addAgent('gemini_developer', 'Developer', 'developer');
            
            dashboard.addWorkflow('demo_workflow', 'Demo Project', 10);
            
            dashboard.start();
            dashboard.systemStarted();
            
            // 샘플 활동 시뮬레이션
            setTimeout(() => {
                dashboard.onTaskStarted('claude_leader', 'task_001', 'Project Planning');
                dashboard.onTaskStarted('gemini_researcher', 'task_002', 'Market Research');
            }, 3000);
            
            setTimeout(() => {
                dashboard.onTaskCompleted('claude_leader', 'task_001', 'Project Planning', 5000);
                dashboard.onTaskStarted('claude_senior', 'task_003', 'Architecture Design');
            }, 8000);
            
            // 정리 함수
            process.on('SIGINT', () => {
                dashboard.systemStopped();
                dashboard.stop();
                console.log(chalk.yellow('\n👋 대시보드 종료'));
                process.exit(0);
            });
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 대시보드 시작 실패:'), error.message);
            process.exit(1);
        }
    });

// 웹 대시보드 명령
program
    .command('web-dashboard')
    .description('웹 기반 실시간 대시보드 시작')
    .option('-p, --port <port>', '웹 서버 포트', '8080')
    .option('-h, --host <host>', '웹 서버 호스트', 'localhost')
    .option('--no-cli', 'CLI 대시보드 비활성화')
    .option('--web-only', '웹 대시보드만 실행')
    .action(async (options) => {
        console.log(chalk.bold.cyan('🌐 웹 대시보드 시작 중...'));
        
        try {
            const bridgeConfig = {
                webPort: parseInt(options.port),
                webHost: options.host,
                enableWebDashboard: true,
                enableCLIDashboard: !options.webOnly && options.cli,
                syncMode: options.webOnly ? 'web-only' : 'bidirectional'
            };

            const bridge = new WebDashboardBridge(bridgeConfig);
            
            // 샘플 팀 데이터로 시작
            bridge.addAgent('claude_leader', 'Team Leader', 'leader', ['strategic_planning', 'task_decomposition']);
            bridge.addAgent('claude_senior', 'Senior Developer', 'senior_developer', ['architecture_design', 'complex_coding']);
            bridge.addAgent('gemini_researcher', 'Researcher', 'researcher', ['data_collection', 'analysis']);
            bridge.addAgent('gemini_developer', 'Developer', 'developer', ['general_coding', 'testing']);

            await bridge.start();
            bridge.systemStarted();

            // 샘플 워크플로우 추가
            bridge.addWorkflow('demo_workflow', 'Demo E-commerce Project', 12);
            
            // 샘플 활동 시뮬레이션
            setTimeout(() => {
                bridge.onTaskStarted('claude_leader', 'task_001', 'Project Planning & Architecture');
                bridge.info('claude_leader', '📋 Starting project analysis and task decomposition');
            }, 2000);

            setTimeout(() => {
                bridge.onTaskStarted('gemini_researcher', 'task_002', 'Market Research & Analysis');
                bridge.info('gemini_researcher', '🔍 Gathering market data and competitor analysis');
            }, 4000);

            setTimeout(() => {
                bridge.onTaskCompleted('claude_leader', 'task_001', 'Project Planning & Architecture', 6000);
                bridge.onTaskStarted('claude_senior', 'task_003', 'System Architecture Design');
                bridge.info('claude_senior', '🏗️ Designing system architecture and database schema');
            }, 8000);

            setTimeout(() => {
                bridge.onTaskStarted('gemini_developer', 'task_004', 'Frontend Components Development');
                bridge.info('gemini_developer', '💻 Building React components and user interface');
            }, 10000);

            setTimeout(() => {
                bridge.onTaskCompleted('gemini_researcher', 'task_002', 'Market Research & Analysis', 8000);
                bridge.info('gemini_researcher', '📊 Market research completed - 15 competitors analyzed');
                bridge.onPerformanceMetric('gemini_researcher', 'research_items', 15, ' items');
            }, 12000);

            console.log(chalk.green(`\n🌟 웹 대시보드가 실행 중입니다!`));
            console.log(chalk.cyan(`   URL: http://${options.host}:${options.port}`));
            console.log(chalk.gray(`   브라우저에서 위 URL을 열어 실시간 모니터링을 확인하세요.`));
            
            if (!options.webOnly && options.cli) {
                console.log(chalk.yellow(`\n🎮 키보드 컨트롤:`));
                console.log(chalk.gray(`   [1] 로그뷰 [2] 진행뷰 [3] 통합뷰 [h] 도움말 [q] 종료`));
            }

            // 정리 함수
            process.on('SIGINT', async () => {
                console.log(chalk.yellow('\n🛑 대시보드 종료 중...'));
                bridge.systemStopped();
                await bridge.stop();
                console.log(chalk.yellow('👋 웹 대시보드 종료 완료'));
                process.exit(0);
            });
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 웹 대시보드 시작 실패:'), error.message);
            process.exit(1);
        }
    });

// 통합 대시보드 명령 (CLI + Web)
program
    .command('full-dashboard')
    .description('CLI와 웹 대시보드를 동시에 실행')
    .option('-p, --port <port>', '웹 서버 포트', '8080')
    .option('-m, --mode <mode>', 'CLI 표시 모드 (logs|progress|combined)', 'combined')
    .action(async (options) => {
        console.log(chalk.bold.magenta('🚀 통합 대시보드 시작 중...'));
        
        try {
            const bridge = new WebDashboardBridge({
                webPort: parseInt(options.port),
                enableWebDashboard: true,
                enableCLIDashboard: true,
                syncMode: 'bidirectional'
            });

            // 팀 시스템과 연결 (실제 구현에서는 팀 시스템 초기화)
            bridge.addAgent('claude_leader', 'Team Leader', 'leader');
            bridge.addAgent('claude_senior', 'Senior Developer', 'senior_developer');  
            bridge.addAgent('gemini_researcher', 'Researcher', 'researcher');
            bridge.addAgent('gemini_developer', 'Developer', 'developer');

            await bridge.start();
            bridge.systemStarted();

            console.log(chalk.green(`\n✨ 통합 대시보드 실행 완료!`));
            console.log(chalk.cyan(`   🌐 웹: http://localhost:${options.port}`));
            console.log(chalk.cyan(`   🖥️  CLI: 현재 터미널`));
            console.log(chalk.gray(`\n   두 인터페이스가 실시간으로 동기화됩니다.`));

            // 정리 함수
            process.on('SIGINT', async () => {
                console.log(chalk.yellow('\n🛑 통합 대시보드 종료 중...'));
                bridge.systemStopped();
                await bridge.stop();
                console.log(chalk.yellow('👋 통합 대시보드 종료 완료'));
                process.exit(0);
            });
            
        } catch (error) {
            console.error(chalk.bold.red('❌ 통합 대시보드 시작 실패:'), error.message);
            process.exit(1);
        }
    });

// 설정 표시 명령
program
    .command('config')
    .description('현재 설정 표시')
    .action(() => {
        console.log(chalk.bold.blue('⚙️  시스템 설정'));
        console.log('='.repeat(40));
        
        const config = {
            nodeVersion: process.version,
            platform: process.platform,
            arch: process.arch,
            cwd: process.cwd(),
            env: process.env.NODE_ENV || 'development'
        };
        
        Object.entries(config).forEach(([key, value]) => {
            console.log(`${key}: ${value}`);
        });
    });

// 도움말 개선
program.on('--help', () => {
    console.log('');
    console.log(chalk.bold.blue('사용 예시:'));
    console.log('');
    console.log(chalk.gray('  # 프로젝트 시작'));
    console.log('  $ npm start "웹 애플리케이션 개발"');
    console.log('');
    console.log(chalk.gray('  # 고급 대시보드 (추천)'));
    console.log('  $ npm run dashboard');
    console.log('  $ npm run dashboard -- --mode progress');
    console.log('  $ npm run dashboard -- --logs-level debug');
    console.log('');
    console.log(chalk.gray('  # 실시간 모니터링'));
    console.log('  $ npm run monitor');
    console.log('  $ npm run monitor-simple');
    console.log('');
    console.log(chalk.gray('  # 새 팀원 추가'));
    console.log('  $ npm run add-member -- -n "신입개발자" -r developer -e "gemini://endpoint"');
    console.log('');
    console.log(chalk.yellow.bold('새로운 기능:'));
    console.log(chalk.cyan('  🎯 대시보드 - 색상별 에이전트 구분, 진행 상황 바, 실시간 로그'));
    console.log(chalk.cyan('  🎮 키보드 컨트롤 - [1] 로그 [2] 진행상황 [3] 통합뷰 [h] 도움말'));
    console.log(chalk.cyan('  📊 진행률 시각화 - 워크플로우별 진행상황, 팀원별 작업량'));
    console.log('');
});

// 에러 처리
program.on('command:*', () => {
    console.error(chalk.red('❌ 알 수 없는 명령어입니다.'));
    console.log(chalk.gray('사용 가능한 명령어를 보려면 --help를 사용하세요.'));
    process.exit(1);
});

// CLI 파싱 및 실행
program.parse(process.argv);

// 명령어가 없을 때 도움말 표시
if (!process.argv.slice(2).length) {
    program.outputHelp();
}