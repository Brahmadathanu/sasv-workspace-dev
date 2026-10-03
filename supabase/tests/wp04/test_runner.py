"""WP04 offline test-runner wrapper. Default CLI stays OFF with zero network."""
from __future__ import annotations

import dataclasses
import datetime as dt
import getpass
import hashlib
import json
import math
import os
import re
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Callable

import auth_api_harness as harness

PRODUCTION = harness.PRODUCTION
BASELINE_READS = harness.BASELINE_READS
ACTORS = harness.ACTORS

HARNESS_SHA256 = "3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed"
WRAPPER_FILENAME = "test_runner.py"

ALLOWED_SPEC_TOP_KEYS = frozenset({
    "schema_version",
    "execution",
    "target",
    "fixture_revision",
    "marker",
    "approved_actions",
    "reviewed_reads",
    "actors",
    "cases",
    "max_fixture_wait_seconds",
    "handoff_directory",
    "phase_limits",
})
ALLOWED_TARGET_KEYS = frozenset({
    "project_ref",
    "host",
    "provider_verified_ref",
    "database_verified_ref",
    "approval_id",
    "expires_at",
})
ALLOWED_CASE_KEYS = frozenset({
    "case_id",
    "actor",
    "mode",
    "qualified_name",
    "params",
    "expectation",
})
ALLOWED_EXPECTATION_KEYS = frozenset({"http_status", "error_code", "body_checks"})
ALLOWED_ACK_KEYS = frozenset({
    "target_ref",
    "spec_sha256",
    "fixture_revision",
    "actor_uuids",
    "verified",
})
ALLOWED_EXPORT_KEYS = frozenset({
    "target_ref",
    "spec_sha256",
    "fixture_revision",
    "actor_uuids",
})
ALLOWED_ACTIONS = frozenset({"auth_create", "auth_signin", "rpc_read"})
CASE_MODES = frozenset({"actor", "anonymous", "invalid_session"})
UNRESOLVED = re.compile(r"^UNRESOLVED(?:_|$)")

REPORT_FIELDS = (
    "mode",
    "execution",
    "native_auth",
    "api_permissions",
    "network_calls",
    "overall",
    "phases",
    "cases",
    "setup_failure",
    "failure_code",
    "cleanup",
    "notes",
)


class RunnerError(Exception):
    """Fixed local codes only; never bodies, secrets, paths with secrets, or chained text."""


def _code(exc: BaseException) -> str:
    if isinstance(exc, RunnerError):
        return str(exc)
    if isinstance(exc, harness.HarnessError):
        return str(exc)
    return "runner_internal_error"


def safe_report(**fields: Any) -> dict:
    out = {
        "mode": "offline_wrapper",
        "execution": "OFF",
        "native_auth": "NOT_RUN",
        "api_permissions": "NOT_RUN",
        "network_calls": 0,
        "overall": "NOT_RUN",
        "phases": [],
        "cases": [],
        "setup_failure": False,
        "failure_code": None,
        "cleanup": "local_forget_only",
        "notes": "offline_only",
    }
    for key, value in fields.items():
        if key not in REPORT_FIELDS:
            raise RunnerError("report_field_refused")
        out[key] = value
    return {key: out[key] for key in REPORT_FIELDS}


def _reject_duplicates(pairs: list[tuple[str, Any]]) -> dict:
    seen: set[str] = set()
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in seen:
            raise RunnerError("duplicate_json_key")
        seen.add(key)
        out[key] = value
    return out


def parse_spec_bytes(raw: bytes) -> tuple[dict, str]:
    if not isinstance(raw, (bytes, bytearray)):
        raise RunnerError("spec_bytes_required")
    text = bytes(raw).decode("utf-8")
    try:
        data = json.loads(text, object_pairs_hook=_reject_duplicates)
    except RunnerError:
        raise
    except Exception:
        raise RunnerError("spec_json_invalid") from None
    if not isinstance(data, dict):
        raise RunnerError("spec_not_object")
    digest = hashlib.sha256(bytes(raw)).hexdigest()
    return data, digest


