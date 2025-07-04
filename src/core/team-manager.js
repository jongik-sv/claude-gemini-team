const chalk = require('chalk');
const EventEmitter = require('events');
const fs = require('fs').promises;
const path = require('path');

/**
 * 팀 멤버 정보를 관리하는 클래스
 */
class TeamMember {
    constructor(config) {
        this.id = config.id;
        this.name = config.name;
        this.role = config.role;
        this.capabilities = config.capabilities || [];
        this.color = config.color || 'white';
        this.mcpEndpoint = config.mcpEndpoint;
        this.status = 'idle'; // idle, busy, offline, error
        this.currentTask = null;
        this.workload = 0; // 0-100
        this.lastHeartbeat = new Date();
        this.performance = {
            tasksCompleted: 0,
            totalTime: 0,
            successRate: 100,
            averageTime: 0
        };
        this.createdAt = new Date();
    }

    /**
     * 팀원 상태 업데이트
     */
    updateStatus(status, taskId = null) {
        this.status = status;
        this.currentTask = taskId;
        this.lastHeartbeat = new Date();
    }

    /**
     * 작업 부하 업데이트
     */
    updateWorkload(workload) {
        this.workload = Math.max(0, Math.min(100, workload));
    }

    /**
     * 성능 지표 업데이트
     */
    updatePerformance(taskTime, success = true) {
        this.performance.tasksCompleted++;
        this.performance.totalTime += taskTime;
        this.performance.averageTime = this.performance.totalTime / this.performance.tasksCompleted;
        
        if (success) {
            this.performance.successRate = (this.performance.successRate * (this.performance.tasksCompleted - 1) + 100) / this.performance.tasksCompleted;
        } else {
            this.performance.successRate = (this.performance.successRate * (this.performance.tasksCompleted - 1)) / this.performance.tasksCompleted;
        }
    }

    /**
     * 팀원이 특정 능력을 가지고 있는지 확인
     */
    hasCapability(capability) {
        return this.capabilities.includes(capability);
    }

    /**
     * 팀원이 사용 가능한지 확인
     */
    isAvailable() {
        return this.status === 'idle' && this.workload < 80;
    }

    /**
     * 팀원 정보를 JSON으로 직렬화
     */
    toJSON() {
        return {
            id: this.id,
            name: this.name,
            role: this.role,
            capabilities: this.capabilities,
            color: this.color,
            mcpEndpoint: this.mcpEndpoint,
            status: this.status,
            currentTask: this.currentTask,
            workload: this.workload,
            lastHeartbeat: this.lastHeartbeat,
            performance: this.performance,
            createdAt: this.createdAt
        };
    }
}

/**
 * 팀 관리 시스템 - 팀원 추가/제거, 상태 관리, 작업 할당
 */
class TeamManager extends EventEmitter {
    constructor() {
        super();
        this.teamMembers = new Map();
        this.config = null;
        this.maxTeamSize = 10;
        this.stateFile = path.join(__dirname, '../../shared/states/team-state.json');
        
        this.loadConfig();
        this.setupEventHandlers();
    }

    /**
     * 설정 파일 로드
     */
    async loadConfig() {
        try {
            const configPath = path.join(__dirname, '../../config/team-config.json');
            const configData = await fs.readFile(configPath, 'utf8');
            this.config = JSON.parse(configData);
            this.maxTeamSize = this.config.team?.maxSize || 10;
        } catch (error) {
            console.warn(chalk.yellow('⚠️  팀 설정 파일을 로드할 수 없습니다. 기본 설정을 사용합니다.'));
            this.config = { team: { maxSize: 10 } };
        }
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        // 정기적인 상태 저장
        setInterval(() => {
            this.saveTeamState().catch(error => {
                console.error(chalk.red('팀 상태 저장 실패:'), error.message);
            });
        }, 30000); // 30초마다 저장

        // 하트비트 체크
        setInterval(() => {
            this.checkHeartbeats();
        }, 60000); // 1분마다 체크
    }

