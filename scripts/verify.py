#!/usr/bin/env python3
"""Sikyeoyong commit gate (docs/wiki/conventions/dev-loop.md).

Mechanical checks for CLAUDE.md absolute rules and docs/wiki/conventions.

Usage:
  python3 -I scripts/verify.py                       # last commit (HEAD~1..HEAD)
  python3 -I scripts/verify.py --range A..B          # a commit range
  python3 -I scripts/verify.py --range A..B --msg-range C..B
                                                     # re-verify: check messages only for new commits
  python3 -I scripts/verify.py --precommit           # before committing: working tree incl. untracked
  add --skip-build to skip lint, typecheck, test, build, forge

Exceptions: a line (or the line above it) may carry `verify-allow: <RULE> <reason>`,
for example `// verify-allow: R4 ratio display, not money`. The reason is required.

Severity: BLOCKER and MAJOR fail (exit 1). REVIEW must be judged by the verifier agent.
MINOR is a note. Exit 2 means the gate could not run (bad range, not a git repo).
"""
import argparse
import os
import re
import subprocess
import sys

DASH_RE = "[" + chr(0x2013) + chr(0x2014) + "]"
TESTNET_CHAIN_ID = 450815
CHAIN_ID_RE = r"\b(450_?815|" + hex(TESTNET_CHAIN_ID) + r")\b"
COMMIT_TYPES = ("feat", "fix", "contract", "docs", "infra", "chore", "test", "refactor")  # git-and-review.md
ALLOWED_TOOLS = {"get_budget", "get_order_history", "get_context", "recommend_merchants", "get_menu",
                 "place_order", "request_owner_approval"}  # CLAUDE.md 3, tech-spec 3.3
UI_AREAS = ("base", "dragon", "chat", "order", "limits", "onboarding", "wallet")
BANNED_UI = ["지갑", "토큰", "트랜잭션", "KYC", "PCL", "블록체인", "가스비", "해시", "OKRW", "attestation", "시드 문구"]
WEB_APP_FILES = {"page.tsx", "layout.tsx", "loading.tsx", "error.tsx", "not-found.tsx", "template.tsx",
                 "global-error.tsx", "globals.css"}
CODE_EXT = (".ts", ".tsx", ".js", ".mjs", ".cjs", ".sol", ".css")
TS_EXT = (".ts", ".tsx")
CONFIG_SCAN_EXT = CODE_EXT + (".json", ".yml", ".yaml", ".sh", ".toml")

# Where chain config may appear, and why.
CHAIN_ID_OK = (
    "packages/shared/src/config/",  # the one home for chain config (CLAUDE.md 2)
    "config/deployments/",          # deploy outputs per chain id (CLAUDE.md 2)
    "docs/", "design/", "CLAUDE.md", "README.md",  # prose
    ".env.example",                 # env template mirrors tech-spec 8.3, values are read via config
    "scripts/verify",               # this gate and its tests
)
ADDRESS_OK = CHAIN_ID_OK + (
    "seed/",            # D-09: each mock merchant has one testnet payout address in seed data
    "contracts/test/",  # forge fixtures
    "contracts/lib/",   # vendored libraries
)
MONEY_NAME = r"\w*(Aokrw|AOKRW|Okrw|OKRW|okrw|aokrw|[Aa]mount|[Pp]rice|[Bb]alance|[Bb]udget|[Ss]pent|[Ss]ubtotal|[Ff]ee)\b"

findings = []


def add(sev, rule, where, msg):
    findings.append((sev, rule, where, msg))


def git(*a, check=True):
    r = subprocess.run(["git"] + list(a), capture_output=True, text=True)
    if check and r.returncode != 0:
        print(f"GATE ERROR: git {' '.join(a)}\n{r.stderr.strip()}")
        print("RESULT ERROR")
        sys.exit(2)
    return r.stdout


def zsplit(out):
    return [p for p in out.split("\0") if p]


def read(p):
    try:
        with open(p, encoding="utf-8") as f:
            return f.read()
    except (UnicodeDecodeError, FileNotFoundError, IsADirectoryError, PermissionError):
        return None


