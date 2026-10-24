import json
def load(p):
    for line in open(p):
        line=line.strip()
        if line.startswith('{"result"'):
            s=json.loads(line)['result']; break
    else:
        s=open(p).read()
    a=s.index('[{'); b=s.rindex('}]')+2
    return json.loads(s[a:b])
