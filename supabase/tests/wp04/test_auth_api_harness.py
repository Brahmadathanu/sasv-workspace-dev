import datetime as dt
import unittest
from unittest.mock import patch
import auth_api_harness as h

REF = 'abcdefghijklmnopqrst'
USER = '00000000-0000-4000-8000-000000000001'
TOKEN = 'native-test-token'

def target(**changes):
    args = dict(project_ref=REF, host=REF+'.supabase.co', provider_verified_ref=REF,
                database_verified_ref=REF, approval_id='offline-test-only',
                approved_actions=frozenset({'auth_create','auth_signin','rpc_read'}),
                expires_at=dt.datetime.now(dt.timezone.utc)+dt.timedelta(hours=1))
    args.update(changes)
    return h.Target(**args)

class Mock:
    def __init__(self): self.calls=[]; self.fail=None
    def __call__(self, host, method, path, headers, body):
        self.calls.append((host,method,path,headers,body))
        if self.fail: return self.fail
        if path=='/auth/v1/admin/users': return 201, {'id':USER}
        if path.startswith('/auth/v1/token'): return 200, {'access_token':TOKEN,'user':{'id':USER}}
        if path=='/auth/v1/user': return 200, {'id':USER}
        return 200, {'notes':'sensitive data must not appear in report'}