def is_test(p):
    return bool(re.search(r"(\.test\.|\.spec\.|\.stories\.|/test/|/__tests__/|\.t\.sol$|^scripts/verify_test)", p))


def is_fixture(p):
    """Deliberate rule violations used by lint and gate tests (scripts/fixtures/). Dash and secret checks still apply."""
    return p.startswith("scripts/fixtures/")


def allowed(lines, idx, rule):
    """idx is 0-based. True if this or previous line has `verify-allow: <rule> <reason>`."""
    pat = re.compile(r"verify-allow:\s*" + re.escape(rule) + r"\s+\S")
    for j in (idx, idx - 1):
        if 0 <= j < len(lines) and pat.search(lines[j]):
            return True
    return False


def code_lines(p):
    """Yield (lineno, line, lines) skipping pure comment lines."""
    txt = read(p)
    if txt is None:
        return
    lines = txt.splitlines()
    in_block = False
    for i, line in enumerate(lines, 1):
        s = line.strip()
        if in_block:
            if "*/" in s:
                in_block = False
            continue
        if s.startswith("/*") and "*/" not in s:
            in_block = True
            continue
        if s.startswith(("//", "*", "/*", "#")) and not s.startswith("#!"):
            if not (p.endswith(".css") and s.startswith("#")):  # css id selectors start with '#'
                continue
        yield i, line, lines


def imports_of(txt):
    return re.findall(r"(?:from|import)\s*\(?\s*['\"]([^'\"]+)['\"]", txt)


# ---------------------------------------------------------------- setup
ap = argparse.ArgumentParser()
ap.add_argument("--range", dest="rng")
ap.add_argument("--msg-range", dest="msg_rng")
ap.add_argument("--precommit", action="store_true")
ap.add_argument("--skip-build", action="store_true")
opt = ap.parse_args()

top = subprocess.run(["git", "rev-parse", "--show-toplevel"], capture_output=True, text=True)
if top.returncode != 0 or not top.stdout.strip():
    print("GATE ERROR: git 저장소 안에서 실행해야 한다")
    print("RESULT ERROR")
    sys.exit(2)
os.chdir(top.stdout.strip())

has_head = subprocess.run(["git", "rev-parse", "--verify", "-q", "HEAD"], capture_output=True).returncode == 0


def verify_rev(r):
    if subprocess.run(["git", "rev-parse", "--verify", "-q", r + "^{commit}"], capture_output=True).returncode != 0:
        print(f"GATE ERROR: 범위가 잘못됐다: {r}")
        print("RESULT ERROR")
        sys.exit(2)


def parse_range(rng):
    if ".." in rng:
        base, head = rng.split("..", 1)
        verify_rev(base)
        verify_rev(head or "HEAD")
        return base, head or "HEAD"
    verify_rev(rng)
    return None, rng


def commits_in(rng):
    base, head = parse_range(rng)
    if base is None:
        return [git("rev-parse", head).strip()]
    return git("rev-list", "--reverse", f"{base}..{head}").split()


def files_of_commit(rev):
    return zsplit(git("diff-tree", "-z", "--no-commit-id", "--name-only", "-r", "--root", "--diff-filter=AMR", rev))


if opt.precommit:
    tracked = zsplit(git("ls-files", "-z", "--cached", "--others", "--exclude-standard"))
    changed = zsplit(git("diff", "-z", "--name-only", "--diff-filter=AMR", "HEAD")) if has_head else []
    changed += zsplit(git("ls-files", "-z", "--others", "--exclude-standard"))
    if not has_head:
        changed = list(tracked)
    rng = "WORKTREE"
    msg_revs = []
