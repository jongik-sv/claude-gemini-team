/**
 * 파일 시스템 관리자
 * Agent 간 파일 기반 데이터 교환을 위한 유틸리티
 */

const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');
const chalk = require('chalk');

class FileManager extends EventEmitter {
    constructor() {
        super();
        this.sharedDir = path.join(__dirname, '../../shared');
        this.workflowsDir = path.join(this.sharedDir, 'workflows');
        this.resultsDir = path.join(this.sharedDir, 'results');
        this.statesDir = path.join(this.sharedDir, 'states');
        this.tempDir = path.join(this.sharedDir, 'temp');
        
        this.watchedFiles = new Map();
        this.lockTimeout = 30000;
        this.initialized = false;
    }

    /**
     * 파일 시스템 초기화
     */
    async initialize() {
        try {
            await this.createDirectories();
            await this.setupWatchers();
            this.initialized = true;
            console.log(chalk.green('✅ FileManager 초기화 완료'));
        } catch (error) {
            console.error(chalk.red('❌ FileManager 초기화 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 디렉터리 생성
     */
    async createDirectories() {
        const dirs = [
            this.sharedDir,
            this.workflowsDir,
            this.resultsDir,
            this.statesDir,
            this.tempDir
        ];

        for (const dir of dirs) {
            try {
                await fs.mkdir(dir, { recursive: true });
            } catch (error) {
                if (error.code !== 'EEXIST') {
                    throw error;
                }
            }
        }
    }

    /**
     * 파일 감시자 설정
     */
    async setupWatchers() {
        const watchDirs = [
            this.workflowsDir,
            this.resultsDir,
            this.statesDir
        ];

        for (const dir of watchDirs) {
            try {
                const watcher = fs.watch(dir, { recursive: true });
                for await (const event of watcher) {
                    this.handleFileEvent(event, dir);
                }
            } catch (error) {
                console.warn(chalk.yellow(`⚠️ 파일 감시자 설정 실패: ${dir}`));
            }
        }
    }

    /**
     * 파일 이벤트 처리
     */
    handleFileEvent(event, dir) {
        const { eventType, filename } = event;
        if (filename && eventType === 'change') {
            const fullPath = path.join(dir, filename);
            this.emit('file:changed', {
                path: fullPath,
                filename,
                directory: dir,
                timestamp: new Date()
            });
        }
    }

    /**
     * 워크플로우 파일 저장
     */
    async saveWorkflow(workflowId, data) {
        const filename = `workflow_${workflowId}.json`;
        const filePath = path.join(this.workflowsDir, filename);
        
        try {
            await this.writeJsonFile(filePath, {
                id: workflowId,
                data,
                timestamp: new Date().toISOString(),
                version: 1
            });
            
            this.emit('workflow:saved', { workflowId, filePath });
            return filePath;
        } catch (error) {
            console.error(chalk.red(`❌ 워크플로우 저장 실패: ${workflowId}`), error.message);
            throw error;
        }
    }

    /**
     * 워크플로우 파일 로드
     */
    async loadWorkflow(workflowId) {
        const filename = `workflow_${workflowId}.json`;
        const filePath = path.join(this.workflowsDir, filename);
        
        try {
            const content = await this.readJsonFile(filePath);
            this.emit('workflow:loaded', { workflowId, filePath });
            return content;
        } catch (error) {
            console.error(chalk.red(`❌ 워크플로우 로드 실패: ${workflowId}`), error.message);
            throw error;
        }
    }

    /**
     * 결과 파일 저장
     */
    async saveResult(agentId, taskId, result) {
        const filename = `result_${agentId}_${taskId}.json`;
        const filePath = path.join(this.resultsDir, filename);
        
        try {
            await this.writeJsonFile(filePath, {
                agentId,
                taskId,
                result,
                timestamp: new Date().toISOString(),
                version: 1
            });
            
            this.emit('result:saved', { agentId, taskId, filePath });
            return filePath;
        } catch (error) {
            console.error(chalk.red(`❌ 결과 저장 실패: ${agentId}/${taskId}`), error.message);
            throw error;
        }
    }

    /**
     * 결과 파일 로드
     */
    async loadResult(agentId, taskId) {
        const filename = `result_${agentId}_${taskId}.json`;
        const filePath = path.join(this.resultsDir, filename);
        
        try {
            const content = await this.readJsonFile(filePath);
            this.emit('result:loaded', { agentId, taskId, filePath });
            return content;
        } catch (error) {
            console.error(chalk.red(`❌ 결과 로드 실패: ${agentId}/${taskId}`), error.message);
            throw error;
        }
    }

    /**
     * 상태 파일 저장
     */
    async saveState(stateId, state) {
        const filename = `state_${stateId}.json`;
        const filePath = path.join(this.statesDir, filename);
        
        try {
            await this.writeJsonFile(filePath, {
                id: stateId,
                state,
                timestamp: new Date().toISOString(),
                version: 1
            });
            
            this.emit('state:saved', { stateId, filePath });
            return filePath;
        } catch (error) {
            console.error(chalk.red(`❌ 상태 저장 실패: ${stateId}`), error.message);
            throw error;
        }
    }

    /**
     * 상태 파일 로드
     */
    async loadState(stateId) {
        const filename = `state_${stateId}.json`;
        const filePath = path.join(this.statesDir, filename);
        
        try {
            const content = await this.readJsonFile(filePath);
            this.emit('state:loaded', { stateId, filePath });
            return content;
        } catch (error) {
            console.error(chalk.red(`❌ 상태 로드 실패: ${stateId}`), error.message);
            throw error;
        }
    }

    /**
     * 임시 파일 생성
     */
    async createTempFile(prefix, data) {
        const timestamp = Date.now();
        const filename = `${prefix}_${timestamp}.json`;
        const filePath = path.join(this.tempDir, filename);
        
        try {
            await this.writeJsonFile(filePath, data);
            
            // 1시간 후 자동 삭제
            setTimeout(() => {
                this.deleteFile(filePath).catch(console.error);
            }, 3600000);
            
            return filePath;
        } catch (error) {
            console.error(chalk.red(`❌ 임시 파일 생성 실패: ${prefix}`), error.message);
            throw error;
        }
    }

    /**
     * JSON 파일 읽기
     */
    async readJsonFile(filePath) {
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    }

    /**
     * JSON 파일 쓰기
     */
    async writeJsonFile(filePath, data) {
        const content = JSON.stringify(data, null, 2);
        await fs.writeFile(filePath, content, 'utf8');
    }

    /**
     * 파일 삭제
     */
    async deleteFile(filePath) {
        try {
            await fs.unlink(filePath);
            this.emit('file:deleted', { filePath });
        } catch (error) {
            if (error.code !== 'ENOENT') {
                throw error;
            }
        }
    }

    /**
     * 파일 목록 조회
     */
    async listFiles(directory) {
        const targetDir = this.getTargetDirectory(directory);
        const files = await fs.readdir(targetDir);
        
        return files.map(filename => ({
            filename,
            path: path.join(targetDir, filename),
            type: this.getFileType(filename)
        }));
    }

    /**
     * 파일 타입 추론
     */
    getFileType(filename) {
        if (filename.startsWith('workflow_')) return 'workflow';
        if (filename.startsWith('result_')) return 'result';
        if (filename.startsWith('state_')) return 'state';
        return 'unknown';
    }

    /**
     * 대상 디렉터리 해석
     */
    getTargetDirectory(directory) {
        switch (directory) {
            case 'workflows': return this.workflowsDir;
            case 'results': return this.resultsDir;
            case 'states': return this.statesDir;
            case 'temp': return this.tempDir;
            default: return this.sharedDir;
        }
    }

    /**
     * 파일 백업
     */
    async backup(sourceDir, backupDir) {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupPath = path.join(backupDir, `backup_${timestamp}`);
            
            await fs.mkdir(backupPath, { recursive: true });
            
            const files = await fs.readdir(sourceDir);
            for (const file of files) {
                const sourcePath = path.join(sourceDir, file);
                const targetPath = path.join(backupPath, file);
                await fs.copyFile(sourcePath, targetPath);
            }
            
            this.emit('backup:completed', { backupPath });
            return backupPath;
        } catch (error) {
            console.error(chalk.red('❌ 백업 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 정리 및 종료
     */
    async shutdown() {
        try {
            // 임시 파일 정리
            const tempFiles = await fs.readdir(this.tempDir);
            for (const file of tempFiles) {
                await this.deleteFile(path.join(this.tempDir, file));
            }
            
            this.removeAllListeners();
            this.initialized = false;
            
            console.log(chalk.green('✅ FileManager 종료 완료'));
        } catch (error) {
            console.error(chalk.red('❌ FileManager 종료 실패:'), error.message);
            throw error;
        }
    }
}

module.exports = FileManager;