class Tests(unittest.TestCase):
    def setUp(self):
        self.mock=Mock()
        self.client=h.Harness(target(),execute=True,publishable_key='sb_publishable_mock',
                              admin_key='sb_secret_mock',transport=self.mock)
    def test_default_zero_network(self):
        with patch('http.client.HTTPSConnection',side_effect=AssertionError('network')):
            self.assertEqual(h.preparation_report()['native_auth'],'NOT_RUN')
            with self.assertRaisesRegex(h.HarnessError,'execution_off'):
                h.Harness(target())._request('rpc_read','/rest/v1/rpc/x',{})
    def test_production_refused(self):
        self.client=h.Harness(target(project_ref=h.PRODUCTION,host=h.PRODUCTION+'.supabase.co'),execute=True,admin_key='sb_secret_mock',transport=self.mock)
        with self.assertRaisesRegex(h.HarnessError,'production_target_refused'): self.client.create_actor('ccc_view')
        self.assertEqual(self.mock.calls,[])
    def test_unknown_host_refused(self):
        for host in [REF+'.supabase.co.evil.test','https://'+REF+'.supabase.co','127.0.0.1',REF+'.supabase.co:443']:
            self.client=h.Harness(target(host=host),execute=True,admin_key='sb_secret_mock',transport=self.mock)
            with self.assertRaises(h.HarnessError): self.client.create_actor('ccc_view')
        self.assertEqual(self.mock.calls,[])
    def test_independent_identity_required(self):
        self.client=h.Harness(target(database_verified_ref='other'),execute=True,admin_key='sb_secret_mock',transport=self.mock)
        with self.assertRaisesRegex(h.HarnessError,'identity_not_reconciled'): self.client.create_actor('ccc_view')
        self.assertEqual(self.mock.calls,[])
    def test_approval_required(self):
        self.client=h.Harness(target(approved_actions=frozenset()),execute=True,admin_key='sb_secret_mock',transport=self.mock)
        with self.assertRaisesRegex(h.HarnessError,'operation_not_approved'): self.client.create_actor('ccc_view')
    def test_expired_approval(self):
        self.client=h.Harness(target(expires_at=dt.datetime.now(dt.timezone.utc)-dt.timedelta(seconds=1)),execute=True,admin_key='sb_secret_mock',transport=self.mock)
        with self.assertRaisesRegex(h.HarnessError,'approval_expired'): self.client.create_actor('ccc_view')
    def test_redirect_refused_no_follow(self):
        self.mock.fail=(302,{'location':'https://evil.test','token':TOKEN})
        with self.assertRaisesRegex(h.HarnessError,'redirect_refused'): self.client.create_actor('ccc_view')
        self.assertEqual(len(self.mock.calls),1)
    def test_native_sequence_and_user_headers(self):
        self.client.create_actor('product_view'); self.client.sign_in('product_view')
        self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},actor='product_view')
        self.assertEqual([c[2] for c in self.mock.calls[:3]],['/auth/v1/admin/users','/auth/v1/token?grant_type=password','/auth/v1/user'])
        for c in self.mock.calls[1:]:
            self.assertEqual(c[3]['apikey'],'sb_publishable_mock')
            self.assertNotIn('sb_secret',str(c[3]))
        self.assertEqual(self.mock.calls[-1][3]['Authorization'],'Bearer '+TOKEN)
        self.assertTrue(self.mock.calls[0][4]['email'].endswith('@example.invalid'))
        self.assertTrue(self.mock.calls[0][4]['email_confirm'])
    def test_missing_session_not_ready(self):
        with self.assertRaisesRegex(h.HarnessError,'native_session_missing'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},actor='ccc_view')
        self.assertEqual(self.mock.calls,[])
    def test_no_session_response(self):
        self.client.create_actor('ccc_view'); self.mock.fail=(200,{'user':{'id':USER}})
        with self.assertRaisesRegex(h.HarnessError,'native_session_missing'): self.client.sign_in('ccc_view')
    def test_privileged_token_rejected(self):
        self.client.create_actor('ccc_view'); self.mock.fail=(200,{'user':{'id':USER},'access_token':'sb_secret_mock'})
        with self.assertRaisesRegex(h.HarnessError,'privileged_token_refused'): self.client.sign_in('ccc_view')
        self.assertEqual(len(self.mock.calls),2)
    def test_unreviewed_writer_or_path(self):
        for name in ['public.rpc_refresh_costing','public.x/../writer','https://evil.test']:
            with self.assertRaisesRegex(h.HarnessError,'read_not_reviewed'): self.client.read_rpc(name,{})
        self.assertEqual(self.mock.calls,[])
    def test_anonymous_invalid_cases(self):
        self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{})
        self.assertNotIn('Authorization',self.mock.calls[-1][3])
        self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},invalid_session=True)
        self.assertEqual(self.mock.calls[-1][3]['Authorization'],'Bearer invalid-native-session')
    def test_safe_report_and_exception(self):
        self.mock.fail=(403,{'message':'secret-password '+TOKEN})
        with self.assertRaises(h.HarnessError) as e: self.client.create_actor('ccc_view')
        self.assertEqual(str(e.exception),'actor_creation_failed')
        result=self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{})
        self.assertNotIn(TOKEN,str(result)); self.assertNotIn('secret-password',str(result))
        self.assertEqual(result['http_status'],403)  # Not interpreted as READY/UNKNOWN or proof of module denial.
    def test_transport_exception_redacted(self):
        def bad(*args): raise RuntimeError('password token secret')
        self.client._transport=bad
        with self.assertRaises(h.HarnessError) as e: self.client.create_actor('ccc_view')
        self.assertEqual(str(e.exception),'transport_unavailable')

    def prepared_session(self):
        self.client.create_actor('ccc_view'); self.client.sign_in('ccc_view')
    def test_target_reassignment_refused(self):
        self.prepared_session(); count=len(self.mock.calls)
        with self.assertRaisesRegex(h.HarnessError,'target_reassignment_refused'):
            self.client.target=target(host='other.supabase.co')
        self.assertEqual(len(self.mock.calls),count)
    def test_private_target_drift_refused(self):
        self.prepared_session(); count=len(self.mock.calls)
        self.client._target=target(approval_id='different-record')
        with self.assertRaisesRegex(h.HarnessError,'target_or_key_binding_changed'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},actor='ccc_view')
        self.assertEqual(len(self.mock.calls),count); self.assertEqual(self.client._sessions,{})
    def test_keys_bound(self):
        self.prepared_session(); count=len(self.mock.calls); self.client._admin='sb_secret_other'
        with self.assertRaisesRegex(h.HarnessError,'target_or_key_binding_changed'): self.client.sign_in('ccc_view')
        self.assertEqual(len(self.mock.calls),count); self.assertEqual(self.client._sessions,{})
    def test_failed_signin_removes_stale_session(self):
        self.prepared_session(); self.mock.fail=(401,{'error':'secret'})
        with self.assertRaises(h.HarnessError): self.client.sign_in('ccc_view')
        self.assertEqual(self.client._sessions,{})
        count=len(self.mock.calls)
        with self.assertRaisesRegex(h.HarnessError,'native_session_missing'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},actor='ccc_view')
        self.assertEqual(len(self.mock.calls),count)
    def test_signin_transport_failure_removes_session(self):
        self.prepared_session()
        def fail(*args): raise RuntimeError('secret')
        self.client._transport=fail
        with self.assertRaises(h.HarnessError): self.client.sign_in('ccc_view')
        self.assertEqual(self.client._sessions,{})
    def test_signin_malformed_removes_session(self):
        self.prepared_session(); self.mock.fail=(200,[])
        with self.assertRaises(h.HarnessError): self.client.sign_in('ccc_view')
        self.assertEqual(self.client._sessions,{})
    def test_native_user_mismatch_removes_session(self):
        self.prepared_session(); original=self.mock
        def transport(host,method,path,headers,body):
            if path=='/auth/v1/user': return 200,{'id':'different'}
            return original(host,method,path,headers,body)
        self.client._transport=transport
        with self.assertRaisesRegex(h.HarnessError,'native_identity_mismatch'): self.client.sign_in('ccc_view')
        self.assertEqual(self.client._sessions,{})
    def test_expectation_exact_and_mismatch(self):
        self.mock.fail=(403,{'code':'42501','message':'private'})
        name='public.rpc_get_latest_governed_cost_period_start'
        self.assertEqual(self.client.read_rpc(name,{},expectation=h.ReadExpectation(403,'42501'))['assertion'],'MATCH')
        self.assertEqual(self.client.read_rpc(name,{},expectation=h.ReadExpectation(403,'wrong'))['assertion'],'MISMATCH')
        self.assertEqual(self.client.read_rpc(name,{})['assertion'],'UNVERIFIED')
        self.mock.fail=(200,{'error':'unexpected'})
        self.assertEqual(self.client.read_rpc(name,{},expectation=h.ReadExpectation(200,body_checks=((('period_start',),'2026-09-01'),)))['assertion'],'MISMATCH')
    def test_assertion_exception_redacted(self):
        class Bad(h.ReadExpectation):
            def evaluate(self,*args): raise RuntimeError('secret-password native-test-token')
        with self.assertRaises(h.HarnessError) as e:
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},expectation=Bad(200))
        self.assertEqual(str(e.exception),'assertion_failed')
    def test_assertion_unknown_verdict_refused(self):
        class Bad(h.ReadExpectation):
            def evaluate(self,*args): return 'private-text'
        with self.assertRaisesRegex(h.HarnessError,'assertion_failed'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},expectation=Bad(200))
    def test_source_target_collections_frozen(self):
        actions={'auth_create'}; reads=set(h.BASELINE_READS)
        t=target(approved_actions=actions,reviewed_reads=reads); actions.add('rpc_read'); reads.add('public.writer')
        self.assertNotIn('rpc_read',t.approved_actions); self.assertNotIn('public.writer',t.reviewed_reads)

    def test_replacement_host_private_binding_refused(self):
        self.prepared_session(); count=len(self.mock.calls); ref='tsrqponmlkjihgfedcba'
        self.client._target=target(project_ref=ref,host=ref+'.supabase.co',provider_verified_ref=ref,database_verified_ref=ref)
        with self.assertRaisesRegex(h.HarnessError,'target_or_key_binding_changed'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},actor='ccc_view')
        self.assertEqual(len(self.mock.calls),count)
    def test_invalid_expectation_before_request(self):
        with self.assertRaisesRegex(h.HarnessError,'expectation_not_reviewed'):
            self.client.read_rpc('public.rpc_get_latest_governed_cost_period_start',{},expectation=lambda *x: 'MATCH')
        self.assertEqual(self.mock.calls,[])
    def test_expectation_nested_inputs_frozen(self):
        path=['period_start']; checks=[(path,'2026-09-01')]
        e=h.ReadExpectation(200,body_checks=checks); path.append('other'); checks.clear()
        self.assertEqual(e.evaluate(200,{'period_start':'2026-09-01'}),'MATCH')

