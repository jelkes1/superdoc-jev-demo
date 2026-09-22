"""Derive a fictional negotiation from the v1 sample; retain explicit OOXML parts.

The fixture builder validates/package these parts separately. No customer content.
"""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json
from lxml import etree as E

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'fixtures/negotiation'
W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
E.register_namespace('w', W)
def el(name, **attrs):
    x = E.Element('{%s}%s' % (W, name))
    for k,v in attrs.items(): x.set('{%s}%s' % (W,k), str(v))
    return x
def run(text, deleted=False):
    r=el('r'); t=el('delText' if deleted else 't'); t.text=text
    t.set('{http://www.w3.org/XML/1998/namespace}space','preserve');r.append(t);return r
def text(p): return ''.join(p.xpath('.//w:t/text()',namespaces=NS))
def settext(p, value):
    for c in list(p):
        if c.tag != '{%s}pPr'%W: p.remove(c)
    p.append(run(value))
def revision(p, before, old, new, after, ident):
    settext(p,before)
    for tag,val,id in [('del',old,ident),('ins',new,ident+1)]:
        x=el(tag,id=id,author='Alex Chen · Meridian counsel',date='2026-09-18T14:30:00Z')
        x.append(run(val,tag=='del'));p.append(x)
    p.append(run(after))
with ZipFile(ROOT/'public/northstar-meridian.docx') as z: parts={n:z.read(n) for n in z.namelist()}
doc=E.fromstring(parts['word/document.xml']); paragraphs=doc.xpath('//w:body//w:p',namespaces=NS)
find=lambda prefix: next(p for p in paragraphs if text(p).startswith(prefix))
settext(find('Software subscription agreement'),'Software subscription agreement')
settext(find('The companies, commercial terms'), 'NEGOTIATION COPY · Returned by Meridian counsel, 18 September 2026. All parties and terms are fictional. Existing comments and revisions are part of this demonstration.')
body=find('Each party’s aggregate liability')
settext(body,'Except for the data-protection obligations specified in Schedule B, each party’s aggregate liability under this agreement shall not exceed the fees paid or payable during the 18 months preceding the claim. Liability for those data-protection obligations shall not exceed 36 months of such fees.')
settext(find('The aggregate cap applies across all claims'), 'Each cap in Section 6.1 applies separately across claims within its scope under this agreement and its order forms. Multiple claims do not enlarge either cap. The parties acknowledge that the fees reflect this allocation of commercial risk.')
settext(find('Schedule B  Service levels'), 'Schedule B  Data protection and service levels')
table=doc.xpath('//w:tbl',namespaces=NS)[0]
row=el('tr')
for value in ['Liability allocation','General cap: 18 months of fees. Data-protection cap: 36 months of fees. See Section 6.1 and Schedule B.']:
    cell=el('tc');pr=el('tcPr');pr.append(el('tcW',w=2200 if value=='Liability allocation' else 6500,type='dxa'));cell.append(pr);p=el('p');p.append(run(value));cell.append(p);row.append(cell)
table.append(row)
schedule=find('B.1')
settext(schedule,'B.1  Data-protection liability')
sp=schedule.getnext()
revision(sp,'Liability for the data-protection obligations under this Schedule B is subject to a separate aggregate cap of ','18','36',' months of fees paid or payable during the period preceding the claim. The general liability cap in Section 6.1 does not apply to these obligations.',101)
# Define the obligations referenced by the supplied commercial fallback.
scope=el('p');scope.append(run('Specified data-protection obligations means Provider’s duties to process Customer Data only on documented instructions, maintain the security measures in Section 8.3, notify Customer of a confirmed security incident, and return or delete Customer Data at the end of the Services. The separate cap in this schedule applies to these duties.'));sp.addnext(scope)
payment=find('Customer shall pay each undisputed invoice')
revision(payment,'Customer shall pay each undisputed invoice within ','45','30',' days after receipt.',103)
comments=el('comments')
for ident,p,bodytext in [(0,sp,'Meridian requests a 36-month data-protection cap. Please confirm the cap in the order form and Section 6.1 matches this schedule.'),(1,payment,'We agreed 30-day payment terms on the commercial call. Please preserve this negotiated change.')]:
    start=el('commentRangeStart',id=ident);p.insert(1 if len(p) and p[0].tag=='{%s}pPr'%W else 0,start)
    p.append(el('commentRangeEnd',id=ident));ref=el('r');ref.append(el('commentReference',id=ident));p.append(ref)
    c=el('comment',id=ident,author='Alex Chen · Meridian counsel',initials='AC',date='2026-09-18T14:30:00Z');cp=el('p');cp.append(run(bodytext));c.append(cp);comments.append(c)
parts['word/comments.xml']=E.tostring(comments,xml_declaration=True,encoding='UTF-8',standalone=True)
rels=E.fromstring(parts['word/_rels/document.xml.rels'])
E.SubElement(rels,'{http://schemas.openxmlformats.org/package/2006/relationships}Relationship',Id='rIdNegotiationComments',Type='http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments',Target='comments.xml')
parts['word/_rels/document.xml.rels']=E.tostring(rels)
ct=E.fromstring(parts['[Content_Types].xml'])
E.SubElement(ct,'{http://schemas.openxmlformats.org/package/2006/content-types}Override',PartName='/word/comments.xml',ContentType='application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml')
parts['[Content_Types].xml']=E.tostring(ct)
# Real Word numbering, distinct from the sample's literal section labels.
numbering=E.fromstring(parts['word/numbering.xml'])
abstract=el('abstractNum',abstractNumId=42);abstract.append(el('multiLevelType',val='singleLevel'));level=el('lvl',ilvl=0)
for name,attrs in [('start',{'val':1}),('numFmt',{'val':'decimal'}),('lvlText',{'val':'%1.'}),('lvlJc',{'val':'left'})]:level.append(el(name,**attrs))
abstract.append(level);numbering.insert(next(i for i,c in enumerate(numbering) if c.tag=='{%s}num'%W),abstract);num=el('num',numId=42);num.append(el('abstractNumId',val=42));numbering.append(num)
parts['word/numbering.xml']=E.tostring(numbering)
bodyel=doc.find('w:body',NS)
for value in ['Confirm the agreed commercial instructions.', 'Review every proposed change and unresolved negotiation point.', 'Return the Word counterproposal with its review history.']:
    p=el('p');pr=el('pPr');np=el('numPr');np.append(el('ilvl',val=0));np.append(el('numId',val=42));pr.append(np);p.append(pr);p.append(run(value));bodyel.insert(len(bodyel)-1,p)
parts['word/document.xml']=E.tostring(doc,xml_declaration=True,encoding='UTF-8',standalone=True)
OUT.mkdir(parents=True,exist_ok=True)
for name,data in parts.items():
    path=OUT/'package'/name;path.parent.mkdir(parents=True,exist_ok=True);path.write_bytes(data)
manifest={'schema':'superdoc.ooxml-fixture.manifest.v1','fixture':'negotiation-counterproposal','documents':[{'file':'negotiation.docx','parts':{n:'package/'+n for n in parts}}]}
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
# Development artifact. Replace with the SDK-built equivalent after validation.
with ZipFile(ROOT/'public/negotiation.docx','w',ZIP_DEFLATED) as z:
    for n,data in parts.items():z.writestr(n,data)
print('Wrote fictional negotiation fixture and explicit package parts.')
