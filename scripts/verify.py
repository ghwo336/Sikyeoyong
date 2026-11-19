#!/usr/bin/env python3
"""Sikyeoyong commit gate.

Mechanical checks for the rules in CLAUDE.md and docs/wiki/conventions.
Run: python3 -I scripts/verify.py [--range BASE..HEAD] [--skip-build]

Severity:
  BLOCKER  must fix before the next commit
  MAJOR    must fix before the next commit
  REVIEW   a human or the verifier agent must judge it (does not fail by itself)
  MINOR    note
Exit code 1 if any BLOCKER or MAJOR.
"""
import os
import re
import subprocess
import sys

ROOT = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True).stdout.strip()
os.chdir(ROOT)

findings = []
DASH_RE = "[" + chr(0x2013) + chr(0x2014) + "]"


def add(sev, rule, where, msg):
    findings.append((sev, rule, where, msg))


def sh(cmd, check=False):
    r = subprocess.run(cmd, shell=isinstance(cmd, str), capture_output=True, text=True)
    if check and r.returncode != 0:
        raise SystemExit(r.stderr)
    return r


def read(p):
    try:
        with open(p, encoding="utf-8") as f:
            return f.read()
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError):
        return None


args = sys.argv[1:]
rng = None
skip_build = "--skip-build" in args
if "--range" in args:
    rng = args[args.index("--range") + 1]
if rng is None:
    rng = "HEAD~1..HEAD" if sh("git rev-parse --verify -q HEAD~1").returncode == 0 else "HEAD"

tracked = [p for p in sh("git ls-files -z").stdout.split("\0") if p and os.path.isfile(p)]
if ".." in rng:
    changed = [p for p in sh(["git", "diff", "--name-only", "--diff-filter=AMR", rng]).stdout.splitlines() if p]
else:
    changed = [p for p in sh(["git", "show", "--name-only", "--pretty=format:", rng]).stdout.splitlines() if p]
changed = [p for p in changed if os.path.isfile(p)]

CODE_EXT = (".ts", ".tsx", ".js", ".mjs", ".cjs", ".sol", ".css")
TS_EXT = (".ts", ".tsx")


def is_test(p):
    return bool(re.search(r"(\.test\.|\.spec\.|\.stories\.|/test/|/__tests__/|\.t\.sol$)", p))


def code_lines(p):
    """Yield (lineno, line) skipping pure comment lines."""
    txt = read(p)
    if txt is None:
        return
    in_block = False
    for i, line in enumerate(txt.splitlines(), 1):
        s = line.strip()
        if in_block:
            if "*/" in s:
                in_block = False
            continue
        if s.startswith("/*") and "*/" not in s:
            in_block = True
            continue
        if s.startswith("//") or s.startswith("*") or s.startswith("/*"):
            continue
        yield i, line


# 1. working tree ----------------------------------------------------------
st = sh("git status --porcelain").stdout.strip()
if st:
    add("MAJOR", "G1 clean-tree", ".", "커밋되지 않은 변경이 있다. 검증은 커밋된 상태만 본다:\n" + st[:800])

# 2. commit messages --------------------------------------------------------
revs = sh(["git", "rev-list", rng]).stdout.split() if ".." in rng else [sh(["git", "rev-parse", rng]).stdout.strip()]
MSG_RE = re.compile(r"^(feat|fix|contract|docs|infra|chore|test|refactor)(\([a-z0-9/._-]+\))?: \S.{0,70}$")
for rev in revs:
    msg = sh(["git", "log", "-1", "--format=%B", rev]).stdout
    subj = msg.splitlines()[0] if msg else ""
    if not MSG_RE.match(subj):
        add("BLOCKER", "G2 commit-format", rev[:8], f"커밋 제목 형식 위반 (git-and-review.md): {subj!r}")
    if "Co-Authored-By:" not in msg:
        add("MAJOR", "G2 attribution", rev[:8], "AI 세션 커밋에 Co-Authored-By 줄이 없다")
    if re.search(DASH_RE, msg):
        add("BLOCKER", "R1 dash", rev[:8], "커밋 메시지에 em/en dash")
    n = len(sh(["git", "show", "--name-only", "--pretty=format:", rev]).stdout.split())
    units = set()
    for p in sh(["git", "show", "--name-only", "--pretty=format:", rev]).stdout.split():
        parts = p.split("/")
        if parts[0] in ("apps", "packages") and len(parts) > 1:
            units.add("/".join(parts[:2]))
        elif parts[0] in ("contracts", "infra", "seed"):
            units.add(parts[0])
    if len(units) > 2:
        add("REVIEW", "G3 commit-split", rev[:8], f"한 커밋이 코드 단위 {len(units)}개를 건드린다 {sorted(units)}. 나눌 수 있었는지 판단")
    if n > 60:
        add("REVIEW", "G3 commit-size", rev[:8], f"파일 {n}개. 스캐폴딩이 아니면 나눠야 한다")