    /**
     * 팀원 추가
     */
    async addTeamMember(memberConfig) {
        // 팀 크기 제한 확인
        if (this.teamMembers.size >= this.maxTeamSize) {
            throw new Error(`팀 크기 제한 초과 (최대 ${this.maxTeamSize}명)`);
        }

        // 중복 ID 확인
        if (this.teamMembers.has(memberConfig.id)) {
            throw new Error(`이미 존재하는 팀원 ID: ${memberConfig.id}`);
        }

        // 입력 검증
        this.validateMemberConfig(memberConfig);

        // 팀원 생성
        const member = new TeamMember(memberConfig);
        this.teamMembers.set(member.id, member);

        // 이벤트 발행
        this.emit('member_added', member);

        console.log(
            chalk.bold.green(`✅ ${member.name} (${member.role})이 팀에 추가되었습니다.`)
        );

        // 상태 저장
        await this.saveTeamState();

        return member;
    }

    /**
     * 팀원 제거
     */
    async removeTeamMember(memberId) {
        const member = this.teamMembers.get(memberId);
        if (!member) {
            throw new Error(`존재하지 않는 팀원 ID: ${memberId}`);
        }

        // 진행 중인 작업이 있는지 확인
        if (member.status === 'busy' && member.currentTask) {
            console.warn(
                chalk.yellow(`⚠️  ${member.name}이 작업 중입니다. 작업을 다른 팀원에게 재할당해야 합니다.`)
            );
            this.emit('task_reassignment_needed', member.currentTask, memberId);
        }

        this.teamMembers.delete(memberId);
        this.emit('member_removed', member);

        console.log(
            chalk.bold.red(`❌ ${member.name}이 팀에서 제거되었습니다.`)
        );

        // 상태 저장
        await this.saveTeamState();

        return member;
    }

    /**
     * 팀원 설정 검증
     */
    validateMemberConfig(config) {
        const required = ['id', 'name', 'role', 'mcpEndpoint'];
        for (const field of required) {
            if (!config[field]) {
                throw new Error(`필수 필드가 누락되었습니다: ${field}`);
            }
        }

        // 역할 검증
        const validRoles = this.config.team?.defaultRoles || ['leader', 'senior_developer', 'researcher', 'developer'];
        if (!validRoles.includes(config.role)) {
            throw new Error(`유효하지 않은 역할: ${config.role}. 가능한 역할: ${validRoles.join(', ')}`);
        }
    }

    /**
     * 팀원 조회
     */
    getAgent(memberId) {
        const member = this.teamMembers.get(memberId);
        if (!member) {
            throw new Error(`존재하지 않는 팀원 ID: ${memberId}`);
        }
        return member;
    }

    /**
     * 역할별 팀원 조회
     */
    getMembersByRole(role) {
        return Array.from(this.teamMembers.values()).filter(member => member.role === role);
    }

    /**
     * 능력별 팀원 조회
     */
    getMembersByCapability(capability) {
        return Array.from(this.teamMembers.values()).filter(member => 
            member.hasCapability(capability)
        );
    }

    /**
     * 사용 가능한 팀원 조회
     */
    getAvailableMembers() {
        return Array.from(this.teamMembers.values()).filter(member => 
            member.isAvailable()
        );
    }

    /**
     * 최적의 팀원 찾기
     */
    findBestMember(requiredCapabilities = [], taskType = null) {
        const availableMembers = this.getAvailableMembers();
        
        if (availableMembers.length === 0) {
            return null;
        }

        // 능력 매칭 스코어 계산
        const scoredMembers = availableMembers.map(member => {
            let score = 0;
            
            // 능력 매칭 점수 (0-50점)
            const matchingCapabilities = requiredCapabilities.filter(cap => 
                member.hasCapability(cap)
            );
            score += (matchingCapabilities.length / Math.max(requiredCapabilities.length, 1)) * 50;
            
            // 성능 점수 (0-25점)
            score += (member.performance.successRate / 100) * 25;
            
            // 작업 부하 점수 (0-25점, 낮을수록 좋음)
            score += (100 - member.workload) / 100 * 25;
            
            return { member, score };
        });

        // 점수순 정렬 후 최고 점수 반환
        scoredMembers.sort((a, b) => b.score - a.score);
        return scoredMembers[0]?.member || null;
    }