class TransportTests(unittest.TestCase):
    def test_https_redirect_is_not_followed(self):
        from unittest.mock import MagicMock
        conn=MagicMock(); response=conn.getresponse.return_value
        response.status=307; response.read.return_value=b'{}'
        with patch('http.client.HTTPSConnection',return_value=conn) as factory:
            with self.assertRaisesRegex(h.HarnessError,'redirect_refused'):
                h.HttpsTransport()(REF+'.supabase.co','GET','/auth/v1/user',{},None)
            factory.assert_called_once(); conn.request.assert_called_once(); conn.close.assert_called_once()
    def test_actual_transport_error_redacted(self):
        from unittest.mock import MagicMock
        conn=MagicMock(); conn.request.side_effect=RuntimeError('secret password')
        with patch('http.client.HTTPSConnection',return_value=conn):
            with self.assertRaises(h.HarnessError) as e:
                h.HttpsTransport()(REF+'.supabase.co','GET','/auth/v1/user',{},None)
            self.assertEqual(str(e.exception),'transport_unavailable')
    def test_response_bound(self):
        from unittest.mock import MagicMock
        conn=MagicMock(); conn.getresponse.return_value.status=200
        conn.getresponse.return_value.read.return_value=b'x'*(1024*1024+1)
        with patch('http.client.HTTPSConnection',return_value=conn):
            with self.assertRaisesRegex(h.HarnessError,'response_too_large'):
                h.HttpsTransport()(REF+'.supabase.co','GET','/auth/v1/user',{},None)

if __name__=='__main__': unittest.main()
