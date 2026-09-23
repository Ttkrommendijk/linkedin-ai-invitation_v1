"""One LEF launcher: visible Chromium, original MV3 extension, local checkpoints."""
import argparse
import ctypes
import json
import os
from pathlib import Path
import sys
import time
import traceback
import uuid
import random
import hashlib

from playwright.sync_api import sync_playwright
from ledger import Ledger, canonical
from linkedin import LinkedIn, CompanyUnavailable
from scheduler import Scheduler, ScheduleWait, SAO_PAULO
from codex_connection import CodexConnection
from datetime import datetime

ROOT = Path(getattr(sys, '_MEIPASS', Path(__file__).resolve().parents[1]))
FROZEN = getattr(sys, 'frozen', False)
EXTENSION = ROOT / 'extension' if FROZEN else ROOT
BROWSERS = ROOT / 'browsers' if FROZEN else ROOT / '.launcher-browsers'
os.environ['PLAYWRIGHT_BROWSERS_PATH'] = str(BROWSERS)

class ReviewInterrupted(Exception):
    """A user control interrupted a cooperative reading pause."""


class Runner:
    def __init__(self, context, ui, ledger):
        self.context, self.ui, self.ledger = context, ui, ledger
        self.scheduler = Scheduler(ledger)
        self.wait_until = 0
        self.wait_reason = ''
        self.last_warning_check = 0
        self.review_interrupted = False
        self.running = False
        self.dry = True
        self.approval = None
        self.current = None
        self.profile_page = None
        self.stage = 'open'
        self.evidence = None
        self.person = None
        self.approved_at = None
        self.batch_request = None
        self.approved_batch = None
        self.deadline = 0
        self.status = 'Choose recipients below, then load and review your queue. Use Settings to sign in to LEF and Show LinkedIn to check your browser login. Dry-run is on.'

    def rpc(self, kind, payload=None):
        if self.dry and kind not in {'DB_GET_INVITATION','DB_GET_COMPANY_BY_ID','DB_GET_COMPANY_BY_LINKEDIN_ID',
                                    'DB_SEARCH_COMPANIES','DB_LIST_INVITATIONS_OVERVIEW'}:
            raise RuntimeError('Dry-run blocked a CRM write')
        response = self.ui.evaluate('''async m => {
          return await Promise.race([chrome.runtime.sendMessage(m),
            new Promise((_,reject)=>setTimeout(()=>reject(new Error('Extension response timed out')),22000))]);
        }''', {'type':kind, 'payload':payload or {}})
        if not response or not response.get('ok'):
            error = (response or {}).get('error', 'No extension response')
            raise RuntimeError(error.get('message', 'Extension operation failed') if isinstance(error, dict) else str(error))
        return response

    def owner(self):
        # Tokens stay in the extension; only the owner identifier crosses this boundary.
        owner = self.ui.evaluate('''async () => {
          const r=await chrome.runtime.sendMessage({type:'SUPABASE_AUTH_GET_SESSION'});
          return r?.ok ? r.session?.user?.id : null;
        }''')
        if not owner:
            raise RuntimeError('Sign in to LEF in Configuration first')
        saved = self.ledger.meta('owner')
        if saved and saved != owner:
            raise RuntimeError('This batch belongs to a different LEF account. Switch back before continuing.')
        return owner

    def load(self, resume):
        owner = self.owner()
        if self.ledger.rows():
            self.refresh_recipient_details()
            campaign = (self.ledger.meta('query') or {}).get('filters', {}).get('campaign', 'saved selection')
            rows = self.ledger.rows()
            errors = sum(r['outcome'] == 'error' for r in rows)
            queued = sum(r['outcome'] in ('queued','working','awaiting_approval') for r in rows)
            self.status = f'Saved batch ({campaign}): {queued} waiting, {errors} errors. '
            self.status += 'In Progress & results, expand Review and recovery to requeue pre-send errors, then press Start.' if errors else 'Press Start to process the next profile.'
            return
        frame = self.ui.frame_locator('#crm')
        frame.locator('#tabOverviewBtn').evaluate('(e) => e.click()')
        frame.locator('#listPersonsTabBtn').evaluate('(e) => e.click()')
        # Reuse the UI's query builder, including its current ordering and other filters.
        crm_frame = self.ui.locator('#crm').element_handle().content_frame()
        query = crm_frame.evaluate('() => buildOverviewQueryState()')
        campaign = query.get('filters', {}).get('campaign')
        if not isinstance(campaign, str) or not campaign.strip():
            raise RuntimeError('Choose a campaign in the Recipients list before loading people.')
        self.status = f'Loading {campaign} in Persons grid order…'
        self.render()
        # One database response gives one ordered snapshot. Do not walk the live
        # list with one request per person: offsets can move between requests.
        result = self.rpc('DB_LIST_INVITATIONS_OVERVIEW', {**query, 'page':1, 'pageSize':10000})
        rows, total = result['rows'], result['total']
        self.ledger.meta('last_load_diagnostic', {
            'query':query, 'returned':len(rows), 'total':total,
            'unique_urls':len({r.get('url') for r in rows})})
        if any(c['action'] == 'pause' for c in self.ui.evaluate('() => window.lefCommands.splice(0)')):
            raise RuntimeError('Batch loading paused; no snapshot saved')
        if total is None:
            raise RuntimeError('LEF did not return the contact count. No batch was saved.')
        if len(rows) != total:
            raise RuntimeError(f'LEF returned {len(rows)} of {total} contacts. No partial batch was saved. Narrow the Persons filters and load again.')
        if len({r['url'] for r in rows}) != len(rows):
            raise RuntimeError('LEF returned duplicate profile URLs in one response. No batch was saved; loading diagnostics were recorded.')
        urls = [canonical(r['url']) for r in rows]
        self.ledger.snapshot(urls, owner, resume)
        self.ledger.meta('query', query)
        self.ledger.meta('recipient_names', {canonical(r['url']): r.get('full_name') or r.get('name') or '' for r in rows})
        self.ledger.meta('recipient_details', {canonical(r['url']): {'name':r.get('name') or r.get('full_name') or '', 'company':r.get('company') or ''} for r in rows})
        self.refresh_recipient_details()
        self.status = f"Loaded {len(urls)} profiles from {campaign} in Persons {query['sortField']} {query['sortDir']} order. Press Start."

    def refresh_recipient_details(self):
        urls = [r['url'] for r in self.ledger.rows()]
        if not urls: return
        self.status = 'Loading saved recipients and linked company names…'
        self.render()
        details = self.ui.evaluate(r'''async urls => {
          const companies=new Map(), result={}; let index=0;
          const call=async(type,payload)=>{
            const r=await chrome.runtime.sendMessage({type,payload});
            if(!r?.ok)throw Error('CRM read failed');return r;
          };
          await Promise.all(Array.from({length:4},async()=>{
            while(index<urls.length){const url=urls[index++];
              try {
                const {row}=await call('DB_GET_INVITATION',{linkedin_url:url});
                if(!row){result[url]={lookup_error:true,lookup_message:'Person not found in CRM'};continue;}
                if(decodeURIComponent(new URL(row.linkedin_url).pathname).replace(/\/$/,'')!==decodeURIComponent(new URL(url).pathname).replace(/\/$/,''))throw Error('CRM returned another person');
                const item={name:row.full_name || '',company:row.company || '',company_id:row.company_id || '',company_source:'registered',lookup_error:false,lookup_message:''};
                if(row.company_id){
                  if(!companies.has(row.company_id))companies.set(row.company_id,call('DB_GET_COMPANY_BY_ID',{company_id:row.company_id}));
                  try {const {company}=await companies.get(row.company_id);
                    if(company?.company_name){item.company=company.company_name;item.company_source='linked';}
                  }catch(_){item.company_source='registered; linked company unavailable';}
                }
                result[url]=item;
              }catch(_){result[url]={lookup_error:true,lookup_message:'CRM details could not be loaded'};}
            }
          }));return result;
        }''', urls)
        saved = self.ledger.meta('recipient_details') or {}
        for url, detail in details.items():
            saved[url] = {**saved.get(url, {}), **detail}
        self.ledger.meta('recipient_details', saved)

    def restore_recipient_display(self):
        if not self.ledger.rows(): return
        try:
            self.owner()
            self.refresh_recipient_details()
            details = self.ledger.meta('recipient_details') or {}
            failures = sum(not details.get(r['url']) or details[r['url']].get('lookup_error', False) for r in self.ledger.rows())
            self.status = ('Saved queue restored. Names and companies loaded from CRM. Paused; nothing has started.'
                if not failures else f'Saved queue restored; {failures} CRM lookups failed. Use Load/resume to refresh. Nothing has started.')
        except Exception as exc:
            self.status = f'Saved queue restored, but CRM details could not be loaded: {exc}. Sign in to LEF, then use Load/resume.'

    def render(self):
        names = self.ledger.meta('recipient_names') or {}
        details = self.ledger.meta('recipient_details') or {}
        rows = [{**row, 'name': names.get(row['url'], ''), 'details_loaded':bool(details.get(row['url'])) and not details[row['url']].get('lookup_error'), **details.get(row['url'], {})} for row in self.ledger.rows()]
        self.ui.evaluate('s => window.lefRender(s)', {'status':self.status, 'running':self.running,
            'approval':self.approval, 'log':self.ledger.events(), 'rows':rows,
            'current':self.current['url'] if self.current else None,
            'batch_request':{k:v for k,v in self.batch_request.items() if k in ('nonce','urls','expires')} if self.batch_request else None,
            'batch_active':bool(self.approved_batch),
            'schedule':self.scheduler.state(), 'next_action_at':self.wait_until or None,
            'campaign':(self.ledger.meta('query') or {}).get('filters', {}).get('campaign', '')})

    def linkedin_session(self):
        # Bind approval to this signed-in browser session; never render or log cookies.
        values = [c['value'] for c in self.context.cookies('https://www.linkedin.com') if c['name'] == 'li_at']
        if len(values) != 1 or not values[0]:
            self.ledger.meta('execution_hold', 'LinkedIn login session could not be verified')
            raise RuntimeError('Sign in using Show LinkedIn before approving a live batch.')
        return hashlib.sha256(values[0].encode()).hexdigest()

    def batch_snapshot(self):
        return {'urls':[r['url'] for r in self.ledger.rows()], 'query':self.ledger.meta('query')}

    def eligible_urls(self):
        return [r['url'] for r in self.ledger.rows() if r['outcome'] in ('queued','working','awaiting_approval') and not r['send_attempted']]

    def check_batch(self):
        scope = self.approved_batch
        if not scope or time.time() >= scope['expires']:
            raise RuntimeError('Batch approval expired. Review and approve the remaining recipients again.')
        if self.owner() != scope['owner'] or self.linkedin_session() != scope['session']:
            raise RuntimeError('The signed-in account or LinkedIn session changed. Batch approval revoked.')
        if self.batch_snapshot() != scope['snapshot'] or (self.current and self.current['url'] not in scope['urls']):
            raise RuntimeError('Recipient selection changed. Review and approve a new batch.')

    def command(self, cmd):
        action = cmd['action']
        if action == 'save_schedule':
            if self.running: raise RuntimeError('Pause before changing the execution schedule.')
            self.scheduler.save(cmd.get('settings', {}))
            self.approved_batch = self.batch_request = None
            self.wait_until = 0
            self.status = 'Executable schedule saved. Activity counters are unchanged.'
        elif action == 'clear_hold':
            if self.running: raise RuntimeError('Pause before reviewing a warning.')
            self.ledger.meta('execution_hold', '')
            self.status = 'Warning acknowledged. Start requires fresh checks and approval.'
        elif action == 'browser':
            if not self.profile_page or self.profile_page.is_closed():
                self.profile_page = self.context.new_page()
                self.profile_page.goto('https://www.linkedin.com/', wait_until='domcontentloaded')
            self.profile_page.bring_to_front()
        elif action == 'pause':
            self.running = False
            self.wait_until = 0
            self.batch_request = None
            self.approved_batch = None
            self.approval = None
            self.approved_at = None
            if self.current and self.ledger.get(self.current['url'])['send_attempted']:
                saved = self.ledger.get(self.current['url'])
                self.ledger.record(self.current['url'], self.stage, 'confirmed_sync_error' if saved['confirmed'] else 'ambiguous', 'Paused after send intent; inspect LinkedIn manually')
                self.current = None
            self.stage = 'open'
            self.status = 'Paused. No further invitation clicks will be made.'
        elif action == 'load' and not self.running:
            self.load(cmd.get('resume',''))
        elif action == 'start' and not self.running:
            if self.ledger.meta('execution_hold'):
                raise RuntimeError('Review and acknowledge the LinkedIn warning in executable Settings first.')
            owner = self.owner()
            self.dry = bool(cmd.get('dry', True))
            self.batch_request = None
            self.approved_batch = None
            self.current = None
            self.approval = None
            self.approved_at = None
            self.stage = 'open'
            self.wait_until = 0
            if not self.dry and cmd.get('batch'):
                urls = self.eligible_urls()
                if not urls:
                    raise RuntimeError('No waiting recipients. Review the results before starting again.')
                self.batch_request = {'nonce':str(uuid.uuid4()), 'urls':urls, 'expires':time.time()+300,
                    'owner':owner, 'session':self.linkedin_session(), 'snapshot':self.batch_snapshot()}
                self.status = f'Review {len(urls)} recipients and approve this batch once. Nothing has started.'
                return
            self.running = True
        elif action == 'approve_batch' and not self.running:
            scope = self.batch_request
            if not scope or cmd.get('batch_nonce') != scope['nonce'] or time.time() >= scope['expires'] or cmd.get('dry', True):
                raise RuntimeError('Batch approval is missing, expired or no longer in live mode.')
            if self.eligible_urls() != scope['urls'] or self.batch_snapshot() != scope['snapshot']:
                raise RuntimeError('The recipient list changed. Review a fresh batch before sending.')
            self.approved_batch = {**scope, 'expires':self.scheduler.approval_end()}
            self.check_batch()
            self.ledger.meta('last_batch_approval', {'urls':scope['urls'], 'approved_at':time.time(),
                'expires':self.approved_batch['expires'], 'content':'LinkedIn invitation without a note'})
            self.batch_request = None
            self.dry = False
            self.running = True
            self.status = f'Batch approved for this workday: up to {len(scope["urls"])} invitations, subject to activity limits.'
        elif action in ('exclude_person','exclude_company','restore_person'):
            if self.running: raise RuntimeError('Pause before editing the invitation queue.')
            url = canonical(cmd.get('url', ''))
            urls = [url]
            if action == 'exclude_company':
                details = self.ledger.meta('recipient_details') or {}
                selected = details.get(url, {})
                def company_key(item):
                    return ('id', str(item['company_id'])) if item.get('company_id') else ('name', (item.get('company') or '').strip().casefold())
                key = company_key(selected)
                if not key[1]: raise RuntimeError('No company is recorded for this person.')
                name = (selected.get('company') or '').strip().casefold()
                urls = [u for u,item in details.items() if company_key(item) == key or
                    (name and not (selected.get('company_id') and item.get('company_id')) and
                     (item.get('company') or '').strip().casefold() == name)]
            count = self.ledger.exclude(urls, restore=action == 'restore_person')
            self.approved_batch = self.batch_request = self.approval = None
            self.current = None
            self.stage = 'open'
            self.wait_until = 0
            self.status = f'{count} recipients restored.' if action == 'restore_person' else f'{count} recipients excluded from this batch. CRM records were not changed.'
        elif action == 'skip':
            self.wait_until = 0
            row = self.current or self.ledger.next()
            if row and not self.ledger.get(row['url'])['send_attempted']:
                self.ledger.record(row['url'], 'skip', 'skipped_user')
            elif row:
                saved = self.ledger.get(row['url'])
                self.ledger.record(row['url'], self.stage, 'confirmed_sync_error' if saved['confirmed'] else 'ambiguous', 'Skipped after send intent; inspect manually')
            self.current = None
            self.approval = None
            self.approved_at = None
            self.stage = 'open'
        elif action == 'review' and not self.running:
            self.ledger.review_dry()
            self.status = 'Dry-run profiles requeued. All prior send attempts remain blocked.'
        elif action == 'approve' and self.running and not self.dry:
            if not self.approval or cmd.get('approval') != self.approval or time.time() > self.approval['expires']:
                raise RuntimeError('Approval expired or does not match this profile')
            self.approved_at = time.monotonic()
            self.approval = None
            self.stage = 'connect'
        elif action == 'retry' and not self.running:
            # Only pre-send errors are resumable. Ambiguous outcomes are immutable here.
            with self.ledger.db:
                self.ledger.db.execute("UPDATE profiles SET outcome='queued',step='queued' WHERE outcome='error' AND send_attempted=0")
            self.status = 'Pre-send errors requeued. Ambiguous and confirmed sends remain blocked.'
        elif action == 'sync' and not self.running:
            if cmd.get('dry', True):
                raise RuntimeError('Turn off dry-run to sync already-confirmed invitations to CRM')
            self.owner()
            self.dry = False
            for row in self.ledger.rows():
                if row['confirmed'] and row['outcome'] != 'invited':
                    self.sync_confirmed(row['url'])
            self.status = 'Confirmed invitation CRM synchronization completed; no LinkedIn clicks.'

    def click_gate(self):
        # Consume controls queued during a slow read before any mouse action.
        commands = self.ui.evaluate('() => window.lefCommands.splice(0)')
        interrupted = False
        for cmd in commands:
            if cmd['action'] in ('pause','skip'):
                self.command(cmd)
                interrupted = True
        if not interrupted and (self.approved_at is None or time.monotonic()-self.approved_at > 60):
            raise RuntimeError('Approval expired during state checks; no further click')
        if not interrupted and self.approved_batch:
            self.check_batch()
        return self.running and not interrupted and not self.dry

    def finish(self, outcome, detail=''):
        self.ledger.record(self.current['url'], self.stage, outcome, detail)
        self.status = f"{outcome}: {self.current['url']} {detail}"
        self.current = None
        self.approval = None
        self.approved_at = None
        self.stage = 'open'

    def check_warning(self, page):
        if not page or page.is_closed(): return
        from urllib.parse import urlsplit
        path = urlsplit(page.url).path.lower()
        if any(x in path for x in ('/checkpoint','/challenge','/authwall','/login','/uas/')):
            reason = 'LinkedIn login or security checkpoint requires manual review'
        else:
            text = page.locator('body').inner_text(timeout=2000)
            import re
            found = re.search(r'(unusual (?:activity|behavio[u]?r)|temporarily restricted|account.{0,30}restricted|automated activity|atingiu o limite semanal|weekly invitation limit|atividade(?:s)? (?:incomum|incomuns|automatizada)|conta.{0,30}restrita)', text, re.I)
            reason = f'LinkedIn warning detected: {found.group(0)}' if found else ''
        if reason:
            self.ledger.meta('execution_hold', reason)
            raise RuntimeError(reason + '. Queue stopped; review manually in Settings.')

    def linkedin(self, page):
        return LinkedIn(page, before_navigation=self.before_navigation, after_navigation=self.check_warning,
                        relax=self.relax, step_seconds=self.scheduler.review_pace()['step_seconds'])

    def before_navigation(self, url):
        if self.review_interrupted: raise ReviewInterrupted()
        self.scheduler.visit(url)

    def relax(self, seconds, label):
        end = time.monotonic() + seconds
        while time.monotonic() < end:
            for cmd in self.ui.evaluate('() => window.lefCommands.splice(0)'):
                if cmd['action'] in ('pause', 'skip'):
                    self.command(cmd)
                    self.review_interrupted = True
                    raise ReviewInterrupted()
            self.scheduler.due('continuation')
            if time.monotonic() - self.last_warning_check > 5:
                for page in self.context.pages:
                    if 'linkedin.com/' in page.url: self.check_warning(page)
                self.last_warning_check = time.monotonic()
            self.status = f'{label} · {max(1, int(end-time.monotonic()))}s. Pause and Skip remain available.'
            self.render()
            self.ui.wait_for_timeout(200)

    def navigate(self, page, url):
        if '/company/' in url:
            self.relax(self.scheduler.review_pace()['step_seconds'], 'Reading before opening company')
        self.before_navigation(url)
        page.goto(url, wait_until='domcontentloaded', timeout=30000)
        self.check_warning(page)
        if '/company/' in url:
            self.relax(self.scheduler.review_pace()['company_seconds'], 'Reading company page')

    def defer(self, exc):
        self.wait_until, self.wait_reason = exc.until, str(exc)
        self.status = f'Waiting: {exc}. Next eligible time: {datetime.fromtimestamp(exc.until, SAO_PAULO):%a %d %b %H:%M} (Sao Paulo).'
        if self.current:
            self.ledger.record(self.current['url'], 'schedule_wait', 'working', self.status)
        # Resume from fresh profile evidence, not from a stale approval/control.
        self.stage = 'open'
        self.approval = None
        self.approved_at = None

    def pacing_ready(self):
        remaining = (self.ledger.meta('next_invitation_at') or 0) - time.time()
        if remaining > 0:
            self.status = f'Waiting {remaining:.1f}s before the next invitation action. Pause and Skip remain available.'
            return False
        return True

    def reserve_invitation_interval(self):
        # Durable deadline covers both Connect (which may send) and final Send.
        interval = random.uniform(1, 10)
        self.ledger.meta('next_invitation_at', time.time() + interval)
        return interval

    def handle_existing(self, evidence):
        if evidence['state'] == 'pending':
            self.finish('skipped_pending', 'Observed LinkedIn pending; no new invitation')
            return
        url = self.current['url']
        if self.dry:
            self.finish('dry_run', 'Already connected: would mark invited and connected in LEF; no invitation')
            return
        self.owner()
        row = self.person_read(url)
        if not row:
            profile = self.extract(self.profile_page, 'EXTRACT_PROFILE_CONTEXT')['profile']
            if canonical(profile['url']) != url or profile.get('name') != evidence['name']:
                raise RuntimeError('Connected profile identity could not be verified')
            self.rpc('DB_UPSERT_GENERATED', {'linkedin_url':url, 'full_name':profile['name'], 'headline':profile.get('headline','')})
            row = self.person_read(url)
        if not row: raise RuntimeError('Connected person could not be saved in LEF')
        if LinkedIn(self.profile_page).inspect(url)['state'] != 'connected':
            raise RuntimeError('Connection state changed before CRM update')
        self.rpc('DB_SET_ACCEPTED_AT_NOW', {'id':row['id'], 'linkedin_url':url, 'reconcile_existing_connection':True})
        row = self.person_read(url)
        if not row or not row.get('accepted') or not row.get('invited_at') or not row.get('accepted_at'):
            raise RuntimeError('Existing connection update could not be verified in LEF')
        self.finish('connected_reconciled', 'Existing connection marked invited and connected in LEF. No invitation sent. Missing dates record observation time.')

    def person_read(self, url):
        row = self.rpc('DB_GET_INVITATION', {'linkedin_url':url})['row']
        if row and canonical(row['linkedin_url']) != url:
            raise RuntimeError('CRM returned a different profile')
        return row

    def extract(self, page, kind):
        result = self.ui.evaluate('''async ({url,type}) => {
          const tabs=await chrome.tabs.query({});
          const matches=tabs.filter(t=>t.url===url);
          if(matches.length!==1) throw new Error('No unique LinkedIn tab for extraction');
          return await chrome.tabs.sendMessage(matches[0].id,{type});
        }''', {'url':page.url,'type':kind})
        if not result or not result.get('ok'):
            raise RuntimeError('Existing LEF page extraction failed')
        return result

    def crm_prepare(self, url):
        self.owner()
        self.person = self.person_read(url)
        if self.person and (self.person.get('accepted') or self.person.get('invited_at') or self.person.get('status') in
                            ('invited','accepted','first message sent','message responded')):
            self.finish('skipped_crm', 'CRM already records invitation/connection activity')
            return
        if not self.person:
            profile = self.extract(self.profile_page, 'EXTRACT_PROFILE_CONTEXT')['profile']
            if canonical(profile['url']) != url or not profile.get('name'):
                raise RuntimeError('Profile extraction identity is incomplete')
            if not self.dry:
                self.rpc('DB_UPSERT_GENERATED', {'linkedin_url':url, 'full_name':profile['name'],
                    'headline':profile.get('headline','')})
                self.person = self.person_read(url)
                if not self.person: raise RuntimeError('Person save could not be verified')
            else:
                self.ledger.record(url, 'person', 'working', 'Would save missing person through LEF')
        if self.person and self.person.get('company_id'):
            company = self.rpc('DB_GET_COMPANY_BY_ID', {'company_id':self.person['company_id']})['company']
            if not company: raise RuntimeError('Existing company link could not be verified')
            self.stage = 'ready'
            return
        try:
            company_url = self.linkedin(self.profile_page).company_url(self.evidence)
        except CompanyUnavailable as error:
            self.ledger.record(url, 'company_unavailable', 'working',
                               f'Continuing without company: {error}')
            self.stage = 'ready'
            return
        if self.evidence.get('employer_source') == 'Profile header':
            self.ledger.record(url, 'company_selection', 'working', f"Profile header company: {self.evidence.get('employer_name', '')}")
        start = self.evidence.get('employer_start')
        if start:
            self.ledger.record(url, 'company_selection', 'working', f"Selected {self.evidence['employer_name']} since {start}. {self.evidence.get('employer_source', 'Experience')}")
        self.ledger.record(url, 'company', 'working', f'Employer company page: {company_url}')
        company = self.rpc('DB_GET_COMPANY_BY_LINKEDIN_ID', {'linkedin_id':company_url})['company']
        if not company:
            company_page = self.context.new_page()
            try:
                company_page.bring_to_front()
                self.navigate(company_page, company_url)
                company_page.locator('main h1').wait_for(timeout=15000)
                resolved_url = canonical(company_page.url, 'company')
                redirected = resolved_url != company_url
                if redirected and not company_url.rstrip('/').split('/')[-1].isdigit():
                    raise RuntimeError('Company page redirected; identity unverified')
                data = self.extract(company_page, 'EXTRACT_COMPANY_CONTEXT')['company']
                if canonical(data['linkedin_id'], 'company') != resolved_url or not data.get('company_name'):
                    raise RuntimeError('Company extraction identity is incomplete')
                if redirected:
                    employer = self.evidence.get('employer_name', '')
                    if not employer or ' '.join(employer.split()).casefold() != ' '.join(data['company_name'].split()).casefold():
                        raise RuntimeError('Redirected company name does not match the profile employer')
                    company_url = resolved_url
                    company = self.rpc('DB_GET_COMPANY_BY_LINKEDIN_ID', {'linkedin_id':company_url})['company']
                if not company:
                    # Name-only matches may be legacy companies without a LinkedIn URL.
                    matches = self.rpc('DB_SEARCH_COMPANIES', {'term':data['company_name'], 'limit':50})['companies']
                    if len(matches) >= 50 or any((c.get('company_name') or '').casefold() == data['company_name'].casefold() for c in matches):
                        raise RuntimeError('Possible existing company by name. Link/merge it in LEF before retrying')
                    if self.dry:
                        self.ledger.record(url, 'company', 'working', f'Would create company from {company_url} and link through LEF')
                    else:
                        allowed = {k:data.get(k,'') for k in ('linkedin_id','company_name','employee_number','it_members','sector','city')}
                        self.rpc('DB_UPSERT_COMPANY_PROFILE', allowed)
                        company = self.rpc('DB_GET_COMPANY_BY_LINKEDIN_ID', {'linkedin_id':company_url})['company']
                        if not company: raise RuntimeError('Company save could not be verified')
            finally:
                company_page.close()
        if company and self.dry:
            self.ledger.record(url, 'company', 'working', f"Would link existing LEF company: {company['company_name']}")
        if company and not self.dry:
            self.rpc('DB_CONFIRM_COMPANY_LINK', {'linkedin_url':url,
                'company_id':company['company_id'], 'company_name':company['company_name']})
            self.person = self.person_read(url)
            if not self.person or str(self.person.get('company_id')) != str(company['company_id']):
                raise RuntimeError('Company link could not be verified; no invitation will be sent')
            details = self.ledger.meta('recipient_details') or {}
            details[url] = {**details.get(url, {}), 'company':company['company_name'],
                'company_id':company['company_id'], 'company_source':'linked'}
            self.ledger.meta('recipient_details', details)
        self.stage = 'ready'

    def sync_confirmed(self, url):
        if not self.ledger.get(url)['confirmed']:
            raise RuntimeError('No persisted LinkedIn confirmation')
        self.owner()
        row = self.person_read(url)
        if not row: raise RuntimeError('Confirmed send has no matching CRM person')
        if row.get('accepted') or row.get('status') in ('accepted','first message sent','message responded'):
            self.ledger.record(url, 'crm_sync', 'invited', 'LinkedIn send confirmed; CRM already has a later lifecycle state')
            return
        if row.get('status') != 'invited' or not row.get('invited_at'):
            self.rpc('DB_MARK_STATUS', {'id':row['id'], 'linkedin_url':url, 'status':'invited'})
        row = self.person_read(url)
        if row.get('status') != 'invited' or not row.get('invited_at'):
            raise RuntimeError('LinkedIn send confirmed but CRM invited status was not verified')
        self.ledger.record(url, 'crm_sync', 'invited')

    def tick(self):
        self.review_interrupted = False
        if self.approved_batch and time.time() >= self.approved_batch['expires']:
            raise RuntimeError('Workday approval expired. Review and approve the remaining recipients again.')
        if time.monotonic() - self.last_warning_check > 5:
            for page in self.context.pages:
                if 'linkedin.com/' in page.url: self.check_warning(page)
            self.last_warning_check = time.monotonic()
        if time.time() < self.wait_until:
            return
        self.wait_until = 0
        row = self.current or self.ledger.next()
        if not row:
            self.running = False
            self.approved_batch = None
            self.status = 'Batch complete or remaining profiles require manual review. See activity log.'
            return
        self.current = row
        if self.stage not in ('dialog', 'confirm', 'sync'):
            self.scheduler.due('continuation')
        if self.approved_batch:
            self.check_batch()
        url = row['url']
        saved = self.ledger.get(url)
        if saved['step'] != self.stage:
            self.ledger.record(url, self.stage, 'confirmed' if saved['confirmed'] else
                               'awaiting_approval' if self.stage == 'approval' else 'working')
        if self.stage != 'approval':
            self.status = f"{'Dry-run' if self.dry else 'Live'} · {self.stage} · {url}"
        if self.stage == 'open':
            self.owner()
            person = self.person_read(url)
            if person and person.get('status') == 'invited':
                self.finish('skipped_crm', 'CRM status is invited; skipped before opening LinkedIn')
                return
            self.scheduler.due('profile', spacing=True)
            if not self.dry: self.scheduler.due('invite', spacing=True)
            self.scheduler.record('person_start', url)
            self.ledger.record(url, 'open_profile', 'working')
            if not self.profile_page or self.profile_page.is_closed():
                self.profile_page = self.context.new_page()
            self.status = f'Opening LinkedIn profile: {url}'
            self.render()
            self.profile_page.bring_to_front()
            self.navigate(self.profile_page, url)
            self.deadline = time.monotonic() + 45
            self.stage = 'wait_profile'
            return
        if self.stage == 'wait_profile':
            state = LinkedIn(self.profile_page).load_state(url)
            if state == 'ready':
                self.review_actions = LinkedIn.review_plan(self.scheduler.review_pace()['profile_seconds'])
                self.deadline = 0
                self.stage = 'browse'
            elif time.monotonic() >= self.deadline:
                raise RuntimeError('LinkedIn profile heading was not found after 45 seconds. The tab is left open: check whether the profile loaded. If it looks normal, its layout needs support. No invitation was attempted.')
            else:
                self.status = 'Waiting for the LinkedIn profile to load. Pause and Skip remain available.'
            return
        if self.stage == 'browse':
            self.status = 'Reviewing profile: scrolling and reading. Pause and Skip remain available.'
            if time.monotonic() < self.deadline:
                return
            if self.review_actions:
                delay = LinkedIn(self.profile_page).review_step(self.review_actions.pop(0))
                self.deadline = time.monotonic() + delay
            else:
                self.stage = 'inspect'
            return
        li = self.linkedin(self.profile_page)
        if self.stage == 'inspect':
            if time.monotonic() < self.deadline: return
            self.evidence = li.inspect(url)
            state = self.evidence['state']
            if state in ('pending','connected'):
                self.handle_existing(self.evidence)
            elif state not in ('connect','more'):
                raise RuntimeError(self.evidence.get('reason') or 'LinkedIn state unknown')
            else:
                self.ledger.record(url, 'inspect', 'working', f'Observed {state}')
                self.stage = 'crm'
        elif self.stage == 'crm':
            self.crm_prepare(url)
        elif self.stage == 'ready':
            evidence = li.inspect(url)
            if evidence['state'] in ('pending','connected'):
                self.handle_existing(evidence)
            elif evidence['state'] not in ('connect','more'):
                raise RuntimeError('LinkedIn action is no longer unambiguous')
            elif self.dry:
                self.finish('dry_run', 'Would request approval, mouse-click Connect, verify Pending, then mark invited in LEF')
            else:
                self.evidence = evidence
                if self.approved_batch:
                    self.check_batch()
                    self.approved_at = time.monotonic()
                    self.stage = 'connect'
                    return
                self.approval = {'url':url, 'nonce':str(uuid.uuid4()), 'expires':time.time()+60}
                self.ledger.record(url, 'approval', 'awaiting_approval')
                self.status = f"Ready: {evidence['name']}. Approve this recipient in LEF to continue."
                self.stage = 'approval'
                self.ui.bring_to_front()
        elif self.stage == 'approval':
            if not self.approval or time.time() > self.approval['expires']:
                self.running = False
                self.approval = None
                self.status = 'Approval expired. Press Start to recheck the profile.'
        elif self.stage in ('connect','menu_connect'):
            if self.dry or self.approved_at is None or time.monotonic()-self.approved_at > 60:
                raise RuntimeError('Fresh recipient approval is required')
            self.owner()
            evidence = li.inspect(url)
            if evidence['state'] in ('pending','connected'):
                self.handle_existing(evidence); return
            if evidence.get('name') != self.evidence['name']:
                raise RuntimeError('Profile identity changed after approval')
            # A fresh CRM check protects against sends recorded by another LEF surface.
            row_now = self.person_read(url)
            if not row_now or (self.person.get('company_id') and
                               row_now.get('company_id') != self.person.get('company_id')):
                raise RuntimeError('Person/company prerequisite changed after approval')
            if row_now.get('accepted') or row_now.get('invited_at') or row_now.get('status') in ('invited','accepted','first message sent','message responded'):
                self.finish('skipped_crm'); return
            if self.stage == 'connect' and evidence['state'] == 'more':
                if not self.click_gate(): return
                li.more()
                self.stage = 'menu_connect'
                return
            button = li.connect_button(self.stage == 'menu_connect')
            if not self.pacing_ready(): return
            if not self.click_gate(): return
            self.scheduler.due('invite', spacing=True)
            self.check_warning(self.profile_page)
            # Connect itself may send immediately. Commit before either possible send click.
            self.scheduler.record('invite', url)
            self.ledger.record(url, 'connect_intent', 'working', attempted=1)
            interval = self.reserve_invitation_interval()
            li.mouse(button)
            self.ledger.meta('next_invitation_at', time.time() + interval)
            self.stage = 'dialog'
            self.deadline = time.monotonic()+12
        elif self.stage == 'dialog':
            if canonical(self.profile_page.url) != url:
                raise RuntimeError('Profile changed after Connect; no further click')
            if li.confirmed(url, self.evidence['name']):
                self.ledger.record(url, 'linkedin_confirmation', 'confirmed', 'Header changed to Pending/Pendente after our click', confirmed=1)
                self.stage = 'sync'
            elif self.profile_page.get_by_role('dialog').count():
                if self.approved_at is None or time.monotonic()-self.approved_at > 60:
                    raise RuntimeError('Approval expired before the final send click')
                button = li.send_button(self.evidence['name'])
                self.scheduler.due('continuation')
                self.check_warning(self.profile_page)
                if not self.pacing_ready(): return
                if not self.click_gate(): return
                self.ledger.record(url, 'send_intent', 'working', attempted=1)
                interval = self.reserve_invitation_interval()
                li.mouse(button)
                self.ledger.meta('next_invitation_at', time.time() + interval)
                self.stage = 'confirm'
                self.deadline = time.monotonic()+15
            elif time.monotonic() > self.deadline:
                raise RuntimeError('Connect outcome is ambiguous. No automatic retry.')
        elif self.stage == 'confirm':
            if li.confirmed(url, self.evidence['name']):
                self.ledger.record(url, 'linkedin_confirmation', 'confirmed', 'Header changed to Pending/Pendente after our click', confirmed=1)
                self.stage = 'sync'
            elif time.monotonic() > self.deadline:
                raise RuntimeError('No LinkedIn Pending confirmation after Send. No automatic retry.')
        elif self.stage == 'sync':
            self.sync_confirmed(url)
            self.finish('invited', 'LinkedIn Pending confirmation and CRM invited status verified')