# 3. dash -------------------------------------------------------------------
for p in tracked:
    txt = read(p)
    if txt is None:
        continue
    for i, line in enumerate(txt.splitlines(), 1):
        if re.search(DASH_RE, line):
            add("BLOCKER", "R1 dash", f"{p}:{i}", "em/en dash")

# 4. wiki tree --------------------------------------------------------------
r = sh([sys.executable, "-I", "scripts/check-wiki.py", "docs/wiki"])
if "errors=0" not in r.stdout:
    add("BLOCKER", "R8 wiki-tree", "docs/wiki", r.stdout.strip()[-1500:])
# new wiki docs outside components/ui must appear in ROOT tree map
root_map = read("docs/wiki/README.md") or ""
for p in changed:
    if p.startswith("docs/wiki/") and p.endswith(".md") and "/components/ui/" not in p and "/archive/" not in p:
        if os.path.basename(p) not in root_map:
            add("MAJOR", "R8 wiki-map", p, "새 위키 문서가 ROOT 트리 지도(docs/wiki/README.md)에 없다")

# 5. secrets ----------------------------------------------------------------
SECRET_PATTERNS = [
    (r"sk-ant-[A-Za-z0-9_-]{10,}", "Anthropic 키"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "PEM 개인키"),
    (r"(?i)(private_?key|secret|auth_?token|api_?key)[\"']?\s*[:=]\s*[\"']?0x[0-9a-fA-F]{64}", "16진 개인키 대입"),
    (r"AIza[0-9A-Za-z_-]{30,}", "Google 키"),
]
for p in tracked:
    base = os.path.basename(p)
    if base.startswith(".env") and base != ".env.example":
        add("BLOCKER", "R5 secret-file", p, ".env 파일이 추적된다")
    if p.endswith(".pem") or p.endswith(".key"):
        add("BLOCKER", "R5 secret-file", p, "키 파일이 추적된다")
    txt = read(p)
    if txt is None:
        continue
    for pat, name in SECRET_PATTERNS:
        for m in re.finditer(pat, txt):
            line = txt[: m.start()].count("\n") + 1
            add("BLOCKER", "R5 secret", f"{p}:{line}", name)
    if base == ".env.example":
        for i, line in enumerate(txt.splitlines(), 1):
            m = re.match(r"^([A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD)[A-Z0-9_]*)=(.+)$", line.strip())
            if m and m.group(3).strip() not in ('""', "''"):
                add("BLOCKER", "R5 env-example", f"{p}:{i}", f"{m.group(1)}에 값이 있다. 예시는 빈 값만")

# 6. hardcoded chain config -------------------------------------------------
CHAIN_OK = ("packages/shared/src/config/", "config/deployments/", "seed/", "docs/", "design/", "contracts/test/",
            "contracts/script/", "contracts/lib/", "scripts/verify.py", ".env.example", "CLAUDE.md", "README.md")