def _require_keys(data: dict, allowed: frozenset, required: frozenset) -> None:
    unknown = set(data) - allowed
    if unknown:
        raise RunnerError("unknown_spec_field")
    missing = required - set(data)
    if missing:
        raise RunnerError("spec_missing_field")


def _is_unresolved(value: Any) -> bool:
    return isinstance(value, str) and bool(UNRESOLVED.match(value))


def _finite_number(value: Any) -> bool:
    return type(value) is int or (type(value) is float and math.isfinite(value))


@dataclasses.dataclass(frozen=True)
class ExternalApproval:
    """Approval digest lives outside hashed spec bytes to avoid self-reference."""
    expected_spec_sha256: str
    expected_harness_sha256: str
    expected_wrapper_sha256: str
    approval_id: str
    expires_at: dt.datetime
    approved_phases: frozenset


@dataclasses.dataclass(frozen=True)
class BodyCheck:
    path: tuple
    expected: Any


@dataclasses.dataclass(frozen=True)
class CaseSpec:
    case_id: str
    mode: str
    actor: str | None
    qualified_name: str
    params: dict
    expectation: harness.ReadExpectation


@dataclasses.dataclass(frozen=True)
class ValidatedSpec:
    raw_sha256: str
    execution: str
    unresolved: bool
    target: harness.Target
    fixture_revision: str
    marker: str
    actors: tuple[str, ...]
    cases: tuple[CaseSpec, ...]
    max_fixture_wait_seconds: int
    handoff_directory: str
    phase_limits: dict


