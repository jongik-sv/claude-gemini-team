const { TeamManager, TeamMember } = require('../../../src/core/team-manager');
const {
    createValidMemberConfig,
    createLeaderConfig,
    invalidMemberConfigs,
    createTeamState,
    createPerformanceMetrics
} = require('../../helpers/factories');
const fs = require('fs').promises;
const path = require('path');

// 파일 시스템 모킹
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        mkdir: jest.fn()
    }
}));

describe('TeamMember', () => {
    describe('생성자', () => {
        test('should create team member with valid config', () => {
            const config = createValidMemberConfig();
            const member = new TeamMember(config);

            expect(member.id).toBe(config.id);
            expect(member.name).toBe(config.name);
            expect(member.role).toBe(config.role);
            expect(member.capabilities).toEqual(config.capabilities);
            expect(member.status).toBe('idle');
            expect(member.workload).toBe(0);
        });

        test('should set default values for optional fields', () => {
            const config = {
                id: 'test',
                name: 'Test',
                role: 'developer',
                mcpEndpoint: 'test://endpoint'
            };
            const member = new TeamMember(config);

            expect(member.capabilities).toEqual([]);
            expect(member.color).toBe('white');
            expect(member.performance.successRate).toBe(100);
        });
    });

    describe('updateStatus', () => {
        test('should update status and task correctly', () => {
            const member = new TeamMember(createValidMemberConfig());
            
            member.updateStatus('busy', 'task_123');
            
            expect(member.status).toBe('busy');
            expect(member.currentTask).toBe('task_123');
            expect(member.lastHeartbeat).toBeInstanceOf(Date);
        });
    });

    describe('updateWorkload', () => {
        test('should update workload within valid range', () => {
            const member = new TeamMember(createValidMemberConfig());
            
            member.updateWorkload(75);
            expect(member.workload).toBe(75);
            
            // 범위 제한 테스트
            member.updateWorkload(150);
            expect(member.workload).toBe(100);
            
            member.updateWorkload(-10);
            expect(member.workload).toBe(0);
        });
    });

    describe('updatePerformance', () => {
        test('should update performance metrics correctly', () => {
            const member = new TeamMember(createValidMemberConfig());
            
            member.updatePerformance(5000, true);
            
            expect(member.performance.tasksCompleted).toBe(1);
            expect(member.performance.totalTime).toBe(5000);
            expect(member.performance.averageTime).toBe(5000);
            expect(member.performance.successRate).toBe(100);
        });

        test('should calculate success rate correctly with failures', () => {
            const member = new TeamMember(createValidMemberConfig());
            
            member.updatePerformance(3000, true);  // 성공
            member.updatePerformance(4000, false); // 실패
            
            expect(member.performance.tasksCompleted).toBe(2);
            expect(member.performance.successRate).toBe(50);
        });
    });

    describe('hasCapability', () => {
        test('should return true if member has capability', () => {
            const config = createValidMemberConfig({
                capabilities: ['coding', 'testing', 'debugging']
            });
            const member = new TeamMember(config);
            
            expect(member.hasCapability('coding')).toBe(true);
            expect(member.hasCapability('testing')).toBe(true);
            expect(member.hasCapability('invalid')).toBe(false);
        });
    });

    describe('isAvailable', () => {
        test('should return true when idle and workload is low', () => {
            const member = new TeamMember(createValidMemberConfig());
            member.status = 'idle';
            member.workload = 50;
            
            expect(member.isAvailable()).toBe(true);
        });

        test('should return false when busy', () => {
            const member = new TeamMember(createValidMemberConfig());
            member.status = 'busy';
            member.workload = 50;
            
            expect(member.isAvailable()).toBe(false);
        });

        test('should return false when workload is high', () => {
            const member = new TeamMember(createValidMemberConfig());
            member.status = 'idle';
            member.workload = 90;
            
            expect(member.isAvailable()).toBe(false);
        });
    });
});