for p in tracked:
    if not p.endswith(CODE_EXT + (".json", ".yml", ".yaml")) or p.startswith(CHAIN_OK) or "/node_modules/" in p:
        continue
    if p.endswith(("pnpm-lock.yaml", "package.json", "tsconfig.json")):
        continue
    for i, line in code_lines(p):
        if re.search(r"\b450815\b", line):
            add("BLOCKER", "R2 chain-config", f"{p}:{i}", "체인 ID 하드코딩. packages/shared/src/config에서 읽는다")
        if re.search(r"https?://[^\s\"']*maroo[^\s\"']*", line):
            add("BLOCKER", "R2 chain-config", f"{p}:{i}", "마루 URL 하드코딩")
        if re.search(r"\b0x[0-9a-fA-F]{40}\b", line) and not is_test(p):
            add("BLOCKER", "R2 chain-config", f"{p}:{i}", "주소 하드코딩")

# 7. money ------------------------------------------------------------------
MONEY_WORD = r"(aokrw|Aokrw|AOKRW|okrw|Okrw|OKRW|amount|Amount|price|Price|balance|Balance|budget|Budget|limit|Limit|float|Float|spent|Spent)"
for p in tracked:
    if not p.endswith(TS_EXT) or "/node_modules/" in p:
        continue
    for i, line in code_lines(p):
        if re.search(MONEY_WORD + r"\w*\??\s*:\s*number\b", line):
            add("BLOCKER", "R4 money-number", f"{p}:{i}", "금액 이름에 number 타입. bigint(aokrw) 또는 정수 문자열")
        if re.search(r"\b(parseFloat|toFixed)\s*\(", line):
            add("BLOCKER", "R4 money-float", f"{p}:{i}", "부동소수점 처리 함수. 금액이면 금지, 아니면 사유 주석")
        if re.search(r"Number\([^)]*" + MONEY_WORD, line) or re.search(MONEY_WORD + r"\w*\s*/\s*1e18", line):
            add("BLOCKER", "R4 money-number", f"{p}:{i}", "금액을 Number로 변환")
        if re.search(r"\b1e18\b|\b10\s*\*\*\s*18\b(?!n)", line) and "packages/shared/src/money" not in p:
            add("MAJOR", "R4 money-scale", f"{p}:{i}", "단위 변환은 packages/shared 금액 유틸에서만")

# 8. typescript hygiene ------------------------------------------------------
for p in tracked:
    if not p.endswith(TS_EXT) or "/node_modules/" in p or p.endswith(".d.ts"):
        continue
    for i, line in code_lines(p):
        if re.search(r":\s*any\b|\bas any\b|<any>|any\[\]", line):
            add("MAJOR", "S1 no-any", f"{p}:{i}", "any 사용 (code-style.md)")
        if "@ts-ignore" in line or "@ts-nocheck" in line:
            add("MAJOR", "S1 ts-ignore", f"{p}:{i}", "@ts-ignore 금지. @ts-expect-error와 사유")
        if "eslint-disable" in line and "--" not in line:
            add("MAJOR", "S1 eslint-disable", f"{p}:{i}", "eslint-disable에 사유(-- 이유)가 없다")
        if re.search(r"\bthrow\s+['\"`]", line):
            add("MAJOR", "S1 string-throw", f"{p}:{i}", "문자열 throw 금지. AppErrorCode 에러 클래스")
        if re.search(r"console\.log\(", line) and not is_test(p) and not p.startswith(("scripts/", "infra/scripts/")):
            add("MINOR", "S1 console", f"{p}:{i}", "console.log. Nest Logger 또는 제거")