def validate_spec_document(data: dict, raw_sha256: str, approval: ExternalApproval | None = None) -> ValidatedSpec:
    if not isinstance(data, dict):
        raise RunnerError("spec_not_object")
    _require_keys(
        data,
        ALLOWED_SPEC_TOP_KEYS,
        frozenset({
            "schema_version",
            "execution",
            "target",
            "fixture_revision",
            "marker",
            "approved_actions",
            "reviewed_reads",
            "actors",
            "cases",
            "max_fixture_wait_seconds",
            "handoff_directory",
            "phase_limits",
        }),
    )
    if type(data["schema_version"]) is not int or data["schema_version"] != 1:
        raise RunnerError("spec_schema_unsupported")
    execution = data["execution"]
    if execution not in ("OFF", "REVIEWED_LIVE"):
        raise RunnerError("execution_value_refused")

    target_data = data["target"]
    if not isinstance(target_data, dict):
        raise RunnerError("target_not_object")
    _require_keys(
        target_data,
        ALLOWED_TARGET_KEYS,
        frozenset({
            "project_ref",
            "host",
            "provider_verified_ref",
            "database_verified_ref",
            "approval_id",
            "expires_at",
        }),
    )

    unresolved = any(_is_unresolved(target_data[key]) for key in ALLOWED_TARGET_KEYS)
    unresolved = unresolved or _is_unresolved(data["fixture_revision"]) or _is_unresolved(data["marker"])
    unresolved = unresolved or _is_unresolved(data["handoff_directory"])

    if type(data["max_fixture_wait_seconds"]) is not int or data["max_fixture_wait_seconds"] <= 0:
        raise RunnerError("fixture_wait_invalid")
    if data["max_fixture_wait_seconds"] > 3600:
        raise RunnerError("fixture_wait_unbounded")

    actions = data["approved_actions"]
    reads = data["reviewed_reads"]
    actors = data["actors"]
    cases = data["cases"]
    phase_limits = data["phase_limits"]
    if not isinstance(actions, list) or not isinstance(reads, list) or not isinstance(actors, list):
        raise RunnerError("spec_collection_invalid")
    if not isinstance(cases, list) or not isinstance(phase_limits, dict):
        raise RunnerError("spec_collection_invalid")
    if any(not isinstance(item, str) for item in actions + reads + actors):
        raise RunnerError("spec_collection_invalid")
    if len(set(actions)) != len(actions) or len(set(reads)) != len(reads) or len(set(actors)) != len(actors):
        raise RunnerError("duplicate_actor_or_action")
    if set(actions) - ALLOWED_ACTIONS:
        raise RunnerError("unsupported_action")
    if set(actors) != set(ACTORS) or len(actors) != len(ACTORS):
        raise RunnerError("actor_matrix_invalid")
    if set(reads) - set(BASELINE_READS) and execution != "OFF":
        # Candidate names require a separately reviewed live approval; offline example may list baseline only.
        if not unresolved:
            raise RunnerError("read_not_in_baseline_without_review")
    for name in reads:
        if not re.fullmatch(r"[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*", name):
            raise RunnerError("read_name_invalid")

    expires_raw = target_data["expires_at"]
    if not isinstance(expires_raw, str) or _is_unresolved(expires_raw):
        unresolved = True
        expires_at = dt.datetime(2099, 1, 1, tzinfo=dt.timezone.utc)
    else:
        try:
            expires_at = dt.datetime.fromisoformat(expires_raw.replace("Z", "+00:00"))
        except ValueError:
            raise RunnerError("expiry_invalid") from None
        if expires_at.tzinfo is None:
            raise RunnerError("expiry_timezone_required")

    case_ids: set[str] = set()
    parsed_cases: list[CaseSpec] = []
    for case in cases:
        if not isinstance(case, dict):
            raise RunnerError("case_not_object")
        _require_keys(
            case,
            ALLOWED_CASE_KEYS,
            frozenset({"case_id", "mode", "qualified_name", "params", "expectation"}),
        )
        case_id = case["case_id"]
        if not isinstance(case_id, str) or not case_id or case_id in case_ids:
            raise RunnerError("duplicate_or_invalid_case_id")
        case_ids.add(case_id)
        mode = case["mode"]
        if mode not in CASE_MODES:
            raise RunnerError("case_mode_refused")
        actor = case.get("actor")
        if mode == "actor":
            if actor not in ACTORS:
                raise RunnerError("case_actor_invalid")
        else:
            if actor is not None:
                raise RunnerError("case_actor_invalid")
        qualified = case["qualified_name"]
        if not isinstance(qualified, str) or (qualified not in reads and not _is_unresolved(qualified)):
            if _is_unresolved(qualified):
                unresolved = True
            else:
                raise RunnerError("case_read_not_allowlisted")
        params = case["params"]
        if not isinstance(params, dict):
            raise RunnerError("case_params_invalid")
        expectation = case["expectation"]
        if expectation is None:
            raise RunnerError("expectation_required")
        if not isinstance(expectation, dict):
            raise RunnerError("expectation_invalid")
        _require_keys(expectation, ALLOWED_EXPECTATION_KEYS, frozenset({"http_status"}))
        status = expectation["http_status"]
        if type(status) is not int or isinstance(status, bool) or not 100 <= status <= 599:
            raise RunnerError("expectation_status_invalid")
        error_code = expectation.get("error_code")
        if error_code is not None and not isinstance(error_code, str):
            raise RunnerError("expectation_error_invalid")
        body_checks_raw = expectation.get("body_checks", [])
        if not isinstance(body_checks_raw, list):
            raise RunnerError("expectation_body_invalid")
        body_checks: list[tuple] = []
        for item in body_checks_raw:
            if not isinstance(item, dict) or set(item) != {"path", "expected"}:
                raise RunnerError("expectation_body_invalid")
            path = item["path"]
            expected = item["expected"]
            if not isinstance(path, list) or not path:
                raise RunnerError("expectation_body_invalid")
            if any(type(part) not in (str, int) or isinstance(part, bool) for part in path):
                raise RunnerError("expectation_body_invalid")
            if type(expected) is float and not math.isfinite(expected):
                raise RunnerError("expectation_nonfinite")
            if type(expected) not in (str, int, float, bool, type(None)):
                raise RunnerError("expectation_body_invalid")
            body_checks.append((tuple(path), expected))
        parsed_cases.append(
            CaseSpec(
                case_id=case_id,
                mode=mode,
                actor=actor if mode == "actor" else None,
                qualified_name=qualified,
                params=dict(params),
                expectation=harness.ReadExpectation(status, error_code, tuple(body_checks)),
            )
        )

    if execution == "OFF" or unresolved:
        # Keep example and unresolved documents non-executable regardless of flag flips.
        execution = "OFF"

    if approval is not None:
        if raw_sha256 != approval.expected_spec_sha256:
            raise RunnerError("spec_hash_mismatch")
        if approval.expected_harness_sha256 != HARNESS_SHA256:
            raise RunnerError("harness_hash_mismatch")
        if approval.expires_at.tzinfo is None or approval.expires_at <= dt.datetime.now(dt.timezone.utc):
            raise RunnerError("approval_expired")
        if not approval.approval_id:
            raise RunnerError("approval_missing")

    if unresolved and execution != "OFF":
        raise RunnerError("unresolved_sample_not_live")

    # Target object is constructed even for OFF/unresolved so structure is frozen; harness still refuses production.
    project_ref = target_data["project_ref"]
    host = target_data["host"]
    if not unresolved:
        if project_ref == PRODUCTION or PRODUCTION in str(host):
            raise RunnerError("production_target_refused")
        if not re.fullmatch(r"[a-z]{20}", project_ref or ""):
            raise RunnerError("invalid_target")
        if host != project_ref + ".supabase.co":
            raise RunnerError("unknown_host_refused")
        if target_data["provider_verified_ref"] != project_ref or target_data["database_verified_ref"] != project_ref:
            raise RunnerError("identity_not_reconciled")
        if expires_at <= dt.datetime.now(dt.timezone.utc):
            raise RunnerError("approval_expired")

    target = harness.Target(
        project_ref="abcdefghijklmnopqrst" if unresolved else project_ref,
        host=("abcdefghijklmnopqrst.supabase.co" if unresolved else host),
        provider_verified_ref="abcdefghijklmnopqrst" if unresolved else target_data["provider_verified_ref"],
        database_verified_ref="abcdefghijklmnopqrst" if unresolved else target_data["database_verified_ref"],
        approval_id="unresolved-offline" if unresolved else target_data["approval_id"],
        approved_actions=frozenset(actions) or frozenset(ALLOWED_ACTIONS),
        expires_at=expires_at,
        reviewed_reads=frozenset(reads) if reads else BASELINE_READS,
    )

    return ValidatedSpec(
        raw_sha256=raw_sha256,
        execution=execution,
        unresolved=unresolved,
        target=target,
        fixture_revision=str(data["fixture_revision"]),
        marker=str(data["marker"]),
        actors=tuple(sorted(actors)),
        cases=tuple(parsed_cases),
        max_fixture_wait_seconds=data["max_fixture_wait_seconds"],
        handoff_directory=str(data["handoff_directory"]),
        phase_limits=dict(phase_limits),
    )


