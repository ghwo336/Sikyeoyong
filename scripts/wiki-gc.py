"""위키 가비지 컬렉션 후보 찾기 (읽기 전용, 아무것도 고치지 않는다).

사용: python3 -I scripts/wiki-gc.py [저장소 루트]
결과는 후보 목록이다. 실제 정리는 wiki-gardener 에이전트가 규칙(docs/wiki/conventions/wiki-gc.md)대로 한다.
"""
import os, re, sys, time

root = sys.argv[1] if len(sys.argv) > 1 else "."
wiki = os.path.join(root, "docs", "wiki")

def md_files(base):
    for d, _, fs in os.walk(base):
        for f in fs:
            if f.endswith(".md"):
                yield os.path.join(d, f)

# 1. 더 이상 쓰지 않는 말 (결정이 바뀌며 낡은 용어). 결정 이력, 작업 기록, 닫힌 질문은 제외.
STALE = {
    r"\bExpo\b|expo-": "D-18: 웹은 Next.js",
    r"\bHono\b": "D-18: 백엔드는 NestJS",
    r"React Native|Reanimated": "D-18",
    r"apps/app\b": "D-18: apps/web",
    r"apps/server\b": "D-18: apps/api",
    r"ClawOps|070 전화": "D-14: 전화 제외",
    r"멤풀 전에 막": "D-02 E-4: 전역 정책에만 쓰는 표현",
}
SKIP_FILES = ("decisions-log.md", "worklog.md")

# 2. 문서가 가리키는 docs/, design/, scripts/ 경로가 실제로 있는지
PATH_RE = re.compile(r"`((?:docs|design|scripts)/[^`\s]+)`")

# 3. 닫힌 질문 (open-questions.md에서 '상태: 닫힘' 또는 '상태: 해결')
Q_RE = re.compile(r"^### (Q-\d+)[^\n]*\n- 상태: (닫힘|해결)", re.M)

# 4. 결정 기록에서 "대체됨"으로 표시된 결정을 아직 인용하는 곳
SUPERSEDED = {}
dec = os.path.join(root, "docs", "_research", "decisions.md")
if os.path.exists(dec):
    for m in re.finditer(r"^## (D-\d+)[^\n]*\((?:[^)]*)대체됨: (D-\d+)\)", open(dec, encoding="utf-8").read(), re.M):
        SUPERSEDED[m.group(1)] = m.group(2)

findings = []
for p in md_files(wiki):
    rel = os.path.relpath(p, root)
    txt = open(p, encoding="utf-8").read()
    if not os.path.basename(p) in SKIP_FILES:
        body = txt
        if os.path.basename(p) == "open-questions.md":
            body = re.sub(r"### Q-\d+[^\n]*\n- 상태: (닫힘|해결).*?(?=\n### |\Z)", "", txt, flags=re.S)
        for pat, why in STALE.items():
            for m in re.finditer(pat, body):
                line = body[:m.start()].count("\n") + 1
                findings.append(("낡은 용어", rel, line, f"{m.group(0)} ({why})"))
    for m in PATH_RE.finditer(txt):
        target = m.group(1).rstrip(".,)")
        if "<" in target or "*" in target:
            continue
        if not os.path.exists(os.path.join(root, target)):
            line = txt[:m.start()].count("\n") + 1
            findings.append(("없는 경로", rel, line, target))
    for d, new in SUPERSEDED.items():
        for m in re.finditer(rf"\b{d}\b", txt):
            line = txt[:m.start()].count("\n") + 1
            findings.append(("대체된 결정 인용", rel, line, f"{d} -> {new}"))

oq = os.path.join(wiki, "log", "open-questions.md")
if os.path.exists(oq):
    for m in Q_RE.finditer(open(oq, encoding="utf-8").read()):
        findings.append(("닫힌 질문 (보관 후보)", os.path.relpath(oq, root), 0, m.group(1)))

wl = os.path.join(wiki, "log", "worklog.md")
if os.path.exists(wl):
    n = len(re.findall(r"^### \d{4}-\d{2}-\d{2}", open(wl, encoding="utf-8").read(), re.M))
    if n > 10:
        findings.append(("작업 기록 압축 후보", os.path.relpath(wl, root), 0, f"항목 {n}개, 최근 10개만 남기고 요약"))

for kind, f, line, what in sorted(findings):
    loc = f"{f}:{line}" if line else f
    print(f"[{kind}] {loc}  {what}")
print(f"후보 {len(findings)}개 ({time.strftime('%Y-%m-%d')})")
