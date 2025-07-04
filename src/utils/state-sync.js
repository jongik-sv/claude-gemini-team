/**
 * 상태 동기화 관리자
 * Agent 간 상태 동기화 및 충돌 해결을 위한 유틸리티
 */

const { EventEmitter } = require('events');
const chalk = require('chalk');
const FileManager = require('./file-manager');

class StateSyncManager extends EventEmitter {
    constructor() {
        super();
        this.fileManager = new FileManager();
        this.states = new Map();
        this.versions = new Map();
        this.locks = new Map();
        this.syncInterval = 5000;
        this.initialized = false;
    }

    /**
     * 상태 동기화 시스템 초기화
     */
    async initialize() {
        try {
            await this.fileManager.initialize();
            this.setupEventHandlers();
            this.startSyncScheduler();
            this.initialized = true;
            console.log(chalk.green('✅ StateSyncManager 초기화 완료'));
        } catch (error) {
            console.error(chalk.red('❌ StateSyncManager 초기화 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 이벤트 핸들러 설정
     */
    setupEventHandlers() {
        this.fileManager.on('state:saved', (event) => {
            this.handleStateFileSaved(event);
        });

        this.fileManager.on('file:changed', (event) => {
            if (event.filename && event.filename.startsWith('state_')) {
                this.handleStateFileChanged(event);
            }
        });
    }

    /**
     * 상태 파일 저장 이벤트 처리
     */
    handleStateFileSaved(event) {
        const { stateId } = event;
        this.emit('state:synchronized', {
            stateId,
            action: 'saved',
            timestamp: new Date()
        });
    }

    /**
     * 상태 파일 변경 이벤트 처리
     */
    async handleStateFileChanged(event) {
        const { filename } = event;
        const stateId = filename.replace('state_', '').replace('.json', '');
        
        try {
            await this.loadRemoteState(stateId);
            this.emit('state:synchronized', {
                stateId,
                action: 'updated',
                timestamp: new Date()
            });
        } catch (error) {
            console.error(chalk.red(`❌ 상태 파일 변경 처리 실패: ${stateId}`), error.message);
        }
    }

    /**
     * 동기화 스케줄러 시작
     */
    startSyncScheduler() {
        setInterval(async () => {
            try {
                await this.syncAllStates();
            } catch (error) {
                console.error(chalk.red('❌ 상태 동기화 실패:'), error.message);
            }
        }, this.syncInterval);
    }

    /**
     * 상태 설정
     */
    async setState(stateId, state, agentId) {
        try {
            await this.acquireLock(stateId);
            
            const currentVersion = this.versions.get(stateId) || 0;
            const newVersion = currentVersion + 1;
            
            const stateData = {
                id: stateId,
                state,
                version: newVersion,
                agentId,
                timestamp: new Date().toISOString()
            };
            
            this.states.set(stateId, stateData);
            this.versions.set(stateId, newVersion);
            
            await this.fileManager.saveState(stateId, stateData);
            
            this.emit('state:updated', {
                stateId,
                version: newVersion,
                agentId,
                timestamp: new Date()
            });
            
            return newVersion;
        } catch (error) {
            console.error(chalk.red(`❌ 상태 설정 실패: ${stateId}`), error.message);
            throw error;
        } finally {
            this.releaseLock(stateId);
        }
    }

    /**
     * 상태 조회
     */
    async getState(stateId) {
        try {
            let stateData = this.states.get(stateId);
            
            if (!stateData) {
                stateData = await this.loadRemoteState(stateId);
            }
            
            return stateData ? stateData.state : null;
        } catch (error) {
            console.error(chalk.red(`❌ 상태 조회 실패: ${stateId}`), error.message);
            return null;
        }
    }

    /**
     * 원격 상태 로드
     */
    async loadRemoteState(stateId) {
        try {
            const stateData = await this.fileManager.loadState(stateId);
            const localVersion = this.versions.get(stateId) || 0;
            
            if (stateData.version > localVersion) {
                this.states.set(stateId, stateData);
                this.versions.set(stateId, stateData.version);
                
                this.emit('state:loaded', {
                    stateId,
                    version: stateData.version,
                    timestamp: new Date()
                });
            }
            
            return stateData;
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
            return null;
        }
    }

    /**
     * 모든 상태 동기화
     */
    async syncAllStates() {
        const stateIds = Array.from(this.states.keys());
        
        for (const stateId of stateIds) {
            try {
                await this.loadRemoteState(stateId);
            } catch (error) {
                console.error(chalk.red(`❌ 상태 동기화 실패: ${stateId}`), error.message);
            }
        }
    }

    /**
     * 상태 충돌 해결
     */
    async resolveConflict(stateId, localState, remoteState, strategy = 'merge') {
        try {
            let resolvedState;
            
            switch (strategy) {
                case 'merge':
                    resolvedState = this.mergeStates(localState, remoteState);
                    break;
                case 'latest':
                    resolvedState = this.selectLatestState(localState, remoteState);
                    break;
                case 'manual':
                    resolvedState = await this.manualConflictResolution(stateId, localState, remoteState);
                    break;
                default:
                    throw new Error(`알 수 없는 충돌 해결 전략: ${strategy}`);
            }
            
            const version = await this.setState(stateId, resolvedState, 'system');
            
            this.emit('conflict:resolved', {
                stateId,
                strategy,
                version,
                timestamp: new Date()
            });
            
            return resolvedState;
        } catch (error) {
            console.error(chalk.red(`❌ 상태 충돌 해결 실패: ${stateId}`), error.message);
            throw error;
        }
    }

    /**
     * 상태 병합
     */
    mergeStates(localState, remoteState) {
        if (typeof localState === 'object' && typeof remoteState === 'object') {
            return {
                ...localState,
                ...remoteState,
                _merged: true,
                _mergeTimestamp: new Date().toISOString()
            };
        }
        return remoteState;
    }

    /**
     * 최신 상태 선택
     */
    selectLatestState(localState, remoteState) {
        const localTimestamp = new Date(localState._timestamp || 0);
        const remoteTimestamp = new Date(remoteState._timestamp || 0);
        
        return remoteTimestamp > localTimestamp ? remoteState : localState;
    }

    /**
     * 수동 충돌 해결
     */
    async manualConflictResolution(stateId, localState, remoteState) {
        return new Promise((resolve) => {
            this.emit('conflict:manual', {
                stateId,
                localState,
                remoteState,
                resolver: resolve
            });
        });
    }

    /**
     * 잠금 획득
     */
    async acquireLock(stateId) {
        const maxWait = 10000;
        const startTime = Date.now();
        
        while (this.locks.get(stateId)) {
            if (Date.now() - startTime > maxWait) {
                throw new Error(`상태 잠금 대기 시간 초과: ${stateId}`);
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        this.locks.set(stateId, true);
    }

    /**
     * 잠금 해제
     */
    releaseLock(stateId) {
        this.locks.delete(stateId);
    }

    /**
     * 상태 목록 조회
     */
    getStateList() {
        return Array.from(this.states.keys()).map(stateId => ({
            id: stateId,
            version: this.versions.get(stateId),
            lastUpdate: this.states.get(stateId)?.timestamp
        }));
    }

    /**
     * 상태 통계 조회
     */
    getStateStats() {
        return {
            totalStates: this.states.size,
            activeStates: Array.from(this.states.values()).filter(s => s.active).length,
            totalVersions: Array.from(this.versions.values()).reduce((sum, v) => sum + v, 0),
            avgVersion: this.versions.size > 0 ? 
                Array.from(this.versions.values()).reduce((sum, v) => sum + v, 0) / this.versions.size : 0
        };
    }

    /**
     * 상태 삭제
     */
    async deleteState(stateId) {
        try {
            await this.acquireLock(stateId);
            
            this.states.delete(stateId);
            this.versions.delete(stateId);
            
            const filename = `state_${stateId}.json`;
            const filePath = path.join(this.fileManager.statesDir, filename);
            await this.fileManager.deleteFile(filePath);
            
            this.emit('state:deleted', {
                stateId,
                timestamp: new Date()
            });
            
        } catch (error) {
            console.error(chalk.red(`❌ 상태 삭제 실패: ${stateId}`), error.message);
            throw error;
        } finally {
            this.releaseLock(stateId);
        }
    }

    /**
     * 정리 및 종료
     */
    async shutdown() {
        try {
            // 최종 동기화
            await this.syncAllStates();
            
            // 파일 매니저 종료
            await this.fileManager.shutdown();
            
            // 리소스 정리
            this.states.clear();
            this.versions.clear();
            this.locks.clear();
            this.removeAllListeners();
            
            this.initialized = false;
            console.log(chalk.green('✅ StateSyncManager 종료 완료'));
        } catch (error) {
            console.error(chalk.red('❌ StateSyncManager 종료 실패:'), error.message);
            throw error;
        }
    }
}

module.exports = StateSyncManager;