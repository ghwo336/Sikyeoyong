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
           "'recommend_merchants','get_menu','place_order','request_owner_approval'," \
           "'propose_limit_change']));\n"

UI_DOC = "---\nnode: leaf\nparent: _index.md\nchildren: []\n---\n# Btn\n## 하네스 상태\n- 기본\n- 로딩\n- 실패\n## 테스트 기준\n- x\n"
UI_IDX = "---\nnode: root\nparent: null\nchildren:\n  - Btn.md\n---\n# base\nBtn.md\n"


def ui_component(stories):
    return {
        "packages/ui/src/base/Btn/Btn.tsx": "export const Btn = () => null;\n",
        "packages/ui/src/base/Btn/Btn.module.css": ".a { color: var(--c); }\n",
        "packages/ui/src/base/Btn/Btn.stories.tsx": stories,
        "packages/ui/src/base/Btn/Btn.test.tsx": "it('x', () => {});\n",
        "packages/ui/src/base/Btn/index.ts": "export * from './Btn';\n",
        "docs/wiki/components/ui/base/Btn.md": UI_DOC,
        "docs/wiki/components/ui/base/_index.md": UI_IDX,
    }


def t1(before, after, path="packages/shared/src/m.ts"):
    return dict(base={path: before}, files={path: after})


