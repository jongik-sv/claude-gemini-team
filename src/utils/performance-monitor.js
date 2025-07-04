/**
 * 성능 모니터링 시스템
 * 시스템 성능 지표 수집, 분석 및 알림
 */

const { EventEmitter } = require('events');
const chalk = require('chalk');
const fs = require('fs').promises;
const path = require('path');

class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = {
            metricsInterval: config.metricsInterval || 5000,
            alertThresholds: {
                memoryUsage: config.alertThresholds?.memoryUsage || 80,
                cpuUsage: config.alertThresholds?.cpuUsage || 85,
                responseTime: config.alertThresholds?.responseTime || 5000,
                errorRate: config.alertThresholds?.errorRate || 10
            },
            historySize: config.historySize || 1000,
            enableAlerts: config.enableAlerts !== false,
            metricsFile: config.metricsFile || path.join(__dirname, '../../shared/metrics/performance.json')
        };
        
        this.metrics = {
            tasks: new Map(),
            agents: new Map(),
            system: [],
            alerts: []
        };
        
        this.startTime = Date.now();
        this.initialized = false;
        this.intervalId = null;
    }

    /**
     * 성능 모니터링 시스템 초기화
     */
    async initialize() {
        try {
            await this.setupMetricsDirectory();
            await this.loadPersistedMetrics();
            this.startMonitoring();
            this.initialized = true;
            console.log(chalk.green('✅ PerformanceMonitor 초기화 완료'));
        } catch (error) {
            console.error(chalk.red('❌ PerformanceMonitor 초기화 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 메트릭 디렉터리 설정
     */
    async setupMetricsDirectory() {
        const metricsDir = path.dirname(this.config.metricsFile);
        await fs.mkdir(metricsDir, { recursive: true });
    }

    /**
     * 저장된 메트릭 로드
     */
    async loadPersistedMetrics() {
        try {
            const data = await fs.readFile(this.config.metricsFile, 'utf8');
            const persistedMetrics = JSON.parse(data);
            
            if (persistedMetrics.system) {
                this.metrics.system = persistedMetrics.system.slice(-this.config.historySize);
            }
            
            console.log(chalk.blue('📊 저장된 성능 메트릭 로드 완료'));
        } catch (error) {
            // 파일이 없는 경우는 정상 (첫 실행)
            if (error.code !== 'ENOENT') {
                console.warn(chalk.yellow('⚠️ 성능 메트릭 로드 실패:'), error.message);
            }
        }
    }

    /**
     * 모니터링 시작
     */
    startMonitoring() {
        this.intervalId = setInterval(() => {
            this.collectSystemMetrics();
        }, this.config.metricsInterval);
        
        console.log(chalk.blue(`📊 성능 모니터링 시작 (${this.config.metricsInterval}ms 간격)`));
    }

    /**
     * 시스템 메트릭 수집
     */
    collectSystemMetrics() {
        const metrics = {
            timestamp: new Date().toISOString(),
            uptime: Date.now() - this.startTime,
            memory: process.memoryUsage(),
            cpu: process.cpuUsage(),
            activeAgents: this.metrics.agents.size,
            activeTasks: Array.from(this.metrics.tasks.values()).filter(t => t.status === 'running').length,
            totalTasks: this.metrics.tasks.size
        };

        // 메모리 사용률 계산
        metrics.memoryUsagePercent = (metrics.memory.heapUsed / metrics.memory.heapTotal) * 100;
        
        // 기록 추가
        this.metrics.system.push(metrics);
        
        // 히스토리 크기 제한
        while (this.metrics.system.length > this.config.historySize) {
            this.metrics.system.shift();
        }

        // 알림 체크
        if (this.config.enableAlerts) {
            this.checkAlerts(metrics);
        }

        // 이벤트 발생
        this.emit('metrics:collected', metrics);
    }

    /**
     * 태스크 성능 기록 시작
     */
    startTaskTracking(taskId, agentId, metadata = {}) {
        const tracking = {
            taskId,
            agentId,
            startTime: Date.now(),
            metadata,
            status: 'running'
        };
        
        this.metrics.tasks.set(taskId, tracking);
        this.emit('task:started', tracking);
        
        return tracking;
    }

    /**
     * 태스크 성능 기록 종료
     */
    endTaskTracking(taskId, success = true, result = null) {
        const tracking = this.metrics.tasks.get(taskId);
        if (!tracking) {
            console.warn(chalk.yellow(`⚠️ 추적되지 않은 태스크 종료: ${taskId}`));
            return null;
        }

        const endTime = Date.now();
        tracking.endTime = endTime;
        tracking.duration = endTime - tracking.startTime;
        tracking.success = success;
        tracking.result = result;
        tracking.status = success ? 'completed' : 'failed';
        
        // 에이전트 성능 업데이트
        this.updateAgentMetrics(tracking.agentId, tracking);
        
        this.emit('task:completed', tracking);
        
        return tracking;
    }

    /**
     * 에이전트 성능 메트릭 업데이트
     */
    updateAgentMetrics(agentId, taskTracking) {
        let agentMetrics = this.metrics.agents.get(agentId);
        
        if (!agentMetrics) {
            agentMetrics = {
                agentId,
                totalTasks: 0,
                successfulTasks: 0,
                failedTasks: 0,
                totalDuration: 0,
                averageDuration: 0,
                lastActivity: null
            };
            this.metrics.agents.set(agentId, agentMetrics);
        }

        agentMetrics.totalTasks++;
        agentMetrics.totalDuration += taskTracking.duration;
        agentMetrics.averageDuration = agentMetrics.totalDuration / agentMetrics.totalTasks;
        agentMetrics.lastActivity = taskTracking.endTime;
        
        if (taskTracking.success) {
            agentMetrics.successfulTasks++;
        } else {
            agentMetrics.failedTasks++;
        }
        
        agentMetrics.successRate = (agentMetrics.successfulTasks / agentMetrics.totalTasks) * 100;
        
        this.emit('agent:updated', agentMetrics);
    }

    /**
     * 알림 체크
     */
    checkAlerts(metrics) {
        const alerts = [];
        
        // 메모리 사용률 알림
        if (metrics.memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
            alerts.push({
                type: 'memory',
                level: 'warning',
                message: `높은 메모리 사용률: ${metrics.memoryUsagePercent.toFixed(1)}%`,
                value: metrics.memoryUsagePercent,
                threshold: this.config.alertThresholds.memoryUsage,
                timestamp: metrics.timestamp
            });
        }

        // 응답 시간 알림
        const avgResponseTime = this.getAverageResponseTime();
        if (avgResponseTime > this.config.alertThresholds.responseTime) {
            alerts.push({
                type: 'response_time',
                level: 'warning',
                message: `높은 응답 시간: ${avgResponseTime}ms`,
                value: avgResponseTime,
                threshold: this.config.alertThresholds.responseTime,
                timestamp: metrics.timestamp
            });
        }

        // 에러율 알림
        const errorRate = this.getErrorRate();
        if (errorRate > this.config.alertThresholds.errorRate) {
            alerts.push({
                type: 'error_rate',
                level: 'critical',
                message: `높은 에러율: ${errorRate.toFixed(1)}%`,
                value: errorRate,
                threshold: this.config.alertThresholds.errorRate,
                timestamp: metrics.timestamp
            });
        }

        // 알림 처리
        for (const alert of alerts) {
            this.handleAlert(alert);
        }
    }

    /**
     * 알림 처리
     */
    handleAlert(alert) {
        this.metrics.alerts.push(alert);
        
        // 알림 히스토리 제한
        if (this.metrics.alerts.length > 100) {
            this.metrics.alerts.shift();
        }

        // 콘솔 출력
        const colorFn = alert.level === 'critical' ? chalk.red : chalk.yellow;
        console.warn(colorFn(`🚨 [${alert.level.toUpperCase()}] ${alert.message}`));
        
        // 이벤트 발생
        this.emit('alert', alert);
    }

    /**
     * 평균 응답 시간 계산
     */
    getAverageResponseTime() {
        const completedTasks = Array.from(this.metrics.tasks.values())
            .filter(t => t.status === 'completed' || t.status === 'failed');
        
        if (completedTasks.length === 0) return 0;
        
        const totalDuration = completedTasks.reduce((sum, task) => sum + task.duration, 0);
        return totalDuration / completedTasks.length;
    }

    /**
     * 에러율 계산
     */
    getErrorRate() {
        const completedTasks = Array.from(this.metrics.tasks.values())
            .filter(t => t.status === 'completed' || t.status === 'failed');
        
        if (completedTasks.length === 0) return 0;
        
        const failedTasks = completedTasks.filter(t => t.status === 'failed').length;
        return (failedTasks / completedTasks.length) * 100;
    }

    /**
     * 성능 요약 조회
     */
    getPerformanceSummary() {
        const recentMetrics = this.metrics.system.slice(-10);
        const activeTasks = Array.from(this.metrics.tasks.values()).filter(t => t.status === 'running');
        
        return {
            system: {
                uptime: Date.now() - this.startTime,
                averageMemoryUsage: recentMetrics.length > 0 
                    ? recentMetrics.reduce((sum, m) => sum + m.memoryUsagePercent, 0) / recentMetrics.length 
                    : 0,
                activeAgents: this.metrics.agents.size,
                activeTasks: activeTasks.length,
                totalTasks: this.metrics.tasks.size,
                averageResponseTime: this.getAverageResponseTime(),
                errorRate: this.getErrorRate()
            },
            agents: Array.from(this.metrics.agents.values()),
            recentAlerts: this.metrics.alerts.slice(-5)
        };
    }

    /**
     * 상세 메트릭 조회
     */
    getDetailedMetrics() {
        return {
            system: this.metrics.system,
            tasks: Array.from(this.metrics.tasks.values()),
            agents: Array.from(this.metrics.agents.values()),
            alerts: this.metrics.alerts
        };
    }

    /**
     * 성능 보고서 생성
     */
    generateReport(period = '1h') {
        const now = Date.now();
        const periodMs = this.parsePeriod(period);
        const since = now - periodMs;
        
        const relevantMetrics = this.metrics.system.filter(m => 
            new Date(m.timestamp).getTime() >= since
        );
        
        const relevantTasks = Array.from(this.metrics.tasks.values()).filter(t => 
            t.startTime >= since
        );
        
        const relevantAlerts = this.metrics.alerts.filter(a => 
            new Date(a.timestamp).getTime() >= since
        );

        return {
            period,
            timeRange: {
                from: new Date(since).toISOString(),
                to: new Date(now).toISOString()
            },
            summary: {
                totalTasks: relevantTasks.length,
                successfulTasks: relevantTasks.filter(t => t.success).length,
                failedTasks: relevantTasks.filter(t => !t.success).length,
                averageDuration: relevantTasks.length > 0 
                    ? relevantTasks.reduce((sum, t) => sum + (t.duration || 0), 0) / relevantTasks.length 
                    : 0,
                totalAlerts: relevantAlerts.length
            },
            details: {
                systemMetrics: relevantMetrics,
                taskMetrics: relevantTasks,
                alerts: relevantAlerts
            }
        };
    }

    /**
     * 기간 파싱
     */
    parsePeriod(period) {
        const units = {
            's': 1000,
            'm': 60 * 1000,
            'h': 60 * 60 * 1000,
            'd': 24 * 60 * 60 * 1000
        };
        
        const match = period.match(/^(\d+)([smhd])$/);
        if (!match) {
            throw new Error(`잘못된 기간 형식: ${period}`);
        }
        
        const [, amount, unit] = match;
        return parseInt(amount) * units[unit];
    }

    /**
     * 메트릭 저장
     */
    async saveMetrics() {
        try {
            const data = {
                system: this.metrics.system,
                savedAt: new Date().toISOString()
            };
            
            await fs.writeFile(this.config.metricsFile, JSON.stringify(data, null, 2));
            console.log(chalk.blue('📊 성능 메트릭 저장 완료'));
        } catch (error) {
            console.error(chalk.red('❌ 성능 메트릭 저장 실패:'), error.message);
            throw error;
        }
    }

    /**
     * 메트릭 초기화
     */
    clearMetrics() {
        this.metrics.tasks.clear();
        this.metrics.agents.clear();
        this.metrics.system = [];
        this.metrics.alerts = [];
        
        console.log(chalk.blue('📊 성능 메트릭 초기화 완료'));
        this.emit('metrics:cleared');
    }

    /**
     * 정리 및 종료
     */
    async shutdown() {
        try {
            if (this.intervalId) {
                clearInterval(this.intervalId);
                this.intervalId = null;
            }
            
            await this.saveMetrics();
            this.removeAllListeners();
            this.initialized = false;
            
            console.log(chalk.green('✅ PerformanceMonitor 종료 완료'));
        } catch (error) {
            console.error(chalk.red('❌ PerformanceMonitor 종료 실패:'), error.message);
            throw error;
        }
    }
}

module.exports = PerformanceMonitor;