#!/bin/bash
# 노트북을 바꿔 앉으면 이것부터 실행한다:  ./시작.sh
#
# 이 폴더는 iCloud 로 두 노트북(집·회사)이 함께 쓴다. 소스는 그대로 따라오지만
# 설치물(node_modules, .venv)은 노트북마다 달라야 해서 동기화에서 뺐다(.nosync).
# 이 스크립트는 "이 노트북의 설치물이 멀쩡한지" 확인하고, 아니면 그 자리에서 다시 만든다.
# 멀쩡하면 아무것도 바꾸지 않는다. 몇 번을 실행해도 된다.
#
# 절차는 이어서작업.md 1단계 (1)(2)(3) 과 같다.

set -u
ROOT="$(cd "$(dirname "$0")" && pwd)"
FE="$ROOT/web/frontend"
BE="$ROOT/web/backend"
DB="$ROOT/data/local/wme.db"

ok()   { printf '  \033[32m✓\033[0m %s\n' "$1"; }
fix()  { printf '  \033[33m→\033[0m %s\n' "$1"; }
fail() { printf '  \033[31m✗\033[0m %s\n' "$1"; FAILED=1; }
FAILED=0

# iCloud 가 만든 빈 충돌 사본("node_modules 2", ".venv 2")을 치운다. 비어 있을 때만 지운다.
clean_conflict_copies() {
  local dir="$1" name="$2" c
  for c in "$dir/$name "[0-9]*; do
    [ -e "$c" ] || continue
    if rmdir "$c" 2>/dev/null; then
      fix "빈 충돌 사본 삭제: ${c#$ROOT/}"
    else
      fail "비어 있지 않은 충돌 사본이 있다(직접 확인): ${c#$ROOT/}"
    fi
  done
}

echo "▶ 이 노트북: $(whoami)@$(hostname -s)"

# ---------------------------------------------------------------- 1. 서버·화면이 떠 있나
# 설치물이 멀쩡하면 떠 있어도 괜찮다. 다시 설치해야 할 때만 먼저 끄라고 멈춘다.
require_ports_free() {
  local busy="" p
  for p in 8000 5173 5174; do
    lsof -iTCP:$p -sTCP:LISTEN -t >/dev/null 2>&1 && busy="$busy $p"
  done
  if [ -n "$busy" ]; then
    fail "다시 설치해야 하는데 포트가 사용 중이다:$busy — ./정리.sh 로 끄고 다시 실행한다"
    exit 1
  fi
}

# ---------------------------------------------------------------- 2. 화면 (node_modules)
echo "▶ 화면 (web/frontend)"
clean_conflict_copies "$FE" "node_modules"

fe_ok=1
[ -L "$FE/node_modules" ] || fe_ok=0
[ -x "$FE/node_modules/.bin/vite" ] && [ -x "$FE/node_modules/.bin/tsc" ] || fe_ok=0
# package-lock.json 이 바뀌었으면(라이브러리 추가 등) 다시 설치한다
cmp -s "$FE/package-lock.json" "$FE/deps.nosync/package-lock.json" || fe_ok=0

if [ $fe_ok = 1 ]; then
  ok "node_modules 정상"
else
  require_ports_free
  fix "node_modules 를 이 노트북에 새로 설치한다 (1~2분)"
  rm -rf "$FE/node_modules" "$FE/deps.nosync"
  mkdir "$FE/deps.nosync"
  cp "$FE/package.json" "$FE/package-lock.json" "$FE/deps.nosync/"
  if (cd "$FE/deps.nosync" && npm ci --no-audit --no-fund >/dev/null 2>&1); then
    ln -s deps.nosync/node_modules "$FE/node_modules"
    [ -x "$FE/node_modules/.bin/vite" ] && ok "node_modules 설치 완료" || fail "설치 후에도 vite 가 없다"
  else
    fail "npm ci 실패 — web/frontend/deps.nosync 에서 npm ci 를 직접 돌려 오류를 본다"
  fi
fi

# ---------------------------------------------------------------- 3. 서버 (.venv)
echo "▶ 서버 (web/backend)"
clean_conflict_copies "$BE" ".venv"

be_ok=1
[ -L "$BE/.venv" ] || be_ok=0
"$BE/.venv/bin/python" -c "import fastapi, uvicorn, pydantic, httpx" >/dev/null 2>&1 || be_ok=0
cmp -s "$BE/requirements.txt" "$BE/.venv.nosync/requirements.txt" || be_ok=0

if [ $be_ok = 1 ]; then
  ok ".venv 정상"
else
  # 파이썬 3.11 을 우선 쓴다. 없으면 python3.
  PY=""
  for cand in python3.11 /opt/homebrew/opt/python@3.11/bin/python3.11 /usr/local/opt/python@3.11/bin/python3.11 python3; do
    if command -v "$cand" >/dev/null 2>&1; then PY="$cand"; break; fi
  done
  if [ -z "$PY" ]; then
    fail "파이썬을 찾지 못했다 (brew install python@3.11)"
  else
    require_ports_free
    fix ".venv 를 이 노트북에 새로 만든다 ($("$PY" --version 2>&1))"
    rm -rf "$BE/.venv" "$BE/.venv.nosync"
    if "$PY" -m venv "$BE/.venv.nosync" && "$BE/.venv.nosync/bin/python" -m pip install -q -r "$BE/requirements.txt" >/dev/null 2>&1; then
      cp "$BE/requirements.txt" "$BE/.venv.nosync/requirements.txt"
      ln -s .venv.nosync "$BE/.venv"
      ok ".venv 설치 완료"
    else
      fail "pip 설치 실패 — web/backend 에서 ./.venv.nosync/bin/pip install -r requirements.txt 로 오류를 본다"
    fi
  fi
fi

# ---------------------------------------------------------------- 4. DB
echo "▶ DB (data/local/wme.db)"
if [ -s "$DB" ]; then
  ok "DB 있음 — 두 노트북이 iCloud 로 같이 쓴다. 떠나기 전에 ./정리.sh 로 서버를 꺼야 안전하다"
elif [ $FAILED = 0 ]; then
  fix "DB 가 없어 시드로 만든다"
  (cd "$BE" && ./.venv/bin/python -m app.seed) && ok "DB 생성" || fail "시드 실패"
else
  fail "DB 가 없다. 위 오류를 먼저 고친 뒤 다시 실행한다"
fi

# ---------------------------------------------------------------- 결과
echo
if [ $FAILED = 0 ]; then
  echo "준비 완료. 실행:"
  echo "  서버  cd web/backend && ./.venv/bin/python -m uvicorn app.main:app --port 8000"
  echo "  화면  npm --prefix web/frontend run dev:server   → http://localhost:5174"
  echo "  (서버 없이 mock) npm --prefix web/frontend run dev → http://localhost:5173"
  echo "코드 받아오기(git pull)는 따로 한다."
else
  echo "✗ 고칠 것이 남았다. 위 빨간 줄을 본다."
  exit 1
fi