class RecordingTransport:
    """Injected offline transport. Never opens sockets."""

    def __init__(self, handler: Callable | None = None):
        self.calls: list[tuple] = []
        self.handler = handler

    def __call__(self, host, method, path, headers, body):
        self.calls.append((host, method, path, dict(headers), body))
        if self.handler is not None:
            return self.handler(host, method, path, headers, body)
        raise RunnerError("transport_handler_missing")


class GuardTransport:
    """Fails closed if a real HTTPS connection is attempted."""

    def __call__(self, *args, **kwargs):
        raise RunnerError("real_network_refused")


class ConsoleCredentialAdapter:
    """Private-input adapter. Refuses redirected agent-terminal shapes."""

    def __init__(self, prompt_fn: Callable | None = None, stream_probe: Callable | None = None):
        self._prompt_fn = prompt_fn
        self._stream_probe = stream_probe or self._default_probe

    @staticmethod
    def _default_probe() -> dict:
        return {
            "stdin_isatty": sys.stdin.isatty(),
            "stdout_isatty": sys.stdout.isatty(),
            "stderr_isatty": sys.stderr.isatty(),
            "stdin_redirected": False if not hasattr(sys.stdin, "isatty") else not sys.stdin.isatty(),
            "stdout_redirected": not sys.stdout.isatty(),
            "stderr_redirected": not sys.stderr.isatty(),
        }

    def assert_private_console(self) -> None:
        probe = self._stream_probe()
        if not probe.get("stdin_isatty") or probe.get("stdin_redirected"):
            raise RunnerError("console_not_private")
        if not probe.get("stdout_isatty") or probe.get("stdout_redirected"):
            raise RunnerError("console_not_private")
        if not probe.get("stderr_isatty") or probe.get("stderr_redirected"):
            raise RunnerError("console_not_private")

    def prompt_secret(self, label: str) -> str:
        self.assert_private_console()
        if self._prompt_fn is not None:
            return self._prompt_fn(label)

        def _raise_on_warning(message, category, filename, lineno, file=None, line=None):
            if category is getpass.GetPassWarning:
                raise RunnerError("secret_echo_refused")
            return True

        previous = __import__("warnings").showwarning
        __import__("warnings").showwarning = _raise_on_warning
        try:
            # No echo_char dependency; GetPassWarning must fail closed.
            value = getpass.getpass(prompt=f"{label}: ")
        except RunnerError:
            raise
        except Exception:
            raise RunnerError("secret_prompt_failed") from None
        finally:
            __import__("warnings").showwarning = previous
        if not isinstance(value, str) or not value:
            raise RunnerError("secret_empty")
        return value