# Each case aims at one rule. `hit` entries are "RULE" or "RULE@substring-of-location".
CASES = [
    # R1 dash
    dict(name="R1 dash in file", files={"docs/x.md": f"a {DASH} b\n"}, hit=["R1 dash@docs/x.md:1"]),
    dict(name="R1 dash in commit msg", files={"a.txt": "x\n"}, msg=f"feat(x): a {DASH} b\n\nCo-Authored-By: C", hit=["R1 dash"]),
    # G2, G3 commits
    dict(name="G2 bad format", files={"a.txt": "x\n"}, msg="update stuff", hit=["G2 commit-format"]),
    dict(name="G2 subject too long", files={"a.txt": "x\n"}, msg="feat(x): " + "가" * 80 + "\n\nCo-Authored-By: C",
         hit=["G2 commit-format"]),
    dict(name="G2 uppercase scope ok", files={"a.txt": "x\n"}, msg="feat(ui/LimitGauge): 추가\n\nCo-Authored-By: C",
         miss=["G2 commit-format"]),
    dict(name="G2 missing attribution is review", files={"a.txt": "x\n"}, msg="feat(x): 사람 커밋",
         hit=["G2 attribution"], ok=True),
    dict(name="G3 three units", files={"apps/api/x/a.txt": "x\n", "apps/web/x/a.txt": "x\n", "packages/ui/x/a.txt": "x\n"},
         hit=["G3 commit-split"], ok=True),
    dict(name="G3 many files", files={f"f/{i}.txt": "x\n" for i in range(61)}, hit=["G3 commit-size"], ok=True),
    # R2 chain config
    dict(name="R2 chain id", files={"apps/api/src/x.ts": "const id = 450815;\n"}, hit=["R2 chain-config@x.ts:1"]),
    dict(name="R2 chain id underscore", files={"apps/api/src/x.ts": "const id = 450_815;\n"}, hit=["R2 chain-config"]),
    dict(name="R2 chain id hex", files={"apps/api/src/x.ts": f"const id = {hex(450815)};\n"}, hit=["R2 chain-config"]),
    dict(name="R2 chain id bigint", files={"apps/api/src/x.ts": "const id = 450815n;\n"}, hit=["R2 chain-config"]),
    dict(name="R2 maroo url", files={"infra/deploy.sh": "curl https://rpc-testnet.maroo.io\n"}, hit=["R2 chain-config"]),
    dict(name="R2 address", files={"apps/api/src/x.ts": "const a = '0x" + "ab" * 20 + "';\n"}, hit=["R2 chain-config"]),
    dict(name="R2 chain id in seed", files={"seed/m.json": '{"chainId": 450815}\n'}, hit=["R2 chain-config"]),
    dict(name="R2 address in seed ok", files={"seed/m.json": '{"payout": "0x' + "ab" * 20 + '"}\n'}, miss=["R2 chain-config"]),
    dict(name="R2 verify-allow", files={"apps/api/src/x.ts": "// verify-allow: R2 boot check compares env\nconst id = 450815;\n"},
         miss=["R2 chain-config"]),
    dict(name="R2 in comment ok", files={"apps/api/src/x.ts": "// chain 450815 changes soon\nexport const a = 1;\n"},
         miss=["R2 chain-config"]),
    # R5 secrets
    dict(name="R5 env file", files={".env": "A=1\n"}, force=[".env"], hit=["R5 secret-file"]),
    dict(name="R5 env local", files={".env.local": "A=1\n"}, force=[".env.local"], hit=["R5 secret-file"]),
    dict(name="R5 anthropic key", files={"apps/api/src/k.ts": f"const k = '{FAKE_KEY}';\n"}, hit=["R5 secret"]),
    dict(name="R5 pem", files={"infra/k.txt": "-----BEGIN " + "PRIVATE KEY-----\nabc\n"}, hit=["R5 secret"]),
    dict(name="R5 hex key", files={"infra/k.txt": "PRIVATE_KEY=0x" + "1f" * 32 + "\n"}, hit=["R5 secret"]),
    dict(name="R5 env example value", files={".env.example": "SESSION_SECRET=abc\nPORT=8787\n"}, hit=["R5 env-example"]),
    dict(name="R5 env example export", files={".env.example": "export WAAS_AUTH_TOKEN=abc\n"}, hit=["R5 env-example"]),
    dict(name="R5 env example empty ok", files={".env.example": "SESSION_SECRET=\nAPI_KEY= # later\n"}, miss=["R5 env-example"]),
    # R4 money
    dict(name="R4 number type", files={"apps/api/src/x.ts": "let amountAokrw: number = 1;\n"}, hit=["R4 money-number@x.ts:1"]),
    dict(name="R4 number array", files={"apps/web/lib/x.ts": "let prices: number[] = [];\n"}, hit=["R4 money-number"]),
    dict(name="R4 useState number", files={"apps/web/lib/x.tsx": "const [amount, setAmount] = useState<number>(0);\n"},
         hit=["R4 money-number"]),
    dict(name="R4 as number only", files={"apps/api/src/x.ts": "const fee = raw as number;\n"}, hit=["R4 money-number"]),
    dict(name="R4 Number()", files={"apps/api/src/x.ts": "const priceAokrw = Number(raw);\n"}, hit=["R4 money-number"]),
    dict(name="R4 Math.round", files={"apps/api/src/x.ts": "const t = Math.round(subtotal * 1.1);\n"}, hit=["R4 money-number"]),
    dict(name="R4 parseInt", files={"apps/api/src/x.ts": "const balance = parseInt(raw, 10);\n"}, hit=["R4 money-number"]),
    dict(name="R4 toFixed", files={"apps/api/src/x.ts": "const s = ratio.toFixed(0);\n"}, hit=["R4 money-float"]),
    dict(name="R4 toFixed allowed", files={"apps/api/src/x.ts": "const s = ratio.toFixed(0); // verify-allow: R4 ratio only\n"},
         miss=["R4 money-float"]),
    dict(name="R4 bigint scale", files={"apps/api/src/x.ts": "const unit = 10n ** 18n;\n"}, hit=["R4 money-scale"]),
    dict(name="R4 1e18", files={"apps/api/src/x.ts": "const unit = 1e18;\n"}, hit=["R4 money-scale"]),
    dict(name="R4 bigint literal", files={"apps/api/src/x.ts": "const one = 1_000_000_000_000_000_000n;\n"}, hit=["R4 money-scale"]),
    dict(name="R4 scale ok in shared money", files={"packages/shared/src/money/m.ts": "export const u = 10n ** 18n;\n",
         "packages/shared/src/money/m.test.ts": "it('x', () => {});\n"}, miss=["R4 money-scale"]),
    dict(name="R4 raw aokrw in template", files={"apps/api/src/x.ts": "const s = `${priceAokrw}원`;\n"}, hit=["R4 money-template"]),
    dict(name="R4 formatted template ok", files={"apps/api/src/x.ts": "const s = `${formatOkrw(priceAokrw)} 결제`;\n"},
         miss=["R4 money-template"]),
    dict(name="R4 limit number is review", files={"apps/api/src/x.ts": "const dailyLimit: number = 3;\n",
         "apps/api/src/x.test.ts": "it('x', () => {});\n"},
         hit=["R4 limit-number"], ok=True),
    dict(name="R4 code after inline comment", files={"apps/api/src/x.ts": "/* c */ let amountAokrw: number = 1;\n"},
         hit=["R4 money-number"]),
    # S1
    dict(name="S1 any", files={"apps/api/src/a.ts": "const a: any = 1;\n"}, hit=["S1 no-any"]),
    dict(name="S1 ts-ignore", files={"apps/api/src/a.ts": "// @ts-ignore\nconst a = 1;\n"}, hit=["S1 ts-ignore"]),
    dict(name="S1 eslint-disable no reason", files={"apps/api/src/a.ts": "// eslint-disable-next-line no-console\nconst a = 1;\n"},
         hit=["S1 eslint-disable"]),
    dict(name="S1 eslint-disable with reason ok", files={"apps/api/src/a.ts":
         "// eslint-disable-next-line no-console -- boot banner\nconst a = 1;\n"}, miss=["S1 eslint-disable"]),
    dict(name="S1 string throw", files={"apps/api/src/a.ts": "throw 'bad';\n"}, hit=["S1 string-throw"]),
    # D18 web
    dict(name="D18 page fetch and state", files={"apps/web/app/x/page.tsx":
         "import { useState } from 'react';\nexport default function P(){ fetch('/a'); useState(0); return null; }\n"},
         hit=["D18 page-assembly", "D18 web-fetch"]),
    dict(name="D18 page too long", files={"apps/web/app/x/page.tsx": "".join(f"export const a{i} = {i};\n" for i in range(61))},
         hit=["D18 page-assembly"]),
    dict(name="D18 layout fetch and color", files={"apps/web/app/layout.tsx":
         "export default function L(){ fetch('/a'); return <div style={{color:'#fff'}} />; }\n"},
         hit=["D18 page-assembly", "D17 tokens-only"]),
    dict(name="D18 extra file in app", files={"apps/web/app/x/Widget.tsx": "export const W = () => null;\n"}, hit=["D18 app-files"]),
    dict(name="D18 container className", files={"apps/web/features/o/containers/C.tsx":
         "export const C = () => <div className='x' />;\n"}, hit=["D18 container-thin"]),
    dict(name="D18 container fetch", files={"apps/web/features/o/containers/C.ts": "export const c = () => fetch('/a');\n"},
         hit=["D18 container-thin"]),
    dict(name="D18 container comment ok", files={"apps/web/features/o/containers/C.tsx":
         "// never set className= here\nexport const C = () => null;\n"}, miss=["D18 container-thin"]),
    dict(name="D18 web fetch outside hooks", files={"apps/web/features/o/components/x.ts": "export const x = () => fetch('/a');\n"},
         hit=["D18 web-fetch"]),
    dict(name="D18 web imports viem", files={"apps/web/lib/x.ts": "import { createPublicClient } from 'viem';\n"},
         hit=["D18 web-scope"]),
    # D17 visual
    dict(name="D17 css hex", files={"packages/ui/src/base/X.module.css": ".a { color: #fff; }\n"}, hit=["D17 tokens-only"]),
    dict(name="D17 css named color", files={"packages/ui/src/base/X.module.css": ".a { color: red; background: white; }\n"},
         hit=["D17 tokens-only"]),
    dict(name="D17 css rgba", files={"packages/ui/src/base/X.module.css": ".a { border-color: rgba(0,0,0,.1); }\n"},
         hit=["D17 tokens-only"]),
    dict(name="D17 css hsl", files={"apps/web/app/globals.css": "body { background: hsl(0 0% 100%); }\n"},
         hit=["D17 tokens-only"]),
    dict(name="D17 css id selector ok", files={"packages/ui/src/base/X.module.css": "#add { color: var(--c); }\n"},
         miss=["D17 tokens-only"]),
    dict(name="D17 tsx href hash ok", files={"apps/web/features/o/components/L.tsx": "export const L = () => <a href='#feed'>x</a>;\n"},
         miss=["D17 tokens-only"]),
    dict(name="D17 tsx style named color", files={"apps/web/features/o/components/L.tsx":
         "export const L = () => <p style={{ color: 'white' }} />;\n"}, hit=["D17 tokens-only"]),
    dict(name="D17 gradient", files={"packages/ui/src/base/X.module.css": ".a { background: linear-gradient(var(--a), var(--b)); }\n"},
         hit=["D17 no-slop"]),
    dict(name="D17 layout transition", files={"packages/ui/src/base/X.module.css": ".a { transition: height 200ms; }\n"},
         hit=["D17 motion"]),
    dict(name="D17 chain word is review", files={"apps/web/features/o/components/L.tsx": "export const t = '지갑 연결';\n"},
         hit=["D17 chain-words"], ok=True),
    # D18 ui components
    dict(name="D18 ui missing stories", files={"packages/ui/src/base/Btn/Btn.tsx": "export const Btn = () => null;\n",
         "packages/ui/src/base/Btn/index.ts": "export * from './Btn';\n"}, hit=["D18 ui-harness", "D18 ui-doc"]),
    dict(name="D18 ui flat file", files={"packages/ui/src/order/OrderCard.tsx": "export const O = () => null;\n"},
         hit=["D18 ui-harness@OrderCard.tsx"]),
    dict(name="D18 ui lowercase folder", files={"packages/ui/src/order/order-card/OrderCard.tsx": "export const O = () => null;\n"},
         hit=["D18 ui-harness"]),
    dict(name="D18 ui unknown area", files={"packages/ui/src/misc/Foo/Foo.tsx": "export const F = () => null;\n"},
         hit=["D18 ui-area"]),
    dict(name="D18 ui harness states short", files=ui_component("export const Default = {};\n"),
         hit=["D18 ui-harness-states"]),
    dict(name="D18 ui complete component ok", files=ui_component(
         "export const Default = {};\nexport const Loading = {};\nexport const Failed = {};\n"), ok=True),
    dict(name="D18 ui imports tanstack", files={"packages/ui/src/base/y.ts": "import { useQuery } from '@tanstack/react-query';\n"},
         hit=["D18 ui-pure"]),
    dict(name="D18 ui cross area", files={"packages/ui/src/order/z.ts": "import { L } from '../limits/L';\n"},
         hit=["D18 ui-cross-area"]),
    dict(name="D18 ui cross area package path", files={"packages/ui/src/order/z.ts": "import { L } from '@sikyeoyong/ui/limits';\n"},
         hit=["D18 ui-cross-area"]),
    dict(name="D18 ui imports base ok", files={"packages/ui/src/order/z.ts": "import { B } from '../base/Button';\n"},
         miss=["D18 ui-cross-area"]),
    # shared purity
    dict(name="A shared env", files={"packages/shared/src/c.ts": "export const a = process.env.A;\n"}, hit=["A shared-pure"]),
    dict(name="A shared fs", files={"packages/shared/src/c.ts": "import fs from 'fs';\n"}, hit=["A shared-pure"]),
    dict(name="A shared require fs", files={"packages/shared/src/c.ts": "const fs = require('fs');\n"}, hit=["A shared-pure"]),
    dict(name="A shared fetch", files={"packages/shared/src/c.ts": "export const a = () => fetch('/x');\n"}, hit=["A shared-pure"]),
    # D18 api
    dict(name="D18 other module repository", files={"apps/api/src/modules/orders/o.service.ts":
         "import { BudgetRepository } from '../budget/budget.repository';\n"}, hit=["D18 api-boundary"]),
    dict(name="D18 other module bare repository", files={"apps/api/src/modules/orders/o.service.ts":
         "import { R } from '../budget/repository';\n"}, hit=["D18 api-boundary"]),
    dict(name="D18 other module index", files={"apps/api/src/modules/orders/o.service.ts": "import { B } from '../budget';\n"},
         hit=["D18 api-boundary"]),
    dict(name="D18 other module service ok", files={"apps/api/src/modules/orders/o.service.ts":
         "import { BudgetService } from '../budget/budget.service';\n"}, miss=["D18 api-boundary"]),
    dict(name="D06 maws outside payment", files={"apps/api/src/modules/orders/o.ts":
         "import { Client } from '@modelcontextprotocol/sdk/client';\n"}, hit=["D06 maws-scope"]),
    dict(name="D18 controller uses repository", files={"apps/api/src/modules/orders/orders.controller.ts":
         "import { OrdersRepository } from './orders.repository';\n"}, hit=["D18 controller-thin"]),
    dict(name="D18 controller comment ok", files={"apps/api/src/modules/orders/orders.controller.ts":
         "// no repository here, service only\nexport class C {}\n"}, miss=["D18 controller-thin"]),
    dict(name="R9 payment retry is review", files={"apps/api/src/modules/payment/p.service.ts": "const maxRetries = 3;\n",
         "apps/api/src/modules/payment/p.service.spec.ts": "it('x', () => {});\n"}, hit=["R9 no-auto-retry"], ok=True),
    # R3 llm tools
    dict(name="R3 tool json quoted name", files={"apps/api/src/modules/llm/tools/defs.ts": '[{ "name": "set_policy" }];\n',
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, hit=["R3 llm-tools@defs.ts:1"]),
    dict(name="R3 tool spaced name", files={"apps/api/src/modules/llm/tools/defs.ts": '[{ name : "drain_agent" }];\n',
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, hit=["R3 llm-tools@defs.ts:1"]),
    dict(name="R3 tool camel name", files={"apps/api/src/modules/llm/tools/defs.ts": "[{ name: 'agentCreate' }];\n",
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, hit=["R3 llm-tools@defs.ts:1"]),
    dict(name="R3 item_name ok", files={"apps/api/src/modules/llm/tools/defs.ts":
         "export const T = [{ name: 'get_menu' }];\nconst row = { item_name: '김밥', filename: 'x' };\n",
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, miss=["R3 llm-tools"]),
    dict(name="R3 tool outside llm tools dir", files={"apps/api/src/modules/agents/tools.ts":
         "const t = { name: 'get_budget', input_schema: {} };\n"}, hit=["R3 llm-tools"]),
    dict(name="R3 tools without whitelist test", files={"apps/api/src/modules/llm/tools/defs.ts":
         "export const T = [{ name: 'get_budget' }];\n"}, hit=["R3 llm-tools"]),
    dict(name="R3 tools ok", files={"apps/api/src/modules/llm/tools/defs.ts": "export const T = [{ name: 'get_budget' }];\n",
         "apps/api/src/modules/llm/tools/defs.test.ts": LLM_TEST}, miss=["R3 llm-tools"]),
    # T1 tests accompany source changes
    dict(name="T1 src without test", files={"packages/shared/src/money.ts": "export const a = 1n;\n"}, hit=["T1 tests-required"]),
    dict(name="T1 src with test", files={"packages/shared/src/money.ts": "export const a = 1n;\n",
         "packages/shared/src/money.test.ts": "it('a', () => {});\n"}, miss=["T1 tests-required"]),
    dict(name="T1 comment-only ok", **t1("export const a = 1n;\n", "// why\nexport const a = 1n;\n"), miss=["T1 tests-required"]),
    dict(name="T1 code change", **t1("export const a = 1n;\n", "// why\nexport const a = 2n;\n"), hit=["T1 tests-required"]),
    dict(name="T1 bypass inline comment", **t1("export const a = 1n;\n", "export const a = 1n;\n/* x */ export const drain = () => 0;\n"),
         hit=["T1 tests-required"]),
    dict(name="T1 bypass star continuation", **t1("export const a = 1n\n  * 2n;\n", "export const a = 1n\n  * 3n;\n"),
         hit=["T1 tests-required"]),
    dict(name="T1 bypass template line", **t1("export const s = `\n// one\n`;\n", "export const s = `\n// two\n`;\n"),
         hit=["T1 tests-required"]),
    dict(name="T1 bypass ++ line", **t1("let i = 0;\nexport { i };\n", "let i = 0;\n// note\n++i;\nexport { i };\n"),
         hit=["T1 tests-required"]),
    dict(name="T1 bypass -- line", **t1("let i = 1;\n--i;\nexport { i };\n", "let i = 1;\n// keep i\nexport { i };\n"),
         hit=["T1 tests-required"]),
    dict(name="T1 code inside block comment ok", **t1("/*\n * old\n */\nexport const a = 1n;\n",
         "/*\n * old\n * const old = 1n;\n */\nexport const a = 1n;\n"), miss=["T1 tests-required"]),
    dict(name="T1 sol natspec ok", **t1("contract X {}\n", "/// @notice x\ncontract X {}\n", path="contracts/src/X.sol"),
         miss=["T1 tests-required"]),
    # R8 wiki
    dict(name="R8 wiki doc not in map", files={"docs/wiki/b.md": WIKI_LEAF},
         edit={"docs/wiki/README.md": WIKI_ROOT.replace("  - a.md\n", "  - a.md\n  - b.md\n")}, hit=["R8 wiki-map"]),
    dict(name="R8 korean wiki doc not in map", files={"docs/wiki/한글.md": WIKI_LEAF},
         edit={"docs/wiki/README.md": WIKI_ROOT.replace("  - a.md\n", "  - a.md\n  - 한글.md\n")}, hit=["R8 wiki-map"]),
    dict(name="R8 wiki orphan", files={"docs/wiki/c.md": WIKI_LEAF}, hit=["R8 wiki-tree"]),
    # T0 build gates
    dict(name="T0 failing lint script", files={"package.json": '{"scripts":{"lint":"exit 1","typecheck":"true","test":"true","build":"true"}}\n',
         "node_modules/.keep": ""}, build=True, hit=["T0 lint"]),
    # fixtures
    dict(name="fixtures skip code rules", files={"scripts/fixtures/eslint/x.ts": "export const a: any = 1;\nconst amountAokrw: number = 1;\n"},
         miss=["S1 no-any", "R4 money-number"]),
    dict(name="fixtures still dash-checked", files={"scripts/fixtures/x.ts": f"// {DASH}\n"}, hit=["R1 dash"]),
    # normal code that must pass
    dict(name="normal code passes", files={
        "apps/api/src/modules/llm/runtime.ts": "const toolCallLimit: number = 8;\nfunction history(n: number) { return n; }\n"
                                               "const logger = { name: 'kimbap' };\n",
        "apps/api/src/money.ts": "// const amountAokrw: number\nconst priceAokrw: bigint = 1n;\n"
                                 "const pct = ratio.toFixed(0); // verify-allow: R4 ratio display, not money\n",
        "apps/api/src/x.test.ts": "const a = '0x" + "cd" * 20 + "';\n",
        "packages/shared/src/config/chain.ts": "export const TESTNET = { id: 450815 };\n",
        "packages/shared/src/config/chain.test.ts": "it('x', () => {});\n",
        "packages/ui/src/base/X.module.css": "#add { color: var(--c); }\n.b { background: transparent; }\n",
        "space name.txt": "x\n",
        "img.png": b"\x89PNG\r\n\x1a\n\x00\x00\xff\xfe",
    }, hit=["R4 limit-number"], ok=True),
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


def findings_of(out):
    return [(m.group(1), m.group(2), m.group(3)) for m in re.finditer(r"^\[(\w+)\] (\S+ \S+) (.*)$", out, re.M)]


def rules_of(out):
    return {rule: sev for sev, rule, _where in findings_of(out)}


def has(out, spec):
    rule, _, where = spec.partition("@")
    return any(r == rule and where in w for _s, r, w in findings_of(out))


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
            args = [] if case.get("build") else ["--skip-build"]
            r = run([sys.executable, "-I", "scripts/verify.py"] + args, root)
            got = rules_of(r.stdout)
            problems = [f"missing {h}" for h in case.get("hit", []) if not has(r.stdout, h)]
            problems += [f"unexpected {m}" for m in case.get("miss", []) if has(r.stdout, m)]
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
    def check(name, ok):
        nonlocal_failures[0] += not ok
        print(("ok   " if ok else "FAIL ") + name)

    nonlocal_failures = [0]
    vp = [sys.executable, "-I", "scripts/verify.py", "--skip-build"]
    root = new_repo()
    try:
        r = run(vp + ["--range", "deadbeef..HEAD"], root, check=False)
        check("bad range exits 2", r.returncode == 2 and "범위가 잘못됐다" in r.stdout)
        write(root, "docs/wiki/z.md", WIKI_LEAF)
        r = run(vp + ["--precommit"], root)
        check("precommit puts untracked files in changed and skips G1",
              has(r.stdout, "R8 wiki-map@docs/wiki/z.md") and "G1 clean-tree" not in rules_of(r.stdout))
        r = run(vp, root)
        check("commit mode flags dirty tree", "G1 clean-tree" in rules_of(r.stdout))
        os.remove(os.path.join(root, "docs/wiki/z.md"))
        r = run([sys.executable, "-I", "scripts/verify.py", "--", "--precommit", "--skip-build"], root, check=False)
        check("a literal -- from pnpm is ignored", r.returncode in (0, 1) and "WORKTREE" in r.stdout)
        write(root, "b.txt", "x\n")
        run(["git", "add", "-A"], root)
        run(["git", "commit", "-q", "-m", "bad message"], root)
        write(root, "c.txt", "x\n")
        run(["git", "add", "-A"], root)
        run(["git", "commit", "-q", "-m", GOOD_MSG], root)
        r = run(vp + ["--range", "HEAD~2..HEAD", "--msg-range", "HEAD~1..HEAD"], root)
        check("msg-range limits message checks", "G2 commit-format" not in rules_of(r.stdout))
        r = run(vp + ["--range", "HEAD~2..HEAD", "--msg-range", "HEAD..HEAD"], root, check=False)
        check("empty msg-range exits 2", r.returncode == 2)
        r = run(vp + ["--range", "HEAD~1..HEAD", "--msg-range", "HEAD~2..HEAD"], root, check=False)
        check("msg-range outside range exits 2", r.returncode == 2)
        r = run(vp + ["--range", "HEAD~2..HEAD~1"], root, check=False)
        check("range end other than HEAD exits 2", r.returncode == 2 and "HEAD가 아니다" in r.stdout)
        write(root, "packages/shared/src/m.ts", "export const a = 1n;\n")
        run(["git", "add", "-A"], root)
        run(["git", "commit", "-q", "-m", GOOD_MSG], root)
        write(root, "packages/shared/src/m.ts", "// why\nexport const a = 1n;\n")
        r = run(vp + ["--precommit"], root)
        check("precommit comment-only change needs no test", "T1 tests-required" not in rules_of(r.stdout))
        write(root, "packages/shared/src/m.ts", "export const a = 2n;\n")
        r = run(vp + ["--precommit"], root)
        check("precommit code change needs test", "T1 tests-required" in rules_of(r.stdout))
    finally:
        shutil.rmtree(root, ignore_errors=True)
    outside = tempfile.mkdtemp()
    r = run([sys.executable, "-I", os.path.join(HERE, "verify.py")], outside, check=False)
    check("outside git repo exits 2", r.returncode == 2)
    shutil.rmtree(outside, ignore_errors=True)
    failures += nonlocal_failures[0]

    print(f"verify_test failures={failures}")
    sys.exit(1 if failures else 0)


if __name__ == "__main__":
    main()