else:
    if not has_head:
        print("GATE ERROR: 커밋이 없다. 첫 커밋 전에는 --precommit")
        print("RESULT ERROR")
        sys.exit(2)
    rng = opt.rng
    if rng is None:
        rng = "HEAD~1..HEAD" if subprocess.run(["git", "rev-parse", "--verify", "-q", "HEAD~1"],
                                               capture_output=True).returncode == 0 else "HEAD"
    base, head = parse_range(rng)
    tracked = zsplit(git("ls-files", "-z"))
    if base is None:
        changed = files_of_commit(head)
    else:
        changed = zsplit(git("diff", "-z", "--name-only", "--diff-filter=AMR", base, head))
    msg_revs = commits_in(opt.msg_rng or rng)

tracked = sorted({p for p in tracked if os.path.isfile(p)})
changed = sorted({p for p in changed if os.path.isfile(p)})

# ---------------------------------------------------------------- G1 clean tree
if not opt.precommit:
    st = git("status", "--porcelain").strip()
    if st:
        add("MAJOR", "G1 clean-tree", ".", "커밋되지 않은 변경이 있다. 커밋 검증은 커밋된 상태만 본다 (커밋 전에는 --precommit):\n" + st[:800])

# ---------------------------------------------------------------- G2, G3 commits
MSG_RE = re.compile(r"^(" + "|".join(COMMIT_TYPES) + r")(\([A-Za-z0-9/._-]+\))?: \S.{0,70}$")
for rev in msg_revs:
    msg = git("log", "-1", "--format=%B", rev)
    subj = msg.splitlines()[0] if msg.strip() else ""
    if not MSG_RE.match(subj):
        add("MAJOR", "G2 commit-format", rev[:8], f"커밋 제목 형식 위반 (git-and-review.md): {subj!r}")
    if re.search(DASH_RE, msg):
        add("BLOCKER", "R1 dash", rev[:8], "커밋 메시지에 em/en dash")
    if "Co-Authored-By:" not in msg:
        add("REVIEW", "G2 attribution", rev[:8], "Co-Authored-By 줄이 없다. AI 세션 커밋이면 필요, 사람 커밋이면 문제 아님")
    files = files_of_commit(rev)
    units = set()
    for p in files:
        parts = p.split("/")
        if parts[0] in ("apps", "packages") and len(parts) > 2:
            units.add("/".join(parts[:2]))
        elif parts[0] in ("contracts", "infra", "seed"):
            units.add(parts[0])
    if len(units) > 2:
        add("REVIEW", "G3 commit-split", rev[:8], f"한 커밋이 코드 단위 {len(units)}개를 건드린다 {sorted(units)}. 나눌 수 있었는지 판단")
    if len(files) > 60:
        add("REVIEW", "G3 commit-size", rev[:8], f"파일 {len(files)}개. 스캐폴딩이 아니면 나눠야 한다")

# ---------------------------------------------------------------- R1 dash
for p in tracked:
    txt = read(p)
    if txt is None:
        continue
    for i, line in enumerate(txt.splitlines(), 1):
        if re.search(DASH_RE, line):
            add("BLOCKER", "R1 dash", f"{p}:{i}", "em/en dash")

# ---------------------------------------------------------------- R8 wiki
if os.path.isfile("scripts/check-wiki.py") and os.path.isdir("docs/wiki"):
    r = subprocess.run([sys.executable, "-I", "scripts/check-wiki.py", "docs/wiki"], capture_output=True, text=True)
    out = (r.stdout + r.stderr).strip()
    if not re.search(r"\berrors=0\b", out):
        add("BLOCKER", "R8 wiki-tree", "docs/wiki", out[-1500:] or f"check-wiki.py 실행 실패 (exit {r.returncode})")
    root_map = re.sub(r"^---\n.*?\n---\n", "", read("docs/wiki/README.md") or "", count=1, flags=re.S)  # body only
    for p in changed:
        if p.startswith("docs/wiki/") and p.endswith(".md") and "/components/ui/" not in p and "/archive/" not in p \
                and p != "docs/wiki/README.md" and os.path.basename(p) not in root_map:
            add("MAJOR", "R8 wiki-map", p, "새 위키 문서가 ROOT 트리 지도(docs/wiki/README.md)에 없다")

