"""Offline boundary tests for the WP04 test runner. No endpoint calls."""
from __future__ import annotations

import datetime as dt
import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import auth_api_harness as h
import test_runner as runner

REF = "abcdefghijabcdefghij"
USER = {
    "ccc_view": "00000000-0000-4000-8000-000000000001",
    "ccc_edit": "00000000-0000-4000-8000-000000000002",
    "product_view": "00000000-0000-4000-8000-000000000003",
    "no_module": "00000000-0000-4000-8000-000000000004",
}
TOKEN = "native-test-token-canary"
CANARY = "secret-password-native-test-token"


def future():
    return dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)


def approval(**changes):
    args = dict(
        expected_spec_sha256="0" * 64,
        expected_harness_sha256=runner.HARNESS_SHA256,
        expected_wrapper_sha256="1" * 64,
        approval_id="offline-wrapper-test",
        expires_at=future(),
        approved_phases=frozenset({"live_orchestrate"}),
    )
    args.update(changes)
    return runner.ExternalApproval(**args)


def base_spec(**changes):
    data = {
        "schema_version": 1,
        "execution": "OFF",
        "target": {
            "project_ref": REF,
            "host": REF + ".supabase.co",
            "provider_verified_ref": REF,
            "database_verified_ref": REF,
            "approval_id": "offline-wrapper-test",
            "expires_at": future().isoformat().replace("+00:00", "Z"),
        },
        "fixture_revision": "fix-rev-1",
        "marker": "marker-1",
        "approved_actions": ["auth_create", "auth_signin", "rpc_read"],
        "reviewed_reads": sorted(h.BASELINE_READS),
        "actors": sorted(h.ACTORS),
        "cases": [
            {
                "case_id": "anon-period",
                "mode": "anonymous",
                "qualified_name": "public.rpc_get_latest_governed_cost_period_start",
                "params": {},
                "expectation": {"http_status": 200, "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}]},
            }
        ],
        "max_fixture_wait_seconds": 30,
        "handoff_directory": str(Path(tempfile.gettempdir()) / "wp04-handoff-test-unused"),
        "phase_limits": {"max_cases": 10},
    }
    data.update(changes)
    return data


def dumps(data) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


class MockTransport:
    def __init__(self):
        self.calls = []
        self.fail = None
        self.created = {}

    def __call__(self, host, method, path, headers, body):
        self.calls.append((host, method, path, dict(headers), body))
        if self.fail is not None:
            return self.fail
        if path == "/auth/v1/admin/users":
            email = body["email"]
            # Allocate next unused UUID deterministically by count.
            label_order = sorted(h.ACTORS)
            idx = len(self.created)
            user_id = USER[label_order[idx]]
            self.created[email] = user_id
            return 201, {"id": user_id, "email": email, "notes": CANARY}
        if path.startswith("/auth/v1/token"):
            return 200, {"access_token": TOKEN, "user": {"id": self.created[body["email"]]}}
        if path == "/auth/v1/user":
            return 200, {"id": list(self.created.values())[-1]}
        return 200, {"period_start": "2026-09-01", "notes": CANARY}


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.handoff = self.root / "outside-handoff"
        self.handoff.mkdir()
        self.worktree = self.root / "worktree"
        self.worktree.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def test_default_cli_off_zero_network(self):
        with patch("http.client.HTTPSConnection", side_effect=AssertionError("network")):
            report = runner.OfflineRunner().default_report()
            self.assertEqual(report["execution"], "OFF")
            self.assertEqual(report["overall"], "NOT_RUN")
            self.assertEqual(report["network_calls"], 0)
            code = runner.main([])
            self.assertEqual(code, 0)

    def test_offline_preflight_uses_fake_transport_only(self):
        with patch("http.client.HTTPSConnection", side_effect=AssertionError("network")):
            report = runner.OfflineRunner().offline_preflight()
        self.assertEqual(report["execution"], "OFF")
        self.assertEqual(report["network_calls"], 0)
        self.assertEqual(report["overall"], "NOT_RUN")

    def test_example_spec_stays_off_with_unresolved(self):
        example = Path(__file__).with_name("test_runner_spec.example.json").read_bytes()
        data, digest = runner.parse_spec_bytes(example)
        validated = runner.validate_spec_document(data, digest)
        self.assertTrue(validated.unresolved)
        self.assertEqual(validated.execution, "OFF")
        # Flipping the flag in a copy still cannot become live while unresolved.
        flipped = json.loads(example.decode())
        flipped["execution"] = "REVIEWED_LIVE"
        validated2 = runner.validate_spec_document(flipped, digest)
        self.assertEqual(validated2.execution, "OFF")

    def test_duplicate_json_keys_rejected(self):
        raw = b'{"schema_version":1,"schema_version":1}'
        with self.assertRaisesRegex(runner.RunnerError, "duplicate_json_key"):
            runner.parse_spec_bytes(raw)

    def test_unknown_field_and_bool_as_int_rejected(self):
        data = base_spec()
        data["extra"] = 1
        with self.assertRaisesRegex(runner.RunnerError, "unknown_spec_field"):
            runner.validate_spec_document(data, "a" * 64)
        data = base_spec()
        data["schema_version"] = True
        with self.assertRaisesRegex(runner.RunnerError, "spec_schema_unsupported"):
            runner.validate_spec_document(data, "a" * 64)
        data = base_spec()
        data["cases"][0]["expectation"]["http_status"] = True
        with self.assertRaisesRegex(runner.RunnerError, "expectation_status_invalid"):
            runner.validate_spec_document(data, "a" * 64)
        data = base_spec()
        data["cases"][0]["expectation"]["body_checks"] = [
            {"path": ["n"], "expected": float("nan")}
        ]
        with self.assertRaisesRegex(runner.RunnerError, "expectation_nonfinite"):
            runner.validate_spec_document(data, "a" * 64)

    def test_production_and_expiry_and_hash_refusals(self):
        data = base_spec()
        data["target"]["project_ref"] = h.PRODUCTION
        data["target"]["host"] = h.PRODUCTION + ".supabase.co"
        data["target"]["provider_verified_ref"] = h.PRODUCTION
        data["target"]["database_verified_ref"] = h.PRODUCTION
        with self.assertRaisesRegex(runner.RunnerError, "production_target_refused"):
            runner.validate_spec_document(data, "a" * 64)
        data = base_spec()
        raw = dumps(data)
        digest = __import__("hashlib").sha256(raw).hexdigest()
        with self.assertRaisesRegex(runner.RunnerError, "spec_hash_mismatch"):
            runner.validate_spec_document(data, digest, approval(expected_spec_sha256="b" * 64))
        with self.assertRaisesRegex(runner.RunnerError, "harness_hash_mismatch"):
            runner.validate_spec_document(
                data, digest, approval(expected_spec_sha256=digest, expected_harness_sha256="c" * 64)
            )
        data = base_spec()
        data["target"]["expires_at"] = "2020-01-01T00:00:00Z"
        with self.assertRaisesRegex(runner.RunnerError, "approval_expired"):
            runner.validate_spec_document(data, "a" * 64)

    def test_expectation_required_and_unverified_not_pass(self):
        data = base_spec()
        data["cases"][0]["expectation"] = None
        with self.assertRaisesRegex(runner.RunnerError, "expectation_required"):
            runner.validate_spec_document(data, "a" * 64)
        overall = runner.GuardedLiveOrchestrator.overall_from_cases(
            [{"case_id": "x", "assertion": "UNVERIFIED"}], setup_failure=False
        )
        self.assertEqual(overall, "NOT_RUN")
        overall = runner.GuardedLiveOrchestrator.overall_from_cases(
            [{"case_id": "x", "assertion": "MISMATCH"}], setup_failure=False
        )
        self.assertEqual(overall, "FAIL")
        overall = runner.GuardedLiveOrchestrator.overall_from_cases([], setup_failure=True)
        self.assertEqual(overall, "SETUP_FAILURE")

    def test_redirected_console_and_getpass_warning_fail_closed(self):
        probe = {
            "stdin_isatty": True,
            "stdout_isatty": False,
            "stderr_isatty": False,
            "stdin_redirected": False,
            "stdout_redirected": True,
            "stderr_redirected": True,
        }
        adapter = runner.ConsoleCredentialAdapter(stream_probe=lambda: probe)
        with self.assertRaisesRegex(runner.RunnerError, "console_not_private"):
            adapter.assert_private_console()

        def warn_prompt(label):
            import warnings
            warnings.showwarning("echo", getpass_warning(), __file__, 1)
            return "x"

        def getpass_warning():
            return __import__("getpass").GetPassWarning

        # Force the installed warning handler path by calling prompt_secret without fake prompt
        # and patching getpass.getpass to emit GetPassWarning via warnings.showwarning.
        good = {
            "stdin_isatty": True,
            "stdout_isatty": True,
            "stderr_isatty": True,
            "stdin_redirected": False,
            "stdout_redirected": False,
            "stderr_redirected": False,
        }
        adapter = runner.ConsoleCredentialAdapter(stream_probe=lambda: good)

        def noisy_getpass(prompt=""):
            import warnings
            import getpass as gp
            warnings.showwarning("hidden failed", gp.GetPassWarning, __file__, 1)
            return "value"

        with patch("getpass.getpass", side_effect=noisy_getpass):
            with self.assertRaisesRegex(runner.RunnerError, "secret_echo_refused"):
                adapter.prompt_secret("publishable")

    def test_canaries_absent_from_reports_exceptions_and_export(self):
        report = runner.safe_report(notes="offline_only")
        blob = json.dumps(report)
        self.assertNotIn(CANARY, blob)
        self.assertNotIn(TOKEN, blob)
        with self.assertRaises(runner.RunnerError) as ctx:
            raise runner.RunnerError("create_uncertain_stop")
        self.assertEqual(str(ctx.exception), "create_uncertain_stop")
        self.assertNotIn(CANARY, str(ctx.exception))

        transport = MockTransport()
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        raw = dumps(data)
        digest = __import__("hashlib").sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree, transport=transport)
        offline.load_spec(raw, approval(expected_spec_sha256=digest, approved_phases=frozenset({"live_orchestrate"})))
        orch = runner.GuardedLiveOrchestrator(
            offline, approval(expected_spec_sha256=digest, approved_phases=frozenset({"live_orchestrate"}))
        )
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        mapping = orch.create_actors()
        path = orch.export_nonsecret_mapping()
        exported = Path(path).read_text(encoding="utf-8")
        self.assertNotIn(CANARY, exported)
        self.assertNotIn(TOKEN, exported)
        self.assertNotIn("@example.invalid", exported)
        self.assertNotIn("sb_secret", exported)
        self.assertNotIn("sb_publishable", exported)
        for value in mapping.values():
            self.assertIn(value, exported)
        offline.client.forget()
        self.assertEqual(offline.client._actors, {})

    def test_uuid_export_allowlist_and_no_overwrite(self):
        payload = {
            "target_ref": REF,
            "spec_sha256": "a" * 64,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
        }
        path = runner.write_uuid_handoff(str(self.handoff), payload, worktree_root=self.worktree)
        self.assertTrue(Path(path).exists())
        with self.assertRaisesRegex(runner.RunnerError, "handoff_overwrite_refused"):
            runner.write_uuid_handoff(str(self.handoff), payload, worktree_root=self.worktree)
        inside = self.worktree / "inside"
        inside.mkdir()
        with self.assertRaisesRegex(runner.RunnerError, "handoff_inside_worktree"):
            runner.write_uuid_handoff(str(inside), payload, worktree_root=self.worktree)
        bad = dict(payload)
        bad["email"] = "x@example.invalid"
        with self.assertRaisesRegex(runner.RunnerError, "handoff_payload_invalid"):
            runner.write_uuid_handoff(str(self.handoff / "other"), bad, worktree_root=self.worktree)

    def test_pause_expiry_and_spec_drift_refusal(self):
        clock = {"now": 100.0}

        def now():
            return clock["now"]

        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff), max_fixture_wait_seconds=5)
        raw = dumps(data)
        digest = __import__("hashlib").sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree, clock=now)
        offline.load_spec(raw, approval(expected_spec_sha256=digest))
        transport = MockTransport()
        orch = runner.GuardedLiveOrchestrator(offline, approval(expected_spec_sha256=digest))
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        orch.export_nonsecret_mapping()
        orch.begin_fixture_pause()
        clock["now"] = 106.0
        with self.assertRaisesRegex(runner.RunnerError, "fixture_wait_expired"):
            orch.continue_after_acknowledgement({
                "target_ref": REF,
                "spec_sha256": digest,
                "fixture_revision": "fix-rev-1",
                "actor_uuids": dict(USER),
                "verified": True,
            })

        offline2 = runner.OfflineRunner(worktree_root=self.worktree)
        offline2.load_spec(raw, approval(expected_spec_sha256=digest))
        offline2.spec_bytes = dumps(base_spec(fixture_revision="changed"))
        with self.assertRaisesRegex(runner.RunnerError, "spec_hash_mismatch"):
            offline2.revalidate_frozen_spec(approval(expected_spec_sha256=digest))

    def test_no_create_retry_after_uncertainty(self):
        transport = MockTransport()
        transport.fail = (500, {"message": CANARY})
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        raw = dumps(data)
        digest = __import__("hashlib").sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree)
        offline.load_spec(raw, approval(expected_spec_sha256=digest))
        orch = runner.GuardedLiveOrchestrator(offline, approval(expected_spec_sha256=digest))
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        with self.assertRaisesRegex(runner.RunnerError, "create_uncertain_stop"):
            orch.create_actors()
        self.assertTrue(offline.create_attempted)
        self.assertFalse(offline.create_confirmed)
        transport.fail = None
        with self.assertRaisesRegex(runner.RunnerError, "create_uncertain_stop"):
            orch.create_actors()
        offline.client.forget()

    def test_missing_session_or_expectation_makes_no_request(self):
        transport = MockTransport()
        client = h.Harness(
            h.Target(
                project_ref=REF,
                host=REF + ".supabase.co",
                provider_verified_ref=REF,
                database_verified_ref=REF,
                approval_id="x",
                approved_actions=frozenset({"auth_create", "auth_signin", "rpc_read"}),
                expires_at=future(),
            ),
            execute=True,
            publishable_key="sb_publishable_mock",
            admin_key="sb_secret_mock",
            transport=transport,
        )
        with self.assertRaisesRegex(h.HarnessError, "native_session_missing"):
            client.read_rpc("public.rpc_get_latest_governed_cost_period_start", {}, actor="ccc_view")
        self.assertEqual(transport.calls, [])
        data = base_spec()
        del data["cases"][0]["expectation"]
        with self.assertRaisesRegex(runner.RunnerError, "spec_missing_field"):
            runner.validate_spec_document(data, "a" * 64)

    def test_match_mismatch_and_ack_validation(self):
        transport = MockTransport()
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        raw = dumps(data)
        digest = __import__("hashlib").sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree)
        offline.load_spec(raw, approval(expected_spec_sha256=digest))
        orch = runner.GuardedLiveOrchestrator(offline, approval(expected_spec_sha256=digest))
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        path = orch.export_nonsecret_mapping()
        orch.begin_fixture_pause()
        ack = {
            "target_ref": REF,
            "spec_sha256": digest,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
            "verified": True,
        }
        orch.continue_after_acknowledgement(ack)
        results = orch.run_proof_cases()
        self.assertEqual(results[0]["assertion"], "MATCH")
        self.assertEqual(
            runner.GuardedLiveOrchestrator.overall_from_cases(results, setup_failure=False),
            "PASS_REVIEWED_ASSERTIONS_ONLY",
        )
        transport.fail = (403, {"code": "42501", "message": CANARY})
        # Rebuild case expectation mismatch through direct harness evaluate path.
        mismatch = h.ReadExpectation(200, body_checks=((("period_start",), "2026-09-01"),))
        outcome = offline.client.read_rpc(
            "public.rpc_get_latest_governed_cost_period_start", {}, expectation=mismatch
        )
        self.assertEqual(outcome["assertion"], "MISMATCH")
        self.assertNotIn(CANARY, json.dumps(outcome))
        bad_ack = dict(ack)
        bad_ack["verified"] = False
        with self.assertRaisesRegex(runner.RunnerError, "ack_not_verified"):
            orch.continue_after_acknowledgement(bad_ack)
        offline.client.forget()
        self.assertTrue(Path(path).exists())

    def test_real_https_guard_and_cleanup_absent(self):
        with patch("http.client.HTTPSConnection", side_effect=AssertionError("network")):
            guard = runner.GuardTransport()
            with self.assertRaisesRegex(runner.RunnerError, "real_network_refused"):
                guard("host", "GET", "/", {}, None)
            report = runner.main(["preflight"])
            self.assertEqual(report, 0)
        src = Path(__file__).with_name("test_runner.py").read_text(encoding="utf-8")
        self.assertIn("local_forget_only", src)
        self.assertIn("forget(", src)
        self.assertNotIn("admin/users/", src)  # no delete path
        self.assertNotIn("delete_user", src)


if __name__ == "__main__":
    unittest.main()
