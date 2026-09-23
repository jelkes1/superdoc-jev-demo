"""Build a reproducible fictional long agreement from the counsel-marked sample."""
from pathlib import Path
from zipfile import ZipFile, ZipInfo, ZIP_DEFLATED
from lxml import etree as E
import json, subprocess, hashlib
R=Path(__file__).resolve().parents[1]; W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'; N={'w':W}
def el(t,**a):
 e=E.Element('{%s}%s'%(W,t))
 for k,v in a.items():e.set('{%s}%s'%(W,k),str(v))
 return e
def para(t,heading=False):
 p=el('p')
 if heading:
  pr=el('pPr');pr.append(el('pStyle',val='Heading2'));p.append(pr)
 r=el('r');s=el('t');s.text=t;r.append(s);p.append(r);return p
def text(p):return ''.join(p.xpath('.//w:t/text()',namespaces=N))
with ZipFile(R/'public/deal-desk.docx')as z:parts={n:z.read(n)for n in z.namelist()}
d=E.fromstring(parts['word/document.xml']);body=d.find('w:body',N);sect=body.find('w:sectPr',N)
def add(t,h=False):body.insert(list(body).index(sect),para(t,h))
# Identify the commercial table structurally, as a real order form would.
first_table=body.find('w:tbl',N);heading=para('Order form',True);heading.find('w:pPr/w:pStyle',N).set('{%s}val'%W,'Heading1');body.insert(list(body).index(first_table),heading)
add('Schedule D  Implementation appendix and operational procedures',True)
body[list(body).index(sect)-1].find('w:pPr/w:pStyle',N).set('{%s}val'%W,'Heading1')
add('D.1  Approved subcontractor',True)
add('Cloud Harbor Systems, Inc. supplies infrastructure monitoring under a separate subcontract with Provider. It is not a party to this agreement. Its name is included to distinguish a third-party organization from the contracting parties during the fictional document-agent demonstration.')
add('D.2  Model improvement program',True)
add('Customer Data and de-identified excerpts may be included in the model improvement program without separate written permission. This permission applies to training, fine-tuning and evaluation of general-purpose models and supplements the model-training permission in the order form.')
add('D.3  Signature record',True)
add('For Northstar Cloud, Inc.: ____________________    Title: ____________________')
add('For Meridian Labs, Inc.: ____________________    Title: ____________________')
topics=[
 ('Workspace provisioning','create the production workspace and a separate validation workspace','workspace identifiers, environment labels and accountable administrators','the implementation lead','configuration export'),
 ('Identity federation','configure single sign-on and recovery access','identity issuer settings, certificate expiration dates and recovery contacts','the identity administrator','federation test record'),
 ('Role assignment','map approved roles to the least-privilege access matrix','role names, authorization boundaries and approval records','the access coordinator','role matrix'),
 ('Network connectivity','establish approved network routes and endpoint allowlists','destination hosts, transport requirements and connectivity results','the network lead','connectivity checklist'),
 ('Import validation','validate the format and completeness of imported business records','record counts, required fields and reconciliation exceptions','the migration lead','import reconciliation report'),
 ('Retention configuration','configure approved record-retention periods','record categories, hold settings and disposal checkpoints','the records manager','retention register'),
 ('Backup restoration','demonstrate restoration in the validation workspace','backup timestamps, recovery steps and restored record counts','the continuity coordinator','restoration record'),
 ('Accessibility review','review supported interaction patterns with assistive technology','keyboard navigation, focus order and documented exceptions','the accessibility lead','accessibility checklist'),
 ('Release coordination','schedule release windows and identify reversible changes','release identifiers, deployment windows and rollback criteria','the release manager','release readiness record'),
 ('Support handover','transfer operational documentation to the service desk','support contacts, escalation paths and triage categories','the service desk lead','handover register'),
 ('Notification delivery','validate transactional notification routing','notification categories, approved recipients and delivery outcomes','the communications lead','notification test log'),
 ('Audit evidence','assemble evidence of configured administrative controls','control owners, dated observations and review outcomes','the assurance coordinator','evidence register'),
 ('Capacity planning','record expected transaction volumes and operating thresholds','concurrent sessions, queue lengths and storage consumption','the operations lead','capacity worksheet'),
 ('Business continuity','rehearse the documented business continuity process','availability dependencies, escalation contacts and recovery checkpoints','the continuity lead','exercise report'),
 ('Incident coordination','establish the operational incident contact process','incident identifiers, impact assessments and containment actions','the incident coordinator','response timeline'),
 ('Integration validation','validate the configured integration endpoints','interface versions, validation examples and error handling outcomes','the integration lead','integration acceptance record'),
 ('Environment retirement','retire a superseded validation environment','environment identifiers, dependency checks and completion evidence','the environment owner','retirement checklist'),
 ('Operational acceptance','record readiness for routine service operation','acceptance criteria, outstanding exceptions and responsible owners','the acceptance coordinator','readiness register'),
 ('Change governance','document the review process for configuration changes','change descriptions, approval dates and implementation checkpoints','the change coordinator','change register'),
 ('Documentation maintenance','maintain the operational reference material','document owners, version identifiers and review dates','the documentation lead','documentation inventory'),
 ('Credential rotation','coordinate scheduled rotation of service credentials','credential identifiers, rotation windows and verification outcomes','the security administrator','rotation checklist'),
 ('Scheduled jobs','validate scheduled background processing','job identifiers, execution schedules and failure escalation paths','the scheduler administrator','job acceptance record'),
 ('Data reconciliation','reconcile record counts between approved interfaces','source identifiers, reconciliation windows and exception owners','the reconciliation lead','reconciliation worksheet'),
 ('Regional availability','document approved availability dependencies','region identifiers, dependency maps and failover checkpoints','the infrastructure coordinator','regional readiness register'),
]
for i,(title,activity,fields,owner,artifact) in enumerate(topics,4):
 add(f'D.{i}  {title}',True)
 paras=[
 f'The parties will {activity}. Provider will appoint {owner} before this work begins and Customer will identify an authorized reviewer for the corresponding deliverable. The parties will record {fields}. These operational records are used to demonstrate completion of the implementation work; they do not expand the license grant, change the commercial allocation of risk or create additional rights in Customer Data. A reference to an operational owner identifies a coordinating function and does not require either party to appoint a new employee.',
 f'The {artifact} will identify the agreed scope, the environment inspected and the date on which evidence was collected. Each observation must be traceable to a reproducible check or a dated written confirmation. Where a check cannot be performed, the record must describe the reason, the practical consequence and the person responsible for resolving the limitation. Silence, an automated success message or delivery of an incomplete worksheet will not by itself constitute operational acceptance. The reviewer may request supporting information that is reasonably necessary to assess the recorded result.',
 f'Before beginning the {title.lower()} work, the coordinating owner will circulate a short implementation note setting out prerequisites, expected participants and the proposed sequence of activities. Customer will identify any dependency that is within its reasonable control and that may affect the planned sequence. Provider will maintain a record of changes to the note. Routine scheduling adjustments may be recorded by email between the named operational contacts, but an adjustment that changes fees, committed scope or a contractual obligation requires the agreement of the parties through the applicable contractual change process.',
 f'The parties will evaluate exceptions associated with {title.lower()} according to their effect on the intended operational outcome. A material exception is one that prevents completion of an agreed acceptance criterion or creates a documented inconsistency with an approved configuration. Minor documentation corrections may remain open when the reviewer records an owner and a completion date. No exception may be treated as closed solely because its reporting period ended. Evidence of resolution must be added to the {artifact}, with a reference to the original exception and the action taken.',
 f'Provider will supply a readable copy of the {artifact} in an ordinarily accessible electronic format. The copy must include the relevant version identifiers and enough information for Customer to understand the result without access to Provider\'s internal ticketing system. Sensitive credentials and unrelated personal information will be omitted. Customer may request correction of a factual error by identifying the affected entry and explaining the discrepancy. The parties will maintain the original entry together with the correction so that the history of the operational review remains understandable.',
 f'After completion of {title.lower()}, the coordinating owner will conduct a handover with the individuals responsible for routine operation. The handover will identify known limitations, reference the supporting records and distinguish completed work from remaining actions. Customer\'s participation does not relieve Provider of its express obligations, and Provider\'s preparation of the record does not make it responsible for systems outside the agreed scope. This procedure is an operational coordination measure. It does not amend subscription duration, cancellation notice, invoice due dates, liability caps or the permissions governing model development.',
 ]
 for p in paras:add(p)