# ---------------------------------------------------------------- R5 secrets
SECRET_PATTERNS = [
    (r"sk-ant-[A-Za-z0-9_-]{10,}", "Anthropic 키"),
    (r"-----BEGIN [A-Z ]*PRIVATE KEY-----", "PEM 개인키"),
    (r"(?i)(private_?key|secret|auth_?token|api_?key|mnemonic)[\"']?\s*[:=]\s*[\"']?0x[0-9a-fA-F]{64}", "16진 개인키 대입"),
    (r"AIza[0-9A-Za-z_-]{30,}", "Google 키"),
    (r"\bxox[abp]-[0-9A-Za-z-]{10,}", "Slack 토큰"),
]
for p in tracked:
    base = os.path.basename(p)
    if base.startswith(".env") and base != ".env.example":
        add("BLOCKER", "R5 secret-file", p, ".env 파일이 추적된다")
    if p.endswith((".pem", ".key", ".p12")) or base == "credentials.json":
        add("BLOCKER", "R5 secret-file", p, "키 파일이 추적된다")
    if p.startswith("scripts/verify_test"):
        continue  # fixtures for this gate contain fake secrets on purpose
    txt = read(p)
    if txt is None:
        continue
    for pat, name in SECRET_PATTERNS:
        for m in re.finditer(pat, txt):
            add("BLOCKER", "R5 secret", f"{p}:{txt[:m.start()].count(chr(10)) + 1}", name)
    if base == ".env.example":
        for i, line in enumerate(txt.splitlines(), 1):
            m = re.match(r"^([A-Z0-9_]*(SECRET|TOKEN|KEY|PASSWORD)[A-Z0-9_]*)=([^#]*)", line.strip())
            if m and m.group(3).strip() not in ("", '""', "''"):
                add("BLOCKER", "R5 env-example", f"{p}:{i}", f"{m.group(1)}에 값이 있다. 예시는 빈 값만")

# ---------------------------------------------------------------- R2 chain config
for p in tracked:
    if is_fixture(p):
        continue
    if not (p.endswith(CONFIG_SCAN_EXT) or os.path.basename(p) == ".env.example") or "/node_modules/" in p:
        continue
    if p.endswith(("pnpm-lock.yaml", "package.json")) or os.path.basename(p).startswith("tsconfig"):
        continue
    for i, line, lines in code_lines(p):
        if allowed(lines, i - 1, "R2"):
            continue
        if not p.startswith(CHAIN_ID_OK):
            if re.search(CHAIN_ID_RE, line, re.I):
                add("BLOCKER", "R2 chain-config", f"{p}:{i}", "체인 ID 하드코딩. packages/shared/src/config에서 읽는다")
            if re.search(r"(https?|wss?)://[^\s\"'`]*maroo[^\s\"'`]*", line):
                add("BLOCKER", "R2 chain-config", f"{p}:{i}", "마루 URL 하드코딩")
        if not p.startswith(ADDRESS_OK) and not is_test(p) and re.search(r"\b0x[0-9a-fA-F]{40}\b", line):
            add("BLOCKER", "R2 chain-config", f"{p}:{i}", "주소 하드코딩")

# ---------------------------------------------------------------- R4 money
for p in tracked:
    if is_fixture(p):
        continue
    if not p.endswith(TS_EXT) or "/node_modules/" in p:
        continue
    for i, line, lines in code_lines(p):
        if allowed(lines, i - 1, "R4"):
            continue
        has_money = re.search(MONEY_NAME, line)
        if re.search(r"\b" + MONEY_NAME + r"\??\s*:\s*number\b", line):
            add("BLOCKER", "R4 money-number", f"{p}:{i}", "금액 이름에 number 타입. bigint(aokrw) 또는 정수 문자열")
        if has_money and (re.search(r"\bNumber\(", line) or re.search(r"\bas number\b", line)
                          or re.search(r"\bMath\.(round|floor|ceil|trunc)\(", line) or re.search(r"\bparseInt\(", line)):
            add("BLOCKER", "R4 money-number", f"{p}:{i}", "금액을 Number, Math, parseInt로 다룬다")
        if re.search(r"\b(parseFloat|toFixed)\s*\(", line):
            add("BLOCKER", "R4 money-float", f"{p}:{i}", "부동소수점 함수. 금액이 아니면 `verify-allow: R4 <사유>`")
        if re.search(r"\b1e18\b|\b10\s*\*\*\s*18\b(?!n)", line) and not p.startswith("packages/shared/src/money"):
            add("MAJOR", "R4 money-scale", f"{p}:{i}", "단위 변환은 packages/shared 금액 유틸에서만")

