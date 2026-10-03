"""Offline boundary tests for corrected WP04 test runner. No endpoint calls."""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
import tempfile
import unittest
import warnings
from pathlib import Path
from unittest.mock import patch

import auth_api_harness as h
import getpass
import test_runner as runner

REF = "abcdefghijabcdefghij"
USER = {
    "ccc_edit": "00000000-0000-4000-8000-000000000002",
    "ccc_view": "00000000-0000-4000-8000-000000000001",
    "no_module": "00000000-0000-4000-8000-000000000004",
    "product_view": "00000000-0000-4000-8000-000000000003",
}
TOKEN = "native-test-token-canary"
CANARY = "secret-password-native-test-token"
PACKAGE = Path(__file__).resolve().parent


def future():
    return dt.datetime.now(dt.timezone.utc) + dt.timedelta(hours=1)


def wrapper_digest() -> str:
    return runner.file_sha256(PACKAGE / "test_runner.py")


def approval(**changes):
    args = dict(
        expected_spec_sha256="0" * 64,
        expected_harness_sha256=runner.HARNESS_SHA256,
        expected_wrapper_sha256=wrapper_digest(),
        approval_id="offline-wrapper-test",
        expires_at=future(),
        approved_phases=frozenset({"live_orchestrate"}),
        approved_actions=frozenset({"auth_create", "auth_signin", "rpc_read"}),
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
                "params": {"nested": {"sku": 1}},
                "expectation": {
                    "http_status": 200,
                    "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}],
                },
            }
        ],
        "max_fixture_wait_seconds": 30,
        "handoff_directory": str(Path(tempfile.gettempdir()) / "wp04-handoff-unused"),
        "phase_limits": {"max_cases": 10, "max_create_actors": 4},
    }
    data.update(changes)
    return data


def dumps(data) -> bytes:
    return json.dumps(data, sort_keys=True, separators=(",", ":")).encode("utf-8")


class BoundFakeTransport(runner.TrustedFakeTransport):
    """Returns correctly bound native identities for all four actors."""

    def __init__(self):
        self._by_email = {}
        self._sessions = {}
        super().__init__(handler=self._handle)

    def _handle(self, host, method, path, headers, body):
        if path == "/auth/v1/admin/users":
            # Label inferred by creation order matching sorted(ACTORS).
            label = sorted(h.ACTORS)[len(self._by_email)]
            user_id = USER[label]
            email = body["email"]
            self._by_email[email] = (label, user_id)
            return 201, {"id": user_id, "email": email, "notes": CANARY}
        if path.startswith("/auth/v1/token"):
            label, user_id = self._by_email[body["email"]]
            token = TOKEN + "-" + label
            self._sessions[token] = user_id
            return 200, {"access_token": token, "user": {"id": user_id}, "notes": CANARY}
        if path == "/auth/v1/user":
            auth = headers.get("Authorization", "")
            token = auth.removeprefix("Bearer ").strip()
            return 200, {"id": self._sessions[token]}
        return 200, {"period_start": "2026-09-01", "notes": CANARY}


class RunnerCorrectionTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = Path(self.tmp.name)
        self.handoff = self.root / "outside-handoff"
        self.handoff.mkdir()
        self.worktree = self.root / "worktree"
        self.worktree.mkdir()

    def tearDown(self):
        self.tmp.cleanup()

    def _live(self, data=None, transport=None, source_path=None):
        data = data or base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        data["handoff_directory"] = str(self.handoff)
        raw = dumps(data)
        digest = hashlib.sha256(raw).hexdigest()
        offline = runner.OfflineRunner(
            worktree_root=self.worktree,
            package_dir=PACKAGE,
            clock=(lambda: getattr(self, "_now", 100.0)),
        )
        appr = approval(expected_spec_sha256=digest)
        if source_path is not None:
            source_path.write_bytes(raw)
        offline.load_spec(raw, appr, source_path=source_path)
        transport = transport or BoundFakeTransport()
        orch = runner.GuardedLiveOrchestrator(offline, appr)
        return offline, orch, transport, digest, appr

    # --- defaults ---
    def test_default_cli_off_zero_network(self):
        with patch("http.client.HTTPSConnection", side_effect=AssertionError("network")):
            report = runner.OfflineRunner().default_report()
            self.assertEqual(report["execution"], "OFF")
            self.assertEqual(report["overall"], "NOT_RUN")
            self.assertEqual(runner.main([]), 0)

    def test_offline_preflight_fake_only(self):
        with patch("http.client.HTTPSConnection", side_effect=AssertionError("network")):
            report = runner.OfflineRunner(package_dir=PACKAGE).offline_preflight()
        self.assertEqual(report["network_calls"], 0)
        self.assertEqual(report["overall"], "NOT_RUN")

    # --- WR-01 ---
    def test_wr01_wrapper_hash_ones_rejected(self):
        data = base_spec()
        raw = dumps(data)
        digest = hashlib.sha256(raw).hexdigest()
        offline = runner.OfflineRunner(package_dir=PACKAGE)
        with self.assertRaisesRegex(runner.RunnerError, "wrapper_hash_mismatch"):
            offline.load_spec(raw, approval(expected_spec_sha256=digest, expected_wrapper_sha256="1" * 64))

    def test_wr01_approval_id_mismatch_rejected(self):
        data = base_spec()
        raw = dumps(data)
        digest = hashlib.sha256(raw).hexdigest()
        offline = runner.OfflineRunner(package_dir=PACKAGE)
        with self.assertRaisesRegex(runner.RunnerError, "approval_id_mismatch"):
            offline.load_spec(raw, approval(expected_spec_sha256=digest, approval_id="different-id"))

    def test_wr01_nested_params_mutation_does_not_affect_request(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        orch.export_nonsecret_mapping()
        orch.begin_fixture_pause()
        orch.continue_after_acknowledgement({
            "target_ref": REF,
            "spec_sha256": digest,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
            "verified": True,
        })
        # Mutate the frozen mapping proxy cannot; mutate a thawed alias before call via case object.
        case = offline.spec.cases[0]
        with self.assertRaises(TypeError):
            case.params["nested"]["sku"] = 999
        before = len(transport.calls)
        results = orch.run_proof_cases()
        self.assertEqual(results[0]["assertion"], "MATCH")
        body = transport.calls[-1][4]
        self.assertEqual(body["nested"]["sku"], 1)
        self.assertGreater(len(transport.calls), before)

    def test_wr01_replaced_spec_bytes_detected(self):
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        raw = dumps(data)
        digest = hashlib.sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree, package_dir=PACKAGE)
        appr = approval(expected_spec_sha256=digest)
        offline.load_spec(raw, appr)
        offline.spec_bytes = dumps(base_spec(fixture_revision="changed", handoff_directory=str(self.handoff)))
        with self.assertRaisesRegex(runner.RunnerError, "spec_hash_mismatch|spec_drift"):
            offline.revalidate_frozen_spec(appr)

    def test_wr01_source_path_drift_detected(self):
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        path = self.root / "spec.json"
        raw = dumps(data)
        path.write_bytes(raw)
        digest = hashlib.sha256(raw).hexdigest()
        offline = runner.OfflineRunner(worktree_root=self.worktree, package_dir=PACKAGE)
        appr = approval(expected_spec_sha256=digest)
        offline.load_spec(raw, appr, source_path=path)
        path.write_bytes(dumps(base_spec(fixture_revision="drift", handoff_directory=str(self.handoff))))
        with self.assertRaisesRegex(runner.RunnerError, "spec_drift"):
            offline.revalidate_frozen_spec(appr)

    # --- WR-02 ---
    def test_wr02_empty_actions_not_widened(self):
        data = base_spec(approved_actions=[])
        with self.assertRaisesRegex(runner.RunnerError, "approved_actions_empty"):
            runner.validate_spec_document(data, "a" * 64)

    def test_wr02_phase_limits_schema(self):
        data = base_spec(phase_limits={"max_cases": 0, "max_create_actors": 4})
        with self.assertRaisesRegex(runner.RunnerError, "phase_limits_invalid"):
            runner.validate_spec_document(data, "a" * 64)
        data = base_spec(phase_limits={"max_cases": 10, "max_create_actors": 4, "unknown": 1})
        with self.assertRaisesRegex(runner.RunnerError, "phase_limits_invalid"):
            runner.validate_spec_document(data, "a" * 64)

    def test_wr02_arbitrary_callable_transport_refused_zero_calls(self):
        offline, orch, transport, digest, appr = self._live()
        calls = []

        def arbitrary(*args, **kwargs):
            calls.append(args)
            return 200, {}

        with self.assertRaisesRegex(runner.RunnerError, "transport_not_trusted"):
            orch.bind_client("sb_publishable_mock", "sb_secret_mock", arbitrary)
        self.assertEqual(calls, [])
        self.assertEqual(offline.stage, runner.Stage.INIT)

    def test_wr02_https_transport_refused_without_phase(self):
        offline, orch, _transport, digest, appr = self._live()
        with self.assertRaisesRegex(runner.RunnerError, "real_network_refused"):
            orch.bind_client("sb_publishable_mock", "sb_secret_mock", h.HttpsTransport())

    # --- WR-03 ---
    def test_wr03_proof_before_ack_refused_zero_calls(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        with self.assertRaisesRegex(runner.RunnerError, "proof_not_ready|stage_refused"):
            orch.run_proof_cases()
        self.assertEqual(len(transport.calls), before)

    def test_wr03_full_sequence_positive(self):
        cases = []
        for label in sorted(h.ACTORS):
            cases.append({
                "case_id": f"actor-{label}",
                "mode": "actor",
                "actor": label,
                "qualified_name": "public.rpc_get_latest_governed_cost_period_start",
                "params": {},
                "expectation": {
                    "http_status": 200,
                    "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}],
                },
            })
        cases.append({
            "case_id": "anon-period",
            "mode": "anonymous",
            "qualified_name": "public.rpc_get_latest_governed_cost_period_start",
            "params": {},
            "expectation": {
                "http_status": 200,
                "body_checks": [{"path": ["period_start"], "expected": "2026-09-01"}],
            },
        })
        data = base_spec(
            execution="REVIEWED_LIVE",
            handoff_directory=str(self.handoff),
            cases=cases,
            phase_limits={"max_cases": 10, "max_create_actors": 4},
        )
        offline, orch, transport, digest, appr = self._live(data=data)
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        mapping = orch.create_actors()
        self.assertEqual(mapping, USER)
        path = orch.export_nonsecret_mapping()
        self.assertTrue(Path(path).exists())
        orch.begin_fixture_pause()
        with self.assertRaisesRegex(runner.RunnerError, "pause_already_used|stage_refused"):
            orch.begin_fixture_pause()
        orch.continue_after_acknowledgement({
            "target_ref": REF,
            "spec_sha256": digest,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
            "verified": True,
        })
        results = orch.run_proof_cases()
        self.assertEqual(len(results), 5)
        self.assertTrue(all(item["assertion"] == "MATCH" for item in results))
        overall = runner.GuardedLiveOrchestrator.overall_from_cases(
            results, setup_failure=False, expected_case_ids=[c["case_id"] for c in cases]
        )
        self.assertEqual(overall, "PASS_REVIEWED_ASSERTIONS_ONLY")
        # Bound identities: each actor sign-in used matching token/user.
        user_calls = [c for c in transport.calls if c[2] == "/auth/v1/user"]
        self.assertEqual(len(user_calls), 4)
        offline.client.forget()

    def test_wr03_subset_match_not_complete_proof(self):
        overall = runner.GuardedLiveOrchestrator.overall_from_cases(
            [{"case_id": "only-one", "assertion": "MATCH"}],
            setup_failure=False,
            expected_case_ids=["only-one", "missing"],
        )
        self.assertEqual(overall, "NOT_RUN")

    def test_wr03_uncertain_create_stops_and_forgets(self):
        transport = BoundFakeTransport()
        fail_once = {"n": 0}
        original = transport.handler

        def flaky(host, method, path, headers, body):
            if path == "/auth/v1/admin/users":
                fail_once["n"] += 1
                if fail_once["n"] == 1:
                    return 500, {"message": CANARY}
            return original(host, method, path, headers, body)

        transport.handler = flaky
        offline, orch, _t, digest, appr = self._live(transport=transport)
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        with self.assertRaisesRegex(runner.RunnerError, "create_uncertain_stop"):
            orch.create_actors()
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertEqual(offline.client._actors, {})
        self.assertEqual(offline.client._sessions, {})
        with self.assertRaisesRegex(runner.RunnerError, "setup_failure_terminal|stage_refused"):
            orch.create_actors()

    # --- WR-04 ---
    def test_wr04_getpass_warning_error_filter(self):
        good = {
            "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
            "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
        }
        adapter = runner.ConsoleCredentialAdapter(stream_probe=lambda: good)

        def fallback(prompt=""):
            warnings.warn("echoed", getpass.GetPassWarning)
            return "echoed-secret"

        for filter_mode in ("ignore", "default", "error"):
            with warnings.catch_warnings():
                warnings.simplefilter(filter_mode, getpass.GetPassWarning)
                with patch("getpass.getpass", side_effect=fallback):
                    with self.assertRaisesRegex(runner.RunnerError, "secret_echo_refused"):
                        adapter.prompt_secret("publishable")

    def test_wr04_redirected_streams_refused(self):
        probe = {
            "stdin_isatty": True, "stdout_isatty": False, "stderr_isatty": False,
            "stdin_redirected": False, "stdout_redirected": True, "stderr_redirected": True,
        }
        adapter = runner.ConsoleCredentialAdapter(stream_probe=lambda: probe)
        with self.assertRaisesRegex(runner.RunnerError, "console_not_private"):
            adapter.assert_private_console()

    # --- WR-05 ---
    def test_wr05_missing_worktree_root_refused(self):
        payload = {
            "target_ref": REF,
            "spec_sha256": "a" * 64,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
        }
        with self.assertRaisesRegex(runner.RunnerError, "handoff_root_required"):
            runner.write_uuid_handoff(str(self.handoff), payload, worktree_root=None)  # type: ignore

    def test_wr05_inside_worktree_and_relative_refused(self):
        payload = {
            "target_ref": REF,
            "spec_sha256": "a" * 64,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
        }
        inside = self.worktree / "inside"
        inside.mkdir()
        with self.assertRaisesRegex(runner.RunnerError, "handoff_inside_worktree"):
            runner.write_uuid_handoff(str(inside), payload, worktree_root=self.worktree)
        with self.assertRaisesRegex(runner.RunnerError, "handoff_path_not_absolute"):
            runner.write_uuid_handoff("relative-dir", payload, worktree_root=self.worktree)

    def test_wr05_symlink_parent_with_missing_leaf_refused(self):
        if not hasattr(os, "symlink"):
            self.skipTest("symlink unsupported")
        link_parent = self.root / "link-parent"
        real_parent = self.root / "real-parent"
        real_parent.mkdir()
        try:
            os.symlink(real_parent, link_parent, target_is_directory=True)
        except OSError:
            self.skipTest("symlink creation requires privileges")
        missing = link_parent / "missing-leaf"
        payload = {
            "target_ref": REF,
            "spec_sha256": "a" * 64,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
        }
        with self.assertRaisesRegex(runner.RunnerError, "handoff_symlink_refused|handoff_dest_missing"):
            runner.write_uuid_handoff(str(missing), payload, worktree_root=self.worktree)

    def test_wr05_windows_reparse_check_invoked(self):
        if os.name != "nt":
            self.skipTest("windows only")
        payload = {
            "target_ref": REF,
            "spec_sha256": "a" * 64,
            "fixture_revision": "fix-rev-1",
            "actor_uuids": dict(USER),
        }
        with patch.object(runner, "_is_reparse_point", return_value=True):
            with self.assertRaisesRegex(runner.RunnerError, "handoff_symlink_refused"):
                runner.write_uuid_handoff(str(self.handoff), payload, worktree_root=self.worktree)

    def test_wr05_exclusive_create_and_duplicate_uuid(self):
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
        bad = dict(payload)
        bad["actor_uuids"] = {label: USER["ccc_view"] for label in USER}
        other = self.root / "other"
        other.mkdir()
        with self.assertRaisesRegex(runner.RunnerError, "actor_export_duplicate_uuid"):
            runner.write_uuid_handoff(str(other), bad, worktree_root=self.worktree)

    # --- WR-06 ---
    def test_wr06_canary_notes_rejected(self):
        with self.assertRaisesRegex(runner.RunnerError, "report_value_refused"):
            runner.safe_report(notes=CANARY)

    def test_wr06_unknown_error_text_mapped(self):
        self.assertEqual(runner._code(RuntimeError(CANARY)), "runner_internal_error")
        self.assertEqual(runner._code(runner.RunnerError("not-a-real-code")), "runner_internal_error")

    def test_wr06_case_id_canary_rejected_in_report(self):
        with self.assertRaisesRegex(runner.RunnerError, "report_value_refused"):
            runner.safe_report(cases=[{"case_id": "secret canary!", "assertion": "MATCH"}])

    def test_wr06_export_excludes_canaries(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        path = orch.export_nonsecret_mapping()
        text = Path(path).read_text(encoding="utf-8")
        self.assertNotIn(CANARY, text)
        self.assertNotIn(TOKEN, text)
        self.assertNotIn("@example.invalid", text)
        offline.client.forget()

    def test_example_spec_stays_off(self):
        example = (PACKAGE / "test_runner_spec.example.json").read_bytes()
        data, digest = runner.parse_spec_bytes(example)
        validated = runner.validate_spec_document(data, digest)
        self.assertEqual(validated.execution, "OFF")
        flipped = json.loads(example.decode())
        flipped["execution"] = "REVIEWED_LIVE"
        self.assertEqual(runner.validate_spec_document(flipped, digest).execution, "OFF")

    def test_duplicate_json_keys_and_bool_status(self):
        with self.assertRaisesRegex(runner.RunnerError, "duplicate_json_key"):
            runner.parse_spec_bytes(b'{"schema_version":1,"schema_version":1}')
        data = base_spec()
        data["cases"][0]["expectation"]["http_status"] = True
        with self.assertRaisesRegex(runner.RunnerError, "expectation_status_invalid"):
            runner.validate_spec_document(data, "a" * 64)

    # --- Targeted follow-up at 4de4f5e ---
    def test_followup_wr01_dataclass_replace_zero_calls(self):
        import dataclasses
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        case = offline.spec.cases[0]
        replaced_case = dataclasses.replace(case, params=runner._freeze({"unreviewed": 999}))
        offline.spec = dataclasses.replace(offline.spec, cases=(replaced_case,))
        with self.assertRaisesRegex(runner.RunnerError, "spec_drift"):
            orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})

    def test_followup_wr01_approval_set_mutation_ignored(self):
        phases = {"live_orchestrate"}
        actions = {"auth_create", "auth_signin", "rpc_read"}
        data = base_spec(execution="REVIEWED_LIVE", handoff_directory=str(self.handoff))
        raw = dumps(data)
        digest = hashlib.sha256(raw).hexdigest()
        appr = runner.ExternalApproval(
            expected_spec_sha256=digest,
            expected_harness_sha256=runner.HARNESS_SHA256,
            expected_wrapper_sha256=wrapper_digest(),
            approval_id="offline-wrapper-test",
            expires_at=future(),
            approved_phases=phases,
            approved_actions=actions,
        )
        phases.add("real_https")
        actions.add("extra_action")
        appr.assert_unchanged()
        self.assertNotIn("real_https", appr.approved_phases)
        self.assertNotIn("extra_action", appr.approved_actions)

    def test_followup_wr01_approval_replacement_refused(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        orch.approval = approval(
            expected_spec_sha256=digest,
            approved_phases=frozenset({"live_orchestrate", "real_https"}),
        )
        with self.assertRaisesRegex(runner.RunnerError, "approval_binding_changed"):
            orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._admin)

    def test_followup_wr03_omitted_expected_coverage_not_pass(self):
        overall = runner.GuardedLiveOrchestrator.overall_from_cases(
            [{"case_id": "anon-period", "assertion": "MATCH"}],
            setup_failure=False,
        )
        self.assertEqual(overall, "NOT_RUN")

    def test_followup_wr03_invalid_ack_clears_secrets(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        orch.export_nonsecret_mapping()
        orch.begin_fixture_pause()
        with self.assertRaisesRegex(runner.RunnerError, "ack_invalid"):
            orch.continue_after_acknowledgement({"verified": True})
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._admin)
        self.assertFalse(offline._ack_verified)
        with self.assertRaisesRegex(runner.RunnerError, "setup_failure_terminal"):
            orch.run_proof_cases()

    def test_followup_wr03_spec_drift_after_bind_clears_secrets(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        offline.spec_bytes = dumps(base_spec(
            execution="REVIEWED_LIVE",
            handoff_directory=str(self.handoff),
            fixture_revision="changed",
        ))
        with self.assertRaisesRegex(runner.RunnerError, "spec_hash_mismatch|spec_drift"):
            orch.create_actors()
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._admin)

    def test_followup_wr03_export_write_failure_clears_secrets(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        with patch.object(runner, "write_uuid_handoff", side_effect=runner.RunnerError("handoff_write_failed")):
            with self.assertRaisesRegex(runner.RunnerError, "handoff_write_failed"):
                orch.export_nonsecret_mapping()
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})

    def test_followup_wr06_nonstring_project_ref(self):
        data = base_spec()
        data["target"]["project_ref"] = 123
        with self.assertRaisesRegex(runner.RunnerError, "invalid_target"):
            runner.validate_spec_document(data, "a" * 64)

    def test_followup_wr06_nonstring_nested_and_approval_fields(self):
        data = base_spec()
        data["cases"][0]["params"] = []
        with self.assertRaisesRegex(runner.RunnerError, "case_params_invalid"):
            runner.validate_spec_document(data, "a" * 64)
        with self.assertRaisesRegex(runner.RunnerError, "approval_missing"):
            runner.ExternalApproval(
                expected_spec_sha256="a" * 64,
                expected_harness_sha256=runner.HARNESS_SHA256,
                expected_wrapper_sha256=wrapper_digest(),
                approval_id="",
                expires_at=future(),
                approved_phases=frozenset({"live_orchestrate"}),
            )

    # --- Exception-boundary correction at 72c0ed9 ---
    def test_exception_boundary_missing_exact_spec_fails_terminal_and_forgets(self):
        source = self.root / "exact-reviewed-spec.json"
        offline, orch, transport, digest, appr = self._live(source_path=source)
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        source.unlink()
        before = len(transport.calls)
        with self.assertRaisesRegex(runner.RunnerError, "spec_source_required"):
            orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._public)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})
        with self.assertRaisesRegex(runner.RunnerError, "setup_failure_terminal"):
            orch.create_actors()

    def test_exception_boundary_permission_read_fails_terminal_and_forgets(self):
        source = self.root / "exact-reviewed-spec.json"
        offline, orch, transport, digest, appr = self._live(source_path=source)
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        with patch.object(Path, "read_bytes", side_effect=PermissionError("private-path-canary")):
            with self.assertRaisesRegex(runner.RunnerError, "spec_source_required"):
                orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._public)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})

    def test_exception_boundary_artifact_read_failure_is_fixed_and_terminal(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        with patch.object(runner, "verify_source_artifacts", side_effect=PermissionError("artifact-canary")):
            with self.assertRaisesRegex(runner.RunnerError, "runner_internal_error"):
                orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._public)
        self.assertIsNone(offline.client._admin)

    def test_exception_boundary_cancellation_propagates_after_terminal_disposal(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        before = len(transport.calls)
        with patch.object(runner, "verify_source_artifacts", side_effect=KeyboardInterrupt):
            with self.assertRaises(KeyboardInterrupt):
                orch.create_actors()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._public)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})

    def test_exception_boundary_real_write_failure_is_fixed_and_terminal(self):
        offline, orch, transport, digest, appr = self._live()
        orch.bind_client("sb_publishable_mock", "sb_secret_mock", transport)
        orch.create_actors()
        before = len(transport.calls)
        with patch("os.write", side_effect=PermissionError("write-canary")):
            with self.assertRaisesRegex(runner.RunnerError, "handoff_write_failed"):
                orch.export_nonsecret_mapping()
        self.assertEqual(len(transport.calls), before)
        self.assertEqual(offline.stage, runner.Stage.FAILED)
        self.assertIsNone(offline.client._public)
        self.assertIsNone(offline.client._admin)
        self.assertEqual(offline.client._sessions, {})

    def test_exception_boundary_malformed_modes_return_fixed_codes(self):
        for malformed in ([], {}, 1, True, None):
            with self.subTest(malformed=malformed):
                data = base_spec()
                data["cases"][0]["mode"] = malformed
                with self.assertRaisesRegex(runner.RunnerError, "case_mode_refused"):
                    runner.validate_spec_document(data, "a" * 64)

    def test_exception_boundary_malformed_public_collections_and_report(self):
        with self.assertRaisesRegex(runner.RunnerError, "live_phase_not_approved"):
            runner.ExternalApproval(
                expected_spec_sha256="a" * 64,
                expected_harness_sha256=runner.HARNESS_SHA256,
                expected_wrapper_sha256=wrapper_digest(),
                approval_id="offline-wrapper-test",
                expires_at=future(),
                approved_phases=[[]],
            )
        with self.assertRaisesRegex(runner.RunnerError, "report_value_refused"):
            runner.safe_report(mode=[])
        data = base_spec()
        data["execution"] = []
        with self.assertRaisesRegex(runner.RunnerError, "execution_value_refused"):
            runner.validate_spec_document(data, "a" * 64)


if __name__ == "__main__":
    unittest.main()
