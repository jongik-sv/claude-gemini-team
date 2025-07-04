/**
 * API Configuration Manager
 * API 키 관리와 연결 검증을 담당하는 유틸리티
 */

const fs = require('fs').promises;
const path = require('path');
const chalk = require('chalk');
require('dotenv').config();

class ApiConfigManager {
    constructor() {
        this.envPath = path.join(__dirname, '../../.env');
        this.apiConfigs = {
            claude: {
                keyEnv: 'CLAUDE_API_KEY',
                urlEnv: 'CLAUDE_API_URL',
                defaultUrl: 'https://api.anthropic.com/v1/messages',
                name: 'Claude API'
            },
            gemini: {
                keyEnv: 'GEMINI_API_KEY', 
                urlEnv: 'GEMINI_API_URL',
                defaultUrl: 'https://generativelanguage.googleapis.com/v1beta/models',
                name: 'Gemini API'
            }
        };
    }

    /**
     * API 키 존재 여부 확인
     * @param {string} provider - 'claude' 또는 'gemini'
     * @returns {boolean} API 키 존재 여부
     */
    hasApiKey(provider) {
        const config = this.apiConfigs[provider];
        if (!config) return false;
        
        return !!process.env[config.keyEnv];
    }

    /**
     * API 설정 정보 조회
     * @param {string} provider - 'claude' 또는 'gemini'
     * @returns {Object} API 설정 정보
     */
    getApiConfig(provider) {
        const config = this.apiConfigs[provider];
        if (!config) {
            throw new Error(`Unknown API provider: ${provider}`);
        }

        return {
            apiKey: process.env[config.keyEnv] || null,
            apiUrl: process.env[config.urlEnv] || config.defaultUrl,
            hasKey: !!process.env[config.keyEnv],
            name: config.name
        };
    }

    /**
     * 모든 API 설정 상태 확인
     * @returns {Object} 전체 API 설정 상태
     */
    getApiStatus() {
        const status = {};
        
        for (const [provider, config] of Object.entries(this.apiConfigs)) {
            status[provider] = {
                name: config.name,
                hasKey: this.hasApiKey(provider),
                url: process.env[config.urlEnv] || config.defaultUrl,
                keyEnv: config.keyEnv
            };
        }

        return status;
    }

    /**
     * .env 파일 생성 (없는 경우)
     */
    async ensureEnvFile() {
        try {
            await fs.access(this.envPath);
        } catch (error) {
            // .env 파일이 없으면 .env.example에서 복사
            const examplePath = path.join(__dirname, '../../.env.example');
            try {
                const exampleContent = await fs.readFile(examplePath, 'utf8');
                await fs.writeFile(this.envPath, exampleContent);
                console.log(chalk.green('✅ .env 파일이 생성되었습니다.'));
            } catch (copyError) {
                console.warn(chalk.yellow('⚠️  .env 파일을 생성할 수 없습니다.'));
            }
        }
    }

    /**
     * API 키 설정
     * @param {string} provider - 'claude' 또는 'gemini'  
     * @param {string} apiKey - API 키
     */
    async setApiKey(provider, apiKey) {
        const config = this.apiConfigs[provider];
        if (!config) {
            throw new Error(`Unknown API provider: ${provider}`);
        }

        await this.ensureEnvFile();

        try {
            let envContent = '';
            try {
                envContent = await fs.readFile(this.envPath, 'utf8');
            } catch (error) {
                // 파일이 없으면 빈 내용으로 시작
            }

            const keyPattern = new RegExp(`^${config.keyEnv}=.*$`, 'm');
            const newKeyLine = `${config.keyEnv}=${apiKey}`;

            if (keyPattern.test(envContent)) {
                // 기존 키 업데이트
                envContent = envContent.replace(keyPattern, newKeyLine);
            } else {
                // 새 키 추가
                envContent += `\n${newKeyLine}`;
            }

            await fs.writeFile(this.envPath, envContent);
            
            // 환경 변수 즉시 업데이트
            process.env[config.keyEnv] = apiKey;
            
            console.log(chalk.green(`✅ ${config.name} 키가 설정되었습니다.`));
            
        } catch (error) {
            throw new Error(`Failed to set API key: ${error.message}`);
        }
    }

