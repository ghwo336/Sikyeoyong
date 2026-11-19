import os, re, sys
root = sys.argv[1]
docs = {}
for d, _, fs in os.walk(root):
    for f in fs:
        if f.endswith('.md'):
            p = os.path.normpath(os.path.join(d, f))
            txt = open(p, encoding='utf-8').read()
            m = re.match(r'^---\n(.*?)\n---\n', txt, re.S)
            if not m:
                print('NO FRONTMATTER', p); continue
            fm = m.group(1)
            node = re.search(r'^node:\s*(\S+)', fm, re.M)
            parent = re.search(r'^parent:\s*(\S+)', fm, re.M)
            kids = re.findall(r'^\s+-\s+(\S+)', fm, re.M)
            docs[p] = (node and node.group(1), parent and parent.group(1), kids)
errors = 0
listed = set()
for p, (node, parent, kids) in docs.items():
    base = os.path.dirname(p)
    for k in kids:
        kp = os.path.normpath(os.path.join(base, k))
        listed.add(kp)
        if kp not in docs:
            print('MISSING CHILD', p, '->', k); errors += 1
        else:
            kpar = docs[kp][1]
            if kpar is None or os.path.normpath(os.path.join(os.path.dirname(kp), kpar)) != p:
                print('PARENT MISMATCH', kp, 'says', kpar, 'but listed by', p); errors += 1
    if node == 'leaf' and kids:
        print('LEAF WITH CHILDREN', p); errors += 1
    if node in ('internal', 'root') and not kids:
        print('INTERNAL WITHOUT CHILDREN', p); errors += 1
for p, (node, parent, kids) in docs.items():
    if node == 'root': continue
    if p not in listed:
        print('ORPHAN', p); errors += 1
print(f'docs={len(docs)} errors={errors}')
