import importlib.util,io,os,shutil,subprocess,tempfile,time,unittest
from contextlib import redirect_stdout
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
spec=importlib.util.spec_from_file_location('duckdns',ROOT/'deploy/duckdns-update.py')
ddns=importlib.util.module_from_spec(spec);spec.loader.exec_module(ddns)

class Response:
 def __init__(self,value):self.value=value
 def __enter__(self):return self
 def __exit__(self,*args):pass
 def read(self,size):return self.value

class DeploymentTests(unittest.TestCase):
 def test_duckdns_success_failure_and_health_expiry(self):
  with tempfile.TemporaryDirectory() as tmp,patch.object(ddns,'SUCCESS',Path(tmp)/'success'):
   self.assertFalse(ddns.healthy())
   def opener(request,timeout):
    from urllib.parse import urlparse,parse_qs
    self.assertEqual(urlparse(request.full_url).netloc,'www.duckdns.org')
    self.assertEqual(parse_qs(urlparse(request.full_url).query,keep_blank_values=True),{'domains':['test-site'],'token':['fake-token'],'ip':['']})
    self.assertEqual(timeout,20)
    return Response(b'OK\n')
   ddns.update('test-site','fake-token',opener)
   self.assertTrue(ddns.healthy())
   ddns.SUCCESS.write_text(str(time.time()-1000))
   self.assertFalse(ddns.healthy())
   with self.assertRaises(ValueError):ddns.update('test-site','fake-token',lambda *a,**k:Response(b'KO'))
   self.assertFalse(ddns.healthy())
 def test_duckdns_invalid_config_does_not_log_token(self):
  output=io.StringIO()
  with patch.dict(os.environ,{'DUCKDNS_SUBDOMAIN':'bad.domain','DUCKDNS_TOKEN':'fake-secret'}),patch('sys.argv',['updater']),redirect_stdout(output):
   self.assertEqual(ddns.main(),1)
  self.assertNotIn('fake-secret',output.getvalue())
 def shell(self):
  candidate='C:/Program Files/Git/bin/bash.exe' if os.name=='nt' else shutil.which('sh')
  if not candidate or not Path(candidate).is_file():self.skipTest('POSIX shell unavailable')
  return candidate
 def test_shell_syntax(self):
  for script in ['nginx-start.sh','certbot-renew.sh']:
   subprocess.run([self.shell(),'-n',str(ROOT/'deploy'/script)],check=True,capture_output=True)
 def test_certbot_issue_arguments_without_network(self):
  with tempfile.TemporaryDirectory() as tmp:
   fake=Path(tmp)/'certbot';fake.write_text('#!/bin/sh\nprintf "%s\\n" "$@"\n',encoding='utf-8');fake.chmod(0o755)
   command='PATH="$(cygpath -u "$1"):$PATH"; exec sh "$2" --issue' if os.name=='nt' else 'PATH="$1:$PATH"; exec sh "$2" --issue'
   env=dict(os.environ,DOMAIN='wordloom-test.duckdns.org',LETSENCRYPT_EMAIL='operator@my-test-domain.org')
   result=subprocess.run([self.shell(),'-c',command,'check',tmp,str(ROOT/'deploy/certbot-renew.sh')],env=env,text=True,capture_output=True)
   self.assertEqual(result.returncode,0,result.stderr)
   args=result.stdout.splitlines()
   self.assertEqual(args[0],'certonly');self.assertIn('--webroot',args)
   self.assertEqual(args[args.index('--domain')+1],env['DOMAIN'])
   self.assertEqual(args[args.index('--cert-name')+1],'wordloom')
   env['LETSENCRYPT_EMAIL']='you@example.com'
   result=subprocess.run([self.shell(),'-c',command,'check',tmp,str(ROOT/'deploy/certbot-renew.sh')],env=env,text=True,capture_output=True)
   self.assertNotEqual(result.returncode,0)

if __name__=='__main__':unittest.main()
