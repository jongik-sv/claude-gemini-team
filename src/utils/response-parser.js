/**
 * AI 응답 파싱 및 구조화 유틸리티
 * Claude 및 Gemini CLI 응답을 구조화된 데이터로 변환
 */

const chalk = require('chalk');

class ResponseParser {
    constructor() {
        this.patterns = {
            // JSON 패턴 (다양한 형태의 JSON 블록 감지)
            json: [
                /```json\s*\n([\s\S]*?)\n```/gi,
                /```\s*\n(\{[\s\S]*?\})\s*\n```/gi,
                /(\{[\s\S]*?\})/g
            ],
            
            // 코드 블록 패턴
            codeBlock: /```(\w+)?\s*\n([\s\S]*?)\n```/gi,
            
            // 마크다운 헤더
            headers: /^(#{1,6})\s+(.+)$/gm,
            
            // 리스트 아이템
            lists: /^[\s]*[-*+]\s+(.+)$/gm,
            
            // 번호 리스트
            numberedLists: /^[\s]*\d+\.\s+(.+)$/gm,
            
            // 강조 텍스트
            bold: /\*\*(.*?)\*\*/g,
            italic: /\*(.*?)\*/g,
            
            // 링크
            links: /\[([^\]]+)\]\(([^)]+)\)/g,
            
            // 테이블
            tables: /^\|(.+)\|$/gm
        };
    }

    /**
     * AI 응답을 구조화된 객체로 파싱
     * @param {string} rawResponse - 원본 응답 텍스트
     * @param {string} provider - AI 제공자 (claude, gemini)
     * @returns {Object} 구조화된 응답 객체
     */
    parseResponse(rawResponse, provider = 'unknown') {
        if (!rawResponse || typeof rawResponse !== 'string') {
            return this.createEmptyResponse(provider);
        }

        const parsed = {
            provider,
            rawText: rawResponse,
            parsedAt: new Date(),
            structure: {
                hasJson: false,
                hasCode: false,
                hasMarkdown: false,
                hasList: false,
                hasTable: false
            },
            content: {
                text: this.extractPlainText(rawResponse),
                json: this.extractJSON(rawResponse),
                codeBlocks: this.extractCodeBlocks(rawResponse),
                headers: this.extractHeaders(rawResponse),
                lists: this.extractLists(rawResponse),
                tables: this.extractTables(rawResponse),
                metadata: this.extractMetadata(rawResponse)
            },
            summary: ''
        };

        // 구조 분석
        parsed.structure.hasJson = parsed.content.json.length > 0;
        parsed.structure.hasCode = parsed.content.codeBlocks.length > 0;
        parsed.structure.hasMarkdown = parsed.content.headers.length > 0;
        parsed.structure.hasList = parsed.content.lists.length > 0;
        parsed.structure.hasTable = parsed.content.tables.length > 0;

        // 요약 생성
        parsed.summary = this.generateSummary(parsed);

        return parsed;
    }

    /**
     * JSON 데이터 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 추출된 JSON 객체들
     */
    extractJSON(text) {
        const jsonObjects = [];

        for (const pattern of this.patterns.json) {
            let match;
            const regex = new RegExp(pattern.source, pattern.flags);
            
            while ((match = regex.exec(text)) !== null) {
                try {
                    const jsonText = match[1] || match[0];
                    const cleanJson = this.cleanJsonText(jsonText);
                    const parsed = JSON.parse(cleanJson);
                    
                    jsonObjects.push({
                        raw: jsonText,
                        parsed: parsed,
                        valid: true,
                        type: this.detectJsonType(parsed)
                    });
                } catch (error) {
                    // JSON 파싱 실패 시에도 원본 텍스트 보존
                    jsonObjects.push({
                        raw: match[1] || match[0],
                        parsed: null,
                        valid: false,
                        error: error.message
                    });
                }
            }
        }

        return jsonObjects;
    }

    /**
     * 코드 블록 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 코드 블록들
     */
    extractCodeBlocks(text) {
        const codeBlocks = [];
        let match;

        while ((match = this.patterns.codeBlock.exec(text)) !== null) {
            codeBlocks.push({
                language: match[1] || 'text',
                code: match[2].trim(),
                lineCount: match[2].split('\n').length
            });
        }

        return codeBlocks;
    }

    /**
     * 마크다운 헤더 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 헤더들
     */
    extractHeaders(text) {
        const headers = [];
        let match;

        while ((match = this.patterns.headers.exec(text)) !== null) {
            headers.push({
                level: match[1].length,
                text: match[2].trim(),
                anchor: this.createAnchor(match[2])
            });
        }

        return headers;
    }

    /**
     * 리스트 아이템 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 리스트들
     */
    extractLists(text) {
        const lists = [];
        
        // 일반 리스트
        let match;
        while ((match = this.patterns.lists.exec(text)) !== null) {
            lists.push({
                type: 'unordered',
                text: match[1].trim(),
                indent: this.getIndentLevel(match[0])
            });
        }

        // 번호 리스트
        while ((match = this.patterns.numberedLists.exec(text)) !== null) {
            lists.push({
                type: 'ordered',
                text: match[1].trim(),
                indent: this.getIndentLevel(match[0])
            });
        }

        return lists;
    }

    /**
     * 테이블 추출
     * @param {string} text - 원본 텍스트
     * @returns {Array} 테이블들
     */
    extractTables(text) {
        const tables = [];
        const lines = text.split('\n');
        let currentTable = null;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (this.patterns.tables.test(line)) {
                if (!currentTable) {
                    currentTable = {
                        headers: [],
                        rows: [],
                        startLine: i
                    };
                }

                const cells = line.split('|').map(cell => cell.trim()).filter(cell => cell);
                
                if (currentTable.headers.length === 0) {
                    currentTable.headers = cells;
                } else if (!line.includes('---')) { // 구분선이 아닌 경우
                    currentTable.rows.push(cells);
                }
            } else if (currentTable) {
                // 테이블 종료
                tables.push(currentTable);
                currentTable = null;
            }
        }

        if (currentTable) {
            tables.push(currentTable);
        }

        return tables;
    }

    /**
     * 메타데이터 추출
     * @param {string} text - 원본 텍스트
     * @returns {Object} 메타데이터
     */
    extractMetadata(text) {
        return {
            wordCount: text.split(/\s+/).length,
            lineCount: text.split('\n').length,
            charCount: text.length,
            hasEmojis: /[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/u.test(text),
            language: this.detectLanguage(text),
            sentiment: this.detectSentiment(text)
        };
    }

    /**
     * 순수 텍스트 추출 (마크다운 제거)
     * @param {string} text - 원본 텍스트
     * @returns {string} 순수 텍스트
     */
    extractPlainText(text) {
        return text
            .replace(this.patterns.codeBlock, '') // 코드 블록 제거
            .replace(this.patterns.headers, '$2') // 헤더 마크 제거
            .replace(this.patterns.bold, '$1') // 굵은 글씨 마크 제거
            .replace(this.patterns.italic, '$1') // 기울임 마크 제거
            .replace(this.patterns.links, '$1') // 링크를 텍스트만 남김
            .replace(/^\|.*\|$/gm, '') // 테이블 제거
            .replace(/^[-*+]\s+/gm, '') // 리스트 마크 제거
            .replace(/^\d+\.\s+/gm, '') // 번호 리스트 마크 제거
            .replace(/\n\s*\n/g, '\n') // 연속 빈 줄 정리
            .trim();
    }

    /**
     * 응답 요약 생성
     * @param {Object} parsed - 파싱된 응답 객체
     * @returns {string} 요약
     */
    generateSummary(parsed) {
        const parts = [];
        
        if (parsed.structure.hasJson) {
            parts.push(`${parsed.content.json.length}개 JSON 객체`);
        }
        
        if (parsed.structure.hasCode) {
            const languages = [...new Set(parsed.content.codeBlocks.map(cb => cb.language))];
            parts.push(`${parsed.content.codeBlocks.length}개 코드 블록 (${languages.join(', ')})`);
        }
        
        if (parsed.structure.hasMarkdown) {
            parts.push(`${parsed.content.headers.length}개 섹션`);
        }
        
        if (parsed.structure.hasList) {
            parts.push(`${parsed.content.lists.length}개 리스트 항목`);
        }
        
        if (parsed.structure.hasTable) {
            parts.push(`${parsed.content.tables.length}개 테이블`);
        }

        const summary = parts.length > 0 
            ? `구조화된 응답: ${parts.join(', ')}`
            : `일반 텍스트 응답 (${parsed.content.metadata.wordCount}단어)`;

        return summary;
    }

    /**
     * 헬퍼 메서드들
     */
    cleanJsonText(jsonText) {
        return jsonText
            .replace(/^```json\s*/i, '')
            .replace(/\s*```$/, '')
            .replace(/^```\s*/, '')
            .trim();
    }

    detectJsonType(obj) {
        if (Array.isArray(obj)) return 'array';
        if (obj && typeof obj === 'object') {
            if (obj.hasOwnProperty('error')) return 'error';
            if (obj.hasOwnProperty('result') || obj.hasOwnProperty('data')) return 'response';
            if (obj.hasOwnProperty('tasks') || obj.hasOwnProperty('phases')) return 'workflow';
            return 'object';
        }
        return 'primitive';
    }

    createAnchor(text) {
        return text.toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '-');
    }

    getIndentLevel(text) {
        const match = text.match(/^(\s*)/);
        return match ? match[1].length : 0;
    }

    detectLanguage(text) {
        // 간단한 언어 감지 (한국어/영어)
        const koreanRatio = (text.match(/[가-힣]/g) || []).length / text.length;
        return koreanRatio > 0.1 ? 'ko' : 'en';
    }

    detectSentiment(text) {
        // 간단한 감정 분석
        const positiveWords = ['좋', '성공', '완료', '훌륭', 'good', 'great', 'success', 'excellent'];
        const negativeWords = ['실패', '오류', '문제', '나쁜', 'error', 'fail', 'bad', 'wrong'];
        
        const positiveCount = positiveWords.reduce((count, word) => 
            count + (text.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);
        const negativeCount = negativeWords.reduce((count, word) => 
            count + (text.toLowerCase().match(new RegExp(word, 'g')) || []).length, 0);
            
        if (positiveCount > negativeCount) return 'positive';
        if (negativeCount > positiveCount) return 'negative';
        return 'neutral';
    }

    createEmptyResponse(provider) {
        return {
            provider,
            rawText: '',
            parsedAt: new Date(),
            structure: {
                hasJson: false,
                hasCode: false,
                hasMarkdown: false,
                hasList: false,
                hasTable: false
            },
            content: {
                text: '',
                json: [],
                codeBlocks: [],
                headers: [],
                lists: [],
                tables: [],
                metadata: {
                    wordCount: 0,
                    lineCount: 0,
                    charCount: 0,
                    hasEmojis: false,
                    language: 'unknown',
                    sentiment: 'neutral'
                }
            },
            summary: '빈 응답'
        };
    }

    /**
     * 파싱된 응답을 콘솔에 예쁘게 출력
     * @param {Object} parsed - 파싱된 응답 객체
     */
    displayParsedResponse(parsed) {
        console.log(chalk.blue(`\n📄 ${parsed.provider.toUpperCase()} 응답 분석:`));
        console.log(chalk.cyan(`   💬 요약: ${parsed.summary}`));
        
        if (parsed.structure.hasJson) {
            console.log(chalk.green(`   📊 JSON 데이터: ${parsed.content.json.length}개`));
            parsed.content.json.forEach((json, i) => {
                if (json.valid) {
                    console.log(chalk.green(`      ${i + 1}. ${json.type} (${Object.keys(json.parsed).length} 속성)`));
                } else {
                    console.log(chalk.red(`      ${i + 1}. 파싱 실패: ${json.error}`));
                }
            });
        }
        
        if (parsed.structure.hasCode) {
            console.log(chalk.yellow(`   💻 코드 블록: ${parsed.content.codeBlocks.length}개`));
            parsed.content.codeBlocks.forEach((block, i) => {
                console.log(chalk.yellow(`      ${i + 1}. ${block.language} (${block.lineCount}줄)`));
            });
        }
        
        if (parsed.structure.hasMarkdown) {
            console.log(chalk.magenta(`   📝 구조: ${parsed.content.headers.length}개 섹션`));
        }

        console.log(chalk.gray(`   📊 메타: ${parsed.content.metadata.wordCount}단어, ${parsed.content.metadata.sentiment} 감정`));
    }
}

module.exports = { ResponseParser };