def actor_uuid_export(client: harness.Harness) -> dict[str, str]:
    """Narrow adapter: labels to synthetic UUIDs only. No email/password/token."""
    mapping: dict[str, str] = {}
    for label, triple in client._actors.items():
        if label not in ACTORS:
            raise RunnerError("actor_export_invalid")
        user_id = triple[0]
        try:
            mapping[label] = str(uuid.UUID(user_id))
        except (ValueError, TypeError, AttributeError):
            raise RunnerError("actor_export_invalid") from None
    if set(mapping) != set(ACTORS) or len(mapping) != 4:
        raise RunnerError("actor_export_incomplete")
    if len(set(mapping.values())) != 4:
        raise RunnerError("actor_export_duplicate_uuid")
    return mapping


def write_uuid_handoff(destination_dir: str, payload: dict, *, worktree_root: Path | None = None) -> str:
    if set(payload) != ALLOWED_EXPORT_KEYS:
        raise RunnerError("handoff_payload_invalid")
    for key in ("target_ref", "spec_sha256", "fixture_revision"):
        if not isinstance(payload[key], str) or not payload[key] or _is_unresolved(payload[key]):
            raise RunnerError("handoff_payload_invalid")
    actors = payload["actor_uuids"]
    if not isinstance(actors, dict) or set(actors) != set(ACTORS):
        raise RunnerError("handoff_payload_invalid")
    for label, value in actors.items():
        try:
            uuid.UUID(value)
        except (ValueError, TypeError, AttributeError):
            raise RunnerError("handoff_payload_invalid") from None
        if not isinstance(value, str):
            raise RunnerError("handoff_payload_invalid")

    dest = Path(destination_dir)
    if worktree_root is not None:
        try:
            resolved_dest = dest.resolve()
            resolved_root = worktree_root.resolve()
            if resolved_dest == resolved_root or resolved_root in resolved_dest.parents:
                raise RunnerError("handoff_inside_worktree")
        except RunnerError:
            raise
        except Exception:
            raise RunnerError("handoff_path_unsupported") from None
    if dest.exists() and not dest.is_dir():
        raise RunnerError("handoff_path_invalid")
    try:
        if dest.exists() and hasattr(os.path, "islink") and (os.path.islink(dest) or any(
            os.path.islink(parent) for parent in [dest, *dest.parents] if parent.exists()
        )):
            raise RunnerError("handoff_symlink_refused")
    except RunnerError:
        raise
    except Exception:
        # Report honestly when platform checks are incomplete.
        raise RunnerError("handoff_path_guarantee_unsupported") from None

    dest.mkdir(parents=True, exist_ok=True)
    path = dest / "wp04-actor-uuid-handoff.json"
    encoded = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(str(path), flags, 0o600)
    except FileExistsError:
        raise RunnerError("handoff_overwrite_refused") from None
    except OSError:
        raise RunnerError("handoff_create_failed") from None
    try:
        os.write(fd, encoded)
    finally:
        os.close(fd)
    return str(path)