# 9. web page assembly -------------------------------------------------------
for p in tracked:
    if not p.startswith("apps/web/"):
        continue
    if p.endswith(TS_EXT):
        txt = read(p) or ""
        for pat, what in [(r"from ['\"](viem|ethers|@anthropic-ai/[^'\"]*|better-sqlite3|drizzle-orm[^'\"]*)['\"]", "웹에 체인/LLM/DB 의존")]:
            for m in re.finditer(pat, txt):
                add("BLOCKER", "D18 web-scope", p, f"{what}: {m.group(1)}")
    if re.match(r"apps/web/app/.*page\.tsx$", p):
        txt = read(p) or ""
        n = len(txt.splitlines())
        if n > 60:
            add("MAJOR", "D18 page-assembly", p, f"page.tsx {n}줄 (60 초과). 컨테이너로 쪼갠다")
        for pat, what in [(r"\bfetch\(", "fetch"), (r"\buse(State|Effect|Reducer|Memo|Callback)\b", "React 상태 훅"),
                          (r"style=\{", "인라인 스타일"), (r"\.module\.css", "CSS 모듈"), (r"className=", "className 스타일"),
                          (r"\bformatOkrw\b|\bparseOkrw\b|\baokrw\b", "금액 계산")]:
            if re.search(pat, txt):
                add("MAJOR", "D18 page-assembly", p, f"페이지에 {what}. 페이지는 조립만")

# 10. ui components ----------------------------------------------------------
UI_AREAS = ("base", "dragon", "chat", "order", "limits", "onboarding", "wallet")
ui_dirs = set()
for p in tracked:
    m = re.match(r"packages/ui/src/([a-z]+)/([A-Z][A-Za-z0-9]+)/", p)
    if m:
        ui_dirs.add((m.group(1), m.group(2)))
for area, name in sorted(ui_dirs):
    d = f"packages/ui/src/{area}/{name}"
    if area not in UI_AREAS:
        add("BLOCKER", "D18 ui-area", d, f"알 수 없는 영역 {area}")
    for suffix in (f"{name}.tsx", f"{name}.stories.tsx", f"{name}.test.tsx", "index.ts"):
        if not os.path.isfile(f"{d}/{suffix}"):
            add("BLOCKER", "D18 ui-harness", d, f"{suffix} 없음 (본체, 하네스, 테스트, index 필수)")
    if not os.path.isfile(f"{d}/{name}.module.css"):
        add("REVIEW", "D18 ui-style", d, f"{name}.module.css 없음. 스타일이 정말 필요 없는지")
    doc = f"docs/wiki/components/ui/{area}/{name}.md"
    if not os.path.isfile(doc):
        add("BLOCKER", "D18 ui-doc", d, f"위키 문서 {doc} 없음")
    else:
        idx = read(f"docs/wiki/components/ui/{area}/_index.md") or ""
        if f"{name}.md" not in idx:
            add("BLOCKER", "D18 ui-doc", doc, "영역 _index.md에 등록 안 됨")
        # every harness state named in the doc should appear in stories
        dtxt = read(doc) or ""
        stories = read(f"{d}/{name}.stories.tsx") or ""
        sec = re.search(r"##\s*하네스 상태\s*\n(.*?)(\n##\s|\Z)", dtxt, re.S)
        if sec and stories:
            states = re.findall(r"^\s*[-*\d.]+\s*`?([^`:\n(]+?)`?\s*(?:[:(]|$)", sec.group(1), re.M)
            exports = re.findall(r"export const (\w+)", stories)
            if len(exports) < len([s for s in states if s.strip()]):
                add("MAJOR", "D18 ui-harness-states", f"{d}/{name}.stories.tsx",
                    f"문서 하네스 상태 {len(states)}개, 스토리 {len(exports)}개. 문서 상태 전부 만든다")
for p in tracked:
    if not p.startswith("packages/ui/src/"):
        continue
    if p.endswith(TS_EXT):
        txt = read(p) or ""
        for m in re.finditer(r"from ['\"]([^'\"]+)['\"]", txt):
            mod = m.group(1)
            if re.match(r"(next/(navigation|router|headers)|@tanstack/|zustand|viem|ethers|@sikyeoyong/(web|api))", mod) or mod.startswith("apps/"):
                add("BLOCKER", "D18 ui-pure", p, f"ui 컴포넌트가 {mod} import. props와 콜백만")
            mm = re.match(r"\.\./\.\./([a-z]+)/", mod)
            area = p.split("/")[3] if len(p.split("/")) > 3 else ""
            if mm and mm.group(1) not in ("base", "dragon") and mm.group(1) != area:
                add("MAJOR", "D18 ui-cross-area", p, f"영역 사이 import {mod}. base와 dragon만 허용")
        if re.search(r"\bfetch\(", txt) and not is_test(p):
            add("BLOCKER", "D18 ui-pure", p, "ui 컴포넌트에서 fetch")
    if p.endswith(".css") and "tokens" not in os.path.basename(p):
        for i, line in code_lines(p):
            if re.search(r"#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(", line):
                add("MAJOR", "D17 tokens-only", f"{p}:{i}", "색 직접 사용. 토큰 CSS 변수만")
            if re.search(r"linear-gradient|radial-gradient", line):
                add("MAJOR", "D17 no-slop", f"{p}:{i}", "그라데이션 금지")
            if re.search(r"transition:\s*[^;]*(top|left|height|width|margin)", line):
                add("MAJOR", "D17 motion", f"{p}:{i}", "레이아웃 속성 애니메이션 금지")

