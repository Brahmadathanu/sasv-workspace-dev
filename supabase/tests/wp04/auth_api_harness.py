"""WP04 offline-reviewed components. Importing or running this file sends no requests."""
from dataclasses import dataclass, field
import datetime as dt
import http.client
import json
import re
import secrets
import uuid

PRODUCTION = 'qhmoqtxpeasamtlxaoak'
BASELINE_READS = frozenset({
    'public.rpc_get_product_sku_readiness',
    'public.rpc_get_latest_governed_cost_period_start',
    'public.rpc_get_cost_period_valuation_context',
})
ACTORS = frozenset({'ccc_view', 'ccc_edit', 'product_view', 'no_module'})

class HarnessError(Exception):
    """Only fixed local codes: never response bodies, URLs, credentials or exceptions."""

@dataclass(frozen=True)
class Target:
    project_ref: str
    host: str
    provider_verified_ref: str
    database_verified_ref: str
    approval_id: str
    approved_actions: frozenset
    expires_at: dt.datetime
    # Exact separately reviewed read-only functions; candidate names never invented.
    reviewed_reads: frozenset = BASELINE_READS

    def validate(self, action):
        if not re.fullmatch(r'[a-z]{20}', self.project_ref or ''):
            raise HarnessError('invalid_target')
        if self.project_ref == PRODUCTION or PRODUCTION in self.host:
            raise HarnessError('production_target_refused')
        if self.host != self.project_ref + '.supabase.co':
            raise HarnessError('unknown_host_refused')
        if self.provider_verified_ref != self.project_ref or self.database_verified_ref != self.project_ref:
            raise HarnessError('identity_not_reconciled')
        if not self.approval_id or action not in self.approved_actions:
            raise HarnessError('operation_not_approved')
        if self.expires_at.tzinfo is None or self.expires_at <= dt.datetime.now(dt.timezone.utc):
            raise HarnessError('approval_expired')

@dataclass(repr=False)
class Session:
    actor: str
    user_id: str
    token: str = field(repr=False)

class HttpsTransport:
    """Direct TLS, no proxy, no redirects/retries, bounded response; exceptions redacted."""
    def __call__(self, host, method, path, headers, body):
        conn = http.client.HTTPSConnection(host, timeout=10)
        try:
            conn.request(method, path, body=json.dumps(body).encode() if body is not None else None,
                         headers=headers)
            response = conn.getresponse()
            status = response.status
            raw = response.read(1024 * 1024 + 1)
            if len(raw) > 1024 * 1024:
                raise HarnessError('response_too_large')
            if 300 <= status < 400:
                raise HarnessError('redirect_refused')
            try:
                data = json.loads(raw) if raw else None
            except (ValueError, UnicodeError):
                raise HarnessError('malformed_response') from None
            return status, data
        except HarnessError:
            raise
        except Exception:
            raise HarnessError('transport_unavailable') from None
        finally:
            conn.close()