# ---------------------------------------------------------------- S1 typescript hygiene
for p in tracked:
    if is_fixture(p):
        continue
    if not p.endswith(TS_EXT) or "/node_modules/" in p or p.endswith(".d.ts"):
        continue
    for i, line, lines in code_lines(p):
        if re.search(r":\s*any\b|\bas any\b|<any>|\bany\[\]", line):
            add("MAJOR", "S1 no-any", f"{p}:{i}", "any 사용 (code-style.md)")
        if "@ts-ignore" in line or "@ts-nocheck" in line:
            add("MAJOR", "S1 ts-ignore", f"{p}:{i}", "@ts-ignore 금지. @ts-expect-error와 사유")
        if "eslint-disable" in line and "--" not in line:
            add("MAJOR", "S1 eslint-disable", f"{p}:{i}", "eslint-disable에 사유(-- 이유)가 없다")
        if re.search(r"\bthrow\s+['\"`]", line):
            add("MAJOR", "S1 string-throw", f"{p}:{i}", "문자열 throw 금지. AppError")
        if re.search(r"\bconsole\.log\(", line) and not is_test(p):
            add("MINOR", "S1 console", f"{p}:{i}", "console.log. Nest Logger 또는 제거")
    for line in (read(p) or "").splitlines():
        if re.search(r"^\s*//.*\beslint-disable", line) and "--" not in line:
            add("MAJOR", "S1 eslint-disable", p, "eslint-disable에 사유(-- 이유)가 없다")
            break

# ---------------------------------------------------------------- D18 web
for p in tracked:
    if not p.startswith("apps/web/") or "/node_modules/" in p:
        continue
    txt = read(p) or ""
    if p.endswith(TS_EXT):
        for mod in imports_of(txt):
            if re.match(r"(viem|ethers|@anthropic-ai/|better-sqlite3|drizzle-orm|@sikyeoyong/api)", mod):
                add("BLOCKER", "D18 web-scope", p, f"웹에 체인, LLM, DB 의존: {mod}")
        if re.search(r"\bfetch\(", txt) and not re.match(r"apps/web/(lib/|features/[^/]+/hooks/)", p) and not is_test(p):
            add("MAJOR", "D18 web-fetch", p, "fetch는 features/*/hooks 또는 lib(API 클라이언트)에서만")
    m = re.match(r"apps/web/app/(.*)$", p)
    if m:
        base = os.path.basename(p)
        if p.endswith(CODE_EXT) and base not in WEB_APP_FILES:
            add("MAJOR", "D18 app-files", p, "app/에는 page, layout, loading, error(와 not-found, template, globals.css)만")
        if p.endswith(TS_EXT):
            n = len(txt.splitlines())
            if base == "page.tsx" and n > 60:
                add("MAJOR", "D18 page-assembly", p, f"page.tsx {n}줄 (60 초과). 컨테이너로 쪼갠다")
            checks = [(r"\bfetch\(", "fetch"), (r"\buse(State|Effect|Reducer|Memo|Callback|Ref)\b", "React 상태 훅"),
                      (r"style=\{", "인라인 스타일"), (r"\bformatOkrw\b|\bparseAokrw\b|\baokrw\b", "금액 계산")]
            if base == "page.tsx":
                checks += [(r"\.module\.css", "CSS 모듈"), (r"className=", "className 스타일")]
            for pat, what in checks:
                if re.search(pat, txt):
                    add("MAJOR", "D18 page-assembly", p, f"{base}에 {what}. app/ 파일은 조립만")
    if re.match(r"apps/web/features/[^/]+/containers/", p) and p.endswith(TS_EXT) and not is_test(p):
        for pat, what in [(r"className=", "className"), (r"style=\{", "인라인 스타일"), (r"\.module\.css", "CSS 모듈"),
                          (r"\bfetch\(", "fetch")]:
            if re.search(pat, txt):
                add("MAJOR", "D18 container-thin", p, f"컨테이너에 {what}. 컨테이너는 훅 결과를 props로 넘기기만")