# 11. user-facing chain words -------------------------------------------------
BANNED_UI = ["지갑", "토큰", "트랜잭션", "KYC", "PCL", "블록체인", "가스비", "해시", "OKRW", "attestation", "시드 문구"]
for p in tracked:
    if not (p.startswith("packages/ui/src/") or p.startswith("apps/web/")) or not p.endswith(TS_EXT):
        continue
    if p.endswith(".test.tsx") or p.endswith(".test.ts"):
        continue
    for i, line in code_lines(p):
        for w in BANNED_UI:
            if re.search(r"[\"'`>][^\"'`<]*" + re.escape(w), line):
                add("REVIEW", "D17 chain-words", f"{p}:{i}", f"화면 문구에 '{w}'. '자세히 보기' 안이 아니면 금지")

# 12. shared purity -----------------------------------------------------------
for p in tracked:
    if not p.startswith("packages/shared/src/") or not p.endswith(TS_EXT) or is_test(p):
        continue
    txt = read(p) or ""
    if "process.env" in txt or "import.meta.env" in txt:
        add("BLOCKER", "A shared-pure", p, "shared에서 환경변수 읽기")
    for m in re.finditer(r"from ['\"]([^'\"]+)['\"]", txt):
        mod = m.group(1)
        if re.match(r"(react|next|@nestjs|better-sqlite3|drizzle-orm|node:|fs|path|@anthropic-ai)", mod):
            add("BLOCKER", "A shared-pure", p, f"shared가 런타임 의존 {mod} import")
    if re.search(r"\bfetch\(", txt) and "/api/" not in p:
        add("MAJOR", "A shared-pure", p, "shared에서 네트워크. API 클라이언트(주입된 fetch)만 예외")

# 13. api module boundaries ---------------------------------------------------
for p in tracked:
    if not p.startswith("apps/api/src/") or not p.endswith(".ts"):
        continue
    txt = read(p) or ""
    m = re.match(r"apps/api/src/modules/([a-z-]+)/", p)
    own = m.group(1) if m else None
    for im in re.finditer(r"from ['\"]([^'\"]+)['\"]", txt):
        mod = im.group(1)
        mm = re.search(r"modules/([a-z-]+)/[^'\"]*\.repository", mod) or (
            re.match(r"\.\./([a-z-]+)/[^'\"]*\.repository", mod) if own else None)
        if mm and mm.group(1) != own:
            add("BLOCKER", "D18 api-boundary", p, f"다른 모듈 저장소 직접 import: {mod}")
        if re.search(r"maws|@modelcontextprotocol", mod, re.I) and own != "payment" and not is_test(p):
            add("BLOCKER", "D06 maws-scope", p, f"MAWS/MCP 클라이언트는 payment 모듈 안에서만: {mod}")
    if p.endswith(".controller.ts"):
        if re.search(r"\.repository|drizzle-orm|from ['\"][^'\"]*db/", txt):
            add("BLOCKER", "D18 controller-thin", p, "컨트롤러가 저장소/DB 직접 사용")
        if re.search(r"\b(for|while)\s*\(|\.reduce\(", txt):
            add("REVIEW", "D18 controller-thin", p, "컨트롤러에 반복/계산 로직이 보인다")
    if own == "payment" and re.search(r"\b(retry|retries|attempt)\w*\s*[<:=]", txt, re.I) and not is_test(p):
        add("REVIEW", "R9 no-auto-retry", p, "결제 모듈에 재시도 흔적. 자동 재시도 금지 (같은 orderRef 수동만)")

