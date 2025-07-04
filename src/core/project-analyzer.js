/**
 * 프로젝트 분석기 - AI를 활용한 지능적인 프로젝트 분석 및 태스크 생성
 */

const { ClaudeAgent } = require('../agents/claude-agent');
const chalk = require('chalk');

class ProjectAnalyzer {
    constructor() {
        this.projectTemplates = {
            'web_application': {
                phases: ['requirements_analysis', 'ui_design', 'backend_development', 'frontend_development', 'integration', 'testing', 'deployment'],
                complexity: 'medium',
                technologies: ['html', 'css', 'javascript', 'nodejs', 'database']
            },
            'mobile_app': {
                phases: ['requirements_analysis', 'ui_ux_design', 'development', 'testing', 'deployment'],
                complexity: 'high',
                technologies: ['react_native', 'flutter', 'swift', 'kotlin']
            },
            'api_service': {
                phases: ['api_design', 'backend_development', 'database_design', 'testing', 'documentation', 'deployment'],
                complexity: 'medium',
                technologies: ['nodejs', 'python', 'database', 'rest_api']
            },
            'data_analysis': {
                phases: ['data_collection', 'data_cleaning', 'analysis', 'visualization', 'reporting'],
                complexity: 'medium',
                technologies: ['python', 'pandas', 'numpy', 'matplotlib']
            },
            'machine_learning': {
                phases: ['data_preparation', 'model_design', 'training', 'validation', 'deployment'],
                complexity: 'high',
                technologies: ['python', 'tensorflow', 'pytorch', 'scikit_learn']
            }
        };

        this.taskTemplates = {
            'requirements_analysis': {
                description: '프로젝트 요구사항 분석 및 명세 작성',
                role: 'leader',
                estimatedHours: 4,
                deliverables: ['requirements_document', 'user_stories', 'acceptance_criteria']
            },
            'ui_design': {
                description: 'UI/UX 디자인 및 와이어프레임 제작',
                role: 'researcher',
                estimatedHours: 8,
                deliverables: ['wireframes', 'mockups', 'design_system']
            },
            'backend_development': {
                description: '백엔드 API 및 서버 로직 개발',
                role: 'senior_developer',
                estimatedHours: 16,
                deliverables: ['api_endpoints', 'database_schema', 'server_code']
            },
            'frontend_development': {
                description: '프론트엔드 UI 구현 및 인터랙션 개발',
                role: 'developer',
                estimatedHours: 12,
                deliverables: ['ui_components', 'pages', 'styling']
            },
            'integration': {
                description: '프론트엔드와 백엔드 통합 및 연동',
                role: 'senior_developer',
                estimatedHours: 6,
                deliverables: ['integrated_application', 'api_integration']
            },
            'testing': {
                description: '단위 테스트, 통합 테스트 및 QA',
                role: 'developer',
                estimatedHours: 8,
                deliverables: ['test_cases', 'test_reports', 'bug_fixes']
            },
            'deployment': {
                description: '프로덕션 배포 및 설정',
                role: 'senior_developer',
                estimatedHours: 4,
                deliverables: ['deployment_scripts', 'production_setup', 'monitoring']
            },
            'data_collection': {
                description: '데이터 수집 및 소스 식별',
                role: 'researcher',
                estimatedHours: 6,
                deliverables: ['data_sources', 'collection_scripts', 'raw_data']
            },
            'data_cleaning': {
                description: '데이터 정제 및 전처리',
                role: 'researcher',
                estimatedHours: 8,
                deliverables: ['cleaned_data', 'preprocessing_scripts', 'data_quality_report']
            },
            'analysis': {
                description: '데이터 분석 및 인사이트 도출',
                role: 'researcher',
                estimatedHours: 12,
                deliverables: ['analysis_results', 'statistical_reports', 'insights']
            },
            'visualization': {
                description: '데이터 시각화 및 대시보드 제작',
                role: 'developer',
                estimatedHours: 6,
                deliverables: ['charts', 'dashboard', 'interactive_visualizations']
            },
            'reporting': {
                description: '최종 보고서 및 프레젠테이션 제작',
                role: 'researcher',
                estimatedHours: 4,
                deliverables: ['final_report', 'presentation', 'executive_summary']
            }
        };
    }

