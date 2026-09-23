import tempfile,unittest
from pathlib import Path
from ledger import Ledger
from main import Runner

class Exclusions(unittest.TestCase):
 def test_company_exclusion_invalidates_approval_and_requires_pause(self):
  with tempfile.TemporaryDirectory() as temp:
   ledger=Ledger(Path(temp)/'progress.db')
   urls=['https://www.linkedin.com/in/'+s+'/' for s in ['a','b','c']]
   ledger.snapshot(urls,'owner')
   ledger.meta('recipient_details',{urls[0]:{'company':'Acme','company_id':'1'},urls[1]:{'company':'ACME'},urls[2]:{'company':'Elsewhere','company_id':'2'}})
   runner=object.__new__(Runner);runner.ledger=ledger;runner.running=True
   with self.assertRaisesRegex(RuntimeError,'Pause'):runner.command({'action':'exclude_company','url':urls[0]})
   self.assertEqual(ledger.next()['url'],urls[0])
   runner.running=False;runner.approved_batch={'old':'approval'}
   runner.command({'action':'exclude_company','url':urls[0]})
   self.assertEqual(runner.eligible_urls(),[urls[2]])
   self.assertIsNone(runner.approved_batch)
   runner.command({'action':'restore_person','url':urls[0]})
   self.assertEqual(runner.eligible_urls(),[urls[0],urls[2]])
   ledger.db.close()
 def test_persistent_reversible_and_preserves_bookmark(self):
  with tempfile.TemporaryDirectory() as temp:
   path=Path(temp)/'progress.db';ledger=Ledger(path)
   urls=['https://www.linkedin.com/in/a/','https://www.linkedin.com/in/b/']
   ledger.snapshot(urls,'owner');ledger.meta('last_processed_url','previous')
   self.assertEqual(ledger.exclude([urls[0]]),1)
   self.assertEqual(ledger.next()['url'],urls[1])
   self.assertEqual(ledger.meta('last_processed_url'),'previous')
   ledger.review_dry();ledger.db.close();ledger=Ledger(path)
   self.assertEqual(ledger.get(urls[0])['outcome'],'skipped_manual')
   self.assertEqual(ledger.exclude([urls[0]],restore=True),1)
   self.assertEqual(ledger.next()['url'],urls[0]);ledger.db.close()
 def test_attempted_and_confirmed_cannot_be_excluded_or_restored(self):
  with tempfile.TemporaryDirectory() as temp:
   ledger=Ledger(Path(temp)/'progress.db');url='https://www.linkedin.com/in/a/'
   ledger.snapshot([url],'owner');ledger.record(url,'send','ambiguous',attempted=True)
   self.assertEqual(ledger.exclude([url]),0)
   self.assertEqual(ledger.exclude([url],restore=True),0)
   self.assertEqual(ledger.get(url)['outcome'],'ambiguous');ledger.db.close()
 def test_dry_run_restore_preserves_original_outcome(self):
  with tempfile.TemporaryDirectory() as temp:
   ledger=Ledger(Path(temp)/'progress.db');url='https://www.linkedin.com/in/a/'
   ledger.snapshot([url],'owner');ledger.record(url,'checked','dry_run')
   ledger.exclude([url]);ledger.exclude([url],restore=True)
   self.assertEqual(ledger.get(url)['outcome'],'dry_run');ledger.db.close()
if __name__=='__main__':unittest.main()
