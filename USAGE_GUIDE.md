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
# 기본 설정 확인
npm run config

# 팀 설정 확인
cat config/team-config.json
```

## 🎮 기본 사용법

### 프로젝트 시작
```bash
# 기본 프로젝트 실행
npm start "웹 애플리케이션 개발 프로젝트"

# 상세 로그와 함께 실행
npm start "API 서버 구축" -- --verbose
```

### 팀원 관리
```bash
# 새 팀원 추가
npm run add-member -- \
  --name "신규개발자" \
  --role "developer" \
  --endpoint "gemini://localhost:8080" \
  --capabilities "coding,testing,debugging"

# 팀 상태 확인
npm run status
```

## 📊 대시보드 사용법

### 1. CLI 대시보드 (터미널)
```bash
# 기본 CLI 대시보드
npm run dashboard

# 특정 모드로 실행
npm run dashboard -- --mode progress
npm run dashboard -- --mode logs
npm run dashboard -- --logs-level debug
```

**키보드 컨트롤:**
- `[1]` - 로그 뷰
- `[2]` - 진행률 뷰  
- `[3]` - 통합 뷰
- `[h]` - 도움말
- `[c]` - 화면 클리어
- `[e]` - 데이터 내보내기
- `[q]` - 종료

### 2. 웹 대시보드 (브라우저)
```bash
# 웹 대시보드 실행
npm run web-dashboard

# 사용자 정의 포트로 실행
npm run web-dashboard -- --port 9000 --host 0.0.0.0

# 웹 전용 모드 (CLI 없이)
npm run web-dashboard -- --web-only
```

**브라우저에서 접속:**
- 기본 URL: `http://localhost:8080`
- 사용자 정의: `http://localhost:9000`

### 3. 통합 대시보드 (CLI + 웹)
```bash
# CLI와 웹을 동시에 실행
npm run full-dashboard

# 사용자 정의 설정
npm run full-dashboard -- --port 8888 --mode combined
```

## 🔧 고급 기능

### 모니터링 시스템
```bash
# 간단한 모니터링
npm run monitor-simple

# 고급 모니터링 (5초 간격)
npm run monitor -- --interval 5000

# 특정 모드로 모니터링
npm run monitor -- --mode progress --interval 2000
```

### 테스트 실행
```bash
# 모든 테스트 실행
npm test

# 유닛 테스트만
npm run test:unit

# 통합 테스트
npm run test:integration

# E2E 테스트
npm run test:e2e

# 모든 테스트 (상세 리포트)
npm run test:all
```

### 코드 품질 검사
```bash
# ESLint 검사
npm run lint

# 자동 수정
npm run lint:fix

# 테스트 감시 모드
npm run test:watch
```

## 📱 웹 대시보드 기능

### 실시간 모니터링
- **시스템 개요**: 활성 에이전트, 작업 수, 성공률, 가동시간
- **팀 상태**: 각 에이전트의 현재 상태 및 작업량
- **활동 로그**: 실시간 시스템 이벤트 및 로그
- **워크플로우**: 진행 중인 프로젝트 상태

### 인터랙티브 컨트롤
- **⏸️ 일시정지**: 실시간 업데이트 중단/재개
- **🗑️ 로그 클리어**: 화면의 로그 항목 삭제
- **💾 데이터 내보내기**: 현재 상태를 JSON으로 저장

### 연결 상태 표시
- **🟢 연결됨**: 실시간 데이터 수신 중
- **🟠 연결 중**: 서버에 연결 시도 중
- **🔴 연결 끊김**: 자동 재연결 대기 중

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

### 예제 프로젝트
```bash
# 샘플 프로젝트 실행
npm start "React 블로그 애플리케이션 개발"
npm start "Node.js REST API 서버 구축"
npm start "데이터 분석 대시보드 제작"
```

### 커뮤니티 및 지원
- **GitHub Issues**: 버그 리포트 및 기능 요청
- **Wiki**: 상세 문서 및 튜토리얼
- **Discussions**: 커뮤니티 Q&A

## 🚀 빠른 시작 체크리스트

1. ✅ Node.js 18+ 설치 확인
2. ✅ 프로젝트 클론 및 의존성 설치
3. ✅ 기본 설정 확인: `npm run config`
4. ✅ 첫 번째 실행: `npm run web-dashboard`
5. ✅ 브라우저에서 `http://localhost:8080` 접속
6. ✅ 샘플 프로젝트 실행해보기
7. ✅ CLI와 웹 대시보드 기능 탐색

---

더 자세한 정보는 [프로젝트 문서](./README.md)를 참조하세요. 문제가 발생하면 [Issues](https://github.com/your-username/claude-gemini-team/issues)에 신고해 주세요.