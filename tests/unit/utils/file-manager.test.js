/**
 * FileManager 테스트
 */

const FileManager = require('../../../src/utils/file-manager');
const fs = require('fs').promises;
const path = require('path');

describe('FileManager', () => {
    let fileManager;
    let testDir;

    beforeEach(async () => {
        fileManager = new FileManager();
        testDir = path.join(__dirname, '../../../temp/test-files');
        
        // 테스트용 디렉터리 설정
        fileManager.sharedDir = testDir;
        fileManager.workflowsDir = path.join(testDir, 'workflows');
        fileManager.resultsDir = path.join(testDir, 'results');
        fileManager.statesDir = path.join(testDir, 'states');
        fileManager.tempDir = path.join(testDir, 'temp');
        
        await fileManager.initialize();
    });

    afterEach(async () => {
        await fileManager.shutdown();
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // 무시 - 테스트 환경에서는 정리 실패가 발생할 수 있음
        }
    });

    describe('초기화', () => {
        it('should initialize file manager successfully', () => {
            expect(fileManager.initialized).toBe(true);
        });

        it('should create required directories', async () => {
            const dirs = [
                fileManager.workflowsDir,
                fileManager.resultsDir,
                fileManager.statesDir,
                fileManager.tempDir
            ];

            for (const dir of dirs) {
                const stat = await fs.stat(dir);
                expect(stat.isDirectory()).toBe(true);
            }
        });
    });

    describe('워크플로우 관리', () => {
        it('should save workflow successfully', async () => {
            const workflowId = 'test-workflow-1';
            const data = { name: 'Test Workflow', tasks: [] };

            const filePath = await fileManager.saveWorkflow(workflowId, data);
            
            expect(filePath).toContain(`workflow_${workflowId}.json`);
            
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.id).toBe(workflowId);
            expect(parsed.data).toEqual(data);
            expect(parsed.version).toBe(1);
        });

        it('should load workflow successfully', async () => {
            const workflowId = 'test-workflow-2';
            const data = { name: 'Test Workflow 2', tasks: ['task1', 'task2'] };

            await fileManager.saveWorkflow(workflowId, data);
            const loaded = await fileManager.loadWorkflow(workflowId);
            
            expect(loaded.id).toBe(workflowId);
            expect(loaded.data).toEqual(data);
            expect(loaded.version).toBe(1);
        });

        it('should emit events for workflow operations', async () => {
            const workflowId = 'test-workflow-3';
            const data = { name: 'Test Workflow 3' };

            const savePromise = new Promise(resolve => {
                fileManager.on('workflow:saved', resolve);
            });

            const loadPromise = new Promise(resolve => {
                fileManager.on('workflow:loaded', resolve);
            });

            await fileManager.saveWorkflow(workflowId, data);
            const saveEvent = await savePromise;
            expect(saveEvent.workflowId).toBe(workflowId);

            await fileManager.loadWorkflow(workflowId);
            const loadEvent = await loadPromise;
            expect(loadEvent.workflowId).toBe(workflowId);
        });
    });

    describe('결과 관리', () => {
        it('should save result successfully', async () => {
            const agentId = 'test-agent';
            const taskId = 'test-task';
            const result = { status: 'completed', output: 'test output' };

            const filePath = await fileManager.saveResult(agentId, taskId, result);
            
            expect(filePath).toContain(`result_${agentId}_${taskId}.json`);
            
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.agentId).toBe(agentId);
            expect(parsed.taskId).toBe(taskId);
            expect(parsed.result).toEqual(result);
        });

        it('should load result successfully', async () => {
            const agentId = 'test-agent-2';
            const taskId = 'test-task-2';
            const result = { status: 'failed', error: 'test error' };

            await fileManager.saveResult(agentId, taskId, result);
            const loaded = await fileManager.loadResult(agentId, taskId);
            
            expect(loaded.agentId).toBe(agentId);
            expect(loaded.taskId).toBe(taskId);
            expect(loaded.result).toEqual(result);
        });
    });

    describe('상태 관리', () => {
        it('should save state successfully', async () => {
            const stateId = 'test-state';
            const state = { active: true, progress: 50 };

            const filePath = await fileManager.saveState(stateId, state);
            
            expect(filePath).toContain(`state_${stateId}.json`);
            
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed.id).toBe(stateId);
            expect(parsed.state).toEqual(state);
        });

        it('should load state successfully', async () => {
            const stateId = 'test-state-2';
            const state = { active: false, progress: 100 };

            await fileManager.saveState(stateId, state);
            const loaded = await fileManager.loadState(stateId);
            
            expect(loaded.id).toBe(stateId);
            expect(loaded.state).toEqual(state);
        });
    });

    describe('임시 파일 관리', () => {
        it('should create temporary file successfully', async () => {
            const prefix = 'test-temp';
            const data = { temporary: true, content: 'test content' };

            const filePath = await fileManager.createTempFile(prefix, data);
            
            expect(filePath).toContain(prefix);
            expect(filePath).toContain('.json');
            
            const content = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(content);
            
            expect(parsed).toEqual(data);
        });
    });

    describe('파일 목록 조회', () => {
        it('should list workflow files', async () => {
            await fileManager.saveWorkflow('workflow-1', { name: 'Test 1' });
            await fileManager.saveWorkflow('workflow-2', { name: 'Test 2' });

            const files = await fileManager.listFiles('workflows');
            
            expect(files).toHaveLength(2);
            expect(files[0].type).toBe('workflow');
            expect(files[1].type).toBe('workflow');
        });

        it('should list result files', async () => {
            await fileManager.saveResult('agent-1', 'task-1', { status: 'completed' });
            await fileManager.saveResult('agent-2', 'task-2', { status: 'failed' });

            const files = await fileManager.listFiles('results');
            
            expect(files).toHaveLength(2);
            expect(files[0].type).toBe('result');
            expect(files[1].type).toBe('result');
        });
    });

    describe('파일 타입 추론', () => {
        it('should identify workflow files', () => {
            expect(fileManager.getFileType('workflow_test.json')).toBe('workflow');
        });

        it('should identify result files', () => {
            expect(fileManager.getFileType('result_agent_task.json')).toBe('result');
        });

        it('should identify state files', () => {
            expect(fileManager.getFileType('state_test.json')).toBe('state');
        });

        it('should identify unknown files', () => {
            expect(fileManager.getFileType('unknown.json')).toBe('unknown');
        });
    });

    describe('백업 기능', () => {
        it('should backup files successfully', async () => {
            // 테스트 파일 생성
            await fileManager.saveWorkflow('backup-test', { name: 'Backup Test' });
            
            const backupDir = path.join(testDir, 'backup');
            await fs.mkdir(backupDir, { recursive: true });
            
            const backupPath = await fileManager.backup(fileManager.workflowsDir, backupDir);
            
            expect(backupPath).toContain('backup_');
            
            const backupFiles = await fs.readdir(backupPath);
            expect(backupFiles).toHaveLength(1);
            expect(backupFiles[0]).toContain('workflow_backup-test.json');
        });
    });

    describe('정리 및 종료', () => {
        it('should shutdown gracefully', async () => {
            await fileManager.createTempFile('test-cleanup', { test: true });
            
            await fileManager.shutdown();
            
            expect(fileManager.initialized).toBe(false);
            
            // 임시 파일이 정리되었는지 확인
            const tempFiles = await fs.readdir(fileManager.tempDir);
            expect(tempFiles).toHaveLength(0);
        });
    });
});