    /**
     * 팀 상태 조회
     */
    getTeamStatus() {
        const members = {};
        
        for (const [id, member] of this.teamMembers) {
            members[id] = {
                name: member.name,
                role: member.role,
                status: member.status,
                currentTask: member.currentTask,
                workload: member.workload,
                progress: member.status === 'busy' ? Math.min(95, member.workload) : 0,
                performance: member.performance,
                lastHeartbeat: member.lastHeartbeat
            };
        }

        return {
            totalMembers: this.teamMembers.size,
            activeMembers: Array.from(this.teamMembers.values()).filter(m => m.status !== 'offline').length,
            busyMembers: Array.from(this.teamMembers.values()).filter(m => m.status === 'busy').length,
            members
        };
    }

    /**
     * 팀 크기 조회
     */
    getTeamSize() {
        return this.teamMembers.size;
    }

    /**
     * 팀원 상태 업데이트
     */
    updateMemberStatus(memberId, status, taskId = null) {
        const member = this.getAgent(memberId);
        const oldStatus = member.status;
        
        member.updateStatus(status, taskId);
        
        this.emit('member_status_changed', {
            memberId,
            oldStatus,
            newStatus: status,
            taskId
        });
    }

    /**
     * 팀원 작업 부하 업데이트
     */
    updateMemberWorkload(memberId, workload) {
        const member = this.getAgent(memberId);
        member.updateWorkload(workload);
        
        this.emit('member_workload_changed', {
            memberId,
            workload
        });
    }

    /**
     * 하트비트 체크
     */
    checkHeartbeats() {
        const now = new Date();
        const timeout = 5 * 60 * 1000; // 5분

        for (const [id, member] of this.teamMembers) {
            if (now - member.lastHeartbeat > timeout && member.status !== 'offline') {
                console.warn(
                    chalk.yellow(`⚠️  ${member.name}의 하트비트가 감지되지 않습니다.`)
                );
                this.updateMemberStatus(id, 'offline');
            }
        }
    }

    /**
     * 팀 상태 저장
     */
    async saveTeamState() {
        try {
            const stateDir = path.dirname(this.stateFile);
            await fs.mkdir(stateDir, { recursive: true });
            
            const teamState = {
                timestamp: new Date().toISOString(),
                members: Array.from(this.teamMembers.values()).map(member => member.toJSON())
            };
            
            await fs.writeFile(this.stateFile, JSON.stringify(teamState, null, 2));
        } catch (error) {
            console.error(chalk.red('팀 상태 저장 실패:'), error.message);
        }
    }

    /**
     * 팀 상태 로드
     */
    async loadTeamState() {
        try {
            const stateData = await fs.readFile(this.stateFile, 'utf8');
            const teamState = JSON.parse(stateData);
            
            // 기존 팀원들 복원
            for (const memberData of teamState.members) {
                const member = new TeamMember(memberData);
                this.teamMembers.set(member.id, member);
            }
            
            console.log(
                chalk.blue(`📋 팀 상태가 복원되었습니다. (${this.teamMembers.size}명)`)
            );
            
        } catch (error) {
            console.log(chalk.gray('이전 팀 상태 파일이 없습니다. 새로 시작합니다.'));
        }
    }

    /**
     * 팀 통계 조회
     */
    getTeamStatistics() {
        const members = Array.from(this.teamMembers.values());
        
        return {
            totalMembers: members.length,
            roleDistribution: this.getRoleDistribution(),
            statusDistribution: this.getStatusDistribution(),
            averagePerformance: this.getAveragePerformance(),
            totalTasksCompleted: members.reduce((sum, m) => sum + m.performance.tasksCompleted, 0),
            averageWorkload: members.reduce((sum, m) => sum + m.workload, 0) / members.length || 0
        };
    }

    /**
     * 역할별 분포 조회
     */
    getRoleDistribution() {
        const distribution = {};
        for (const member of this.teamMembers.values()) {
            distribution[member.role] = (distribution[member.role] || 0) + 1;
        }
        return distribution;
    }

    /**
     * 상태별 분포 조회
     */
    getStatusDistribution() {
        const distribution = {};
        for (const member of this.teamMembers.values()) {
            distribution[member.status] = (distribution[member.status] || 0) + 1;
        }
        return distribution;
    }

    /**
     * 평균 성능 조회
     */
    getAveragePerformance() {
        const members = Array.from(this.teamMembers.values());
        if (members.length === 0) return 0;
        
        return members.reduce((sum, m) => sum + m.performance.successRate, 0) / members.length;
    }
}

module.exports = { TeamManager, TeamMember };