    /**
     * API 연결 테스트
     * @param {string} provider - 'claude' 또는 'gemini'
     * @returns {Promise<boolean>} 연결 성공 여부
     */
    async testApiConnection(provider) {
        const config = this.getApiConfig(provider);
        
        if (!config.hasKey) {
            console.log(chalk.yellow(`⚠️  ${config.name} 키가 설정되지 않았습니다.`));
            return false;
        }

        try {
            console.log(chalk.blue(`🔍 ${config.name} 연결 테스트 중...`));
            
            if (provider === 'claude') {
                return await this.testClaudeConnection(config);
            } else if (provider === 'gemini') {
                return await this.testGeminiConnection(config);
            }
            
            return false;
            
        } catch (error) {
            console.log(chalk.red(`❌ ${config.name} 연결 실패: ${error.message}`));
            return false;
        }
    }

    /**
     * Claude API 연결 테스트
     */
    async testClaudeConnection(config) {
        const fetch = require('node-fetch');
        
        const response = await fetch(config.apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': config.apiKey,
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: 'claude-3-5-sonnet-20241022',
                max_tokens: 10,
                messages: [{ role: 'user', content: 'Test' }]
            })
        });

        if (response.ok) {
            console.log(chalk.green(`✅ Claude API 연결 성공`));
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
    }

    /**
     * Gemini API 연결 테스트
     */
    async testGeminiConnection(config) {
        const fetch = require('node-fetch');
        
        const url = `${config.apiUrl}/gemini-1.5-flash:generateContent?key=${config.apiKey}`;
        
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: 'Test' }] }],
                generationConfig: { maxOutputTokens: 10 }
            })
        });

        if (response.ok) {
            console.log(chalk.green(`✅ Gemini API 연결 성공`));
            return true;
        } else {
            const error = await response.json();
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }
    }

    /**
     * 전체 API 상태 출력
     */
    displayApiStatus() {
        const status = this.getApiStatus();
        
        console.log(chalk.bold.blue('\n🔧 API 설정 상태'));
        console.log(chalk.dim('─'.repeat(50)));
        
        for (const [provider, config] of Object.entries(status)) {
            const statusIcon = config.hasKey ? '✅' : '❌';
            const statusText = config.hasKey ? 'API 키 설정됨' : 'API 키 없음';
            
            console.log(`${statusIcon} ${config.name}: ${statusText}`);
            if (config.hasKey) {
                console.log(chalk.dim(`   URL: ${config.url}`));
                console.log(chalk.dim(`   환경변수: ${config.keyEnv}`));
            } else {
                console.log(chalk.yellow(`   설정 방법: ${config.keyEnv}=your_api_key`));
            }
            console.log('');
        }
    }

    /**
     * API 키 설정 가이드 출력
     */
    displaySetupGuide() {
        console.log(chalk.bold.cyan('\n📋 API 키 설정 가이드'));
        console.log(chalk.dim('─'.repeat(50)));
        
        console.log(chalk.white('1. .env 파일을 생성하고 다음과 같이 설정하세요:'));
        console.log('');
        console.log(chalk.green('# Claude API (Anthropic)'));
        console.log(chalk.green('CLAUDE_API_KEY=your_claude_api_key_here'));
        console.log('');
        console.log(chalk.green('# Gemini API (Google)'));
        console.log(chalk.green('GEMINI_API_KEY=your_gemini_api_key_here'));
        console.log('');
        
        console.log(chalk.white('2. API 키 발급 방법:'));
        console.log(chalk.blue('   • Claude API: https://console.anthropic.com/'));
        console.log(chalk.blue('   • Gemini API: https://makersuite.google.com/app/apikey'));
        console.log('');
        
        console.log(chalk.white('3. 설정 후 다음 명령어로 연결을 테스트하세요:'));
        console.log(chalk.cyan('   npm run test-api'));
        console.log('');
    }

    /**
     * 대화형 API 키 설정
     */
    async interactiveSetup() {
        const readline = require('readline');
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        const question = (text) => new Promise(resolve => rl.question(text, resolve));

        try {
            console.log(chalk.bold.magenta('\n🚀 AI 연동 설정을 시작합니다!'));
            this.displayApiStatus();

            for (const [provider, config] of Object.entries(this.apiConfigs)) {
                if (!this.hasApiKey(provider)) {
                    console.log(chalk.yellow(`\n${config.name} 설정이 필요합니다.`));
                    const apiKey = await question(`${config.name} API 키를 입력하세요 (건너뛰려면 Enter): `);
                    
                    if (apiKey.trim()) {
                        await this.setApiKey(provider, apiKey.trim());
                        await this.testApiConnection(provider);
                    }
                }
            }

            console.log(chalk.green('\n✅ API 키 설정이 완료되었습니다!'));
            this.displayApiStatus();
            
        } finally {
            rl.close();
        }
    }
}

module.exports = { ApiConfigManager };