class Harness:
    def __init__(self, target=None, *, execute=False, publishable_key=None,
                 admin_key=None, transport=None):
        self.target = target
        self.execute = execute
        self._public = publishable_key
        self._admin = admin_key
        self._transport = transport if transport is not None else HttpsTransport()
        self._actors = {}
        self._sessions = {}

    def _request(self, action, path, headers, body=None, method='POST'):
        if not self.execute:
            raise HarnessError('execution_off')
        if self.target is None:
            raise HarnessError('target_missing')
        self.target.validate(action)
        # No caller-supplied URL, query string, encoded traversal or alternate host.
        if not re.fullmatch(r'/[A-Za-z0-9_/-]+(?:\?grant_type=password)?', path):
            raise HarnessError('path_refused')
        try:
            status, data = self._transport(self.target.host, method, path, headers, body)
        except HarnessError:
            raise
        except Exception:
            raise HarnessError('transport_unavailable') from None
        if not isinstance(status, int) or not 100 <= status <= 599:
            raise HarnessError('malformed_response')
        if 300 <= status < 400:
            raise HarnessError('redirect_refused')
        return status, data

    def _public_headers(self, token=None):
        if not isinstance(self._public, str) or not self._public.startswith('sb_publishable_'):
            raise HarnessError('publishable_key_required')
        headers = {'apikey': self._public, 'Content-Type': 'application/json'}
        if token:
            if token == self._admin or token.startswith(('sb_secret_', 'sb_publishable_')):
                raise HarnessError('privileged_token_refused')
            headers['Authorization'] = 'Bearer ' + token
        return headers

    def create_actor(self, actor):
        if actor not in ACTORS or actor in self._actors:
            raise HarnessError('actor_refused')
        if not isinstance(self._admin, str) or not self._admin.startswith('sb_secret_'):
            raise HarnessError('target_admin_secret_required')
        password = secrets.token_urlsafe(32)
        email = 'wp04-' + uuid.uuid4().hex + '@example.invalid'
        status, data = self._request('auth_create', '/auth/v1/admin/users',
                                    {'apikey': self._admin, 'Content-Type': 'application/json'},
                                    {'email': email, 'password': password, 'email_confirm': True})
        if status not in (200, 201) or not isinstance(data, dict):
            raise HarnessError('actor_creation_failed')
        try:
            user_id = str(uuid.UUID(data['id']))
        except (KeyError, ValueError, TypeError, AttributeError):
            raise HarnessError('actor_identity_missing') from None
        # Kept in memory only. No module permission writes here.
        self._actors[actor] = (user_id, email, password)
        return {'actor': actor, 'created': True}  # No identity, email or credential output.

    def sign_in(self, actor):
        if actor not in self._actors:
            raise HarnessError('actor_not_prepared')
        user_id, email, password = self._actors[actor]
        status, data = self._request('auth_signin', '/auth/v1/token?grant_type=password',
                                    self._public_headers(), {'email': email, 'password': password})
        if status != 200 or not isinstance(data, dict):
            raise HarnessError('native_signin_failed')
        token = data.get('access_token')
        user = data.get('user')
        if (not isinstance(token, str) or not token or not isinstance(user, dict)
                or user.get('id') != user_id):
            raise HarnessError('native_session_missing')
        # Not JWT fabrication or claim-based authorization; confirm with native user endpoint.
        status, native_user = self._request('auth_signin', '/auth/v1/user',
                                          self._public_headers(token), method='GET')
        if status != 200 or not isinstance(native_user, dict) or native_user.get('id') != user_id:
            raise HarnessError('native_identity_mismatch')
        self._sessions[actor] = Session(actor, user_id, token)
        return {'actor': actor, 'session': 'native_verified'}

    def read_rpc(self, qualified_name, params, *, actor=None, invalid_session=False):
        if self.target is None or qualified_name not in self.target.reviewed_reads:
            raise HarnessError('read_not_reviewed')
        if not re.fullmatch(r'[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*', qualified_name):
            raise HarnessError('read_not_reviewed')
        if actor is not None and actor not in self._sessions:
            raise HarnessError('native_session_missing')
        token = self._sessions[actor].token if actor else None
        if invalid_session:
            if actor is not None:
                raise HarnessError('ambiguous_session_case')
            token = 'invalid-native-session'
        headers = self._public_headers(token)
        schema, name = qualified_name.split('.')
        headers['Content-Profile'] = schema
        status, data = self._request('rpc_read', '/rest/v1/rpc/' + name, headers, params)
        # Return structural HTTP result only. No readiness computation or body/free-text leakage.
        return {'http_status': status, 'result': 'response_received',
                'body_shape': 'object' if isinstance(data, dict) else 'array' if isinstance(data, list) else 'other'}

    def forget(self):
        self._sessions.clear()
        self._actors.clear()
        self._admin = None
        self._public = None
        # Best-effort reference disposal, not memory zeroization or remote session revocation.


def preparation_report():
    return {'mode': 'offline_preparation', 'network_calls': 0,
            'native_auth': 'NOT_RUN', 'api_permissions': 'NOT_RUN',
            'execution': 'OFF', 'cleanup': 'NOT_IMPLEMENTED_NOT_AUTHORIZED'}

if __name__ == '__main__':
    print(json.dumps(preparation_report(), sort_keys=True))