    /**
     * 프로젝트 유형 자동 감지
     * @param {string} description - 프로젝트 설명
     * @returns {string} 감지된 프로젝트 유형
     */
    detectProjectType(description) {
        const keywords = {
            'web_application': ['웹', 'web', '사이트', 'website', 'html', 'css', 'javascript', '웹앱', 'webapp'],
            'mobile_app': ['모바일', 'mobile', 'app', '앱', 'android', 'ios', '휴대폰', 'smartphone'],
            'api_service': ['api', 'rest', 'service', '서비스', 'backend', '백엔드', 'server', '서버'],
            'data_analysis': ['데이터', 'data', '분석', 'analysis', '통계', 'statistics', '리포트', 'report'],
            'machine_learning': ['머신러닝', 'machine learning', 'ml', 'ai', '인공지능', '모델', 'model', '학습', 'training']
        };

        const lowerDesc = description.toLowerCase();
        let maxScore = 0;
        let detectedType = 'web_application'; // 기본값

        for (const [type, keywordList] of Object.entries(keywords)) {
            const score = keywordList.reduce((count, keyword) => {
                return count + (lowerDesc.includes(keyword.toLowerCase()) ? 1 : 0);
            }, 0);

            if (score > maxScore) {
                maxScore = score;
                detectedType = type;
            }
        }

        return detectedType;
    }

    /**
     * 프로젝트 복잡도 분석
     * @param {string} description - 프로젝트 설명
     * @returns {string} 복잡도 (low, medium, high)
     */
    analyzeComplexity(description) {
        const complexityIndicators = {
            high: ['복잡한', 'complex', '대규모', 'large scale', '엔터프라이즈', 'enterprise', '마이크로서비스', 'microservice', '분산', 'distributed'],
            medium: ['일반적인', 'standard', '중간', 'medium', '표준', 'typical'],
            low: ['간단한', 'simple', '기본', 'basic', '프로토타입', 'prototype', '최소', 'minimal']
        };

        const lowerDesc = description.toLowerCase();
        
        for (const [complexity, indicators] of Object.entries(complexityIndicators)) {
            if (indicators.some(indicator => lowerDesc.includes(indicator))) {
                return complexity;
            }
        }

        // 기본적으로 단어 수로 복잡도 추정
        const wordCount = description.split(' ').length;
        if (wordCount > 20) return 'high';
        if (wordCount > 10) return 'medium';
        return 'low';
    }

    /**
     * AI 기반 상세 프로젝트 분석
     * @param {string} description - 프로젝트 설명
     * @returns {Promise<Object>} 상세 분석 결과
     */
    async analyzeWithAI(description) {
        try {
            // 분석용 Claude 에이전트 생성
            const analyzer = new ClaudeAgent({
                id: 'project_analyzer',
                name: '프로젝트 분석기',
                role: 'analyst',
                useLocalCLI: true,
                cliPath: process.env.CLAUDE_CLI_PATH || 'claude',
                model: 'claude-sonnet-4'
            });

            await analyzer.initialize();

            const analysisPrompt = `
당신은 소프트웨어 프로젝트 분석 전문가입니다. 다음 프로젝트를 분석하고 상세한 실행 계획을 제공해주세요.

프로젝트 설명: "${description}"

다음 형식으로 JSON 응답을 제공해주세요:

{
    "project_type": "프로젝트 유형 (web_application, mobile_app, api_service, data_analysis, machine_learning 중 하나)",
    "complexity": "복잡도 (low, medium, high 중 하나)",
    "estimated_duration_days": "예상 소요 일수 (숫자)",
    "key_technologies": ["주요 기술 스택들"],
    "phases": [
        {
            "name": "단계명",
            "description": "단계 설명",
            "estimated_hours": "예상 소요 시간(시간)",
            "role": "담당 역할 (leader, senior_developer, researcher, developer 중 하나)",
            "deliverables": ["산출물1", "산출물2"]
        }
    ],
    "risks": ["위험 요소들"],
    "recommendations": ["권장사항들"]
}

현실적이고 실행 가능한 계획을 수립해주세요.
`;

            const result = await analyzer.executeTask({
                id: 'analysis_task',
                type: 'planning',
                description: 'Analyze project and create execution plan',
                data: { prompt: analysisPrompt }
            });

            if (result.success && result.data) {
                return this.parseAIAnalysis(result.data);
            } else {
                console.warn(chalk.yellow('⚠️  AI 분석 실패, 기본 분석으로 대체'));
                return this.createBasicAnalysis(description);
            }

        } catch (error) {
            console.warn(chalk.yellow('⚠️  AI 분석 오류, 기본 분석으로 대체:'), error.message);
            return this.createBasicAnalysis(description);
        }
    }

    /**
     * AI 분석 결과 파싱
     * @param {Object} aiResult - AI 분석 결과
     * @returns {Object} 파싱된 분석 결과
     */
    parseAIAnalysis(aiResult) {
        try {
            // AI 응답에서 JSON 부분 추출 시도
            let analysisData;
            
            if (typeof aiResult.result === 'string') {
                // JSON 문자열 파싱 시도
                const jsonMatch = aiResult.result.match(/\{[\s\S]*\}/);
                if (jsonMatch) {
                    analysisData = JSON.parse(jsonMatch[0]);
                } else {
                    throw new Error('JSON not found in AI response');
                }
            } else if (typeof aiResult.result === 'object') {
                analysisData = aiResult.result;
            } else {
                throw new Error('Invalid AI response format');
            }

            // 필수 필드 검증 및 기본값 설정
            return {
                project_type: analysisData.project_type || 'web_application',
                complexity: analysisData.complexity || 'medium',
                estimated_duration_days: analysisData.estimated_duration_days || 14,
                key_technologies: analysisData.key_technologies || ['javascript', 'html', 'css'],
                phases: this.validatePhases(analysisData.phases),
                risks: analysisData.risks || ['기술적 복잡성', '일정 지연 가능성'],
                recommendations: analysisData.recommendations || ['점진적 개발', '정기적 리뷰'],
                source: 'ai_analysis'
            };

        } catch (error) {
            console.warn(chalk.yellow('⚠️  AI 분석 결과 파싱 실패, 기본 분석 사용:'), error.message);
            return this.createBasicAnalysis();
        }
    }

