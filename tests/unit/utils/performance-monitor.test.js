/**
 * PerformanceMonitor 테스트
 */

const PerformanceMonitor = require('../../../src/utils/performance-monitor');
const fs = require('fs').promises;
const path = require('path');

describe('PerformanceMonitor', () => {
    let performanceMonitor;
    let testDir;

    beforeEach(async () => {
        testDir = path.join(__dirname, '../../../temp/test-metrics');
        const metricsFile = path.join(testDir, 'test-performance.json');
        
        performanceMonitor = new PerformanceMonitor({
            metricsInterval: 100, // 빠른 테스트를 위해 짧은 간격
            metricsFile,
            enableAlerts: true,
            alertThresholds: {
                memoryUsage: 80,
                responseTime: 1000,
                errorRate: 10
            }
        });
        
        await performanceMonitor.initialize();
    });

    afterEach(async () => {
        await performanceMonitor.shutdown();
        try {
            await fs.rm(testDir, { recursive: true, force: true });
        } catch (error) {
            // 무시 - 테스트 환경에서는 정리 실패가 발생할 수 있음
        }
    });

    describe('초기화', () => {
        it('should initialize performance monitor successfully', () => {
            expect(performanceMonitor.initialized).toBe(true);
        });

        it('should create metrics directory', async () => {
            const stat = await fs.stat(testDir);
            expect(stat.isDirectory()).toBe(true);
        });

        it('should start collecting metrics', (done) => {
            performanceMonitor.on('metrics:collected', (metrics) => {
                expect(metrics).toBeDefined();
                expect(metrics.timestamp).toBeDefined();
                expect(metrics.memory).toBeDefined();
                expect(metrics.uptime).toBeGreaterThan(0);
                done();
            });
        });
    });

    describe('태스크 성능 추적', () => {
        it('should start task tracking successfully', () => {
            const taskId = 'test-task-1';
            const agentId = 'test-agent';
            const metadata = { type: 'test' };

            const tracking = performanceMonitor.startTaskTracking(taskId, agentId, metadata);
            
            expect(tracking.taskId).toBe(taskId);
            expect(tracking.agentId).toBe(agentId);
            expect(tracking.metadata).toEqual(metadata);
            expect(tracking.status).toBe('running');
            expect(tracking.startTime).toBeDefined();
        });

        it('should end task tracking successfully', (done) => {
            const taskId = 'test-task-2';
            const agentId = 'test-agent';

            performanceMonitor.startTaskTracking(taskId, agentId);
            
            // 짧은 지연 후 종료
            setTimeout(() => {
                const result = performanceMonitor.endTaskTracking(taskId, true, { output: 'success' });
                
                expect(result.taskId).toBe(taskId);
                expect(result.success).toBe(true);
                expect(result.duration).toBeGreaterThan(0);
                expect(result.status).toBe('completed');
                done();
            }, 50);
        });

        it('should emit events for task lifecycle', (done) => {
            const taskId = 'test-task-3';
            const agentId = 'test-agent';
            
            let startEventReceived = false;
            
            performanceMonitor.on('task:started', (tracking) => {
                expect(tracking.taskId).toBe(taskId);
                startEventReceived = true;
            });

            performanceMonitor.on('task:completed', (tracking) => {
                expect(tracking.taskId).toBe(taskId);
                expect(startEventReceived).toBe(true);
                done();
            });

            performanceMonitor.startTaskTracking(taskId, agentId);
            setTimeout(() => {
                performanceMonitor.endTaskTracking(taskId, true);
            }, 10);
        });

        it('should handle failed tasks', () => {
            const taskId = 'test-task-4';
            const agentId = 'test-agent';

            performanceMonitor.startTaskTracking(taskId, agentId);
            const result = performanceMonitor.endTaskTracking(taskId, false, { error: 'Test error' });
            
            expect(result.success).toBe(false);
            expect(result.status).toBe('failed');
            expect(result.result.error).toBe('Test error');
        });
    });

    describe('에이전트 메트릭', () => {
        it('should update agent metrics when tasks complete', () => {
            const agentId = 'test-agent-metrics';
            const taskId1 = 'task-1';
            const taskId2 = 'task-2';

            // 첫 번째 태스크
            performanceMonitor.startTaskTracking(taskId1, agentId);
            performanceMonitor.endTaskTracking(taskId1, true);

            // 두 번째 태스크
            performanceMonitor.startTaskTracking(taskId2, agentId);
            performanceMonitor.endTaskTracking(taskId2, false);

            const agentMetrics = performanceMonitor.metrics.agents.get(agentId);
            
            expect(agentMetrics.agentId).toBe(agentId);
            expect(agentMetrics.totalTasks).toBe(2);
            expect(agentMetrics.successfulTasks).toBe(1);
            expect(agentMetrics.failedTasks).toBe(1);
            expect(agentMetrics.successRate).toBe(50);
        });

        it('should calculate average duration correctly', (done) => {
            const agentId = 'test-agent-duration';
            let completedTasks = 0;
            
            // 여러 태스크 실행
            for (let i = 0; i < 3; i++) {
                const taskId = `duration-task-${i}`;
                performanceMonitor.startTaskTracking(taskId, agentId);
                
                // 지연 시뮬레이션
                setTimeout(() => {
                    performanceMonitor.endTaskTracking(taskId, true);
                    completedTasks++;
                    
                    if (completedTasks === 3) {
                        const agentMetrics = performanceMonitor.metrics.agents.get(agentId);
                        expect(agentMetrics.averageDuration).toBeGreaterThan(0);
                        expect(agentMetrics.totalDuration).toBeGreaterThan(0);
                        done();
                    }
                }, 10 * (i + 1));
            }
        });
    });

    describe('성능 요약 및 보고서', () => {
        it('should generate performance summary', () => {
            const summary = performanceMonitor.getPerformanceSummary();
            
            expect(summary.system).toBeDefined();
            expect(summary.system.uptime).toBeGreaterThan(0);
            expect(summary.agents).toBeInstanceOf(Array);
            expect(summary.recentAlerts).toBeInstanceOf(Array);
        });

        it('should generate detailed metrics', () => {
            const detailed = performanceMonitor.getDetailedMetrics();
            
            expect(detailed.system).toBeInstanceOf(Array);
            expect(detailed.tasks).toBeInstanceOf(Array);
            expect(detailed.agents).toBeInstanceOf(Array);
            expect(detailed.alerts).toBeInstanceOf(Array);
        });

        it('should generate report for specific period', () => {
            const report = performanceMonitor.generateReport('1h');
            
            expect(report.period).toBe('1h');
            expect(report.timeRange).toBeDefined();
            expect(report.summary).toBeDefined();
            expect(report.details).toBeDefined();
        });

        it('should parse different time periods', () => {
            const periods = ['30s', '5m', '2h', '1d'];
            
            periods.forEach(period => {
                expect(() => {
                    performanceMonitor.generateReport(period);
                }).not.toThrow();
            });
        });
    });

    describe('알림 시스템', () => {
        it('should generate memory usage alert', (done) => {
            // 메모리 사용률 임계값 낮게 설정
            performanceMonitor.config.alertThresholds.memoryUsage = 1;
            
            performanceMonitor.on('alert', (alert) => {
                expect(alert.type).toBe('memory');
                expect(alert.level).toBe('warning');
                expect(alert.value).toBeGreaterThan(alert.threshold);
                done();
            });
            
            // 메트릭 수집을 강제로 실행
            performanceMonitor.collectSystemMetrics();
        });

        it('should generate response time alert', (done) => {
            // 응답 시간 임계값 낮게 설정
            performanceMonitor.config.alertThresholds.responseTime = 1;
            
            performanceMonitor.on('alert', (alert) => {
                if (alert.type === 'response_time') {
                    expect(alert.level).toBe('warning');
                    expect(alert.value).toBeGreaterThan(alert.threshold);
                    done();
                }
            });
            
            // 느린 태스크 시뮬레이션
            const taskId = 'slow-task';
            performanceMonitor.startTaskTracking(taskId, 'test-agent');
            setTimeout(() => {
                performanceMonitor.endTaskTracking(taskId, true);
                performanceMonitor.collectSystemMetrics();
            }, 50);
        });

        it('should generate error rate alert', (done) => {
            // 에러율 임계값 낮게 설정
            performanceMonitor.config.alertThresholds.errorRate = 5;
            
            performanceMonitor.on('alert', (alert) => {
                if (alert.type === 'error_rate') {
                    expect(alert.level).toBe('critical');
                    expect(alert.value).toBeGreaterThan(alert.threshold);
                    done();
                }
            });
            
            // 실패한 태스크들 생성
            for (let i = 0; i < 5; i++) {
                const taskId = `failed-task-${i}`;
                performanceMonitor.startTaskTracking(taskId, 'test-agent');
                performanceMonitor.endTaskTracking(taskId, false);
            }
            
            performanceMonitor.collectSystemMetrics();
        });
    });

    describe('메트릭 저장 및 로드', () => {
        it('should save metrics to file', async () => {
            await performanceMonitor.saveMetrics();
            
            const stat = await fs.stat(performanceMonitor.config.metricsFile);
            expect(stat.isFile()).toBe(true);
            
            const content = await fs.readFile(performanceMonitor.config.metricsFile, 'utf8');
            const data = JSON.parse(content);
            
            expect(data.system).toBeInstanceOf(Array);
            expect(data.savedAt).toBeDefined();
        });

        it('should load persisted metrics', async () => {
            // 테스트 메트릭 생성
            performanceMonitor.metrics.system.push({
                timestamp: new Date().toISOString(),
                uptime: 1000,
                memory: { heapUsed: 1000000, heapTotal: 2000000 },
                memoryUsagePercent: 50
            });
            
            await performanceMonitor.saveMetrics();
            await performanceMonitor.shutdown();
            
            // 새 인스턴스로 로드 테스트
            const newMonitor = new PerformanceMonitor({
                metricsFile: performanceMonitor.config.metricsFile
            });
            
            await newMonitor.initialize();
            
            expect(newMonitor.metrics.system.length).toBeGreaterThan(0);
            
            await newMonitor.shutdown();
        });
    });

    describe('메트릭 관리', () => {
        it('should clear all metrics', () => {
            performanceMonitor.startTaskTracking('test-task', 'test-agent');
            performanceMonitor.endTaskTracking('test-task', true);
            
            expect(performanceMonitor.metrics.tasks.size).toBeGreaterThan(0);
            expect(performanceMonitor.metrics.agents.size).toBeGreaterThan(0);
            
            performanceMonitor.clearMetrics();
            
            expect(performanceMonitor.metrics.tasks.size).toBe(0);
            expect(performanceMonitor.metrics.agents.size).toBe(0);
            expect(performanceMonitor.metrics.system.length).toBe(0);
            expect(performanceMonitor.metrics.alerts.length).toBe(0);
        });

        it('should limit history size', () => {
            const historySize = 5;
            performanceMonitor.config.historySize = historySize;
            
            // 기존 메트릭 초기화
            performanceMonitor.metrics.system = [];
            
            // 히스토리 크기보다 많은 메트릭 추가
            for (let i = 0; i < historySize + 3; i++) {
                performanceMonitor.metrics.system.push({
                    timestamp: new Date().toISOString(),
                    index: i
                });
            }
            
            // 다음 수집에서 크기 제한 적용
            performanceMonitor.collectSystemMetrics();
            
            expect(performanceMonitor.metrics.system.length).toBeLessThanOrEqual(historySize + 1);
        });
    });

    describe('정리 및 종료', () => {
        it('should shutdown gracefully', async () => {
            await performanceMonitor.shutdown();
            
            expect(performanceMonitor.initialized).toBe(false);
            expect(performanceMonitor.intervalId).toBeNull();
        });
    });
});