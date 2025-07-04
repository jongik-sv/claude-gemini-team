# 🤖 Claude-Gemini Team 사용 가이드

## 📋 목차
- [시스템 요구사항](#시스템-요구사항)
- [설치 및 초기 설정](#설치-및-초기-설정)
- [기본 사용법](#기본-사용법)
- [대시보드 사용법](#대시보드-사용법)
- [고급 기능](#고급-기능)
- [문제해결](#문제해결)

## 📦 시스템 요구사항

### 필수 요구사항
- **Node.js**: v18.0.0 이상
- **npm**: v8.0.0 이상
- **운영체제**: Windows 10+, macOS 10.15+, Linux (Ubuntu 18.04+)
- **메모리**: 최소 4GB RAM (권장: 8GB+)
- **브라우저**: Chrome 80+, Firefox 75+, Safari 13+, Edge 80+

### 선택적 요구사항
- **Redis**: 고급 상태 관리 (선택사항)
- **Docker**: 컨테이너 환경 실행 (선택사항)

## 🚀 설치 및 초기 설정

### 1. 프로젝트 클론
```bash
git clone https://github.com/your-username/claude-gemini-team.git
cd claude-gemini-team
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 설정 (선택사항)
```bash
# .env 파일 생성
cp .env.example .env

# API 키 설정 (필요한 경우)
echo "CLAUDE_API_KEY=your_claude_api_key" >> .env
echo "GEMINI_API_KEY=your_gemini_api_key" >> .env
```

### 4. 설정 파일 확인
```bash
# 팀 설정 확인
cat config/team-config.json

# MCP 도구 설정 확인
cat config/mcp-tools.json

# 사용 가능한 npm 스크립트 확인
npm run

# Node.js 환경 확인
node --version
echo "Node.js $(node --version) - $(uname -s)"
```

## 🎮 기본 사용법

### 시스템 테스트 및 검증 (현재 동작하는 기능)
```bash
# 전체 시스템 테스트 실행 (170+ 테스트)
npm test

# 통합 테스트 실행 (14개 시나리오)
npm run test:integration

# E2E 테스트 실행
npm run test:e2e

# 코드 품질 검사
npm run lint
```

### 대시보드 및 모니터링 (✅ 정상 작동)
```bash
# 실시간 CLI 대시보드 (추천)
npm run dashboard

# 웹 대시보드 (브라우저 기반) ✅
npm run web-dashboard

# 간단한 모니터링 
npm run monitor-simple

# 통합 대시보드 (CLI + 웹)
npm run full-dashboard

# 대시보드 기능 확인
npm test -- tests/unit/visualization/
```

### 프로젝트 상태 확인
```bash
# 현재 구현된 핵심 기능들 확인
echo "✅ 팀 관리 시스템 (TeamManager)"
echo "✅ 워크플로우 엔진 (WorkflowEngine)" 
echo "✅ 메시지 브로커 (MessageBroker)"
echo "✅ 파일 공유 시스템 (FileManager, StateSyncManager)"
echo "✅ 성능 모니터링 (PerformanceMonitor)"
echo "✅ 시각화 대시보드 (CLI + 웹 모두 작동)"
```

### 시스템 상태 확인
```bash
# 테스트 실행으로 시스템 동작 확인
npm test

# 통합 테스트 실행
npm run test:integration

# 사용 가능한 명령어 확인
npm run

# 팀 멤버 추가 (CLI)
npm run add-member
```

## 📊 대시보드 사용법 (✅ 정상 작동)

### 실시간 CLI 대시보드
```bash
# 기본 대시보드 실행 (추천)
npm run dashboard

# 특정 모드로 실행
npm run dashboard -- --mode progress
npm run dashboard -- --mode logs  
npm run dashboard -- --logs-level debug
```

**실제 동작하는 기능들:**
- ✅ 4개 에이전트 실시간 상태 모니터링 (Team Leader, Senior Developer, Researcher, Developer)
- ✅ 실시간 로그 출력 (색상별 에이전트 구분)
- ✅ 작업 진행률 시각화 (프로그레스 바)
- ✅ 워크플로우 상태 및 통계
- ✅ 자동 새로고침 (2초 간격)
- ⚠️ 키보드 컨트롤 (일부 환경에서 제한적)

### 간단한 모니터링
```bash
# 간단한 시스템 모니터링
npm run monitor-simple

# 사용자 정의 간격
npm run monitor-simple -- --interval 3
```

### 고급 대시보드 사용법
```bash
# CLI 대시보드 커스터마이징
npm run dashboard -- --mode progress --logs-level debug

# 웹 대시보드 포트 변경  
npm run web-dashboard -- --port 9000

# 통합 대시보드 포트 설정
npm run full-dashboard -- --port 8888

# 특정 간격으로 모니터링
npm run monitor-simple -- --interval 3
```

### 대시보드 기능 미리보기 (테스트 환경)
```bash
# 실시간 시각화 기능 확인
npm test -- --testNamePattern="실시간"

# 키보드 컨트롤 기능 확인  
npm test -- --testNamePattern="키보드"

# WebSocket 연결 기능 확인
npm test -- --testNamePattern="WebSocket"
```

## 🔧 고급 기능

### 성능 모니터링 시스템
```bash
# 간단한 모니터링
npm run monitor-simple

# 고급 모니터링 (5초 간격)
npm run monitor -- --interval 5000

# 특정 모드로 모니터링
npm run monitor -- --mode progress --interval 2000

# 성능 메트릭 수집 및 분석
# PerformanceMonitor가 자동으로 다음을 추적:
# - 시스템 메모리/CPU 사용률
# - 태스크 실행 시간 및 성공률
# - 에이전트별 성능 통계
# - 실시간 알림 (임계값 초과 시)
```

### 파일 기반 데이터 공유
```bash
# 파일 시스템을 통한 에이전트 간 데이터 교환
# - 워크플로우 데이터: shared/workflows/
# - 실행 결과: shared/results/
# - 상태 정보: shared/states/
# - 임시 파일: shared/temp/

# 상태 동기화 및 충돌 해결 자동 처리
# - 버전 기반 상태 관리
# - 3-way 병합 충돌 해결
# - 실시간 파일 변경 감지
```

### 테스트 실행
```bash
# 모든 테스트 실행 (170+ 테스트)
npm test

# 유닛 테스트만 (각 컴포넌트별 세부 테스트)
npm run test:unit

# 통합 테스트 (14개 시나리오)
npm run test:integration

# E2E 테스트 (전체 워크플로우)
npm run test:e2e

# 파일 공유 시스템 테스트
npm test -- tests/unit/utils/

# 성능 모니터링 테스트
npm test -- tests/unit/utils/performance-monitor.test.js
```

### 코드 품질 검사
```bash
# ESLint 검사
npm run lint

# 자동 수정
npm run lint:fix

# 테스트 감시 모드
npm run test:watch

# 테스트 커버리지 확인
npm test -- --coverage
```

## 📱 웹 대시보드 기능

### 실시간 모니터링
- **시스템 개요**: 활성 에이전트, 작업 수, 성공률, 가동시간
- **팀 상태**: 각 에이전트의 현재 상태 및 작업량
- **활동 로그**: 실시간 시스템 이벤트 및 로그 (색상별 에이전트 구분)
- **워크플로우**: 진행 중인 프로젝트 상태
- **성능 메트릭**: 메모리/CPU 사용률, 응답 시간, 에러율

### 인터랙티브 컨트롤
- **⏸️ 일시정지**: 실시간 업데이트 중단/재개
- **🗑️ 로그 클리어**: 화면의 로그 항목 삭제
- **💾 데이터 내보내기**: 현재 상태를 JSON으로 저장
- **📊 성능 보고서**: 시간대별 성능 분석 데이터

### 연결 상태 표시
- **🟢 연결됨**: 실시간 데이터 수신 중 (WebSocket)
- **🟠 연결 중**: 서버에 연결 시도 중
- **🔴 연결 끊김**: 자동 재연결 대기 중

### 에이전트별 색상 코딩
- **🔵 Claude 팀장**: 파란색 (전략 계획, 품질 관리)
- **🟣 김선임 (Claude)**: 보라색 (복잡한 개발, 디버깅)
- **🟢 이조사 (Gemini)**: 초록색 (데이터 수집, 분석)
- **🟡 박개발 (Gemini)**: 노란색 (일반 개발, 테스트)

## 🛠️ 설정 커스터마이징

### 팀 설정 파일 (`config/team-config.json`)
```json
{
  "team": {
    "maxSize": 10,
    "defaultTimeout": 30000,
    "retryAttempts": 3
  },
  "communication": {
    "mode": "async",
    "heartbeatInterval": 30000
  },
  "visualization": {
    "refreshInterval": 2000,
    "maxLogHistory": 1000,
    "enableColors": true
  }
}
```

### MCP 도구 설정 (`config/mcp-tools.json`)
```json
{
  "tools": [
    {
      "name": "yahoo-finance",
      "endpoint": "yahoo-finance://localhost:8080",
      "capabilities": ["financial_data", "market_analysis"]
    },
    {
      "name": "supabase",
      "endpoint": "supabase://localhost:8081", 
      "capabilities": ["database", "auth", "storage"]
    }
  ]
}
```

## 🔍 문제해결

### 일반적인 문제

#### 1. 포트 충돌 오류
```bash
# 포트가 이미 사용 중일 때
npm run web-dashboard -- --port 8081
npm run full-dashboard -- --port 9000
```

#### 2. 의존성 설치 오류
```bash
# 캐시 클리어 후 재설치
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

#### 3. WebSocket 연결 실패
```bash
# 방화벽 확인
sudo ufw status

# 프로세스 확인
lsof -i :8080
```

#### 4. 메모리 부족 오류
```bash
# Node.js 메모리 증가
NODE_OPTIONS="--max-old-space-size=4096" npm run web-dashboard
```

### 로그 및 디버깅

#### 디버그 모드 실행
```bash
# 상세 로그로 실행
DEBUG=* npm run dashboard

# 특정 컴포넌트만 디버그
DEBUG=team-manager,workflow-engine npm start
```

#### 로그 파일 확인
```bash
# 시스템 로그 확인
cat logs/team-system.log

# 에러 로그만 확인
grep "ERROR" logs/team-system.log
```

#### 성능 분석
```bash
# 메모리 사용량 확인
node --inspect src/index.js

# 프로파일링
npm run dashboard -- --profile
```

### 네트워크 문제

#### 연결 테스트
```bash
# WebSocket 서버 상태 확인
curl http://localhost:8080/api/status

# 연결 통계 확인
curl http://localhost:8080/api/stats
```

#### 방화벽 설정
```bash
# Ubuntu/Debian
sudo ufw allow 8080

# CentOS/RHEL
sudo firewall-cmd --add-port=8080/tcp --permanent
sudo firewall-cmd --reload
```

## 📖 추가 리소스

### 도움말 명령어
```bash
# CLI 도움말
npm run dashboard -- --help
npm run web-dashboard -- --help

# 전체 명령어 목록
node src/cli.js --help
```

### 시스템 아키텍처 확인
```bash
# 구현된 핵심 컴포넌트들
ls src/core/          # TeamManager, WorkflowEngine
ls src/agents/        # Claude, Gemini Agent 구현체
ls src/communication/ # MessageBroker, 상태 동기화
ls src/tools/         # MCP Tool Manager
ls src/utils/         # FileManager, StateSyncManager, PerformanceMonitor
ls src/visualization/ # CLI/웹 대시보드, 실시간 모니터링

# 테스트 커버리지 확인
npm test -- --coverage
# 170+ 유닛 테스트, 14개 통합 테스트, E2E 테스트 포함
```

### 현재 지원되는 기능
```bash
# 실제 동작하는 기능들:
echo "✅ 4-멤버 팀 관리 (Claude 2명 + Gemini 2명)"
echo "✅ 실시간 통신 프로토콜 (MessageBroker)"  
echo "✅ 태스크 분류 및 분배 (WorkflowEngine)"
echo "✅ 파일 기반 데이터 공유 (FileManager)"
echo "✅ 상태 동기화 및 충돌 해결 (StateSyncManager)"
echo "✅ 성능 모니터링 및 알림 (PerformanceMonitor)"
echo "✅ CLI 실시간 대시보드 (dashboard, monitor-simple)"
echo "✅ 웹 대시보드 (브라우저 기반 실시간 모니터링)"

echo ""
echo "현재 버전: 멀티 에이전트 협업 시스템 프레임워크 (98% 완성)"
echo "테스트 통과율: 170+ 유닛 테스트, 14개 통합 테스트 대부분 통과"
```

### 커뮤니티 및 지원
- **GitHub Issues**: 버그 리포트 및 기능 요청
- **Wiki**: 상세 문서 및 튜토리얼
- **Discussions**: 커뮤니티 Q&A

## 🚀 빠른 시작 체크리스트

### 기본 설정
1. ✅ Node.js 18+ 설치 확인: `node --version`
2. ✅ 프로젝트 클론 및 의존성 설치: `npm install`
3. ✅ 시스템 테스트: `npm test`

### 대시보드 실행
4. ✅ CLI 대시보드 실행: `npm run dashboard`
5. ✅ 웹 대시보드 실행: `npm run web-dashboard`
6. ✅ 브라우저에서 `http://localhost:8080` 접속
7. ✅ 통합 대시보드 체험: `npm run full-dashboard`

### 고급 기능 탐색
8. ✅ 통합 테스트 실행: `npm run test:integration`
9. ✅ 성능 모니터링 확인: `npm test -- tests/unit/utils/performance-monitor.test.js`
10. ✅ 파일 공유 시스템 확인: `npm test -- tests/unit/utils/`
11. ✅ 실시간 WebSocket 연결 상태 확인

---

더 자세한 정보는 [프로젝트 문서](./README.md)를 참조하세요. 문제가 발생하면 [Issues](https://github.com/your-username/claude-gemini-team/issues)에 신고해 주세요.