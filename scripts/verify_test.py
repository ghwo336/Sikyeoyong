#!/usr/bin/env python3
"""Self-test for scripts/verify.py. Run: python3 -I scripts/verify_test.py

Each case builds a throwaway git repo with the gate, a minimal wiki, a base commit,
then the case files as one commit, runs the gate with --skip-build and compares
the rule names it reports. `hit` rules must appear, `miss` rules must not.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

HERE = os.path.dirname(os.path.abspath(__file__))
DASH = chr(0x2014)
FAKE_KEY = "sk-" + "ant-" + "abcdefghijklmnop1234"
GOOD_MSG = "feat(x): 테스트\n\nCo-Authored-By: Claude <noreply@anthropic.com>"

WIKI_ROOT = "---\nnode: root\nparent: null\nchildren:\n  - a.md\n---\n# root\na.md\n"
WIKI_LEAF = "---\nnode: leaf\nparent: README.md\nchildren: []\n---\n# a\n"
LLM_TEST = "it('whitelist', () => expect(names).toEqual(['get_budget','get_order_history','get_context'," \
           "'recommend_merchants','get_menu','place_order','request_owner_approval']));\n"

CASES = [
    # ---- violations that must be caught
    dict(name="dash in file", files={"docs/x.md": f"a {DASH} b\n"}, hit=["R1 dash"]),
    dict(name="dash in commit msg", files={"a.txt": "x\n"}, msg=f"feat(x): a {DASH} b\n\nCo-Authored-By: C", hit=["R1 dash"]),
    dict(name="bad commit format", files={"a.txt": "x\n"}, msg="update stuff", hit=["G2 commit-format"]),
    dict(name="uppercase scope ok", files={"a.txt": "x\n"}, msg="feat(ui/LimitGauge): 추가\n\nCo-Authored-By: C",
         miss=["G2 commit-format"]),
    dict(name="missing attribution is review", files={"a.txt": "x\n"}, msg="feat(x): 사람 커밋",
         hit=["G2 attribution"], ok=True),
    dict(name="money number type", files={"apps/api/src/x.ts": "const amountAokrw: number = 1;\n"},
         hit=["R4 money-number"]),
    dict(name="money as number", files={"apps/api/src/x.ts": "const fee = raw as number; const priceAokrw = Number(raw);\n"},
         hit=["R4 money-number"]),
    dict(name="money Math.round", files={"apps/api/src/x.ts": "const t = Math.round(subtotal * 1.1);\n"},
         hit=["R4 money-number"]),
    dict(name="toFixed without reason", files={"apps/api/src/x.ts": "const s = ratio.toFixed(0);\n"},
         hit=["R4 money-float"]),
    dict(name="chain id plain", files={"apps/api/src/x.ts": "const id = 450815;\n"}, hit=["R2 chain-config"]),
    dict(name="chain id underscore", files={"apps/api/src/x.ts": "const id = 450_815;\n"}, hit=["R2 chain-config"]),
    dict(name="chain id hex", files={"apps/api/src/x.ts": f"const id = {hex(450815)};\n"}, hit=["R2 chain-config"]),
    dict(name="maroo url", files={"infra/deploy.sh": "curl https://rpc-testnet.maroo.io\n"}, hit=["R2 chain-config"]),
    dict(name="address in code", files={"apps/api/src/x.ts": "const a = '0x" + "ab" * 20 + "';\n"},
         hit=["R2 chain-config"]),
    dict(name="chain id in seed", files={"seed/m.json": '{"chainId": 450815}\n'}, hit=["R2 chain-config"]),
    dict(name="env file", files={".env": "A=1\n"}, force=[".env"], hit=["R5 secret-file"]),
    dict(name="env local", files={".env.local": "A=1\n"}, force=[".env.local"], hit=["R5 secret-file"]),
    dict(name="anthropic key", files={"apps/api/src/k.ts": f"const k = '{FAKE_KEY}';\n"}, hit=["R5 secret"]),
    dict(name="env example with value", files={".env.example": "SESSION_SECRET=abc\nPORT=8787\n"},
         hit=["R5 env-example"]),
    dict(name="page fetch and state", files={"apps/web/app/x/page.tsx":
         "import { useState } from 'react';\nexport default function P(){ fetch('/a'); useState(0); return null; }\n"},
         hit=["D18 page-assembly", "D18 web-fetch"]),
    dict(name="layout fetch and color", files={"apps/web/app/layout.tsx":
         "export default function L(){ fetch('/a'); return <div style={{color:'#fff'}} />; }\n"},
         hit=["D18 page-assembly", "D17 tokens-only"]),
    dict(name="extra file in app", files={"apps/web/app/x/Widget.tsx": "export const W = () => null;\n"},
         hit=["D18 app-files"]),
    dict(name="container className", files={"apps/web/features/o/containers/C.tsx":
         "export const C = () => <div className='x' />;\n"}, hit=["D18 container-thin"]),
    dict(name="web imports viem", files={"apps/web/lib/x.ts": "import { createPublicClient } from 'viem';\n"},
         hit=["D18 web-scope"]),
    dict(name="ui missing stories", files={
        "packages/ui/src/base/Btn/Btn.tsx": "export const Btn = () => null;\n",
        "packages/ui/src/base/Btn/index.ts": "export * from './Btn';\n"}, hit=["D18 ui-harness", "D18 ui-doc"]),
    dict(name="ui css color", files={"packages/ui/src/base/X.module.css": ".a { color: #fff; }\n"},
         hit=["D17 tokens-only"]),
    dict(name="ui gradient", files={"packages/ui/src/base/X.module.css": ".a { background: linear-gradient(red, blue); }\n"},
         hit=["D17 no-slop"]),
    dict(name="ui layout transition", files={"packages/ui/src/base/X.module.css": ".a { transition: height 200ms; }\n"},
         hit=["D17 motion"]),
    dict(name="ui imports tanstack", files={"packages/ui/src/base/Y/y.ts": "import { useQuery } from '@tanstack/react-query';\n"},
         hit=["D18 ui-pure"]),
    dict(name="ui cross area", files={"packages/ui/src/order/z.ts": "import { L } from '../limits/L';\n"},
         hit=["D18 ui-cross-area"]),
    dict(name="ui imports base ok", files={"packages/ui/src/order/z.ts": "import { B } from '../base/Button';\n"},
         miss=["D18 ui-cross-area"]),
    dict(name="other module repository", files={"apps/api/src/modules/orders/o.service.ts":
         "import { BudgetRepository } from '../budget/budget.repository';\n"}, hit=["D18 api-boundary"]),
    dict(name="other module bare repository", files={"apps/api/src/modules/orders/o.service.ts":
         "import { R } from '../budget/repository';\n"}, hit=["D18 api-boundary"]),
    dict(name="other module index", files={"apps/api/src/modules/orders/o.service.ts":
         "import { B } from '../budget';\n"}, hit=["D18 api-boundary"]),
    dict(name="other module service ok", files={"apps/api/src/modules/orders/o.service.ts":
         "import { BudgetService } from '../budget/budget.service';\n"}, miss=["D18 api-boundary"]),
    dict(name="maws outside payment", files={"apps/api/src/modules/orders/o.ts":
         "import { Client } from '@modelcontextprotocol/sdk/client';\n"}, hit=["D06 maws-scope"]),
    dict(name="controller uses repository", files={"apps/api/src/modules/orders/orders.controller.ts":
         "import { OrdersRepository } from './orders.repository';\n"}, hit=["D18 controller-thin"]),
    dict(name="llm tool json style", files={"apps/api/src/modules/llm/tools/defs.ts":
         '[{ "name": "set_policy" }, { name : "drain_agent" }, { name: "agentCreate" }]\n'}, hit=["R3 llm-tools"]),
    dict(name="llm tool outside tools dir", files={"apps/api/src/modules/llm/x.ts":
         "const t = { name: 'get_budget', input_schema: {} };\n"}, hit=["R3 llm-tools"]),
    dict(name="llm tools without whitelist test", files={"apps/api/src/modules/llm/tools/defs.ts":
         "export const T = [{ name: 'get_budget' }];\n"}, hit=["R3 llm-tools"]),
    dict(name="llm tools ok", files={"apps/api/src/modules/llm/tools/defs.ts": "export const T = [{ name: 'get_budget' }];\n",
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, miss=["R3 llm-tools"]),
    dict(name="shared env", files={"packages/shared/src/c.ts": "export const a = process.env.A;\n"}, hit=["A shared-pure"]),
    dict(name="shared fs", files={"packages/shared/src/c.ts": "import fs from 'fs';\n"}, hit=["A shared-pure"]),
    dict(name="any", files={"apps/api/src/a.ts": "const a: any = 1;\n"}, hit=["S1 no-any"]),
    dict(name="src without test", files={"packages/shared/src/money.ts": "export const a = 1n;\n"},
         hit=["T1 tests-required"]),
    dict(name="src with test", files={"packages/shared/src/money.ts": "export const a = 1n;\n",
         "packages/shared/src/money.test.ts": "it('a', () => {});\n"}, miss=["T1 tests-required"]),
    dict(name="comment-only change needs no test", base={"packages/shared/src/money.ts": "export const a = 1n;\n"},
         files={"packages/shared/src/money.ts": "// why this exists\nexport const a = 1n;\n"}, miss=["T1 tests-required"]),
    dict(name="code change still needs test", base={"packages/shared/src/money.ts": "export const a = 1n;\n"},
         files={"packages/shared/src/money.ts": "// why\nexport const a = 2n;\n"}, hit=["T1 tests-required"]),
    dict(name="wiki doc not in map", files={"docs/wiki/b.md": WIKI_LEAF},
         edit={"docs/wiki/README.md": WIKI_ROOT.replace("  - a.md\n", "  - a.md\n  - b.md\n")},
         hit=["R8 wiki-map"]),
    dict(name="korean wiki doc not in map", files={"docs/wiki/한글.md": WIKI_LEAF},
         edit={"docs/wiki/README.md": WIKI_ROOT.replace("  - a.md\n", "  - a.md\n  - 한글.md\n")},
         hit=["R8 wiki-map"]),
    dict(name="wiki orphan", files={"docs/wiki/c.md": WIKI_LEAF}, hit=["R8 wiki-tree"]),
    dict(name="fixtures skip code rules", files={"scripts/fixtures/eslint/x.ts": "export const a: any = 1;\nconst amountAokrw: number = 1;\n"},
         miss=["S1 no-any", "R4 money-number"]),
    dict(name="fixtures still dash-checked", files={"scripts/fixtures/x.ts": f"// {DASH}\n"}, hit=["R1 dash"]),
    # ---- normal code that must pass
    dict(name="normal code passes", files={
        "apps/api/src/modules/llm/runtime.ts": "const toolCallLimit: number = 8;\nfunction history(limit: number) { return limit; }\n"
                                               "const rateLimitPerMinute: number = 60;\nconst logger = { name: 'kimbap' };\n",
        "apps/api/src/money.ts": "// const amountAokrw: number\nconst priceAokrw: bigint = 10n ** 18n;\n"
                                 "const pct = ratio.toFixed(0); // verify-allow: R4 ratio display, not money\n",
        "apps/api/src/x.test.ts": "const a = '0x" + "cd" * 20 + "';\n",
        "packages/shared/src/config/chain.ts": "export const TESTNET = { id: 450815 };\n",
        "packages/shared/src/config/chain.test.ts": "it('x', () => {});\n",
        "space name.txt": "x\n",
        "img.png": b"\x89PNG\r\n\x1a\n\x00\x00\xff\xfe",
    }, ok=True),
]


def run(cmd, cwd, check=True):
    r = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True)
    if check and r.returncode not in (0, 1):
        raise RuntimeError(f"{cmd} -> {r.returncode}\n{r.stdout}\n{r.stderr}")
    return r


def write(root, rel, content):
    path = os.path.join(root, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    mode = "wb" if isinstance(content, bytes) else "w"
    with open(path, mode, **({} if mode == "wb" else {"encoding": "utf-8"})) as f:
        f.write(content)


def new_repo():
    root = tempfile.mkdtemp(prefix="verify-test-")
    run(["git", "init", "-q", "-b", "main"], root)
    run(["git", "config", "user.email", "t@example.com"], root)
    run(["git", "config", "user.name", "t"], root)
    os.makedirs(os.path.join(root, "scripts"))
    for f in ("verify.py", "check-wiki.py"):
        shutil.copy(os.path.join(HERE, f), os.path.join(root, "scripts", f))
    write(root, "docs/wiki/README.md", WIKI_ROOT)
    write(root, "docs/wiki/a.md", WIKI_LEAF)
    write(root, ".gitignore", ".env\n.env.*\n!.env.example\n")
    run(["git", "add", "-A"], root)
    run(["git", "commit", "-q", "-m", "chore(test): base\n\nCo-Authored-By: C"], root)
    return root


def rules_of(out):
    return {m.group(2): m.group(1) for m in re.finditer(r"^\[(\w+)\] (\S+ \S+) ", out, re.M)}


def main():
    failures = 0
    for case in CASES:
        root = new_repo()
        try:
            if case.get("base"):
                for rel, content in case["base"].items():
                    write(root, rel, content)
                run(["git", "add", "-A"], root)
                run(["git", "commit", "-q", "-m", GOOD_MSG], root)
            for rel, content in case.get("files", {}).items():
                write(root, rel, content)
            for rel, content in case.get("edit", {}).items():
                write(root, rel, content)
            run(["git", "add", "-A"], root)
            for rel in case.get("force", []):
                run(["git", "add", "-f", rel], root)
            run(["git", "commit", "-q", "-m", case.get("msg", GOOD_MSG)], root)
            r = run([sys.executable, "-I", "scripts/verify.py", "--skip-build"], root)
            got = rules_of(r.stdout)
            problems = [f"missing {h}" for h in case.get("hit", []) if h not in got]
            problems += [f"unexpected {m}" for m in case.get("miss", []) if m in got]
            if case.get("ok") and r.returncode != 0:
                problems.append("expected PASS, got FAIL: " + ", ".join(f"{k}={v}" for k, v in got.items()))
            if problems:
                failures += 1
                print(f"FAIL {case['name']}: {'; '.join(problems)}\n{r.stdout}")
            else:
                print(f"ok   {case['name']}")
        finally:
            shutil.rmtree(root, ignore_errors=True)

    # gate behaviour cases
    root = new_repo()
    try:
        r = run([sys.executable, "-I", "scripts/verify.py", "--skip-build", "--range", "deadbeef..HEAD"], root, check=False)
        ok = r.returncode == 2 and "범위가 잘못됐다" in r.stdout
        print(("ok   " if ok else "FAIL ") + "bad range exits 2")
        failures += not ok
        write(root, "new.md", f"a {DASH}\n")
        r = run([sys.executable, "-I", "scripts/verify.py", "--skip-build", "--precommit"], root)
        ok = "R1 dash" in rules_of(r.stdout) and "G1 clean-tree" not in rules_of(r.stdout)
        print(("ok   " if ok else "FAIL ") + "precommit sees untracked files and skips G1")
        failures += not ok
        r = run([sys.executable, "-I", "scripts/verify.py", "--skip-build"], root)
        ok = "G1 clean-tree" in rules_of(r.stdout)
        print(("ok   " if ok else "FAIL ") + "commit mode flags dirty tree")
        failures += not ok
        os.remove(os.path.join(root, "new.md"))
        write(root, "b.txt", "x\n")
        run(["git", "add", "-A"], root)
        run(["git", "commit", "-q", "-m", "bad message"], root)
        write(root, "c.txt", "x\n")
        run(["git", "add", "-A"], root)
        run(["git", "commit", "-q", "-m", GOOD_MSG], root)
        r = run([sys.executable, "-I", "scripts/verify.py", "--skip-build", "--range", "HEAD~2..HEAD",
                 "--msg-range", "HEAD~1..HEAD"], root)
        ok = "G2 commit-format" not in rules_of(r.stdout)
        print(("ok   " if ok else "FAIL ") + "msg-range limits message checks")
        failures += not ok
    finally:
        shutil.rmtree(root, ignore_errors=True)
    outside = tempfile.mkdtemp()
    r = run([sys.executable, "-I", os.path.join(HERE, "verify.py")], outside, check=False)
    ok = r.returncode == 2
    print(("ok   " if ok else "FAIL ") + "outside git repo exits 2")
    failures += not ok
    shutil.rmtree(outside, ignore_errors=True)

    print(f"verify_test failures={failures}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
