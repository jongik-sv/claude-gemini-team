// 테스트용 데이터 팩토리 함수들

/**
 * 유효한 팀원 설정 생성
 */
function createValidMemberConfig(overrides = {}) {
    return {
        id: 'test_member',
        name: 'Test Member',
        role: 'developer',
        capabilities: ['coding', 'testing'],
        color: 'green',
        mcpEndpoint: 'test://endpoint',
        ...overrides
    };
}

/**
 * 팀장 설정 생성
 */
function createLeaderConfig(overrides = {}) {
    return createValidMemberConfig({
        id: 'test_leader',
        name: 'Test Leader',
        role: 'leader',
        capabilities: ['planning', 'coordination', 'quality_assurance'],
        color: 'blue',
        ...overrides
    });
}

/**
 * 시니어 개발자 설정 생성
 */
function createSeniorDeveloperConfig(overrides = {}) {
    return createValidMemberConfig({
        id: 'test_senior',
        name: 'Test Senior',
        role: 'senior_developer',
        capabilities: ['complex_coding', 'architecture', 'debugging'],
        color: 'cyan',
        ...overrides
    });
}

/**
 * 연구원 설정 생성
 */
function createResearcherConfig(overrides = {}) {
    return createValidMemberConfig({
        id: 'test_researcher',
        name: 'Test Researcher',
        role: 'researcher',
        capabilities: ['data_collection', 'analysis', 'documentation'],
        color: 'yellow',
        ...overrides
    });
}

/**
 * 유효한 태스크 생성
 */
function createValidTask(overrides = {}) {
    return {
        id: 'test_task',
        type: 'coding',
        description: 'Test task description',
        priority: 3,
        complexity: 'medium',
        dependencies: [],
        estimatedTime: 3600000, // 1시간
        metadata: {},
        ...overrides
    };
}

/**
 * 계획 태스크 생성
 */
function createPlanningTask(overrides = {}) {
    return createValidTask({
        id: 'planning_task',
        type: 'planning',
        description: 'Create project plan',
        priority: 5,
        complexity: 'high',
        ...overrides
    });
}

/**
 * 연구 태스크 생성
 */
function createResearchTask(overrides = {}) {
    return createValidTask({
        id: 'research_task',
        type: 'research',
        description: 'Research latest trends',
        priority: 4,
        complexity: 'medium',
        ...overrides
    });
}

/**
 * 복잡한 코딩 태스크 생성
 */
function createComplexCodingTask(overrides = {}) {
    return createValidTask({
        id: 'complex_coding_task',
        type: 'complex_coding',
        description: 'Implement complex algorithm',
        priority: 5,
        complexity: 'high',
        estimatedTime: 7200000, // 2시간
        ...overrides
    });
}

/**
 * 잘못된 팀원 설정들
 */
const invalidMemberConfigs = {
    missingId: {
        name: 'Test Member',
        role: 'developer',
        mcpEndpoint: 'test://endpoint'
    },
    missingName: {
        id: 'test_member',
        role: 'developer',
        mcpEndpoint: 'test://endpoint'
    },
    missingRole: {
        id: 'test_member',
        name: 'Test Member',
        mcpEndpoint: 'test://endpoint'
    },
    missingEndpoint: {
        id: 'test_member',
        name: 'Test Member',
        role: 'developer'
    },
    invalidRole: {
        id: 'test_member',
        name: 'Test Member',
        role: 'invalid_role',
        mcpEndpoint: 'test://endpoint'
    }
};

/**
 * 잘못된 태스크 설정들
 */
const invalidTaskConfigs = {
    missingId: {
        type: 'coding',
        description: 'Test task'
    },
    missingType: {
        id: 'test_task',
        description: 'Test task'
    },
    missingDescription: {
        id: 'test_task',
        type: 'coding'
    },
    invalidPriority: {
        id: 'test_task',
        type: 'coding',
        description: 'Test task',
        priority: 10 // 유효 범위: 1-5
    }
};

/**
 * 모킹된 API 응답 생성
 */
function createMockApiResponse(data, success = true) {
    return {
        success,
        data,
        timestamp: new Date().toISOString(),
        ...(success ? {} : { error: 'Mock error message' })
    };
}

/**
 * 모킹된 파일 시스템 응답 생성
 */
function createMockFileContent(content) {
    return JSON.stringify(content, null, 2);
}

/**
 * 테스트용 성능 메트릭 생성
 */
function createPerformanceMetrics(overrides = {}) {
    return {
        tasksCompleted: 10,
        tasksSucceeded: 9,
        tasksFailed: 1,
        totalExecutionTime: 50000,
        averageExecutionTime: 5000,
        successRate: 90,
        ...overrides
    };
}

/**
 * 테스트용 팀 상태 생성
 */
function createTeamState(memberConfigs = []) {
    const members = {};
    
    memberConfigs.forEach((config, index) => {
        members[config.id] = {
            name: config.name,
            role: config.role,
            status: index === 0 ? 'busy' : 'idle',
            currentTask: index === 0 ? 'test_task' : null,
            workload: index * 20,
            progress: index * 25,
            performance: createPerformanceMetrics(),
            lastHeartbeat: new Date()
        };
    });
    
    return {
        totalMembers: memberConfigs.length,
        activeMembers: memberConfigs.length,
        busyMembers: 1,
        members
    };
}

module.exports = {
    // 팀원 관련
    createValidMemberConfig,
    createLeaderConfig,
    createSeniorDeveloperConfig,
    createResearcherConfig,
    invalidMemberConfigs,
    
    // 태스크 관련
    createValidTask,
    createPlanningTask,
    createResearchTask,
    createComplexCodingTask,
    invalidTaskConfigs,
    
    // 유틸리티
    createMockApiResponse,
    createMockFileContent,
    createPerformanceMetrics,
    createTeamState
};