def validate_fixture_acknowledgement(ack: dict, expected: dict) -> None:
    if not isinstance(ack, dict):
        raise RunnerError("ack_invalid")
    if set(ack) != ALLOWED_ACK_KEYS:
        raise RunnerError("ack_invalid")
    if ack.get("verified") is not True:
        raise RunnerError("ack_not_verified")
    for key in ("target_ref", "spec_sha256", "fixture_revision"):
        if ack.get(key) != expected.get(key):
            raise RunnerError("ack_identity_mismatch")
    actors = ack.get("actor_uuids")
    if not isinstance(actors, dict) or actors != expected.get("actor_uuids"):
        raise RunnerError("ack_actor_mismatch")


class OfflineRunner:
    """Default offline wrapper. CLI never enables live network."""

    def __init__(
        self,
        *,
        transport: Callable | None = None,
        prompt: ConsoleCredentialAdapter | None = None,
        worktree_root: Path | None = None,
        clock: Callable[[], float] | None = None,
    ):
        self.transport = transport if transport is not None else GuardTransport()
        self.prompt = prompt or ConsoleCredentialAdapter()
        self.worktree_root = worktree_root
        self.clock = clock or time.monotonic
        self.spec: ValidatedSpec | None = None
        self.spec_bytes: bytes | None = None
        self.client: harness.Harness | None = None
        self.create_attempted: set[str] = set()
        self.create_confirmed: set[str] = set()
        self._paused_deadline: float | None = None
        self._export_payload: dict | None = None

    def default_report(self) -> dict:
        return safe_report(
            mode="offline_wrapper",
            execution="OFF",
            native_auth="NOT_RUN",
            api_permissions="NOT_RUN",
            network_calls=0,
            overall="NOT_RUN",
            notes="default_cli_off",
        )

    def load_spec(self, raw: bytes, approval: ExternalApproval | None = None) -> ValidatedSpec:
        data, digest = parse_spec_bytes(raw)
        validated = validate_spec_document(data, digest, approval)
        self.spec_bytes = bytes(raw)
        self.spec = validated
        return validated

    def revalidate_frozen_spec(self, approval: ExternalApproval | None = None) -> ValidatedSpec:
        if self.spec is None or self.spec_bytes is None:
            raise RunnerError("spec_not_loaded")
        data, digest = parse_spec_bytes(self.spec_bytes)
        if digest != self.spec.raw_sha256:
            raise RunnerError("spec_hash_mismatch")
        validated = validate_spec_document(data, digest, approval)
        if validated != self.spec and (
            validated.raw_sha256 != self.spec.raw_sha256
            or validated.execution != self.spec.execution
            or validated.fixture_revision != self.spec.fixture_revision
        ):
            raise RunnerError("spec_drift")
        # Keep frozen snapshot; do not silently replace with a different object graph.
        return self.spec

    def offline_preflight(self) -> dict:
        transport = RecordingTransport(handler=lambda *a, **k: (_ for _ in ()).throw(RunnerError("preflight_network_refused")))
        probe = {"stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
                 "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False}

        def fake_prompt(label: str) -> str:
            return "fake-not-a-real-secret"

        adapter = ConsoleCredentialAdapter(prompt_fn=fake_prompt, stream_probe=lambda: probe)
        # Fake console path only; does not prove the agent terminal is private.
        adapter.assert_private_console()
        fake_pub = adapter.prompt_secret("publishable")
        fake_sec = adapter.prompt_secret("secret")
        if "fake" not in fake_pub or "fake" not in fake_sec:
            raise RunnerError("preflight_values_invalid")
        client = harness.Harness(
            target=None,
            execute=False,
            publishable_key="sb_publishable_fake_offline",
            admin_key="sb_secret_fake_offline",
            transport=transport,
        )
        with _patched_https_guard():
            report = harness.preparation_report()
            try:
                client.create_actor("ccc_view")
            except harness.HarnessError as exc:
                if str(exc) != "execution_off":
                    raise RunnerError("preflight_unexpected") from None
            try:
                client._request("rpc_read", "/rest/v1/rpc/x", {})
            except harness.HarnessError as exc:
                if str(exc) != "execution_off":
                    raise RunnerError("preflight_unexpected") from None
        if transport.calls:
            raise RunnerError("preflight_network_refused")
        client.forget()
        return safe_report(
            mode="offline_preflight",
            execution="OFF",
            native_auth="NOT_RUN",
            api_permissions="NOT_RUN",
            network_calls=0,
            overall="NOT_RUN",
            phases=["preflight"],
            notes="fake_preflight_only",
        )


class GuardedLiveOrchestrator:
    """Importable live stages for later review. Not reachable from default CLI."""

    def __init__(self, runner: OfflineRunner, approval: ExternalApproval):
        self.runner = runner
        self.approval = approval
        if "live_orchestrate" not in approval.approved_phases:
            raise RunnerError("live_phase_not_approved")

    def bind_client(self, publishable_key: str, admin_key: str, transport: Callable) -> harness.Harness:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.spec is None or self.runner.spec.execution != "REVIEWED_LIVE" or self.runner.spec.unresolved:
            raise RunnerError("live_spec_not_ready")
        if not isinstance(transport, RecordingTransport):
            # Production HTTPSTransport only when a later approval explicitly supplies it.
            if transport.__class__.__name__ == "HttpsTransport" and "real_https" not in self.approval.approved_phases:
                raise RunnerError("real_network_refused")
        client = harness.Harness(
            self.runner.spec.target,
            execute=True,
            publishable_key=publishable_key,
            admin_key=admin_key,
            transport=transport,
        )
        self.runner.client = client
        return client

    def create_actors(self) -> dict[str, str]:
        self.runner.revalidate_frozen_spec(self.approval)
        client = self.runner.client
        if client is None:
            raise RunnerError("client_not_bound")
        for label in sorted(ACTORS):
            if label in self.runner.create_attempted and label not in self.runner.create_confirmed:
                raise RunnerError("create_uncertain_stop")
            self.runner.create_attempted.add(label)
            try:
                result = client.create_actor(label)
            except Exception as exc:
                # Uncertain/failed create stops; never retry or invent readiness UNKNOWN.
                raise RunnerError("create_uncertain_stop") from None
            if not isinstance(result, dict) or result.get("created") is not True:
                raise RunnerError("create_uncertain_stop")
            if label not in client._actors:
                raise RunnerError("create_uncertain_stop")
            self.runner.create_confirmed.add(label)
        return actor_uuid_export(client)

    def export_nonsecret_mapping(self) -> str:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.spec is None or self.runner.client is None:
            raise RunnerError("export_not_ready")
        if self.runner.create_confirmed != set(ACTORS):
            raise RunnerError("export_not_ready")
        mapping = actor_uuid_export(self.runner.client)
        payload = {
            "target_ref": self.runner.spec.target.project_ref,
            "spec_sha256": self.runner.spec.raw_sha256,
            "fixture_revision": self.runner.spec.fixture_revision,
            "actor_uuids": mapping,
        }
        self.runner._export_payload = payload
        return write_uuid_handoff(
            self.runner.spec.handoff_directory,
            payload,
            worktree_root=self.runner.worktree_root,
        )

    def begin_fixture_pause(self) -> float:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.spec is None:
            raise RunnerError("spec_not_loaded")
        deadline = self.runner.clock() + float(self.runner.spec.max_fixture_wait_seconds)
        self.runner._paused_deadline = deadline
        return deadline

    def continue_after_acknowledgement(self, ack: dict) -> None:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner._paused_deadline is None or self.runner._export_payload is None:
            raise RunnerError("pause_not_active")
        if self.runner.clock() > self.runner._paused_deadline:
            raise RunnerError("fixture_wait_expired")
        if self.approval.expires_at <= dt.datetime.now(dt.timezone.utc):
            raise RunnerError("approval_expired")
        validate_fixture_acknowledgement(ack, self.runner._export_payload)

    def run_proof_cases(self) -> list[dict]:
        self.runner.revalidate_frozen_spec(self.approval)
        client = self.runner.client
        spec = self.runner.spec
        if client is None or spec is None:
            raise RunnerError("proof_not_ready")
        results = []
        for case in spec.cases:
            if case.expectation is None:
                raise RunnerError("expectation_required")
            kwargs = {
                "expectation": case.expectation,
            }
            if case.mode == "actor":
                kwargs["actor"] = case.actor
            elif case.mode == "invalid_session":
                kwargs["invalid_session"] = True
            try:
                if case.mode == "actor":
                    client.sign_in(case.actor)
                outcome = client.read_rpc(case.qualified_name, case.params, **kwargs)
            except Exception as exc:
                results.append({
                    "case_id": case.case_id,
                    "assertion": "SETUP_FAILURE",
                    "failure_code": _code(exc),
                })
                continue
            assertion = outcome.get("assertion")
            results.append({
                "case_id": case.case_id,
                "assertion": assertion,
                "http_status": outcome.get("http_status"),
                "body_shape": outcome.get("body_shape"),
            })
        return results

    @staticmethod
    def overall_from_cases(case_results: list[dict], *, setup_failure: bool) -> str:
        if setup_failure:
            return "SETUP_FAILURE"
        if not case_results:
            return "NOT_RUN"
        assertions = [item.get("assertion") for item in case_results]
        if any(value == "SETUP_FAILURE" for value in assertions):
            return "SETUP_FAILURE"
        if any(value == "MISMATCH" for value in assertions):
            return "FAIL"
        if any(value in (None, "UNVERIFIED", "NOT_RUN") for value in assertions):
            return "NOT_RUN"
        if all(value == "MATCH" for value in assertions):
            return "PASS_REVIEWED_ASSERTIONS_ONLY"
        return "NOT_RUN"


class _patched_https_guard:
    def __enter__(self):
        import http.client
        self._original = http.client.HTTPSConnection

        def blocked(*args, **kwargs):
            raise AssertionError("real_network_refused")

        http.client.HTTPSConnection = blocked  # type: ignore
        return self

    def __exit__(self, exc_type, exc, tb):
        import http.client
        http.client.HTTPSConnection = self._original
        return False


def file_sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    runner = OfflineRunner(worktree_root=Path(__file__).resolve().parents[3])
    try:
        with _patched_https_guard():
            if argv and argv[0] == "preflight":
                report = runner.offline_preflight()
            else:
                report = runner.default_report()
            if runner.client is not None:
                runner.client.forget()
    except Exception as exc:
        report = safe_report(
            overall="NOT_RUN",
            setup_failure=True,
            failure_code=_code(exc),
            notes="offline_failure",
        )
    print(json.dumps(report, sort_keys=True))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