def smoke(context, ui, worker, output):
    errors = []
    ui.on('pageerror', lambda error: errors.append(str(error)))
    frame = ui.frame_locator('#crm')
    frame.locator('#personsListPanel').wait_for()
    ui.locator('#crm-container.ready').wait_for()
    assert not frame.locator('#topTabs').is_visible()
    ui.locator('[data-view="settings"]').click()
    frame.locator('#apiKey').wait_for()
    ui.locator('[data-view="recipients"]').click()
    frame.locator('#filterCampaign').wait_for()
    popup = context.new_page()
    popup.on('pageerror', lambda error: errors.append(str(error)))
    popup.goto(worker.url.rsplit('/', 3)[0] + '/src/popup/popup.html')
    popup.locator('#tabConfigBtn').click()
    popup.locator('#configGeneralPanel').wait_for()
    assert popup.locator('#configGeneralTabBtn').inner_text() == 'OpenAI'
    popup.locator('#openai-provider [value=codex]').check()
    popup.locator('#codex-status').click()
    popup.wait_for_function("!document.getElementById('codex-status').disabled")
    codex_status = popup.locator('#codex-connection-status').inner_text()
    assert 'ChatGPT' in codex_status, codex_status
    assert not popup.locator('#apiKey').is_visible()
    popup.locator('#openai-provider [value=api]').check()
    ui.bring_to_front()
    ui.locator('.activity > summary').click()
    ui.locator('#panel').click()
    ui.wait_for_timeout(1200)
    worker.evaluate('async () => { await chrome.action.openPopup(); }')
    ui.wait_for_timeout(400)
    views = worker.evaluate("async () => (await chrome.runtime.getContexts({})).map(c=>({type:c.contextType,url:c.documentUrl}))")
    panel = any(v['type'] == 'SIDE_PANEL' and v['url'].endswith('/sidepanel.html') for v in views)
    action_popup = any(v['type'] == 'POPUP' for v in views)
    result = {'chromium':context.browser.version if context.browser else 'persistent',
              'extension_worker':worker.url, 'popup_loaded':True, 'crm_frame_loaded':True,
              'native_side_panel_open':panel, 'native_action_popup_open':action_popup,
              'page_errors':errors, 'dry_run_default':ui.locator('#dry').is_checked(),
              'focused_persons_and_settings':True,
              'openai_provider_controls':True, 'codex_native_status':codex_status,
              'authenticated_crm_verified':False, 'live_linkedin_verified':False}
    output.parent.mkdir(parents=True, exist_ok=True)
    ui.screenshot(path=str(output.with_suffix('.png')))
    output.write_text(json.dumps(result, indent=2), encoding='utf-8')
    if not panel or not action_popup or errors:
        raise RuntimeError('Smoke checks failed; see '+str(output))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--smoke-test', action='store_true')
    parser.add_argument('--data-dir', type=Path)
    args = parser.parse_args()
    data = args.data_dir or Path(os.environ['LOCALAPPDATA']) / 'LEF' / 'Launcher'
    data.mkdir(parents=True, exist_ok=True)
    # OS-owned lock is released on crash; a second process cannot send concurrently.
    import msvcrt
    lock = (data / 'launcher.lock').open('a+b')
    lock.seek(0)
    if lock.read(1) == b'':
        lock.write(b'0'); lock.flush()
    lock.seek(0)
    try:
        msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
    except OSError:
        ctypes.windll.user32.MessageBoxW(0, 'LEF is already running for this browser profile.', 'LEF', 0)
        return
    try:
        with sync_playwright() as pw:
            context = pw.chromium.launch_persistent_context(str(data / 'browser-profile'), headless=False,
                channel='chromium', no_viewport=True,
                args=[f'--disable-extensions-except={EXTENSION}', f'--load-extension={EXTENSION}', '--start-maximized'])
            worker = next((w for w in context.service_workers if w.url.endswith('/src/background/background.js')), None)
            if not worker:
                worker = context.wait_for_event('serviceworker', timeout=20000)
            extension_id = worker.url.split('/')[2]
            codex_binary = ROOT / 'codex' / 'codex.exe' if FROZEN else ROOT / 'build/lef-codex/node_modules/@openai/codex-win32-x64/vendor/x86_64-pc-windows-msvc/bin/codex.exe'
            codex = CodexConnection(codex_binary, data)
            def openai_bridge(source, request):
                allowed = (f'chrome-extension://{extension_id}/src/popup/', f'chrome-extension://{extension_id}/src/launcher/')
                if not source['frame'].url.startswith(allowed):
                    return {'ok':False,'error':'OpenAI connection is available only to LEF extension pages'}
                try:
                    action = request.get('action')
                    if action == 'status': result = codex.status()
                    elif action == 'login': result = codex.login()
                    elif action == 'logout': result = codex.logout()
                    elif action == 'enrich': result = codex.enrich(request)
                    else: raise ValueError('Unknown OpenAI connection action')
                    return {'ok':True,'data':result}
                except Exception as exc:
                    return {'ok':False,'error':str(exc)}
            context.expose_binding('lefOpenAI', openai_bridge)
            ui = context.new_page()
            ui.goto(f'chrome-extension://{extension_id}/src/launcher/launcher.html')
            ledger = Ledger(data / 'progress.sqlite3')
            runner = Runner(context, ui, ledger)
            runner.render()
            runner.restore_recipient_display()
            runner.render()
            if args.smoke_test:
                smoke(context, ui, worker, data / 'smoke-result.json')
            else:
                while not ui.is_closed():
                    try:
                        for cmd in ui.evaluate('() => window.lefCommands.splice(0)'):
                            runner.command(cmd)
                        if runner.running:
                            runner.tick()
                        runner.render()
                        ui.wait_for_timeout(200)
                    except ReviewInterrupted:
                        runner.render()
                    except ScheduleWait as exc:
                        if runner.current and ledger.get(runner.current['url'])['send_attempted']:
                            runner.command({'action':'pause'})
                            runner.status = 'Schedule ended after send intent; inspect LinkedIn manually. No automatic retry.'
                        else:
                            runner.defer(exc)
                        runner.render()
                        ui.wait_for_timeout(200)
                    except Exception as exc:
                        if ui.is_closed(): break
                        runner.running = False
                        runner.status = str(exc)
                        if runner.current:
                            row = ledger.get(runner.current['url'])
                            outcome = 'confirmed_sync_error' if row['confirmed'] else 'ambiguous' if row['send_attempted'] else 'error'
                            ledger.record(row['url'], row['step'], outcome, str(exc))
                        runner.approval = None
                        runner.batch_request = None
                        runner.approved_batch = None
                        runner.approved_at = None
                        runner.current = None
                        runner.stage = 'open'
                        runner.render()
                        ui.bring_to_front()
            ledger.db.close()
            codex.close()
            context.close()
    except Exception:
        (data / 'launcher-error.log').write_text(traceback.format_exc(), encoding='utf-8')
        if not args.smoke_test:
            ctypes.windll.user32.MessageBoxW(0, f'LEF could not continue. See {data / "launcher-error.log"}', 'LEF', 0x10)
        raise
    finally:
        lock.close()


if __name__ == '__main__':
    main()