describe('TeamManager', () => {
    let teamManager;

    beforeEach(() => {
        teamManager = new TeamManager();
        // 설정 로드 모킹
        teamManager.config = {
            team: {
                maxSize: 10,
                defaultRoles: ['leader', 'senior_developer', 'researcher', 'developer']
            }
        };
    });

    describe('addTeamMember', () => {
        test('should add valid team member successfully', async () => {
            const config = createValidMemberConfig();
            
            const member = await teamManager.addTeamMember(config);
            
            expect(member).toBeInstanceOf(TeamMember);
            expect(member.id).toBe(config.id);
            expect(teamManager.getTeamSize()).toBe(1);
            expect(teamManager.teamMembers.has(config.id)).toBe(true);
        });

        test('should emit member_added event', async () => {
            const config = createValidMemberConfig();
            const eventHandler = jest.fn();
            teamManager.on('member_added', eventHandler);
            
            const member = await teamManager.addTeamMember(config);
            
            expect(eventHandler).toHaveBeenCalledWith(member);
        });

        test('should throw error when team size limit exceeded', async () => {
            teamManager.maxTeamSize = 1;
            await teamManager.addTeamMember(createValidMemberConfig({ id: 'member1' }));
            
            await expect(
                teamManager.addTeamMember(createValidMemberConfig({ id: 'member2' }))
            ).rejects.toThrow('팀 크기 제한 초과');
        });

        test('should throw error for duplicate member ID', async () => {
            const config = createValidMemberConfig();
            await teamManager.addTeamMember(config);
            
            await expect(
                teamManager.addTeamMember(config)
            ).rejects.toThrow('이미 존재하는 팀원 ID');
        });

        test('should throw error for invalid member config', async () => {
            await expect(
                teamManager.addTeamMember(invalidMemberConfigs.missingId)
            ).rejects.toThrow('필수 필드가 누락되었습니다: id');
            
            await expect(
                teamManager.addTeamMember(invalidMemberConfigs.invalidRole)
            ).rejects.toThrow('유효하지 않은 역할');
        });
    });

    describe('removeTeamMember', () => {
        test('should remove existing team member', async () => {
            const config = createValidMemberConfig();
            await teamManager.addTeamMember(config);
            
            const removedMember = await teamManager.removeTeamMember(config.id);
            
            expect(removedMember.id).toBe(config.id);
            expect(teamManager.getTeamSize()).toBe(0);
            expect(teamManager.teamMembers.has(config.id)).toBe(false);
        });

        test('should emit member_removed event', async () => {
            const config = createValidMemberConfig();
            await teamManager.addTeamMember(config);
            
            const eventHandler = jest.fn();
            teamManager.on('member_removed', eventHandler);
            
            const member = await teamManager.removeTeamMember(config.id);
            
            expect(eventHandler).toHaveBeenCalledWith(member);
        });

        test('should throw error for non-existent member', async () => {
            await expect(
                teamManager.removeTeamMember('non_existent')
            ).rejects.toThrow('존재하지 않는 팀원 ID: non_existent');
        });

        test('should emit task reassignment event for busy member', async () => {
            const config = createValidMemberConfig();
            const member = await teamManager.addTeamMember(config);
            member.status = 'busy';
            member.currentTask = 'active_task';
            
            const eventHandler = jest.fn();
            teamManager.on('task_reassignment_needed', eventHandler);
            
            await teamManager.removeTeamMember(config.id);
            
            expect(eventHandler).toHaveBeenCalledWith('active_task', config.id);
        });
    });

    describe('getAgent', () => {
        test('should return existing team member', async () => {
            const config = createValidMemberConfig();
            await teamManager.addTeamMember(config);
            
            const member = teamManager.getAgent(config.id);
            
            expect(member.id).toBe(config.id);
        });

        test('should throw error for non-existent member', () => {
            expect(() => {
                teamManager.getAgent('non_existent');
            }).toThrow('존재하지 않는 팀원 ID: non_existent');
        });
    });

    describe('getMembersByRole', () => {
        test('should return members with specified role', async () => {
            await teamManager.addTeamMember(createLeaderConfig());
            await teamManager.addTeamMember(createValidMemberConfig({ 
                id: 'dev1', role: 'developer' 
            }));
            await teamManager.addTeamMember(createValidMemberConfig({ 
                id: 'dev2', role: 'developer' 
            }));
            
            const leaders = teamManager.getMembersByRole('leader');
            const developers = teamManager.getMembersByRole('developer');
            
            expect(leaders).toHaveLength(1);
            expect(developers).toHaveLength(2);
            expect(leaders[0].role).toBe('leader');
        });
    });

    describe('getMembersByCapability', () => {
        test('should return members with specified capability', async () => {
            await teamManager.addTeamMember(createValidMemberConfig({
                id: 'coder1',
                capabilities: ['coding', 'testing']
            }));
            await teamManager.addTeamMember(createValidMemberConfig({
                id: 'coder2', 
                capabilities: ['coding', 'debugging']
            }));
            await teamManager.addTeamMember(createValidMemberConfig({
                id: 'designer',
                capabilities: ['design', 'ui']
            }));
            
            const coders = teamManager.getMembersByCapability('coding');
            const testers = teamManager.getMembersByCapability('testing');
            
            expect(coders).toHaveLength(2);
            expect(testers).toHaveLength(1);
        });
    });

    describe('getAvailableMembers', () => {
        test('should return only available members', async () => {
            const member1 = await teamManager.addTeamMember(createValidMemberConfig({ id: 'available' }));
            const member2 = await teamManager.addTeamMember(createValidMemberConfig({ id: 'busy' }));
            const member3 = await teamManager.addTeamMember(createValidMemberConfig({ id: 'overloaded' }));
            
            member2.status = 'busy';
            member3.workload = 90;
            
            const available = teamManager.getAvailableMembers();
            
            expect(available).toHaveLength(1);
            expect(available[0].id).toBe('available');
        });
    });

    describe('findBestMember', () => {
        test('should return member with best capability match', async () => {
            await teamManager.addTeamMember(createValidMemberConfig({
                id: 'specialist',
                capabilities: ['coding', 'testing', 'debugging']
            }));
            await teamManager.addTeamMember(createValidMemberConfig({
                id: 'generalist',
                capabilities: ['coding', 'design']
            }));
            
            const bestMember = teamManager.findBestMember(['coding', 'testing']);
            
            expect(bestMember.id).toBe('specialist');
        });

        test('should return null when no members available', () => {
            const bestMember = teamManager.findBestMember(['coding']);
            
            expect(bestMember).toBeNull();
        });

        test('should consider performance in selection', async () => {
            const member1 = await teamManager.addTeamMember(createValidMemberConfig({
                id: 'performer',
                capabilities: ['coding']
            }));
            const member2 = await teamManager.addTeamMember(createValidMemberConfig({
                id: 'underperformer',
                capabilities: ['coding']
            }));
            
            member1.performance.successRate = 95;
            member2.performance.successRate = 70;
            
            const bestMember = teamManager.findBestMember(['coding']);
            
            expect(bestMember.id).toBe('performer');
        });
    });

    describe('getTeamStatus', () => {
        test('should return comprehensive team status', async () => {
            await teamManager.addTeamMember(createValidMemberConfig({ id: 'member1' }));
            const member2 = await teamManager.addTeamMember(createValidMemberConfig({ id: 'member2' }));
            member2.status = 'busy';
            
            const status = teamManager.getTeamStatus();
            
            expect(status.totalMembers).toBe(2);
            expect(status.activeMembers).toBe(2);
            expect(status.busyMembers).toBe(1);
            expect(status.members).toHaveProperty('member1');
            expect(status.members).toHaveProperty('member2');
            expect(status.members.member2.status).toBe('busy');
        });
    });

    describe('updateMemberStatus', () => {
        test('should update member status and emit event', async () => {
            const config = createValidMemberConfig();
            await teamManager.addTeamMember(config);
            
            const eventHandler = jest.fn();
            teamManager.on('member_status_changed', eventHandler);
            
            teamManager.updateMemberStatus(config.id, 'busy', 'task_123');
            
            const member = teamManager.getAgent(config.id);
            expect(member.status).toBe('busy');
            expect(member.currentTask).toBe('task_123');
            expect(eventHandler).toHaveBeenCalledWith({
                memberId: config.id,
                oldStatus: 'idle',
                newStatus: 'busy',
                taskId: 'task_123'
            });
        });
    });

    describe('saveTeamState', () => {
        test('should save team state to file', async () => {
            const mockWriteFile = fs.writeFile;
            const mockMkdir = fs.mkdir;
            
            await teamManager.addTeamMember(createValidMemberConfig());
            await teamManager.saveTeamState();
            
            expect(mockMkdir).toHaveBeenCalled();
            expect(mockWriteFile).toHaveBeenCalled();
            
            const writeCall = mockWriteFile.mock.calls[0];
            const savedData = JSON.parse(writeCall[1]);
            expect(savedData.members).toHaveLength(1);
            expect(savedData.timestamp).toBeDefined();
        });
    });

    describe('loadTeamState', () => {
        test('should load team state from file', async () => {
            const mockTeamState = {
                timestamp: new Date().toISOString(),
                members: [createValidMemberConfig()]
            };
            
            fs.readFile.mockResolvedValue(JSON.stringify(mockTeamState));
            
            await teamManager.loadTeamState();
            
            expect(teamManager.getTeamSize()).toBe(1);
            expect(teamManager.teamMembers.has('test_member')).toBe(true);
        });

        test('should handle missing state file gracefully', async () => {
            fs.readFile.mockRejectedValue(new Error('File not found'));
            
            await expect(teamManager.loadTeamState()).resolves.not.toThrow();
            expect(teamManager.getTeamSize()).toBe(0);
        });
    });

    describe('getTeamStatistics', () => {
        test('should return team statistics', async () => {
            await teamManager.addTeamMember(createLeaderConfig());
            await teamManager.addTeamMember(createValidMemberConfig({ 
                id: 'dev1', role: 'developer' 
            }));
            
            const stats = teamManager.getTeamStatistics();
            
            expect(stats.totalMembers).toBe(2);
            expect(stats.roleDistribution).toEqual({
                leader: 1,
                developer: 1
            });
            expect(stats.statusDistribution).toEqual({
                idle: 2
            });
            expect(stats.averagePerformance).toBe(100);
        });
    });
});