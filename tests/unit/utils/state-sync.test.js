/**
 * StateSyncManager 테스트
 */

const StateSyncManager = require('../../../src/utils/state-sync');
const fs = require('fs').promises;
const path = require('path');

describe('StateSyncManager', () => {
    let stateSyncManager;
    let testDir;

    beforeEach(async () => {
        stateSyncManager = new StateSyncManager();
        testDir = path.join(__dirname, '../../../temp/test-sync');
        
        // 테스트용 디렉터리 설정
        stateSyncManager.fileManager.sharedDir = testDir;
        stateSyncManager.fileManager.workflowsDir = path.join(testDir, 'workflows');
        stateSyncManager.fileManager.resultsDir = path.join(testDir, 'results');
        stateSyncManager.fileManager.statesDir = path.join(testDir, 'states');
        stateSyncManager.fileManager.tempDir = path.join(testDir, 'temp');
        
        await stateSyncManager.initialize();
    });

    afterEach(async () => {
        await stateSyncManager.shutdown();
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // 무시 - 테스트 환경에서는 정리 실패가 발생할 수 있음
        }
    });

    describe('초기화', () => {
        it('should initialize state sync manager successfully', () => {
            expect(stateSyncManager.initialized).toBe(true);
        });

        it('should have file manager initialized', () => {
            expect(stateSyncManager.fileManager.initialized).toBe(true);
        });
    });

    describe('상태 관리', () => {
        it('should set state successfully', async () => {
            const stateId = 'test-state-1';
            const state = { active: true, progress: 25 };
            const agentId = 'test-agent';

            const version = await stateSyncManager.setState(stateId, state, agentId);
            
            expect(version).toBe(1);
            expect(stateSyncManager.versions.get(stateId)).toBe(1);
            expect(stateSyncManager.states.get(stateId)).toBeDefined();
            expect(stateSyncManager.states.get(stateId).state).toEqual(state);
        });

        it('should get state successfully', async () => {
            const stateId = 'test-state-2';
            const state = { active: false, progress: 75 };
            const agentId = 'test-agent';

            await stateSyncManager.setState(stateId, state, agentId);
            const retrieved = await stateSyncManager.getState(stateId);
            
            expect(retrieved).toEqual(state);
        });

        it('should increment version on state updates', async () => {
            const stateId = 'test-state-3';
            const agentId = 'test-agent';

            const version1 = await stateSyncManager.setState(stateId, { progress: 10 }, agentId);
            const version2 = await stateSyncManager.setState(stateId, { progress: 20 }, agentId);
            const version3 = await stateSyncManager.setState(stateId, { progress: 30 }, agentId);
            
            expect(version1).toBe(1);
            expect(version2).toBe(2);
            expect(version3).toBe(3);
        });

        it('should emit events for state updates', async () => {
            const stateId = 'test-state-4';
            const state = { test: true };
            const agentId = 'test-agent';

            const eventPromise = new Promise(resolve => {
                stateSyncManager.on('state:updated', resolve);
            });

            await stateSyncManager.setState(stateId, state, agentId);
            const event = await eventPromise;
            
            expect(event.stateId).toBe(stateId);
            expect(event.version).toBe(1);
            expect(event.agentId).toBe(agentId);
        });
    });

    describe('상태 동기화', () => {
        it('should load remote state successfully', async () => {
            const stateId = 'test-remote-state';
            const state = { remote: true, data: 'test' };
            const agentId = 'remote-agent';

            // 파일에 직접 상태 저장
            await stateSyncManager.fileManager.saveState(stateId, {
                id: stateId,
                state,
                version: 5,
                agentId,
                timestamp: new Date().toISOString()
            });

            const loaded = await stateSyncManager.loadRemoteState(stateId);
            
            expect(loaded.id).toBe(stateId);
            expect(loaded.state).toEqual(state);
            expect(loaded.version).toBe(5);
            expect(stateSyncManager.versions.get(stateId)).toBe(5);
        });

        it('should sync all states', async () => {
            const stateId1 = 'sync-state-1';
            const stateId2 = 'sync-state-2';
            
            await stateSyncManager.setState(stateId1, { data: 'test1' }, 'agent1');
            await stateSyncManager.setState(stateId2, { data: 'test2' }, 'agent2');
            
            // 로컬 상태 초기화
            stateSyncManager.states.clear();
            stateSyncManager.versions.clear();
            
            await stateSyncManager.syncAllStates();
            
            expect(stateSyncManager.states.has(stateId1)).toBe(true);
            expect(stateSyncManager.states.has(stateId2)).toBe(true);
        });
    });

    describe('충돌 해결', () => {
        it('should resolve conflict using merge strategy', async () => {
            const stateId = 'conflict-state';
            const localState = { localData: 'local', shared: 'local' };
            const remoteState = { remoteData: 'remote', shared: 'remote' };

            const resolved = await stateSyncManager.resolveConflict(stateId, localState, remoteState, 'merge');
            
            expect(resolved.localData).toBe('local');
            expect(resolved.remoteData).toBe('remote');
            expect(resolved.shared).toBe('remote'); // 원격이 우선
            expect(resolved._merged).toBe(true);
        });

        it('should resolve conflict using latest strategy', async () => {
            const stateId = 'conflict-state-2';
            const localState = { data: 'local', _timestamp: '2023-01-01T00:00:00Z' };
            const remoteState = { data: 'remote', _timestamp: '2023-01-02T00:00:00Z' };

            const resolved = await stateSyncManager.resolveConflict(stateId, localState, remoteState, 'latest');
            
            expect(resolved.data).toBe('remote');
        });

        it('should emit conflict resolved event', async () => {
            const stateId = 'conflict-state-3';
            const localState = { data: 'local' };
            const remoteState = { data: 'remote' };

            const eventPromise = new Promise(resolve => {
                stateSyncManager.on('conflict:resolved', resolve);
            });

            await stateSyncManager.resolveConflict(stateId, localState, remoteState, 'merge');
            const event = await eventPromise;
            
            expect(event.stateId).toBe(stateId);
            expect(event.strategy).toBe('merge');
        });
    });

    describe('잠금 관리', () => {
        it('should acquire and release lock successfully', async () => {
            const stateId = 'lock-test-state';
            
            await stateSyncManager.acquireLock(stateId);
            expect(stateSyncManager.locks.get(stateId)).toBe(true);
            
            stateSyncManager.releaseLock(stateId);
            expect(stateSyncManager.locks.get(stateId)).toBeUndefined();
        });

        it('should prevent concurrent access to same state', async () => {
            const stateId = 'concurrent-state';
            
            await stateSyncManager.acquireLock(stateId);
            
            const start = Date.now();
            const lockPromise = stateSyncManager.acquireLock(stateId);
            
            // 잠금 해제
            setTimeout(() => {
                stateSyncManager.releaseLock(stateId);
            }, 100);
            
            await lockPromise;
            const elapsed = Date.now() - start;
            
            expect(elapsed).toBeGreaterThan(50);
        });
    });

    describe('상태 통계 및 조회', () => {
        it('should return state list', async () => {
            await stateSyncManager.setState('state-1', { data: 'test1' }, 'agent1');
            await stateSyncManager.setState('state-2', { data: 'test2' }, 'agent2');
            
            const list = stateSyncManager.getStateList();
            
            expect(list).toHaveLength(2);
            expect(list[0].id).toBe('state-1');
            expect(list[1].id).toBe('state-2');
        });

        it('should return state statistics', async () => {
            await stateSyncManager.setState('stats-1', { data: 'test1' }, 'agent1');
            await stateSyncManager.setState('stats-2', { data: 'test2' }, 'agent2');
            await stateSyncManager.setState('stats-1', { data: 'test1-updated' }, 'agent1');
            
            const stats = stateSyncManager.getStateStats();
            
            expect(stats.totalStates).toBe(2);
            expect(stats.totalVersions).toBe(3); // 1 + 2 (stats-1 updated)
            expect(stats.avgVersion).toBe(1.5);
        });
    });

    describe('상태 삭제', () => {
        it('should delete state successfully', async () => {
            const stateId = 'delete-state';
            
            await stateSyncManager.setState(stateId, { data: 'test' }, 'agent');
            expect(stateSyncManager.states.has(stateId)).toBe(true);
            
            await stateSyncManager.deleteState(stateId);
            expect(stateSyncManager.states.has(stateId)).toBe(false);
            expect(stateSyncManager.versions.has(stateId)).toBe(false);
        });

        it('should emit state deleted event', async () => {
            const stateId = 'delete-state-2';
            
            await stateSyncManager.setState(stateId, { data: 'test' }, 'agent');
            
            const eventPromise = new Promise(resolve => {
                stateSyncManager.on('state:deleted', resolve);
            });
            
            await stateSyncManager.deleteState(stateId);
            const event = await eventPromise;
            
            expect(event.stateId).toBe(stateId);
        });
    });

    describe('정리 및 종료', () => {
        it('should shutdown gracefully', async () => {
            await stateSyncManager.setState('shutdown-test', { data: 'test' }, 'agent');
            
            await stateSyncManager.shutdown();
            
            expect(stateSyncManager.initialized).toBe(false);
            expect(stateSyncManager.states.size).toBe(0);
            expect(stateSyncManager.versions.size).toBe(0);
            expect(stateSyncManager.locks.size).toBe(0);
        });
    });
});