import tempfile, unittest
from pathlib import Path
from datetime import datetime
from ledger import Ledger
from scheduler import Scheduler, ScheduleWait, SAO_PAULO, DEFAULTS

class ScheduleTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.path=Path(self.temp.name)/'journal.db'
        self.ledger=Ledger(self.path)
        self.now=datetime(2026,9,22,10,tzinfo=SAO_PAULO).timestamp()
        self.s=Scheduler(self.ledger,lambda:self.now)
    def tearDown(self):
        self.ledger.db.close();self.temp.cleanup()
    def test_rolling_limit_ages_individually_not_at_midnight(self):
        for i in range(10): self.s.record('invite',str(i));self.now+=60
        with self.assertRaises(ScheduleWait) as caught:self.s.due('invite')
        self.assertEqual(caught.exception.until,datetime(2026,9,23,10,tzinfo=SAO_PAULO).timestamp())
        self.now=caught.exception.until;self.s.due('invite')
        self.assertEqual(len(self.s.usage('invite')),9)
    def test_attempts_and_settings_survive_restart(self):
        self.s.save({**DEFAULTS,'invites':15})
        self.s.record('invite','ambiguous');self.s.record('profile','dryrun')
        self.ledger.db.close();self.ledger=Ledger(self.path);self.s=Scheduler(self.ledger,lambda:self.now)
        self.assertEqual(self.s.settings['invites'],15)
        self.assertEqual(self.s.state()['used'],dict(invite=1,profile=1,company=0))
    def test_spacing_no_catchup_and_current_person_does_not_delay_own_send(self):
        self.s.record('person_start','a');self.s.due('invite',spacing=True)
        self.s.record('invite','a')
        with self.assertRaises(ScheduleWait):self.s.due('profile',spacing=True)
        self.now+=7200;self.s.due('profile',spacing=True);self.s.record('person_start','b')
        with self.assertRaises(ScheduleWait) as c:self.s.due('profile',spacing=True)
        self.assertEqual(c.exception.until,self.now+1800)
    def test_weekend_and_workday_expiry(self):
        self.now=datetime(2026,9,25,17,tzinfo=SAO_PAULO).timestamp()
        with self.assertRaises(ScheduleWait) as c:self.s.due('profile')
        self.assertEqual(datetime.fromtimestamp(c.exception.until,SAO_PAULO).isoformat(),'2026-09-28T09:00:00-03:00')
        with self.assertRaises(ScheduleWait):self.s.approval_end()
    def test_browsing_counts_failures_and_dry_run_separately(self):
        self.s.save({**DEFAULTS,'profiles':1,'companies':1})
        self.s.visit('https://www.linkedin.com/in/a/')
        with self.assertRaises(ScheduleWait):self.s.visit('https://www.linkedin.com/in/a/details/experience/')
        self.s.visit('https://www.linkedin.com/company/a/')
        self.assertEqual(self.s.state()['used'],dict(invite=0,profile=1,company=1))
    def test_hold_survives_restart_and_never_expires_automatically(self):
        self.ledger.meta('execution_hold','restriction')
        self.now+=86400*10
        with self.assertRaisesRegex(RuntimeError,'warning stop'):Scheduler(self.ledger,lambda:self.now).due('invite')
    def test_invalid_settings_do_not_replace_valid_ones(self):
        for patch in [{'days':[]},{'gap_minutes':0},{'end':'08:00'},{'profiles':True}]:
            with self.assertRaises(ValueError):self.s.save({**DEFAULTS,**patch})
        self.assertEqual(self.s.settings,DEFAULTS)
    def test_historical_ambiguous_attempt_imported_once(self):
        self.ledger.snapshot(['https://www.linkedin.com/in/a/'],'owner')
        self.ledger.record('https://www.linkedin.com/in/a/','connect_intent','ambiguous',attempted=1)
        self.ledger.meta('activity_budget_imported',False)
        s=Scheduler(self.ledger)
        Scheduler(self.ledger)
        self.assertEqual(s.state()['used']['invite'],1)

    def test_review_pace_scales_with_workday_and_volume(self):
        pace = self.s.review_pace()
        self.assertEqual(pace['profile_seconds'],144)
        self.assertEqual(pace['company_seconds'],24)
        self.s.save({**DEFAULTS,'invites':15})
        self.assertLess(self.s.review_pace()['profile_seconds'],pace['profile_seconds'])
        self.s.save({**DEFAULTS,'invites':1})
        self.assertEqual(self.s.review_pace()['profile_seconds'],180)
        from linkedin import LinkedIn
        plan = LinkedIn.review_plan(144)
        self.assertAlmostEqual(sum(x[2] for x in plan),144)
        self.assertTrue(all(x[2] > 0 for x in plan))

    def test_window_switch_recounts_all_kinds_without_erasing_history(self):
        self.now -= 13*3600
        for kind in ('invite','profile','company'):
            for i in range(30): self.s.record(kind,str(i))
        self.now += 13*3600
        with self.assertRaises(ScheduleWait): self.s.due('invite')
        self.s.save({**DEFAULTS,'window_hours':12})
        self.s.due('invite')
        self.assertEqual(self.s.state()['used'],dict(invite=0,profile=0,company=0))
        self.ledger.db.close();self.ledger=Ledger(self.path)
        self.s=Scheduler(self.ledger,lambda:self.now)
        self.assertEqual(self.s.settings['window_hours'],12)
        self.s.save({**DEFAULTS,'window_hours':24})
        self.assertEqual(self.s.state()['used'],dict(invite=30,profile=30,company=30))

    def test_twelve_hour_exact_boundary_and_validation(self):
        self.s.save({**DEFAULTS,'window_hours':12})
        self.now -= 12*3600
        self.s.record('invite','old')
        self.now += 12*3600
        self.assertEqual(self.s.usage('invite'),[])
        for value in (0,13,True,'12'):
            with self.assertRaises(ValueError): self.s.save({**DEFAULTS,'window_hours':value})

    def test_start_estimate_recalculates_window_and_dry_mode_without_writes(self):
        self.now -= 13*3600
        for i in range(10): self.s.record('invite',str(i))
        self.now += 13*3600
        before = self.db_rows()
        self.assertGreater(self.s.start_estimate(False)['at'],self.now)
        self.assertEqual(self.s.start_estimate(True)['reason'],'Ready now')
        self.s.save({**DEFAULTS,'window_hours':12})
        self.assertEqual(self.s.start_estimate(False),{'at':self.now,'reason':'Ready now'})
        self.assertEqual(self.db_rows(),before)
        self.ledger.meta('execution_hold','Warning')
        self.assertIsNone(self.s.start_estimate(False)['at'])

    def db_rows(self):
        return list(self.ledger.db.execute('select * from activity_budget'))

if __name__=='__main__':unittest.main()
