from pathlib import Path
from zipfile import ZipFile,ZIP_DEFLATED
from lxml import etree as E
import json
R=Path(__file__).resolve().parents[1]; W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; N={'w':W}; E.register_namespace('w',W)
def el(t,**a):
 e=E.Element('{%s}%s'%(W,t))
 for k,v in a.items():e.set('{%s}%s'%(W,k),str(v))
 return e
def para(t):
 p=el('p');r=el('r');s=el('t');s.text=t;r.append(s);p.append(r);return p
def txt(p):return ''.join(p.xpath('.//w:t/text()',namespaces=N))
def replace(p,t):
 for c in list(p):
  if c.tag!='{%s}pPr'%W:p.remove(c)
 p.extend(list(para(t)))
with ZipFile(R/'public/negotiation.docx')as z:parts={n:z.read(n)for n in z.namelist()}
d=E.fromstring(parts['word/document.xml']);ps=d.xpath('//w:body//w:p',namespaces=N)
def find(t):return next(p for p in ps if txt(p).startswith(t))
find('Customer retains all rights').addnext(para('Provider may use Customer Data to train general-purpose machine learning models without obtaining further permission from Customer. Customer grants a perpetual license for this purpose.'))
table=d.xpath('//w:tbl',namespaces=N)[0]
for label,value in [('Model training','Model training permitted by default.'),('Renewal notice','Non-renewal notice: 15 days.')]:
 row=el('tr')
 for text in [label,value]:
  c=el('tc');c.append(para(text));row.append(c)
 table.append(row)
first=find('Confirm the agreed commercial instructions.')
h=para('Schedule C  Negotiated safeguards');pr=el('pPr');pr.append(el('pStyle',val='Heading1'));h.insert(0,pr);first.addprevious(h)
replace(first,'Provider will maintain the security measures described in Section 8.3 throughout the subscription term.')
replace(find('Review every proposed change'),'Provider will limit access to Customer Data to personnel who require access to deliver the Services.')
replace(find('Return the Word counterproposal'),'Provider will return or delete Customer Data following the export period described in Section 5.4.')
parts['word/document.xml']=E.tostring(d,xml_declaration=True,encoding='UTF-8',standalone=True)
out=R/'fixtures/deal-desk';out.mkdir(parents=True,exist_ok=True)
for n,b in parts.items():
 p=out/'package'/n;p.parent.mkdir(parents=True,exist_ok=True);p.write_bytes(b)
(out/'manifest.json').write_text(json.dumps({'schema':'superdoc.ooxml-fixture.manifest.v1','fixture':'living-deal-desk','documents':[{'file':'deal-desk.docx','parts':{n:'package/'+n for n in parts}}]},indent=2)+'\n')
with ZipFile(R/'public/deal-desk.docx','w',ZIP_DEFLATED)as z:
 for n,b in parts.items():z.writestr(n,b)