# ---------------------------------------------------------------- D17 visual (ui and web)
for p in tracked:
    if not (p.startswith("packages/ui/src/") or p.startswith("apps/web/")) or "/node_modules/" in p:
        continue
    if not p.endswith((".css", ".tsx", ".ts")) or is_test(p) or "/tokens/" in p or os.path.basename(p).startswith("tokens"):
        continue
    for i, line, lines in code_lines(p):
        if allowed(lines, i - 1, "D17"):
            continue
        if re.search(r"(?<![&\w])#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{1}|[0-9a-fA-F]{3}|[0-9a-fA-F]{5})?\b|\brgba?\(|\bhsla?\(", line):
            add("MAJOR", "D17 tokens-only", f"{p}:{i}", "색 직접 사용. 토큰 CSS 변수만")
        if re.search(r"(linear|radial|conic)-gradient", line):
            add("MAJOR", "D17 no-slop", f"{p}:{i}", "그라데이션 금지")
        if re.search(r"box-shadow\s*:(?![^;]*var\()", line) and "none" not in line:
            add("REVIEW", "D17 no-slop", f"{p}:{i}", "토큰 밖 그림자. 장식 그림자 금지")
        if re.search(r"transition(-property)?\s*:\s*[^;]*\b(top|left|right|bottom|height|width|margin|padding)\b", line):
            add("MAJOR", "D17 motion", f"{p}:{i}", "레이아웃 속성 애니메이션 금지")
    if p.endswith(TS_EXT) and not p.endswith(".test.tsx"):
        for i, line, lines in code_lines(p):
            for w in BANNED_UI:
                if re.search(r"[\"'`>][^\"'`<]*" + re.escape(w), line) and not allowed(lines, i - 1, "D17"):
                    add("REVIEW", "D17 chain-words", f"{p}:{i}", f"화면 문구에 '{w}'. '자세히 보기' 안이 아니면 금지")

# ---------------------------------------------------------------- D18 ui components
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
        continue
    idx = read(f"docs/wiki/components/ui/{area}/_index.md") or ""
    if f"{name}.md" not in idx:
        add("BLOCKER", "D18 ui-doc", doc, "영역 _index.md에 등록 안 됨")
    dtxt = read(doc) or ""
    stories = read(f"{d}/{name}.stories.tsx") or ""
    sec = re.search(r"##\s*하네스 상태\s*\n(.*?)(\n##\s|\Z)", dtxt, re.S)
    if sec and stories:
        states = [s for s in re.findall(r"^\s*(?:[-*]|\d+\.)\s+(.+)$", sec.group(1), re.M) if s.strip()]
        exports = re.findall(r"^export const (\w+)", stories, re.M)
        if len(exports) < len(states):
            add("MAJOR", "D18 ui-harness-states", f"{d}/{name}.stories.tsx",
                f"문서 하네스 상태 {len(states)}개, 스토리 {len(exports)}개. 문서 상태 전부 만든다")
