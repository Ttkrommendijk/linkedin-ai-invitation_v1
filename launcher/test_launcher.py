"""Offline adversarial fixtures: no requests reach LinkedIn, CRM or Supabase."""
import json
import html
from pathlib import Path
import tempfile
import time
import unittest
from unittest.mock import Mock

from playwright.sync_api import sync_playwright
from ledger import Ledger, canonical
from linkedin import LinkedIn, oldest_active_employer
from main import Runner, ReviewInterrupted
from scheduler import Scheduler, ScheduleWait, SAO_PAULO
from datetime import datetime

URL = 'https://www.linkedin.com/in/fixture-person/'
NEXT = 'https://www.linkedin.com/in/fixture-next/'


class EmployerSelectionTests(unittest.TestCase):
    def test_oldest_current_role_ignores_ended_ceo_role_and_school(self):
        links=[
            {'url':'https://www.linkedin.com/company/cvc/','text':'Director\nCVC CORP \u00b7 Full-time\nNov 2025 - Present'},
            {'url':'https://www.linkedin.com/company/bauk/','text':'Bauk Tech\n1 year 8 months'},
            {'url':'https://www.linkedin.com/company/bauk/','text':'Adviser\nTemporary\nNov 2025 - Present'},
            {'url':'https://www.linkedin.com/company/bauk/','text':'CEO\nFull-time\nFeb 2024 - Nov 2025'},
            {'url':'https://www.linkedin.com/company/random/','text':'Partner | Founder\nRandom Wear\njan de 2025 - o momento'},
        ]
        result=oldest_active_employer(links)
        self.assertEqual(result['name'],'CVC CORP')
        self.assertEqual(result['start'],(2025,11))

    def test_current_grouped_role_uses_its_own_start_date(self):
        links=[{'url':'https://www.linkedin.com/company/group/','text':'Group Company\n10 years'},
               {'url':'https://www.linkedin.com/company/group/','text':'Director\nTemporary\nNov 2025 - Present'}]
        self.assertEqual(oldest_active_employer(links)['name'],'Group Company')
        self.assertEqual(oldest_active_employer(links)['start'],(2025,11))

    def test_grouped_role_without_employment_type_uses_company_header(self):
        links=[{'url':'https://www.linkedin.com/company/338323/','text':'Dasa\nTempo integral \u00b7 5 a\nSao Paulo'},
               {'url':'https://www.linkedin.com/company/338323/','text':'Executive Manager IT\nout de 2023 - o momento \u00b7 3 anos\nHibrido'},
               {'url':'https://www.linkedin.com/company/338323/','text':'IT Manager\nout de 2021 - out de 2023'}]
        result=oldest_active_employer(links)
        self.assertEqual(result['name'],'Dasa')
        self.assertEqual(result['start'],(2023,10))

    def test_role_title_is_never_used_as_missing_company_name(self):
        with self.assertRaisesRegex(RuntimeError,'no identifiable employer'):
            oldest_active_employer([{'url':'https://www.linkedin.com/company/338323/','text':'Executive Manager IT\nout de 2023 - o momento'}])

    def test_tied_oldest_employers_choose_topmost(self):
        links=[{'url':f'https://www.linkedin.com/company/{n}/','text':f'Founder\n{n}\nJan 2025 - Present'} for n in ['a','b']]
        self.assertEqual(oldest_active_employer(links)['name'], 'a')
        self.assertEqual(oldest_active_employer(list(reversed(links)))['name'], 'b')

    def test_unknown_current_start_date_stops(self):
        with self.assertRaisesRegex(RuntimeError,'unreadable start'):
            oldest_active_employer([{'url':'https://www.linkedin.com/company/a/','text':'Founder\nA\n2025 - Present'}])

    def test_secondary_roles_do_not_beat_unknown_primary_role(self):
        links=[{'url':f'https://www.linkedin.com/company/{i}/', 'text':f'{title}\n{company}\nJan 2000 - Present'}
               for i,(title,company) in enumerate([('Developer','Freelancer Co · Freelance'),
                   ('Advisor','Board Co · Full-time'),('Member','Association'),('Director','Side Co · Part-time'),
                   ('Consultant','Self Co · Self-employed'),('Voluntário','Volunteer Co')])]
        links.append({'url':'https://www.linkedin.com/company/main/','text':'Founder\nMain Co\nJan 2024 - Present'})
        result=oldest_active_employer(links)
        self.assertEqual(result['name'],'Main Co')
        self.assertIn('Secondary roles excluded',result['reason'])

    def test_group_full_time_inherited_but_explicit_part_time_overrides(self):
        links=[{'url':'https://www.linkedin.com/company/main/','text':'Main Co\nTempo integral · 10 anos'},
               {'url':'https://www.linkedin.com/company/main/','text':'Director\nJan 2024 - Present'},
               {'url':'https://www.linkedin.com/company/side/','text':'Side Co\nFull-time · 20 years'},
               {'url':'https://www.linkedin.com/company/side/','text':'Consultant\nPart-time\nJan 2000 - Present'}]
        result=oldest_active_employer(links)
        self.assertEqual(result['name'],'Main Co')
        self.assertEqual(result['rank'],0)

    def test_only_secondary_roles_require_manual_primary_company(self):
        with self.assertRaisesRegex(RuntimeError,'Only secondary'):
            oldest_active_employer([{'url':'https://www.linkedin.com/company/a/','text':'Consultant\nA · Autônomo\nJan 2000 - Present'}])

    def test_full_time_date_then_topmost_and_founder_not_excluded(self):
        links=[{'url':f'https://www.linkedin.com/company/{n}/','text':f'Founder\n{n} · Full-time\nJan {year} - Present'}
               for n,year in [('new',2025),('top',2020),('bottom',2020)]]
        self.assertEqual(oldest_active_employer(links)['name'],'top')

