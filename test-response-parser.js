#!/usr/bin/env node

/**
 * 응답 파서 테스트 스크립트
 */

const { ResponseParser } = require('./src/utils/response-parser');
const chalk = require('chalk');

function testResponseParser() {
    console.log(chalk.bold.blue('🧪 응답 파서 테스트 시작'));
    console.log(chalk.dim('='.repeat(60)));

    const parser = new ResponseParser();

    // 테스트 응답 샘플들
    const testResponses = [
        {
            name: 'JSON 응답',
            text: `프로젝트 분석 결과입니다:

\`\`\`json
{
    "project_type": "web_application",
    "complexity": "medium",
    "estimated_duration_days": 14,
    "key_technologies": ["javascript", "react", "nodejs"],
    "phases": [
        {
            "name": "planning",
            "description": "프로젝트 계획 수립",
            "estimated_hours": 8
        },
        {
            "name": "development", 
            "description": "개발 단계",
            "estimated_hours": 32
        }
    ],
    "risks": ["일정 지연", "기술적 복잡성"]
}
\`\`\`

이 분석을 바탕으로 진행하시면 됩니다.`
        },
        {
            name: '코드 응답',
            text: `다음은 React 컴포넌트 예시입니다:

\`\`\`javascript
import React, { useState } from 'react';

function TodoApp() {
    const [todos, setTodos] = useState([]);
    const [input, setInput] = useState('');

    const addTodo = () => {
        if (input.trim()) {
            setTodos([...todos, { id: Date.now(), text: input, completed: false }]);
            setInput('');
        }
    };

    return (
        <div className="todo-app">
            <h1>Todo List</h1>
            <div>
                <input 
                    value={input} 
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="새 할일 입력"
                />
                <button onClick={addTodo}>추가</button>
            </div>
            <ul>
                {todos.map(todo => (
                    <li key={todo.id}>{todo.text}</li>
                ))}
            </ul>
        </div>
    );
}

export default TodoApp;
\`\`\`

이 컴포넌트는 기본적인 할일 관리 기능을 제공합니다.`
        },
        {
            name: '마크다운 구조 응답',
            text: `# 프로젝트 실행 계획

## 개요
이 프로젝트는 웹 애플리케이션 개발을 목표로 합니다.

## 주요 단계

### 1단계: 요구사항 분석
- 사용자 스토리 작성
- 기능 명세서 작성
- 기술 스택 결정

### 2단계: 디자인 
- UI/UX 디자인
- 데이터베이스 설계
- API 설계

### 3단계: 개발
- 프론트엔드 개발
- 백엔드 개발  
- 테스트 코드 작성

## 예상 일정

| 단계 | 예상 기간 | 담당자 |
|------|-----------|---------|
| 요구사항 분석 | 3일 | PM |
| 디자인 | 5일 | 디자이너 |
| 개발 | 15일 | 개발팀 |

## 주요 위험 요소
- **일정 지연**: 요구사항 변경으로 인한 지연 가능성
- **기술적 복잡성**: 새로운 기술 스택 학습 필요
- **팀 협업**: 원격 협업으로 인한 커뮤니케이션 이슈`
        },
        {
            name: '일반 텍스트 응답',
            text: `안녕하세요! 프로젝트 분석을 완료했습니다. 

전반적으로 이 프로젝트는 중간 난이도의 웹 애플리케이션 개발 프로젝트로 보입니다. React와 Node.js를 기반으로 하는 모던 웹 스택을 사용하게 될 것 같습니다.

개발 기간은 대략 2-3주 정도 소요될 것으로 예상되며, 특히 데이터베이스 설계와 API 개발 부분에서 신중한 접근이 필요할 것 같습니다.

팀 구성은 프론트엔드 개발자 2명, 백엔드 개발자 1명 정도가 적절할 것 같습니다. 프로젝트 매니저가 전체적인 진행 상황을 관리하면서 일정을 조율하는 것이 중요합니다.

궁금한 점이 있으시면 언제든 문의해 주세요! 😊`
        }
    ];

    // 각 응답 테스트
    testResponses.forEach((sample, index) => {
        console.log(chalk.cyan(`\n🧩 테스트 ${index + 1}: ${sample.name}`));
        console.log(chalk.dim('-'.repeat(50)));

        const parsed = parser.parseResponse(sample.text, 'claude');
        parser.displayParsedResponse(parsed);

        // 간단한 검증
        console.log(chalk.green(`✅ 파싱 완료 - 형식: ${getDetectedFormats(parsed)}`));
    });

    // 빈 응답 테스트
    console.log(chalk.cyan('\n🧩 테스트 5: 빈 응답'));
    console.log(chalk.dim('-'.repeat(50)));
    const emptyParsed = parser.parseResponse('', 'gemini');
    parser.displayParsedResponse(emptyParsed);

    console.log(chalk.bold.green('\n🎉 모든 테스트 완료!'));
}

function getDetectedFormats(parsed) {
    const formats = [];
    if (parsed.structure.hasJson) formats.push('JSON');
    if (parsed.structure.hasCode) formats.push('Code');
    if (parsed.structure.hasMarkdown) formats.push('Markdown');
    if (parsed.structure.hasList) formats.push('List');
    if (parsed.structure.hasTable) formats.push('Table');
    return formats.length > 0 ? formats.join(', ') : 'Text';
}

// 스크립트 실행
if (require.main === module) {
    testResponseParser();
}

module.exports = { testResponseParser };