    /**
     * 단계 정보 검증
     * @param {Array} phases - AI가 생성한 단계들
     * @returns {Array} 검증된 단계들
     */
    validatePhases(phases) {
        if (!Array.isArray(phases) || phases.length === 0) {
            return this.getDefaultPhases('web_application');
        }

        return phases.map(phase => ({
            name: phase.name || 'unknown_phase',
            description: phase.description || '단계 설명',
            estimated_hours: Math.max(1, parseInt(phase.estimated_hours) || 4),
            role: this.validateRole(phase.role),
            deliverables: Array.isArray(phase.deliverables) ? phase.deliverables : ['산출물']
        }));
    }

    /**
     * 역할 검증
     * @param {string} role - 역할
     * @returns {string} 유효한 역할
     */
    validateRole(role) {
        const validRoles = ['leader', 'senior_developer', 'researcher', 'developer'];
        return validRoles.includes(role) ? role : 'developer';
    }

    /**
     * 기본 분석 생성 (AI 분석 실패 시 폴백)
     * @param {string} description - 프로젝트 설명
     * @returns {Object} 기본 분석 결과
     */
    createBasicAnalysis(description = '') {
        const projectType = this.detectProjectType(description);
        const complexity = this.analyzeComplexity(description);
        const template = this.projectTemplates[projectType];

        return {
            project_type: projectType,
            complexity: complexity,
            estimated_duration_days: this.estimateDuration(complexity),
            key_technologies: template.technologies,
            phases: this.getDefaultPhases(projectType),
            risks: this.getDefaultRisks(complexity),
            recommendations: this.getDefaultRecommendations(projectType),
            source: 'template_based'
        };
    }

    /**
     * 프로젝트 유형별 기본 단계 반환
     * @param {string} projectType - 프로젝트 유형
     * @returns {Array} 기본 단계들
     */
    getDefaultPhases(projectType) {
        const template = this.projectTemplates[projectType];
        if (!template) return this.getDefaultPhases('web_application');

        return template.phases.map(phaseName => {
            const taskTemplate = this.taskTemplates[phaseName];
            return {
                name: phaseName,
                description: taskTemplate?.description || `${phaseName} 단계`,
                estimated_hours: taskTemplate?.estimatedHours || 4,
                role: taskTemplate?.role || 'developer',
                deliverables: taskTemplate?.deliverables || ['산출물']
            };
        });
    }

    /**
     * 복잡도별 예상 기간 계산
     * @param {string} complexity - 복잡도
     * @returns {number} 예상 일수
     */
    estimateDuration(complexity) {
        const durationMap = {
            'low': 7,
            'medium': 14,
            'high': 28
        };
        return durationMap[complexity] || 14;
    }

    /**
     * 복잡도별 기본 위험 요소
     * @param {string} complexity - 복잡도
     * @returns {Array} 위험 요소들
     */
    getDefaultRisks(complexity) {
        const risks = {
            'low': ['요구사항 변경', '기술적 이슈'],
            'medium': ['일정 지연', '통합 복잡성', '성능 이슈'],
            'high': ['아키텍처 복잡성', '확장성 문제', '팀 커뮤니케이션', '기술 부채']
        };
        return risks[complexity] || risks.medium;
    }

    /**
     * 프로젝트 유형별 기본 권장사항
     * @param {string} projectType - 프로젝트 유형
     * @returns {Array} 권장사항들
     */
    getDefaultRecommendations(projectType) {
        const recommendations = {
            'web_application': ['반응형 디자인 적용', 'SEO 최적화', '성능 모니터링'],
            'mobile_app': ['사용자 경험 우선', '플랫폼별 최적화', '앱스토어 가이드라인 준수'],
            'api_service': ['RESTful 설계', 'API 문서화', '버전 관리'],
            'data_analysis': ['데이터 품질 검증', '시각화 중심', '재현 가능한 분석'],
            'machine_learning': ['데이터 전처리 중요', '모델 성능 검증', 'A/B 테스트']
        };
        return recommendations[projectType] || ['점진적 개발', '정기적 리뷰'];
    }
}

module.exports = { ProjectAnalyzer };