class ReviewPlanTests(unittest.TestCase):
    def test_varied_bounded_review_plans_return_to_header(self):
        from unittest.mock import patch
        import random
        with patch('linkedin.random', random.Random(19)):
            plans=[LinkedIn.review_plan() for _ in range(30)]
        self.assertGreater(len({tuple(p) for p in plans}), 1)
        for plan in plans:
            self.assertEqual(plan[0][0], 'header')
            self.assertEqual(plan[-1][0], 'header')
            self.assertEqual(sum(a[1] for a in plan), 0)
            self.assertTrue(6 <= len(plan) <= 10)
            self.assertTrue(6 <= sum(a[2] for a in plan) <= 22)

class LedgerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'ledger.db'
        self.ledger = Ledger(self.path)

    def tearDown(self):
        self.ledger.db.close()
        self.temp.cleanup()

    def test_canonical_identity_and_host_rejection(self):
        self.assertEqual(canonical('https://br.linkedin.com/in/a%ab/?x=1'), 'https://www.linkedin.com/in/a%AB/')
        for url in ('https://linkedin.com.evil/in/a/', 'http://www.linkedin.com/in/a/',
                    'https://www.linkedin.com/in/a/detail/', 'https://user@www.linkedin.com/in/a/'):
            with self.assertRaises(ValueError): canonical(url)

    def test_resume_and_deduplicate(self):
        self.ledger.snapshot([URL, URL, NEXT], 'owner', URL)
        self.assertEqual(self.ledger.next()['url'], NEXT)
        self.assertEqual(len(self.ledger.rows()), 2)
        self.ledger.record(NEXT, 'inspect', 'dry_run')
        self.ledger.review_dry()
        self.assertEqual(self.ledger.next()['url'], NEXT)

    def test_missing_resume_does_not_create_batch(self):
        with self.assertRaises(ValueError): self.ledger.snapshot([URL], 'owner', NEXT)
        self.assertEqual(self.ledger.rows(), [])

    def test_crash_after_intent_is_permanently_blocked(self):
        self.ledger.snapshot([URL, NEXT], 'owner')
        self.ledger.record(URL, 'connect_intent', 'working', attempted=1)
        self.ledger.db.close()
        self.ledger = Ledger(self.path)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'ambiguous')
        self.ledger.review_dry()
        self.assertEqual(self.ledger.next()['url'], NEXT)

    def test_confirmed_not_retried_after_crash(self):
        self.ledger.snapshot([URL], 'owner')
        self.ledger.record(URL, 'confirmation', 'confirmed', attempted=1, confirmed=1)
        self.ledger.db.close()
        self.ledger = Ledger(self.path)
        self.assertEqual(self.ledger.get(URL)['confirmed'], 1)
        self.assertIsNone(self.ledger.next())


class UI:
    def __init__(self): self.commands = []
    def evaluate(self, script, *args):
        if 'splice(0)' in script:
            result, self.commands = self.commands, []
            return result
        if 'SUPABASE_AUTH_GET_SESSION' in script: return 'owner'
        return None
    def bring_to_front(self): pass


def fixture(action='Connect', more=False, confirm=True, recipient='Fixture Person', email=False, direct=False):
    # An unrelated recommendation must never supply connection state or a click target.
    send = "document.querySelector('#action').textContent='Pendente';document.querySelector('[role=dialog]').remove()" if confirm else "document.querySelector('[role=dialog]').remove()"
    dialog = f'<div role="dialog"><h2>Invite {recipient}</h2>{"<input type=email>" if email else ""}<button onclick="{send}">Send without a note</button></div>'
    connect = "document.querySelector('#action').textContent='Pending'" if direct else f'document.body.insertAdjacentHTML("beforeend", {json.dumps(dialog)})'
    initial = 'More' if more else action
    return f'''<html><body><main><section><h1>Fixture Person</h1>
      <span class="dist-value">2nd</span><a href="https://www.linkedin.com/company/fixture/">Fixture Company</a>
      <button id="action">{initial}</button></section>
      <section><h2>Recommended person</h2><button>Pending</button><button>Connect</button></section></main>
      <script>window.clicks=0;const act=document.querySelector('#action');
      function connect(){{window.clicks++; {connect};}}
      act.onclick={'()=>{document.body.insertAdjacentHTML("beforeend",\'<div role="menu"><button role="menuitem" id="menuConnect">Connect</button></div>\');document.querySelector("#menuConnect").onclick=()=>{document.querySelector("[role=menu]").remove();connect();};}' if more else 'connect'};
      </script></body></html>'''


class BrowserTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.pw = sync_playwright().start()
        cls.browser = cls.pw.chromium.launch(headless=True, channel='chromium')

    @classmethod
    def tearDownClass(cls):
        cls.browser.close(); cls.pw.stop()

    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.ledger = Ledger(Path(self.temp.name) / 'progress.db')
        self.ledger.snapshot([URL], 'owner')
        self.context = self.browser.new_context()
        self.html = fixture()
        self.context.route('**/*', lambda route: route.fulfill(status=200, content_type='text/html', body=self.html))
        self.ui = UI()
        self.runner = Runner(self.context, self.ui, self.ledger)
        self.runner.relax = lambda seconds, label: None
        # Browser state-machine fixtures run without real-time schedule waits.
        # Rolling budgets, persistence and navigation gates have separate clocked tests.
        self.runner.scheduler.due = lambda *args, **kwargs: None
        self.runner.scheduler.visit = lambda url: None
        self.runner.scheduler.record = lambda *args: None
        self.runner.scheduler.approval_end = lambda: time.time() + 3600
        self.runner.pacing_ready = lambda: True  # exercise waits separately with a controlled clock
        self.row = {'id':'fixture', 'linkedin_url':URL, 'full_name':'Fixture Person', 'company_id':'company', 'status':'registered'}
        self.calls = []
        self.runner.rpc = self.rpc

    def tearDown(self):
        self.context.close(); self.ledger.db.close(); self.temp.cleanup()

    def rpc(self, kind, payload=None):
        self.calls.append((kind, payload))
        if kind == 'DB_GET_INVITATION': return {'row':self.row.copy() if self.row else None}
        if kind == 'DB_GET_COMPANY_BY_ID': return {'company':{'company_id':'company'}}
        if kind == 'DB_MARK_STATUS':
            self.assertTrue(self.ledger.get(URL)['confirmed'], 'CRM marked before LinkedIn confirmation')
            self.row.update(status='invited', invited_at='2026-09-21T00:00:00Z')
            return {'ok':True}
        if kind == 'DB_SET_ACCEPTED_AT_NOW':
            self.assertTrue(payload['reconcile_existing_connection'])
            self.row.update(accepted=True, accepted_at=self.row.get('accepted_at') or 'observed',
                            invited_at=self.row.get('invited_at') or 'observed')
            if self.row['status'] not in ('first message sent', 'message responded'):
                self.row['status'] = 'accepted'
            return {'ok':True}
        raise AssertionError('Unexpected operation '+kind)

    def start_to_approval(self, dry=False):
        self.runner.command({'action':'start','dry':dry})
        for _ in range(40):
            self.runner.deadline = 0
            self.runner.tick()
            if self.runner.stage == 'approval' or not self.runner.current: break

    def approve(self):
        self.runner.command({'action':'approve','approval':self.runner.approval})

    def test_profile_loading_yields_and_can_pause(self):
        self.html = '<main>Still loading</main>'
        self.runner.command({'action':'start','dry':True})
        self.runner.tick()
        self.assertEqual(self.runner.stage, 'wait_profile')
        self.runner.tick()
        self.assertIn('Waiting for', self.runner.status)
        self.runner.command({'action':'pause'})
        self.assertFalse(self.runner.running)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def test_pause_during_random_review_stops_before_invitation(self):
        self.runner.command({'action':'start','dry':True})
        self.runner.tick(); self.runner.tick()
        self.assertEqual(self.runner.stage, 'browse')
        self.runner.tick()
        self.runner.command({'action':'pause'})
        self.assertFalse(self.runner.running)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def test_missing_profile_heading_explains_timeout(self):
        self.html = '<main>Still loading</main>'
        self.runner.command({'action':'start','dry':True})
        self.runner.tick()
        self.runner.deadline = 0
        with self.assertRaisesRegex(RuntimeError, 'profile heading was not found'):
            self.runner.tick()
        self.assertFalse(self.runner.profile_page.is_closed())

    def test_closed_profile_tab_explains_recovery(self):
        self.runner.command({'action':'start','dry':True})
        self.runner.tick()
        self.runner.profile_page.close()
        with self.assertRaisesRegex(RuntimeError, 'profile tab was closed'):
            self.runner.tick()

    def test_login_page_stops_before_actions(self):
        self.runner.command({'action':'start','dry':True})
        self.runner.tick()
        self.runner.profile_page.goto('https://www.linkedin.com/login')
        with self.assertRaisesRegex(RuntimeError, 'requires login or a security check'):
            self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def test_modern_h2_topcard_and_anchor_connect(self):
        self.html = fixture().replace('<h1>', '<h2>').replace('</h1>', '</h2>')
        self.html = self.html.replace('<h2>', '<a componentkey="topcard-logo-image-referencekey" href="'+URL+'">Photo</a><h2>', 1)
        self.html = self.html.replace('<button id="action">Connect</button>', '<a href="#" id="action">Connect</a>')
        self.html = self.html.replace('<main>', '<main><section>').replace('</main>', '</section></main>')
        self.start_to_approval(dry=True)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'dry_run')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(LinkedIn(self.runner.profile_page).connect_button().get_attribute('id'), 'action')

    def test_shadow_dialog_button_accepts_actual_inner_hit(self):
        page=self.context.new_page()
        page.set_content('<div id="host"></div>')
        page.evaluate("() => {window.clicks=0;const r=document.querySelector('#host').attachShadow({mode:'open'});r.innerHTML='<button><span>Send</span></button>';r.querySelector('button').onclick=()=>window.clicks++;}")
        LinkedIn(page).mouse(page.get_by_role('button',name='Send'))
        self.assertEqual(page.evaluate('window.clicks'),1)

    def test_shadow_dialog_real_overlay_still_blocks_click(self):
        page=self.context.new_page()
        page.set_content('<div id="host"></div>')
        page.evaluate("() => {window.clicks=0;const r=document.querySelector('#host').attachShadow({mode:'open'});r.innerHTML='<button><span>Send</span></button>';r.querySelector('button').onclick=()=>window.clicks++;document.body.insertAdjacentHTML('beforeend', '<div style=\"position:fixed;inset:0;z-index:999\">Overlay</div>');}")
        with self.assertRaisesRegex(RuntimeError,'covered by another element'):
            LinkedIn(page).mouse(page.get_by_role('button',name='Send'))
        self.assertEqual(page.evaluate('window.clicks'),0)

    def test_pending_reference_is_skip_no_click_no_crm_write(self):
        self.html = fixture('Pendente')
        self.start_to_approval()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'skipped_pending')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(self.calls, [('DB_GET_INVITATION', {'linkedin_url':URL})])

    def test_connected_is_skip(self):
        self.html = fixture().replace('>2nd<', '>1st<')
        self.start_to_approval()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'connected_reconciled')
        self.assertTrue(self.row['accepted'])
        self.assertTrue(self.row['invited_at'])
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)
        self.assertEqual(self.ledger.get(URL)['confirmed'], 0)

    def test_connected_dry_run_does_not_write(self):
        self.html = fixture().replace('>2nd<', '>1st<')
        self.start_to_approval(dry=True)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'dry_run')
        self.assertEqual(self.calls, [('DB_GET_INVITATION', {'linkedin_url':URL})])

    def modern_degree_fixture(self, degree, hidden=False):
        return fixture(more=True).replace('<html><body>', '<html><head><meta charset="utf-8"></head><body>').replace('<h1>Fixture Person</h1>',
            '<a componentkey="topcard-logo-image-referencekey"></a><div>'
            '<div data-view-name="profile-top-card-verified-badge"><div><h2>Fixture Person</h2></div></div>'
            f'<p{ " style=display:none" if hidden else "" }>\u00b7 {degree}</p></div>').replace('<span class="dist-value">2nd</span>', '')

    def test_modern_first_degree_reconciles_without_invitation(self):
        self.html = self.modern_degree_fixture('1\u00ba')
        self.start_to_approval()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'connected_reconciled')
        self.assertTrue(self.row['accepted'])
        self.assertTrue(self.row['invited_at'])
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def missing_company_fixture(self):
        self.row['company_id'] = None
        self.html = fixture().replace('<a href="https://www.linkedin.com/company/fixture/">Fixture Company</a>', '')
        self.html = self.html.replace('</main>', '<section><h2>Experience</h2><p>Developer</p><p>Jan 2020 - Present</p></section></main>')

    def test_crm_invited_skips_before_navigation_even_without_date_or_company(self):
        for dry in (True, False):
            with self.subTest(dry=dry):
                self.row.update(status='invited', invited_at=None, company_id=None)
                self.ledger.record(URL, 'queued', 'queued')
                self.runner.command({'action':'start', 'dry':dry})
                self.runner.tick()
                self.assertEqual(self.ledger.get(URL)['outcome'], 'skipped_crm')
                self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)
                self.assertIsNone(self.runner.profile_page)
                self.assertFalse(any(kind != 'DB_GET_INVITATION' for kind, _ in self.calls))

    def test_schedule_blocks_navigation_outside_hours(self):
        clock = datetime(2026,9,26,10,tzinfo=SAO_PAULO).timestamp()
        self.runner.scheduler = Scheduler(self.ledger, lambda: clock)
        self.runner.command({'action':'start','dry':True})
        with self.assertRaises(ScheduleWait) as caught: self.runner.tick()
        self.runner.defer(caught.exception)
        self.assertIsNone(self.runner.profile_page)
        self.assertIn('Outside working hours', self.runner.status)
        self.runner.command({'action':'pause'})
        self.assertFalse(self.runner.running)

    def test_reading_pause_interrupts_without_followup_navigation(self):
        self.runner.running = True
        self.ui.commands = [{'action':'pause'}]
        with self.assertRaises(ReviewInterrupted): Runner.relax(self.runner,30,'Reading company')
        self.assertFalse(self.runner.running)
        with self.assertRaises(ReviewInterrupted): self.runner.before_navigation(URL)
        self.assertEqual(self.ledger.get(URL)['send_attempted'],0)

    def test_schedule_rechecks_budget_before_send_intent(self):
        self.start_to_approval(); self.approve()
        clock = datetime(2026,9,22,10,tzinfo=SAO_PAULO).timestamp()
        self.runner.scheduler = Scheduler(self.ledger, lambda: clock)
        for i in range(10): self.runner.scheduler.record('invite', str(i))
        with self.assertRaises(ScheduleWait): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'],0)
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'),0)

    def test_warning_persists_hold_and_blocks_restart(self):
        page = self.context.new_page()
        page.goto(URL)
        page.set_content('<main>Your account has been temporarily restricted</main>')
        with self.assertRaisesRegex(RuntimeError,'Queue stopped'): self.runner.check_warning(page)
        self.assertTrue(self.ledger.meta('execution_hold'))
        with self.assertRaisesRegex(RuntimeError,'acknowledge'): self.runner.command({'action':'start','dry':True})
        self.runner.command({'action':'clear_hold'})
        self.assertFalse(self.runner.running)
        self.assertFalse(self.ledger.meta('execution_hold'))

    def test_navigation_reserves_profile_and_company_in_dry_run(self):
        clock = datetime(2026,9,22,10,tzinfo=SAO_PAULO).timestamp()
        self.runner.scheduler = Scheduler(self.ledger, lambda: clock)
        page = self.context.new_page()
        self.runner.navigate(page,URL)
        self.runner.navigate(page,'https://www.linkedin.com/company/fixture/')
        self.assertEqual(self.runner.scheduler.state()['used'],dict(invite=0,profile=1,company=1))

    def test_missing_company_dry_run_continues_without_writes(self):
        self.missing_company_fixture()
        self.start_to_approval(dry=True)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'dry_run')
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)
        self.assertTrue(any('Continuing without company' in e for e in self.ledger.events()))
        self.assertTrue(all(kind == 'DB_GET_INVITATION' for kind, _ in self.calls))

    def test_missing_company_send_confirms_before_crm(self):
        self.missing_company_fixture()
        self.start_to_approval()
        self.assertEqual(self.runner.stage, 'approval')
        self.approve()
        for _ in range(15):
            self.runner.tick()
            if self.ledger.get(URL)['outcome'] == 'invited': break
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')
        self.assertEqual(self.ledger.get(URL)['confirmed'], 1)
        self.assertIsNone(self.row['company_id'])

    def test_missing_company_does_not_allow_deleted_person(self):
        self.missing_company_fixture()
        self.start_to_approval()
        self.approve()
        self.row = None
        with self.assertRaisesRegex(RuntimeError, 'prerequisite changed'):
            self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def test_modern_degree_ignores_hidden_and_unrelated_first_degree(self):
        for degree, hidden in [('2\u00ba', False), ('1\u00ba', True)]:
            with self.subTest(degree=degree, hidden=hidden):
                self.html = self.modern_degree_fixture(degree, hidden).replace('Recommended person', 'Recommended person \u00b7 1\u00ba')
                page = self.context.new_page()
                page.goto(URL)
                self.assertEqual(LinkedIn(page).inspect(URL)['state'], 'more')
                page.close()

    def test_modern_first_degree_dry_run_does_not_write(self):
        self.html = self.modern_degree_fixture('1\u00ba')
        self.start_to_approval(dry=True)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'dry_run')
        self.assertEqual(self.calls, [('DB_GET_INVITATION', {'linkedin_url':URL})])

    def test_verified_name_extra_wrappers_still_detect_first_degree(self):
        for count in (1, 3):
            with self.subTest(wrappers=count):
                self.html = self.modern_degree_fixture('1\u00ba').replace(
                    '<div data-view-name="profile-top-card-verified-badge">',
                    '<div>' * count + '<div data-view-name="profile-top-card-verified-badge">').replace(
                    '<p>\u00b7 1\u00ba</p>', '</div>' * count + '<p>\u00b7 1\u00ba</p>')
                page = self.context.new_page(); page.goto(URL)
                self.assertEqual(LinkedIn(page).inspect(URL)['state'], 'connected')
                page.close()

    def test_degree_search_stops_before_unrelated_header_text(self):
        self.html = self.modern_degree_fixture('1\u00ba').replace(
            '<h2>Fixture Person</h2>', '<h2>Fixture Person</h2><p>Profile headline</p>')
        page = self.context.new_page(); page.goto(URL)
        self.assertEqual(LinkedIn(page).inspect(URL)['state'], 'more')
        page.close()

    def test_pacing_deadline_persists_and_has_one_to_ten_second_bounds(self):
        from unittest.mock import patch
        with patch('main.time.time', return_value=1000), patch('main.random.uniform', return_value=7) as choose:
            self.runner.reserve_invitation_interval()
            choose.assert_called_once_with(1, 10)
            self.assertEqual(self.ledger.meta('next_invitation_at'), 1007)
            self.assertFalse(Runner.pacing_ready(self.runner))
        with patch('main.time.time', return_value=1007):
            self.assertTrue(Runner.pacing_ready(self.runner))

    def test_cooldown_blocks_connect_until_due(self):
        self.start_to_approval(); self.approve()
        self.runner.pacing_ready = lambda: Runner.pacing_ready(self.runner)
        self.ledger.meta('next_invitation_at', time.time()+10)
        self.runner.tick()
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)
        self.runner.command({'action':'pause'})
        self.assertFalse(self.runner.running)

    def test_dry_run_never_clicks_or_writes(self):
        self.start_to_approval(dry=True)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'dry_run')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertFalse(any(c[0] == 'DB_MARK_STATUS' for c in self.calls))

    def test_live_requires_approval_and_confirms_before_crm(self):
        self.start_to_approval()
        self.assertEqual(self.runner.stage, 'approval')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.approve()
        for _ in range(5): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 1)

    def request_batch(self):
        self.runner.linkedin_session = lambda: 'fixture-session'
        self.runner.command({'action':'start','dry':False,'batch':True})
        self.assertFalse(self.runner.running)
        self.assertIsNone(self.runner.profile_page)
        return self.runner.batch_request['nonce']

    def approve_batch(self, nonce):
        self.runner.command({'action':'approve_batch','dry':False,'batch_nonce':nonce})

    def test_batch_two_recipients_require_only_one_approval(self):
        with self.ledger.db:
            self.ledger.db.execute("INSERT INTO profiles SELECT ?,1,step,outcome,error,send_attempted,confirmed,updated_at FROM profiles WHERE url=?", (NEXT,URL))
        nonce = self.request_batch()
        self.assertEqual(self.runner.batch_request['urls'], [URL,NEXT])
        self.approve_batch(nonce)
        for _ in range(100):
            next_row = self.runner.current or self.ledger.next()
            if next_row and self.row['linkedin_url'] != next_row['url']:
                self.row = {'id':'fixture-next','linkedin_url':next_row['url'],'full_name':'Fixture Person','company_id':'company','status':'registered'}
            self.runner.deadline = 0
            self.runner.tick()
            self.assertIsNone(self.runner.approval)
            if not self.runner.running: break
        self.assertEqual([r['outcome'] for r in self.ledger.rows()], ['invited','invited'])
        self.assertIsNone(self.runner.approved_batch)

    def test_batch_pause_revokes_and_restart_has_no_approval(self):
        self.approve_batch(self.request_batch())
        self.runner.command({'action':'pause'})
        self.assertIsNone(self.runner.approved_batch)
        self.assertFalse(self.runner.running)
        self.assertIsNone(Runner(self.context,self.ui,self.ledger).approved_batch)

    def test_batch_selection_changed_before_approval_blocks(self):
        nonce = self.request_batch()
        self.ledger.record(URL,'skip','skipped_user')
        with self.assertRaisesRegex(RuntimeError,'recipient list changed'): self.approve_batch(nonce)
        self.assertFalse(self.runner.running)

    def test_batch_session_change_and_expiry_block_before_click(self):
        self.approve_batch(self.request_batch())
        self.runner.linkedin_session = lambda: 'different-session'
        with self.assertRaisesRegex(RuntimeError,'session changed'): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'],0)
        self.runner.linkedin_session = lambda: 'fixture-session'
        self.runner.approved_batch['expires']=0
        with self.assertRaisesRegex(RuntimeError,'expired'): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'],0)

    def test_batch_ambiguous_send_remains_blocked(self):
        self.html = fixture(confirm=False)
        self.approve_batch(self.request_batch())
        for _ in range(40):
            self.runner.deadline=0
            if self.runner.stage == 'confirm': break
            self.runner.tick()
        self.runner.deadline=0
        with self.assertRaisesRegex(RuntimeError,'No LinkedIn Pending'): self.runner.tick()
        self.assertIsNone(self.ledger.next())
        self.assertFalse(any(c[0]=='DB_MARK_STATUS' for c in self.calls))

    def test_more_connect_path(self):
        self.html = fixture(more=True)
        self.start_to_approval(); self.approve()
        for _ in range(6): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')

    def test_connect_in_lower_topcard_prompt(self):
        # Follow/Message/More above, with Connect in a separate prompt in the
        # same person's top card. Recommended profiles remain out of scope.
        self.html = fixture().replace('<button id="action">Connect</button>',
            '<div><button>Follow</button><button>Send message</button><button>More</button></div>'
            '<aside><p>Connect if you know each other</p><button id="action">Connect</button></aside>')
        self.start_to_approval()
        self.assertEqual(self.runner.evidence['state'], 'connect')
        self.approve()
        for _ in range(5): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 1)

    def test_connect_can_send_immediately(self):
        self.html = fixture(direct=True)
        self.start_to_approval(); self.approve()
        self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 1)
        self.runner.tick(); self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')

    def test_ambiguous_send_never_marks_crm_and_restart_blocks(self):
        self.html = fixture(confirm=False)
        self.start_to_approval(); self.approve()
        self.runner.tick(); self.runner.tick()
        self.runner.deadline = 0
        with self.assertRaisesRegex(RuntimeError, 'No LinkedIn Pending'): self.runner.tick()
        self.assertFalse(any(c[0] == 'DB_MARK_STATUS' for c in self.calls))
        self.assertIsNone(self.ledger.next())

    def test_wrong_dialog_recipient_blocks_final_send(self):
        self.html = fixture(recipient='Another Person')
        self.start_to_approval(); self.approve(); self.runner.tick()
        with self.assertRaisesRegex(RuntimeError, 'recipient'): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['confirmed'], 0)

    def test_email_required_blocks_send(self):
        self.html = fixture(email=True)
        self.start_to_approval(); self.approve(); self.runner.tick()
        with self.assertRaisesRegex(RuntimeError, 'email address'): self.runner.tick()

    def test_pause_queued_during_read_prevents_click(self):
        self.start_to_approval(); self.approve()
        self.ui.commands.append({'action':'pause'})
        self.runner.tick()
        self.assertFalse(self.runner.running)
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)
        self.assertEqual(self.ledger.get(URL)['send_attempted'], 0)

    def test_pause_between_connect_and_send_blocks_followup(self):
        self.start_to_approval(); self.approve(); self.runner.tick()
        self.runner.command({'action':'pause'})
        self.assertEqual(self.ledger.get(URL)['outcome'], 'ambiguous')
        self.runner.command({'action':'start','dry':False}); self.runner.tick()
        self.assertFalse(self.runner.running)
        self.assertFalse(any(c[0] == 'DB_MARK_STATUS' for c in self.calls))

    def test_crm_failure_after_confirm_does_not_resend(self):
        self.start_to_approval(); self.approve(); self.runner.tick(); self.runner.tick(); self.runner.tick()
        real_rpc = self.runner.rpc
        self.runner.rpc = lambda kind,payload=None: (_ for _ in ()).throw(RuntimeError('CRM unavailable')) if kind == 'DB_MARK_STATUS' else real_rpc(kind,payload)
        with self.assertRaisesRegex(RuntimeError, 'CRM unavailable'): self.runner.tick()
        self.assertEqual(self.ledger.get(URL)['confirmed'], 1)
        self.assertIsNone(self.ledger.next())
        self.runner.rpc = real_rpc
        self.runner.sync_confirmed(URL)
        self.assertEqual(self.ledger.get(URL)['outcome'], 'invited')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 1)

    def test_stale_approval_rejected(self):
        self.start_to_approval()
        self.runner.approval['expires'] = 0
        with self.assertRaisesRegex(RuntimeError, 'expired'): self.approve()

    def test_duplicate_connect_controls_fail_closed(self):
        self.html = fixture().replace('<button id="action">', '<button>Connect</button><button id="action">')
        with self.assertRaisesRegex(RuntimeError, 'No unique'): self.start_to_approval()

    def test_dry_rpc_boundary_blocks_all_writes(self):
        with self.assertRaisesRegex(RuntimeError, 'Dry-run blocked'):
            Runner.rpc(self.runner, 'DB_MARK_STATUS', {'linkedin_url':URL, 'status':'invited'})

    def test_owner_switch_blocks_start(self):
        self.ledger.meta('owner', 'another-owner')
        with self.assertRaisesRegex(RuntimeError, 'different LEF account'):
            self.runner.command({'action':'start','dry':True})

    def load_ui(self, campaign):
        # Exercise real iframe controls and the extension's existing query builder.
        with self.ledger.db:
            self.ledger.db.execute('DELETE FROM profiles')
        source = (Path(__file__).resolve().parents[1] / 'src/popup/core/state-rendering.js').read_text(encoding='utf-8')
        builder = 'function buildOverviewQueryState()' + source.split('function buildOverviewQueryState()', 1)[1].split('\n}', 1)[0] + '\n}'
        frame_html = '''<button id="tabOverviewBtn">Contacts</button><button id="listPersonsTabBtn">Persons</button>
          <select id="filterCampaign"><option value="">All campaigns</option>
          <option value="campaign-uuid" data-campaign-name="''' + html.escape(campaign, quote=True) + '''" selected>Selected campaign</option></select>
          <select id="overviewArchivedFilter"><option value="" selected>All</option><option value="0">0</option></select>
          <script>const filterCampaignEl=document.getElementById('filterCampaign');
          const overviewFilters={campaign:'campaign-uuid',archived:'',status:'registered',accepted:'false'};
          const overviewPage=1,overviewPageSize=25,overviewSortField='most_relevant_date',overviewSortDir='desc',overviewSearch='Test';
          ''' + builder + '</script>'
        page = self.context.new_page()
        page.set_content('<script>window.lefCommands=[];window.lefRender=()=>{};</script><iframe id="crm"></iframe>')
        page.frames[1].set_content(frame_html)
        self.runner.ui = page
        self.runner.owner = lambda: 'owner'
        def overview(kind, payload=None):
            self.calls.append((kind,payload))
            self.assertEqual(kind, 'DB_LIST_INVITATIONS_OVERVIEW')
            entries = [URL, NEXT]
            return {'rows':[{'url':u} for u in entries], 'total':2}
        self.runner.rpc = overview
        return page

    def test_load_uses_actual_selected_campaign_and_preserves_filters(self):
        page = self.load_ui('HDI EXPERIENCE 26')
        self.runner.load(URL)
        query = self.ledger.meta('query')
        self.assertEqual(query['filters'], {'campaign':'HDI EXPERIENCE 26', 'archived':'', 'status':'registered', 'accepted':'false'})
        self.assertEqual(query['search'], 'Test')
        self.assertEqual(query['sortDir'], 'desc')
        self.assertEqual(page.frames[1].locator('#overviewArchivedFilter').input_value(), '')
        self.assertEqual(page.frames[1].locator('#filterCampaign').input_value(), 'campaign-uuid')
        self.assertEqual(self.ledger.next()['url'], NEXT)
        self.assertIn('HDI EXPERIENCE 26', self.runner.status)
        self.assertEqual(len(self.calls), 1)
        self.assertEqual(self.calls[0][1]['page'], 1)
        self.assertEqual(self.calls[0][1]['pageSize'], 10000)

    def test_load_rejects_server_truncation_without_saving(self):
        self.load_ui('Selected campaign')
        self.runner.rpc = lambda *args: {'rows':[{'url':URL}], 'total':189}
        with self.assertRaisesRegex(RuntimeError, '1 of 189'):
            self.runner.load('')
        self.assertEqual(self.ledger.rows(), [])
        self.assertEqual(self.ledger.meta('last_load_diagnostic')['returned'], 1)

    def test_load_rejects_duplicate_response_without_blame(self):
        self.load_ui('Selected campaign')
        self.runner.rpc = lambda *args: {'rows':[{'url':URL},{'url':URL}], 'total':2}
        with self.assertRaisesRegex(RuntimeError, 'duplicate profile URLs'):
            self.runner.load('')
        self.assertEqual(self.ledger.rows(), [])

    def test_load_preserves_response_order_not_alphabetical_order(self):
        self.load_ui('Selected campaign')
        self.runner.rpc = lambda *args: {'rows':[{'url':NEXT},{'url':URL}], 'total':2}
        self.runner.load('')
        self.assertEqual([r['url'] for r in self.ledger.rows()], [NEXT,URL])

    def test_load_uses_other_selected_campaign_without_name_assumptions(self):
        self.load_ui('Different selected campaign')
        self.runner.load('')
        self.assertEqual(self.ledger.meta('query')['filters']['campaign'], 'Different selected campaign')

    def test_load_without_specific_campaign_never_queries_all_contacts(self):
        page = self.load_ui('HDI EXPERIENCE 26')
        page.frames[1].locator('#filterCampaign').select_option('')
        with self.assertRaisesRegex(RuntimeError, 'Choose a campaign in the Recipients list'):
            self.runner.load('')
        self.assertEqual(self.calls, [])
        self.assertEqual(self.ledger.rows(), [])

    def test_skip_pre_send_advances_without_click(self):
        self.start_to_approval()
        self.runner.command({'action':'skip'})
        self.assertEqual(self.ledger.get(URL)['outcome'], 'skipped_user')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def test_expiry_during_read_blocks_click(self):
        self.start_to_approval(); self.approve()
        def delayed_read(url):
            self.runner.approved_at -= 61
            return self.row
        self.runner.person_read = delayed_read
        with self.assertRaisesRegex(RuntimeError, 'expired during'): self.runner.tick()
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def experience_fixture(self, company_link='https://www.linkedin.com/company/fixture/'):
        original = '<a href="https://www.linkedin.com/company/fixture/">Fixture Company</a>'
        control = '<div role="button" onclick="document.getElementById(&quot;experience&quot;).scrollIntoView()"><svg></svg>Fixture Company</div>'
        self.html = fixture().replace(original, control).replace('</main>',
            '<section id="experience"><h2>Experience</h2><a href="'+company_link+'">Fixture Company<br>2 years</a>'
            '<a href="https://www.linkedin.com/company/previous/">Previous employer</a></section>'
            '<section><h2>Recommendations</h2><a href="https://www.linkedin.com/company/wrong/">Fixture Company</a></section></main>')

    def test_company_navigation_matches_experience_not_recommendations(self):
        self.experience_fixture()
        self.runner.command({'action':'start','dry':True});self.runner.tick();self.runner.tick()
        li=LinkedIn(self.runner.profile_page)
        evidence=li.inspect(URL)
        self.assertEqual(li.company_url(evidence), 'https://www.linkedin.com/company/fixture/')
        self.assertEqual(evidence['employer_name'], 'Fixture Company')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def test_header_company_precedes_older_experience(self):
        self.experience_fixture()
        self.html=self.html.replace('Previous employer</a>', 'Founder<br>Previous employer<br>Jan 2000 - Present</a>')
        page=self.context.new_page();page.goto(URL)
        li=LinkedIn(page);evidence=li.inspect(URL)
        self.assertEqual(li.company_url(evidence),'https://www.linkedin.com/company/fixture/')
        self.assertEqual(evidence['employer_source'],'Profile header')
        page.close()

    def test_missing_experience_preview_uses_same_profile_details(self):
        self.html=fixture().replace('<a href="https://www.linkedin.com/company/fixture/">Fixture Company</a>',
                                  '<div role="button"><svg></svg>Fixture Company</div>')
        self.context.route(URL+'details/experience/', lambda r:r.fulfill(content_type='text/html',
            body='<main><a href="https://www.linkedin.com/company/fixture/">Fixture Company<br>2 years</a></main>'))
        page=self.context.new_page();page.goto(URL)
        li=LinkedIn(page);evidence=li.inspect(URL)
        self.assertEqual(li.company_url(evidence),'https://www.linkedin.com/company/fixture/')
        self.assertEqual(page.url,URL)
        self.assertEqual(evidence['employer_source'],'Profile header')
        page.close()

    def test_school_header_falls_back_to_active_experience(self):
        self.experience_fixture()
        self.html=self.html.replace('<svg></svg>Fixture Company</div>', '<svg></svg>Example School</div>').replace(
            'Fixture Company<br>2 years', 'Director<br>Fixture Company<br>Jan 2020 - Present')
        page=self.context.new_page();page.goto(URL)
        li=LinkedIn(page);evidence=li.inspect(URL)
        self.assertEqual(li.company_url(evidence),'https://www.linkedin.com/company/fixture/')
        self.assertEqual(evidence['employer_start'],'2020-01')
        self.assertTrue(evidence['employer_source'].startswith('Experience'))
        page.close()

    def test_company_experience_role_title_and_employment_suffix(self):
        self.experience_fixture()
        self.html=self.html.replace('Fixture Company<br>2 years', 'Support manager<br>Fixture Company &middot; Full-time<br>2 years')
        self.runner.command({'action':'start','dry':True});self.runner.tick();self.runner.tick()
        li=LinkedIn(self.runner.profile_page)
        self.assertEqual(li.company_url(li.inspect(URL)), 'https://www.linkedin.com/company/fixture/')
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def test_company_suffix_match_does_not_accept_name_prefix(self):
        self.experience_fixture()
        self.html=self.html.replace('Fixture Company<br>2 years', 'Fixture Company Holdings &middot; Full-time<br>2 years')
        self.runner.command({'action':'start','dry':True});self.runner.tick();self.runner.tick()
        li=LinkedIn(self.runner.profile_page)
        with self.assertRaisesRegex(RuntimeError, 'no unique company-page link matching'):
            li.company_url(li.inspect(URL))

    def test_company_navigation_rejects_different_experience_employer(self):
        self.experience_fixture()
        self.html=self.html.replace('Fixture Company<br>', 'Different employer<br>')
        self.runner.command({'action':'start','dry':True});self.runner.tick();self.runner.tick()
        li=LinkedIn(self.runner.profile_page)
        with self.assertRaisesRegex(RuntimeError, 'no unique company-page link matching'):
            li.company_url(li.inspect(URL))

    def test_company_numeric_redirect_reuses_existing_company(self):
        self.experience_fixture('https://www.linkedin.com/company/914294/')
        self.row.pop('company_id')
        self.context.route('**/company/914294/',lambda r:r.fulfill(status=302,headers={'location':'https://www.linkedin.com/company/fixture/'}))
        self.runner.extract=lambda page,kind: {'company':{'linkedin_id':'https://www.linkedin.com/company/fixture/','company_name':'Fixture Company'}}
        original=self.rpc
        def crm(kind,payload=None):
            if kind=='DB_GET_COMPANY_BY_LINKEDIN_ID':
                return {'company':{'company_id':'existing','company_name':'Fixture Company'} if payload['linkedin_id'].endswith('/fixture/') else None}
            if kind=='DB_CONFIRM_COMPANY_LINK':
                self.row['company_id']=payload['company_id'];return {'ok':True}
            return original(kind,payload)
        self.runner.rpc=crm
        self.start_to_approval()
        self.assertEqual(self.runner.stage,'approval')
        self.assertEqual(self.row['company_id'],'existing')
        self.assertFalse(any(c[0]=='DB_UPSERT_COMPANY_PROFILE' for c in self.calls))

    def test_missing_person_company_created_and_link_verified(self):
        self.row = None
        company = None
        self.runner.extract = lambda page,kind: {'profile':{'url':URL, 'name':'Fixture Person'}} if kind == 'EXTRACT_PROFILE_CONTEXT' else {
            'company':{'linkedin_id':'https://www.linkedin.com/company/fixture/', 'company_name':'Fixture Company'}}
        original = self.rpc
        def crm(kind, payload=None):
            nonlocal company
            if kind == 'DB_GET_COMPANY_BY_LINKEDIN_ID': return {'company':company}
            if kind == 'DB_SEARCH_COMPANIES': return {'companies':[]}
            if kind == 'DB_UPSERT_GENERATED':
                self.calls.append((kind,payload))
                self.row = {'id':'created','linkedin_url':URL,'full_name':payload['full_name']}
                return {'ok':True}
            if kind == 'DB_UPSERT_COMPANY_PROFILE':
                self.calls.append((kind,payload))
                self.assertNotIn('company_page_excerpt', payload)
                company = {'company_id':'new-company', 'company_name':payload['company_name']}
                return {'company':company}
            if kind == 'DB_CONFIRM_COMPANY_LINK':
                self.calls.append((kind,payload)); self.row['company_id'] = payload['company_id']
                return {'ok':True}
            return original(kind,payload)
        self.runner.rpc = crm
        self.start_to_approval()
        self.assertEqual(self.runner.stage, 'approval')
        self.assertEqual(self.row['company_id'], 'new-company')
        self.assertEqual([c[0] for c in self.calls if c[0].startswith(('DB_UPSERT','DB_CONFIRM'))],
                         ['DB_UPSERT_GENERATED','DB_UPSERT_COMPANY_PROFILE','DB_CONFIRM_COMPANY_LINK'])
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def test_unverified_company_link_blocks_invitation(self):
        self.row.pop('company_id')
        original = self.rpc
        def crm(kind,payload=None):
            if kind == 'DB_GET_COMPANY_BY_LINKEDIN_ID': return {'company':{'company_id':'c','company_name':'Fixture Company'}}
            if kind == 'DB_CONFIRM_COMPANY_LINK': return {'ok':True}  # legacy minimal response, no changed row
            return original(kind,payload)
        self.runner.rpc = crm
        with self.assertRaisesRegex(RuntimeError, 'link could not be verified'): self.start_to_approval()
        self.assertEqual(self.runner.profile_page.evaluate('window.clicks'), 0)

    def test_redirect_blocks_profile(self):
        self.start_to_approval(); self.approve()
        self.runner.profile_page.goto(NEXT)
        with self.assertRaisesRegex(RuntimeError, 'redirected or profile changed'): self.runner.tick()

    def test_unknown_layout_never_uses_recommendation_connect(self):
        self.html = fixture('Follow')
        with self.assertRaisesRegex(RuntimeError, 'No unique'): self.start_to_approval()

    def test_note_not_approved_blocks_send(self):
        self.start_to_approval(); self.approve(); self.runner.tick()
        self.runner.profile_page.locator('[role=dialog]').evaluate('e=>e.insertAdjacentHTML("beforeend","<textarea>Unapproved note</textarea>")')
        with self.assertRaisesRegex(RuntimeError, 'Unexpected invitation note'): self.runner.tick()

    def test_later_crm_state_never_downgraded(self):
        self.ledger.record(URL, 'confirmation', 'confirmed', attempted=1, confirmed=1)
        self.row.update(status='accepted', accepted=True)
        self.runner.sync_confirmed(URL)
        self.assertFalse(any(c[0] == 'DB_MARK_STATUS' for c in self.calls))


if __name__ == '__main__':
    unittest.main(verbosity=2)