for p in tracked:
    if not p.startswith("packages/ui/src/") or not p.endswith(TS_EXT):
        continue
    txt = read(p) or ""
    parts = p.split("/")
    area = parts[3] if len(parts) > 4 else ""
    for mod in imports_of(txt):
        if re.match(r"(next/(navigation|router|headers)|@tanstack/|zustand|viem|ethers|@sikyeoyong/(web|api))", mod) \
                or "apps/" in mod:
            add("BLOCKER", "D18 ui-pure", p, f"ui 컴포넌트가 {mod} import. props와 콜백만")
        if mod.startswith("."):
            target = os.path.normpath(os.path.join(os.path.dirname(p), mod))
            tm = re.match(r"packages/ui/src/([a-z]+)/", target + "/")
            if tm and area and tm.group(1) != area and tm.group(1) not in ("base", "dragon") and tm.group(1) in UI_AREAS:
                add("MAJOR", "D18 ui-cross-area", p, f"영역 사이 import {mod}. base와 dragon만 허용")
    if re.search(r"\bfetch\(", txt) and not is_test(p):
        add("BLOCKER", "D18 ui-pure", p, "ui 컴포넌트에서 fetch")

# ---------------------------------------------------------------- shared purity
for p in tracked:
    if not p.startswith("packages/shared/src/") or not p.endswith(TS_EXT) or is_test(p):
        continue
    txt = read(p) or ""
    if "process.env" in txt or "import.meta.env" in txt:
        add("BLOCKER", "A shared-pure", p, "shared에서 환경변수 읽기")
    for mod in imports_of(txt):
        if re.match(r"(react|next|@nestjs|better-sqlite3|drizzle-orm|node:|fs$|path$|@anthropic-ai)", mod):
            add("BLOCKER", "A shared-pure", p, f"shared가 런타임 의존 {mod} import")
    if re.search(r"\bfetch\(", txt) and not p.startswith("packages/shared/src/api/"):
        add("MAJOR", "A shared-pure", p, "shared에서 네트워크. API 클라이언트(주입된 fetch)만 예외")

# ---------------------------------------------------------------- D18 api boundaries
for p in tracked:
    if not p.startswith("apps/api/src/") or not p.endswith(".ts"):
        continue
    txt = read(p) or ""
    m = re.match(r"apps/api/src/modules/([a-z0-9-]+)/", p)
    own = m.group(1) if m else None
    for mod in imports_of(txt):
        if re.search(r"maws|@modelcontextprotocol", mod, re.I) and own != "payment" and not is_test(p):
            add("BLOCKER", "D06 maws-scope", p, f"MAWS/MCP 클라이언트는 payment 모듈 안에서만: {mod}")
        if not mod.startswith("."):
            continue
        target = os.path.normpath(os.path.join(os.path.dirname(p), mod))
        tm = re.match(r"apps/api/src/modules/([a-z0-9-]+)(/(.*))?$", target)
        if not tm or tm.group(1) == own:
            continue
        rest = tm.group(3) or ""
        if "repository" in rest or "/db" in rest or "schema" in rest:
            add("BLOCKER", "D18 api-boundary", p, f"다른 모듈 저장소/테이블 직접 import: {mod}")
        elif not re.search(r"\.(service|module)$", rest):
            add("MAJOR", "D18 api-boundary", p, f"다른 모듈은 service.ts(와 module.ts)로만: {mod}")
    if p.endswith(".controller.ts"):
        if re.search(r"repository|drizzle-orm|['\"][^'\"]*/db/", txt):
            add("BLOCKER", "D18 controller-thin", p, "컨트롤러가 저장소/DB 직접 사용")
        if re.search(r"\b(for|while)\s*\(|\.reduce\(", txt):
            add("REVIEW", "D18 controller-thin", p, "컨트롤러에 반복/계산 로직이 보인다")
    if own == "payment" and not is_test(p):
        for i, line, lines in code_lines(p):
            if re.search(r"\b(retry|retries|attempts?|backoff)\w*\b", line, re.I):
                add("REVIEW", "R9 no-auto-retry", f"{p}:{i}", "결제 모듈에 재시도 흔적. 자동 재시도 금지 (같은 orderRef 수동만)")

