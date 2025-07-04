#!/usr/bin/env node

/**
 * Integration and E2E Test Runner
 * Executes all integration and end-to-end tests with proper setup
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import chalk from 'chalk';

class TestRunner {
    constructor() {
        this.testResults = {
            integration: { passed: 0, failed: 0, total: 0 },
            e2e: { passed: 0, failed: 0, total: 0 },
            startTime: null,
            endTime: null
        };
        this.testFiles = [];
    }

    async run() {
        console.log(chalk.blue('🚀 Starting Integration and E2E Tests\n'));
        this.testResults.startTime = Date.now();

        try {
            // Discover test files
            await this.discoverTests();
            
            // Run integration tests
            await this.runIntegrationTests();
            
            // Run E2E tests
            await this.runE2ETests();
            
            // Generate report
            await this.generateReport();
            
        } catch (error) {
            console.error(chalk.red('❌ Test runner failed:'), error.message);
            process.exit(1);
        }
    }

    async discoverTests() {
        console.log(chalk.yellow('📂 Discovering test files...\n'));
        
        const integrationDir = path.join(process.cwd(), 'tests', 'integration');
        const e2eDir = path.join(process.cwd(), 'tests', 'e2e');
        
        // Find integration test files
        if (fs.existsSync(integrationDir)) {
            const integrationFiles = fs.readdirSync(integrationDir)
                .filter(file => file.endsWith('.test.js'))
                .map(file => path.join(integrationDir, file));
            
            this.testFiles.push(...integrationFiles.map(file => ({ file, type: 'integration' })));
        }
        
        // Find E2E test files
        if (fs.existsSync(e2eDir)) {
            const e2eFiles = fs.readdirSync(e2eDir)
                .filter(file => file.endsWith('.test.js'))
                .map(file => path.join(e2eDir, file));
            
            this.testFiles.push(...e2eFiles.map(file => ({ file, type: 'e2e' })));
        }
        
        console.log(chalk.green(`✓ Found ${this.testFiles.length} test files`));
        this.testFiles.forEach(({ file, type }) => {
            console.log(`  ${type === 'integration' ? '🔗' : '🎯'} ${path.basename(file)}`);
        });
        console.log();
    }

    async runIntegrationTests() {
        console.log(chalk.blue('🔗 Running Integration Tests\n'));
        
        const integrationTests = this.testFiles.filter(t => t.type === 'integration');
        
        if (integrationTests.length === 0) {
            console.log(chalk.yellow('⚠️  No integration tests found\n'));
            return;
        }

        for (const { file } of integrationTests) {
            const testName = path.basename(file, '.test.js');
            console.log(chalk.cyan(`📝 Running ${testName}...`));
            
            try {
                const result = await this.runJestTest(file);
                
                if (result.success) {
                    console.log(chalk.green(`✓ ${testName} passed`));
                    this.testResults.integration.passed++;
                } else {
                    console.log(chalk.red(`❌ ${testName} failed`));
                    this.testResults.integration.failed++;
                    console.log(chalk.red(`  Error: ${result.error}`));
                }
            } catch (error) {
                console.log(chalk.red(`❌ ${testName} crashed`));
                console.log(chalk.red(`  Error: ${error.message}`));
                this.testResults.integration.failed++;
            }
            
            this.testResults.integration.total++;
        }
        
        console.log();
    }

    async runE2ETests() {
        console.log(chalk.blue('🎯 Running E2E Tests\n'));
        
        const e2eTests = this.testFiles.filter(t => t.type === 'e2e');
        
        if (e2eTests.length === 0) {
            console.log(chalk.yellow('⚠️  No E2E tests found\n'));
            return;
        }

        for (const { file } of e2eTests) {
            const testName = path.basename(file, '.test.js');
            console.log(chalk.cyan(`📝 Running ${testName}...`));
            
            try {
                const result = await this.runJestTest(file);
                
                if (result.success) {
                    console.log(chalk.green(`✓ ${testName} passed`));
                    this.testResults.e2e.passed++;
                } else {
                    console.log(chalk.red(`❌ ${testName} failed`));
                    this.testResults.e2e.failed++;
                    console.log(chalk.red(`  Error: ${result.error}`));
                }
            } catch (error) {
                console.log(chalk.red(`❌ ${testName} crashed`));
                console.log(chalk.red(`  Error: ${error.message}`));
                this.testResults.e2e.failed++;
            }
            
            this.testResults.e2e.total++;
        }
        
        console.log();
    }

    async runJestTest(testFile) {
        return new Promise((resolve) => {
            const jestProcess = spawn('npx', ['jest', testFile, '--verbose'], {
                stdio: 'pipe',
                cwd: process.cwd()
            });

            let stdout = '';
            let stderr = '';

            jestProcess.stdout.on('data', (data) => {
                stdout += data.toString();
            });

            jestProcess.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            jestProcess.on('close', (code) => {
                resolve({
                    success: code === 0,
                    error: code !== 0 ? stderr || stdout : null,
                    output: stdout
                });
            });
        });
    }

    async generateReport() {
        this.testResults.endTime = Date.now();
        const duration = this.testResults.endTime - this.testResults.startTime;
        
        console.log(chalk.blue('📊 Test Results Summary\n'));
        console.log(chalk.white('=' * 50));
        
        // Integration tests summary
        const integrationTotal = this.testResults.integration.total;
        const integrationPassed = this.testResults.integration.passed;
        const integrationFailed = this.testResults.integration.failed;
        
        console.log(chalk.cyan('\n🔗 Integration Tests:'));
        console.log(`  Total: ${integrationTotal}`);
        console.log(`  ${chalk.green('Passed: ' + integrationPassed)}`);
        console.log(`  ${chalk.red('Failed: ' + integrationFailed)}`);
        
        if (integrationTotal > 0) {
            const integrationRate = ((integrationPassed / integrationTotal) * 100).toFixed(1);
            console.log(`  Success Rate: ${integrationRate}%`);
        }
        
        // E2E tests summary
        const e2eTotal = this.testResults.e2e.total;
        const e2ePassed = this.testResults.e2e.passed;
        const e2eFailed = this.testResults.e2e.failed;
        
        console.log(chalk.cyan('\n🎯 E2E Tests:'));
        console.log(`  Total: ${e2eTotal}`);
        console.log(`  ${chalk.green('Passed: ' + e2ePassed)}`);
        console.log(`  ${chalk.red('Failed: ' + e2eFailed)}`);
        
        if (e2eTotal > 0) {
            const e2eRate = ((e2ePassed / e2eTotal) * 100).toFixed(1);
            console.log(`  Success Rate: ${e2eRate}%`);
        }
        
        // Overall summary
        const totalTests = integrationTotal + e2eTotal;
        const totalPassed = integrationPassed + e2ePassed;
        const totalFailed = integrationFailed + e2eFailed;
        
        console.log(chalk.white('\n📈 Overall:'));
        console.log(`  Total Tests: ${totalTests}`);
        console.log(`  ${chalk.green('Passed: ' + totalPassed)}`);
        console.log(`  ${chalk.red('Failed: ' + totalFailed)}`);
        console.log(`  Duration: ${(duration / 1000).toFixed(2)}s`);
        
        if (totalTests > 0) {
            const overallRate = ((totalPassed / totalTests) * 100).toFixed(1);
            console.log(`  Success Rate: ${overallRate}%`);
        }
        
        console.log(chalk.white('\n' + '=' * 50));
        
        // Final result
        if (totalFailed === 0) {
            console.log(chalk.green('\n🎉 All tests passed!'));
        } else {
            console.log(chalk.red(`\n❌ ${totalFailed} test(s) failed`));
        }
        
        // Save detailed report
        await this.saveDetailedReport();
    }

    async saveDetailedReport() {
        const reportData = {
            summary: {
                totalTests: this.testResults.integration.total + this.testResults.e2e.total,
                totalPassed: this.testResults.integration.passed + this.testResults.e2e.passed,
                totalFailed: this.testResults.integration.failed + this.testResults.e2e.failed,
                duration: this.testResults.endTime - this.testResults.startTime,
                timestamp: new Date().toISOString()
            },
            integration: this.testResults.integration,
            e2e: this.testResults.e2e,
            testFiles: this.testFiles.map(({ file, type }) => ({
                file: path.basename(file),
                type,
                fullPath: file
            }))
        };
        
        const reportPath = path.join(process.cwd(), 'tests', 'integration-test-report.json');
        fs.writeFileSync(reportPath, JSON.stringify(reportData, null, 2));
        
        console.log(chalk.gray(`\n📄 Detailed report saved to: ${reportPath}`));
    }
}

// Run the test runner
const runner = new TestRunner();
runner.run().catch(error => {
    console.error(chalk.red('Fatal error:'), error);
    process.exit(1);
});