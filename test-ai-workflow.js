#!/usr/bin/env node

/**
 * AI 기반 워크플로우 시스템 테스트 스크립트
 */

const { WorkflowEngine } = require('./src/core/workflow-engine');
const { ProjectAnalyzer } = require('./src/core/project-analyzer');
const chalk = require('chalk');

async function testAIWorkflow() {
    console.log(chalk.bold.magenta('🧪 AI 기반 워크플로우 시스템 테스트'));
    console.log(chalk.dim('='.repeat(60)));

    try {
        // 워크플로우 엔진 초기화
        const workflowEngine = new WorkflowEngine();
        await workflowEngine.initialize();

        // 테스트 프로젝트 시나리오들
        const testProjects = [
            {
                name: '간단한 웹 앱',
                description: '간단한 투두 리스트 웹 애플리케이션 개발'
            },
            {
                name: '복잡한 이커머스',
                description: '대규모 이커머스 플랫폼 개발 - 마이크로서비스 아키텍처, 결제 시스템, 재고 관리, 분산 데이터베이스'
            },
            {
                name: '데이터 분석 프로젝트',
                description: '고객 구매 패턴 분석 및 추천 시스템을 위한 머신러닝 모델 개발'
            }
        ];

        for (const project of testProjects) {
            console.log(chalk.blue(`\n🚀 테스트: ${project.name}`));
            console.log(chalk.cyan(`📋 설명: ${project.description}`));
            console.log(chalk.dim('-'.repeat(50)));

            // AI 기반 실행 계획 생성
            const plan = await workflowEngine.createExecutionPlan('test_leader', project.description);

            // 태스크 분배
            const tasks = await workflowEngine.distributeTasks(plan);

            // 결과 요약
            console.log(chalk.green(`\n✅ 분석 완료: ${plan.analysisSource}`));
            console.log(chalk.cyan(`   📊 프로젝트 유형: ${plan.projectType}`));
            console.log(chalk.cyan(`   ⚡ 복잡도: ${plan.complexity}`));
            console.log(chalk.cyan(`   ⏱️  예상 기간: ${plan.estimatedDurationDays}일`));
            console.log(chalk.cyan(`   🔧 핵심 기술: ${plan.keyTechnologies.join(', ')}`));
            console.log(chalk.cyan(`   📋 태스크 수: ${tasks.length}개`));

            if (plan.risks && plan.risks.length > 0) {
                console.log(chalk.yellow(`   ⚠️  주요 위험: ${plan.risks.slice(0, 2).join(', ')}`));
            }

            // 태스크 세부 정보
            console.log(chalk.blue('\n📋 생성된 태스크:'));
            tasks.forEach((task, index) => {
                const hours = Math.round(task.estimatedTime / 3600000);
                console.log(chalk.green(`   ${index + 1}. ${task.description} (${hours}시간, ${task.metadata.preferredRole})`));
            });

            console.log(chalk.dim('\n' + '='.repeat(60)));
        }

        // 정리
        await workflowEngine.shutdown();
        console.log(chalk.bold.green('\n🎉 모든 테스트 완료!'));

    } catch (error) {
        console.error(chalk.bold.red('❌ 테스트 실패:'), error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// 스크립트 실행
if (require.main === module) {
    testAIWorkflow();
}

module.exports = { testAIWorkflow };