# ---------------------------------------------------------------- R3 llm tools
TOOLS_DIR = "apps/api/src/modules/llm/tools/"
TOOL_NAME_RE = re.compile(r"[\"']?name[\"']?\s*:\s*[\"'`]([^\"'`]+)[\"'`]")
for p in tracked:
    if not p.startswith("apps/api/src/modules/llm/") or is_test(p) or not p.endswith(TS_EXT + (".json",)):
        continue
    txt = read(p) or ""
    if p.startswith(TOOLS_DIR):
        for m in TOOL_NAME_RE.finditer(txt):
            if m.group(1) not in ALLOWED_TOOLS:
                add("BLOCKER", "R3 llm-tools", p, f"허용 목록에 없는 LLM 도구 이름 {m.group(1)!r}")
    elif re.search(r"input_schema|inputSchema", txt):
        add("MAJOR", "R3 llm-tools", p, f"도구 정의는 {TOOLS_DIR} 안에만 둔다")
    for i, line, lines in code_lines(p):
        for w in ("transfer", "fund", "createAgent", "agent_create", "setPolicy", "policy_set", "drain", "unfreeze", "withdraw"):
            if re.search(r"\b" + w + r"\w*", line, re.I):
                add("REVIEW", "R3 llm-tools", f"{p}:{i}", f"llm 모듈에 돈/정책 관련 식별자 '{w}'")
if any(p.startswith(TOOLS_DIR) and not is_test(p) for p in tracked):
    tests = [read(p) or "" for p in tracked if p.startswith(TOOLS_DIR) and is_test(p)]
    if not any(all(t in txt for t in ALLOWED_TOOLS) for txt in tests):
        add("MAJOR", "R3 llm-tools", TOOLS_DIR, "도구 화이트리스트 자동 비교 테스트가 없다 (testing.md). 허용 목록 7개를 모두 적은 테스트")

# ---------------------------------------------------------------- T1 tests accompany source changes
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
    elif re.search(r"/src/.*\.(ts|tsx|sol)$", p) and not re.search(r"(/index\.ts|\.d\.ts|/main\.ts|\.module\.ts)$", p):
        src_by_pkg.setdefault(pk, []).append(p)
for pk, srcs in sorted(src_by_pkg.items()):
    if pk not in test_by_pkg and pk != "apps/web":
        add("MAJOR", "T1 tests-required", pk, f"소스가 바뀌었는데 테스트 변경이 없다: {srcs[:5]}")


# ---------------------------------------------------------------- T0 build gates
def gate(name, cmd, cwd=None):
    r = subprocess.run(cmd, shell=True, capture_output=True, text=True, cwd=cwd)
    if r.returncode != 0:
        add("BLOCKER", "T0 " + name, cmd, (r.stdout + r.stderr).strip()[-2500:])


if not opt.skip_build:
    if os.path.isfile("package.json"):
        if not os.path.isdir("node_modules"):
            gate("install", "pnpm install --frozen-lockfile")
        pj = read("package.json") or ""
        for script in ("lint", "typecheck", "test", "build"):
            if f'"{script}"' in pj:
                gate(script, f"pnpm -s {script}")
            else:
                add("MAJOR", "T0 scripts", "package.json", f"루트 스크립트 {script} 없음 (CLAUDE.md 7 명령어 규약)")
    if os.path.isfile("contracts/foundry.toml"):
        gate("forge-build", "forge build", cwd="contracts")
        gate("forge-test", "forge test", cwd="contracts")

# ---------------------------------------------------------------- report
order = {"BLOCKER": 0, "MAJOR": 1, "REVIEW": 2, "MINOR": 3}
findings = sorted(set(findings), key=lambda f: (order[f[0]], f[1], f[2], f[3]))
counts = {k: sum(1 for f in findings if f[0] == k) for k in order}
print(f"# verify.py range={rng} msg-commits={len(msg_revs)} changed={len(changed)} tracked={len(tracked)} "
      f"build={'skip' if opt.skip_build else 'run'}")
for sev, rule, where, msg in findings:
    print(f"[{sev}] {rule} {where}\n    {msg}")
print("SUMMARY " + " ".join(f"{k}={v}" for k, v in counts.items()))
fail = counts["BLOCKER"] + counts["MAJOR"] > 0
print("RESULT " + ("FAIL" if fail else "PASS"))
sys.exit(1 if fail else 0)
