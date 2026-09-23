import tempfile, unittest, subprocess, json
from pathlib import Path
from unittest.mock import patch
from codex_connection import CodexConnection

class CodexTests(unittest.TestCase):
 def setUp(self):
  self.temp=tempfile.TemporaryDirectory();self.root=Path(self.temp.name)
  self.binary=self.root/'codex.exe';self.binary.touch()
  self.c=CodexConnection(self.binary,self.root)
 def tearDown(self):self.temp.cleanup()
 def test_environment_separate_and_no_api_credentials(self):
  with patch.dict('os.environ',{'OPENAI_API_KEY':'never-forward','CODEX_API_KEY':'never-forward'}):
   env=self.c.options()['env'];self.assertNotIn('OPENAI_API_KEY',env);self.assertNotIn('CODEX_API_KEY',env)
   self.assertEqual(env['CODEX_HOME'],str(self.root/'codex-account'))
 def test_api_login_is_not_chatgpt_login(self):
  with patch('subprocess.run',return_value=subprocess.CompletedProcess([],0,'','Logged in using an API key')):
   self.assertFalse(self.c.status()['connected'])
 def test_disconnected_enrichment_does_not_execute(self):
  with patch.object(self.c,'status',return_value={'connected':False}),patch('subprocess.run') as run:
   with self.assertRaisesRegex(RuntimeError,'fallback'):self.c.enrich({'type':'ENRICH_PROFILE','prompt':'data'})
   run.assert_not_called()
 def test_exact_output_fields_and_sandbox(self):
  def run(args,**kwargs):
   self.assertIn('read-only',args);self.assertIn('--ignore-user-config',args)
   target=Path(args[args.index('--output-last-message')+1])
   target.write_text(json.dumps({'company':'Company','headline':'IT Manager','language':'Portuguese'}))
   return subprocess.CompletedProcess(args,0,'','')
  with patch.object(self.c,'status',return_value={'connected':True}),patch('subprocess.run',side_effect=run):
   self.assertEqual(self.c.enrich({'type':'ENRICH_PROFILE','prompt':'data'})['headline'],'IT Manager')
 def test_model_failure_never_falls_back(self):
  with patch.object(self.c,'status',return_value={'connected':True}),patch('subprocess.run',return_value=subprocess.CompletedProcess([],1,'','')) as run:
   with self.assertRaisesRegex(RuntimeError,'No API fallback'):self.c.enrich({'type':'ENRICH_COMPANY_PROFILE','prompt':'data'})
   self.assertEqual(run.call_count,1)
 def test_generation_model_and_reasoning_reach_cli(self):
  def run(args,**kwargs):
   self.assertEqual(args[args.index('--model')+1],'gpt-5.6-sol')
   self.assertIn('model_reasoning_effort="low"',args)
   Path(args[args.index('--output-last-message')+1]).write_text('{"text":"Hello fixture"}')
   return subprocess.CompletedProcess(args,0,'','')
  with patch.object(self.c,'status',return_value={'connected':True}),patch('subprocess.run',side_effect=run):
   result=self.c.enrich({'type':'GENERATE_FREE_PROMPT','prompt':'Write a greeting','model':'gpt-5.6-sol','reasoning':'low'})
   self.assertEqual(result,{'ok':True,'text':'Hello fixture'})
 def test_invalid_model_or_reasoning_never_runs(self):
  for override in [{'model':'--bad-model'},{'reasoning':'not-a-level'}]:
   with patch('subprocess.run') as run:
    with self.assertRaises(ValueError): self.c.enrich({'type':'ENRICH_PROFILE',**override})
    run.assert_not_called()
if __name__=='__main__':unittest.main()