parts['word/document.xml']=E.tostring(d,xml_declaration=True,encoding='UTF-8',standalone=True)
out=R/'public/agent-agreement.docx'
with ZipFile(out,'w',ZIP_DEFLATED)as z:
 for n,b in parts.items():
  info=ZipInfo(n,(2026,9,22,0,0,0));info.compress_type=ZIP_DEFLATED;z.writestr(info,b)
texts=[text(p)for p in d.xpath('//w:body//w:p',namespaces=N) if text(p)]
count=subprocess.check_output(['node','--input-type=module','-e',"import {getEncoding} from 'js-tiktoken'; let s='';for await(const c of process.stdin)s+=c;console.log(getEncoding('o200k_base').encode(s).length)"],input='\n'.join(texts).encode(),cwd=R).decode().strip()
folder=R/'fixtures/agent';folder.mkdir(exist_ok=True)
(folder/'expected.json').write_text(json.dumps({'version':'agent-fixture-v2','documentHash':hashlib.sha256(out.read_bytes()).hexdigest(),'tokens':int(count),'existingRevisions':4,'comments':2,'cases':[
 {'id':'renewal','request':'Change renewal cancellation notice to 60 days throughout the agreement and order form.','requiredTexts':[t for t in texts if 'at least 15 days before' in t or t=='Non-renewal notice: 15 days.'],'mustPreserve':['Customer shall pay each undisputed invoice within 30 days after receipt.'],'expectedOperations':2},
 {'id':'training','request':'Require written consent for training on customer data, including the order form and appendix. Preserve payment and liability terms.','requiredTexts':[t for t in texts if t=='Model training permitted by default.' or 'train general-purpose machine learning' in t or t.startswith('Provider may use Operational Signals') or t.startswith('Customer Data and de-identified excerpts may')],'mustPreserve':['Customer shall pay each undisputed invoice within 30 days after receipt.'],'expectedOperations':4},
 {'id':'names','request':'Replace every company name with ______.','clarificationRequired':True,'requiredTexts':[],'expectedOperations':0}
]},indent=2)+'\n')
print(json.dumps({'file':str(out),'tokens':int(count),'paragraphs':len(texts)}))