# 14. llm tool whitelist ------------------------------------------------------
ALLOWED_TOOLS = {"get_budget", "get_order_history", "get_context", "recommend_merchants", "get_menu",
                 "place_order", "request_owner_approval"}
for p in tracked:
    if p.startswith("apps/api/src/modules/llm/") and p.endswith(".ts") and not is_test(p):
        txt = read(p) or ""
        for m in re.finditer(r"name:\s*['\"]([a-z_]+)['\"]", txt):
            if m.group(1) not in ALLOWED_TOOLS:
                add("BLOCKER", "R3 llm-tools", p, f"허용 목록에 없는 LLM 도구 {m.group(1)}")
        for w in ("transfer", "fund", "createAgent", "agent_create", "setPolicy", "policy_set", "drain", "unfreeze"):
            if re.search(r"\b" + w + r"\b", txt):
                add("REVIEW", "R3 llm-tools", p, f"llm 모듈에 돈/정책 관련 식별자 '{w}'")

# 15. tests accompany source changes -----------------------------------------
def pkg_of(p):
    parts = p.split("/")
    if parts[0] in ("apps", "packages") and len(parts) > 2:
        return "/".join(parts[:2])
    if parts[0] == "contracts":
        return "contracts"
    return None

src_by_pkg, test_by_pkg = {}, {}
for p in changed:
    pk = pkg_of(p)
    if not pk:
        continue
    if is_test(p):
        test_by_pkg.setdefault(pk, []).append(p)
    elif re.search(r"/src/.*\.(ts|tsx|sol)$", p) and not re.search(r"(index\.ts|\.d\.ts|main\.ts|module\.ts|\.module\.css)$", p):
        src_by_pkg.setdefault(pk, []).append(p)
for pk, srcs in src_by_pkg.items():
    if pk not in test_by_pkg and pk != "apps/web":
        add("MAJOR", "T1 tests-required", pk, f"소스가 바뀌었는데 테스트 변경이 없다: {srcs[:5]}")

# 16. build gates ------------------------------------------------------------
def gate(name, cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        out = (r.stdout + r.stderr).strip()
        add("BLOCKER", "T0 " + name, cmd, out[-2500:])
    return r.returncode == 0

if not skip_build:
    if os.path.isfile("package.json"):
        if not os.path.isdir("node_modules"):
            gate("install", "pnpm install --frozen-lockfile")
        pj = read("package.json") or ""
        for script in ("lint", "typecheck", "test", "build"):
            if f'"{script}"' in pj:
                gate(script, f"pnpm -s {script}")
            else:
                add("MAJOR", "T0 scripts", "package.json", f"루트 스크립트 {script} 없음 (CLAUDE.md 6)")
    if os.path.isfile("contracts/foundry.toml"):
        gate("forge-build", "forge build", cwd="contracts")
        gate("forge-test", "forge test", cwd="contracts")

# report ---------------------------------------------------------------------
order = {"BLOCKER": 0, "MAJOR": 1, "REVIEW": 2, "MINOR": 3}
findings.sort(key=lambda f: (order[f[0]], f[1], f[2]))
counts = {k: sum(1 for f in findings if f[0] == k) for k in order}
print(f"# verify.py range={rng} changed={len(changed)} tracked={len(tracked)} build={'skip' if skip_build else 'run'}")
for sev, rule, where, msg in findings:
    print(f"[{sev}] {rule} {where}\n    {msg}")
print("SUMMARY " + " ".join(f"{k}={v}" for k, v in counts.items()))
fail = counts["BLOCKER"] + counts["MAJOR"] > 0
print("RESULT " + ("FAIL" if fail else "PASS"))
sys.exit(1 if fail else 0)
