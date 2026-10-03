"""WP04 offline test-runner wrapper. Default CLI stays OFF with zero network."""
from __future__ import annotations

import copy
import dataclasses
import datetime as dt
import enum
import getpass
import hashlib
import json
import math
import os
import re
import sys
import time
import types
import uuid
import warnings
from pathlib import Path
from typing import Any, Callable

import auth_api_harness as harness

PRODUCTION = harness.PRODUCTION
BASELINE_READS = harness.BASELINE_READS
ACTORS = harness.ACTORS

HARNESS_SHA256 = "3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed"
WRAPPER_FILENAME = "test_runner.py"
HARNESS_FILENAME = "auth_api_harness.py"

ALLOWED_SPEC_TOP_KEYS = frozenset({
    "schema_version", "execution", "target", "fixture_revision", "marker",
    "approved_actions", "reviewed_reads", "actors", "cases",
    "max_fixture_wait_seconds", "handoff_directory", "phase_limits",
})
ALLOWED_TARGET_KEYS = frozenset({
    "project_ref", "host", "provider_verified_ref", "database_verified_ref",
    "approval_id", "expires_at",
})
ALLOWED_CASE_KEYS = frozenset({
    "case_id", "actor", "mode", "qualified_name", "params", "expectation",
})
ALLOWED_EXPECTATION_KEYS = frozenset({"http_status", "error_code", "body_checks"})
ALLOWED_ACK_KEYS = frozenset({
    "target_ref", "spec_sha256", "fixture_revision", "actor_uuids", "verified",
})
ALLOWED_EXPORT_KEYS = frozenset({
    "target_ref", "spec_sha256", "fixture_revision", "actor_uuids",
})
ALLOWED_ACTIONS = frozenset({"auth_create", "auth_signin", "rpc_read"})
ALLOWED_PHASE_LIMIT_KEYS = frozenset({"max_cases", "max_create_actors"})
CASE_MODES = frozenset({"actor", "anonymous", "invalid_session"})
UNRESOLVED = re.compile(r"^UNRESOLVED(?:_|$)")
CASE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$")

ALLOWED_MODES = frozenset({"offline_wrapper", "offline_preflight"})
ALLOWED_EXECUTION = frozenset({"OFF"})
ALLOWED_NATIVE = frozenset({"NOT_RUN"})
ALLOWED_OVERALL = frozenset({
    "NOT_RUN", "SETUP_FAILURE", "FAIL", "PASS_REVIEWED_ASSERTIONS_ONLY",
})
ALLOWED_NOTES = frozenset({
    "offline_only", "default_cli_off", "fake_preflight_only", "offline_failure",
})
ALLOWED_CLEANUP = frozenset({"local_forget_only"})
ALLOWED_ASSERTIONS = frozenset({
    "MATCH", "MISMATCH", "UNVERIFIED", "NOT_RUN", "SETUP_FAILURE",
})
KNOWN_FAILURE_CODES = frozenset({
    "report_field_refused", "report_value_refused", "duplicate_json_key",
    "spec_bytes_required", "spec_json_invalid", "spec_not_object",
    "unknown_spec_field", "spec_missing_field", "spec_schema_unsupported",
    "execution_value_refused", "target_not_object", "fixture_wait_invalid",
    "fixture_wait_unbounded", "spec_collection_invalid", "duplicate_actor_or_action",
    "unsupported_action", "approved_actions_empty", "reviewed_reads_empty",
    "actor_matrix_invalid", "read_not_in_baseline_without_review", "read_name_invalid",
    "expiry_invalid", "expiry_timezone_required", "case_not_object",
    "duplicate_or_invalid_case_id", "case_mode_refused", "case_actor_invalid",
    "case_read_not_allowlisted", "case_params_invalid", "expectation_required",
    "expectation_invalid", "expectation_status_invalid", "expectation_error_invalid",
    "expectation_body_invalid", "expectation_nonfinite", "spec_hash_mismatch",
    "harness_hash_mismatch", "wrapper_hash_mismatch", "harness_artifact_drift",
    "approval_expired", "approval_missing", "approval_id_mismatch",
    "unresolved_sample_not_live", "production_target_refused", "invalid_target",
    "unknown_host_refused", "identity_not_reconciled", "phase_limits_invalid",
    "phase_limit_cardinality", "transport_handler_missing", "real_network_refused",
    "transport_not_trusted", "console_not_private", "secret_echo_refused",
    "secret_prompt_failed", "secret_empty", "actor_export_invalid",
    "actor_export_incomplete", "actor_export_duplicate_uuid", "handoff_payload_invalid",
    "handoff_root_required", "handoff_path_not_absolute", "handoff_inside_worktree",
    "handoff_path_unsupported", "handoff_path_invalid", "handoff_symlink_refused",
    "handoff_path_guarantee_unsupported", "handoff_dest_missing",
    "handoff_overwrite_refused", "handoff_create_failed", "handoff_write_failed",
    "ack_invalid", "ack_not_verified", "ack_identity_mismatch", "ack_actor_mismatch",
    "spec_not_loaded", "spec_drift", "spec_source_required", "preflight_network_refused",
    "preflight_unexpected", "preflight_values_invalid", "live_phase_not_approved",
    "live_spec_not_ready", "stage_refused", "client_not_bound", "create_uncertain_stop",
    "export_not_ready", "pause_not_active", "pause_already_used", "fixture_wait_expired",
    "proof_not_ready", "proof_incomplete", "setup_failure_terminal",
    "approval_binding_changed", "runner_internal_error",
    # Pass-through harness codes that may appear at public boundaries:
    "execution_off", "native_session_missing", "actor_creation_failed",
    "assertion_failed", "target_missing", "operation_not_approved",
})

REPORT_FIELDS = (
    "mode", "execution", "native_auth", "api_permissions", "network_calls",
    "overall", "phases", "cases", "setup_failure", "failure_code", "cleanup", "notes",
)


class RunnerError(Exception):
    """Fixed local codes only."""

    def __init__(self, code: str):
        if code not in KNOWN_FAILURE_CODES:
            code = "runner_internal_error"
        super().__init__(code)


class Stage(enum.Enum):
    INIT = "init"
    BOUND = "bound"
    ACTORS_CREATED = "actors_created"
    EXPORTED = "exported"
    PAUSED = "paused"
    ACKED = "acked"
    PROOF_DONE = "proof_done"
    FAILED = "failed"


def _code(exc: BaseException) -> str:
    text = str(exc) if isinstance(exc, (RunnerError, harness.HarnessError)) else ""
    if text in KNOWN_FAILURE_CODES:
        return text
    return "runner_internal_error"


def _freeze(value: Any) -> Any:
    if isinstance(value, dict):
        return types.MappingProxyType({key: _freeze(item) for key, item in value.items()})
    if isinstance(value, list):
        return tuple(_freeze(item) for item in value)
    if isinstance(value, tuple):
        return tuple(_freeze(item) for item in value)
    return value


def _thaw_dict(value: Any) -> dict:
    if isinstance(value, types.MappingProxyType):
        return {key: _thaw_dict(item) if isinstance(item, types.MappingProxyType)
                else list(_thaw_list(item)) if isinstance(item, tuple) else item
                for key, item in value.items()}
    if isinstance(value, dict):
        return copy.deepcopy(value)
    raise RunnerError("case_params_invalid")


def _thaw_list(value: tuple) -> list:
    out = []
    for item in value:
        if isinstance(item, types.MappingProxyType):
            out.append(_thaw_dict(item))
        elif isinstance(item, tuple):
            out.append(_thaw_list(item))
        else:
            out.append(item)
    return out


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
    return _validate_report(out)


def _validate_report(report: dict) -> dict:
    if set(report) != set(REPORT_FIELDS):
        raise RunnerError("report_field_refused")
    if type(report["mode"]) is not str or report["mode"] not in ALLOWED_MODES:
        raise RunnerError("report_value_refused")
    if type(report["execution"]) is not str or report["execution"] not in ALLOWED_EXECUTION:
        raise RunnerError("report_value_refused")
    if (type(report["native_auth"]) is not str or type(report["api_permissions"]) is not str
            or report["native_auth"] not in ALLOWED_NATIVE
            or report["api_permissions"] not in ALLOWED_NATIVE):
        raise RunnerError("report_value_refused")
    if type(report["network_calls"]) is not int or report["network_calls"] < 0:
        raise RunnerError("report_value_refused")
    if type(report["overall"]) is not str or report["overall"] not in ALLOWED_OVERALL:
        raise RunnerError("report_value_refused")
    if type(report["notes"]) is not str or report["notes"] not in ALLOWED_NOTES:
        raise RunnerError("report_value_refused")
    if type(report["cleanup"]) is not str or report["cleanup"] not in ALLOWED_CLEANUP:
        raise RunnerError("report_value_refused")
    if type(report["setup_failure"]) is not bool:
        raise RunnerError("report_value_refused")
    if (report["failure_code"] is not None
            and (type(report["failure_code"]) is not str
                 or report["failure_code"] not in KNOWN_FAILURE_CODES)):
        raise RunnerError("report_value_refused")
    if not isinstance(report["phases"], list) or any(not isinstance(item, str) or not CASE_ID_RE.match(item) for item in report["phases"]):
        raise RunnerError("report_value_refused")
    if not isinstance(report["cases"], list):
        raise RunnerError("report_value_refused")
    sanitized_cases = []
    for item in report["cases"]:
        if not isinstance(item, dict):
            raise RunnerError("report_value_refused")
        case_id = item.get("case_id")
        assertion = item.get("assertion")
        if not isinstance(case_id, str) or not CASE_ID_RE.match(case_id):
            raise RunnerError("report_value_refused")
        if assertion not in ALLOWED_ASSERTIONS:
            raise RunnerError("report_value_refused")
        entry = {"case_id": case_id, "assertion": assertion}
        if "failure_code" in item:
            code = item["failure_code"]
            if code is not None and code not in KNOWN_FAILURE_CODES:
                raise RunnerError("report_value_refused")
            entry["failure_code"] = code
        if "http_status" in item:
            status = item["http_status"]
            if type(status) is not int or not 100 <= status <= 599:
                raise RunnerError("report_value_refused")
            entry["http_status"] = status
        if "body_shape" in item:
            shape = item["body_shape"]
            if shape not in ("object", "array", "other"):
                raise RunnerError("report_value_refused")
            entry["body_shape"] = shape
        if set(item) - set(entry):
            raise RunnerError("report_value_refused")
        sanitized_cases.append(entry)
    report = dict(report)
    report["cases"] = sanitized_cases
    return report


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
    try:
        text = bytes(raw).decode("utf-8")
    except UnicodeDecodeError:
        raise RunnerError("spec_json_invalid") from None
    try:
        data = json.loads(text, object_pairs_hook=_reject_duplicates)
    except RunnerError:
        raise
    except Exception:
        raise RunnerError("spec_json_invalid") from None
    if not isinstance(data, dict):
        raise RunnerError("spec_not_object")
    return data, hashlib.sha256(bytes(raw)).hexdigest()


def _require_keys(data: dict, allowed: frozenset, required: frozenset) -> None:
    if set(data) - allowed:
        raise RunnerError("unknown_spec_field")
    if required - set(data):
        raise RunnerError("spec_missing_field")


def _is_unresolved(value: Any) -> bool:
    return isinstance(value, str) and bool(UNRESOLVED.match(value))


def file_sha256(path: Path) -> str:
    try:
        data = path.read_bytes()
    except OSError:
        raise RunnerError("spec_source_required") from None
    # Reviewed text hashes are LF-canonical; normalize CRLF working-tree checkouts.
    if b"\r\n" in data:
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def verify_source_artifacts(approval: ExternalApproval, harness_file: Path, wrapper_file: Path) -> None:
    harness_digest = file_sha256(harness_file)
    wrapper_digest = file_sha256(wrapper_file)
    if harness_digest != approval.expected_harness_sha256:
        raise RunnerError("harness_hash_mismatch")
    if harness_digest != HARNESS_SHA256:
        raise RunnerError("harness_artifact_drift")
    if wrapper_digest != approval.expected_wrapper_sha256:
        raise RunnerError("wrapper_hash_mismatch")


ALLOWED_APPROVAL_PHASES = frozenset({"live_orchestrate", "real_https"})


@dataclasses.dataclass(frozen=True)
class ExternalApproval:
    expected_spec_sha256: str
    expected_harness_sha256: str
    expected_wrapper_sha256: str
    approval_id: str
    expires_at: dt.datetime
    approved_phases: frozenset
    approved_actions: frozenset = frozenset({"auth_create", "auth_signin", "rpc_read"})

    def __post_init__(self):
        if not isinstance(self.approved_phases, (set, frozenset, list, tuple)):
            raise RunnerError("live_phase_not_approved")
        if not isinstance(self.approved_actions, (set, frozenset, list, tuple)):
            raise RunnerError("unsupported_action")
        if any(type(value) is not str for value in self.approved_phases):
            raise RunnerError("live_phase_not_approved")
        if any(type(value) is not str for value in self.approved_actions):
            raise RunnerError("unsupported_action")
        phases = frozenset(self.approved_phases)
        actions = frozenset(self.approved_actions)
        if type(self.expected_spec_sha256) is not str or type(self.expected_harness_sha256) is not str:
            raise RunnerError("approval_missing")
        if type(self.expected_wrapper_sha256) is not str or type(self.approval_id) is not str:
            raise RunnerError("approval_missing")
        if not self.approval_id:
            raise RunnerError("approval_missing")
        if not isinstance(self.expires_at, dt.datetime) or self.expires_at.tzinfo is None:
            raise RunnerError("approval_expired")
        if not phases or phases - ALLOWED_APPROVAL_PHASES:
            raise RunnerError("live_phase_not_approved")
        if not actions or actions - ALLOWED_ACTIONS:
            raise RunnerError("unsupported_action")
        object.__setattr__(self, "approved_phases", phases)
        object.__setattr__(self, "approved_actions", actions)
        object.__setattr__(self, "_fingerprint", (
            self.expected_spec_sha256,
            self.expected_harness_sha256,
            self.expected_wrapper_sha256,
            self.approval_id,
            self.expires_at,
            phases,
            actions,
        ))

    def fingerprint(self) -> tuple:
        return (
            self.expected_spec_sha256,
            self.expected_harness_sha256,
            self.expected_wrapper_sha256,
            self.approval_id,
            self.expires_at,
            frozenset(self.approved_phases),
            frozenset(self.approved_actions),
        )

    def assert_unchanged(self) -> None:
        if self.fingerprint() != getattr(self, "_fingerprint"):
            raise RunnerError("approval_binding_changed")


@dataclasses.dataclass(frozen=True)
class CaseSpec:
    case_id: str
    mode: str
    actor: str | None
    qualified_name: str
    params: Any
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
    phase_limits: Any


def _fingerprint_spec(spec: ValidatedSpec) -> tuple:
    cases = []
    for case in spec.cases:
        cases.append((
            case.case_id, case.mode, case.actor, case.qualified_name,
            case.params,
            case.expectation.http_status, case.expectation.error_code,
            case.expectation.body_checks,
        ))
    target = spec.target
    return (
        spec.raw_sha256, spec.execution, spec.unresolved,
        target.project_ref, target.host, target.provider_verified_ref,
        target.database_verified_ref, target.approval_id, frozenset(target.approved_actions),
        target.expires_at, frozenset(target.reviewed_reads),
        spec.fixture_revision, spec.marker, spec.actors,
        tuple(cases), spec.max_fixture_wait_seconds,
        spec.handoff_directory, spec.phase_limits,
    )


def _validate_phase_limits(phase_limits: dict, case_count: int) -> Any:
    if not isinstance(phase_limits, dict):
        raise RunnerError("phase_limits_invalid")
    if set(phase_limits) - ALLOWED_PHASE_LIMIT_KEYS:
        raise RunnerError("phase_limits_invalid")
    if "max_cases" not in phase_limits or "max_create_actors" not in phase_limits:
        raise RunnerError("phase_limits_invalid")
    max_cases = phase_limits["max_cases"]
    max_create = phase_limits["max_create_actors"]
    if type(max_cases) is not int or type(max_create) is not int:
        raise RunnerError("phase_limits_invalid")
    if max_cases < 1 or max_cases > 1000 or max_create != 4:
        raise RunnerError("phase_limits_invalid")
    if case_count > max_cases:
        raise RunnerError("phase_limit_cardinality")
    return _freeze({"max_cases": max_cases, "max_create_actors": max_create})


def _validate_spec_document(
    data: dict,
    raw_sha256: str,
    approval: ExternalApproval | None = None,
) -> ValidatedSpec:
    if not isinstance(data, dict):
        raise RunnerError("spec_not_object")
    _require_keys(
        data,
        ALLOWED_SPEC_TOP_KEYS,
        frozenset(ALLOWED_SPEC_TOP_KEYS),
    )
    if type(data["schema_version"]) is not int or data["schema_version"] != 1:
        raise RunnerError("spec_schema_unsupported")
    execution = data["execution"]
    if type(execution) is not str or execution not in ("OFF", "REVIEWED_LIVE"):
        raise RunnerError("execution_value_refused")

    target_data = data["target"]
    if not isinstance(target_data, dict):
        raise RunnerError("target_not_object")
    _require_keys(target_data, ALLOWED_TARGET_KEYS, frozenset(ALLOWED_TARGET_KEYS))

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
    if not isinstance(cases, list):
        raise RunnerError("spec_collection_invalid")
    if any(type(item) is not str for item in actions + reads + actors):
        raise RunnerError("spec_collection_invalid")
    if not actions:
        raise RunnerError("approved_actions_empty")
    if not reads:
        raise RunnerError("reviewed_reads_empty")
    if len(set(actions)) != len(actions) or len(set(reads)) != len(reads) or len(set(actors)) != len(actors):
        raise RunnerError("duplicate_actor_or_action")
    if set(actions) - ALLOWED_ACTIONS:
        raise RunnerError("unsupported_action")
    if set(actors) != set(ACTORS) or len(actors) != len(ACTORS):
        raise RunnerError("actor_matrix_invalid")
    if set(reads) - set(BASELINE_READS):
        if not unresolved:
            raise RunnerError("read_not_in_baseline_without_review")
    for name in reads:
        if not re.fullmatch(r"[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*", name):
            raise RunnerError("read_name_invalid")

    frozen_limits = _validate_phase_limits(phase_limits, len(cases))

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
        _require_keys(case, ALLOWED_CASE_KEYS, frozenset({"case_id", "mode", "qualified_name", "params", "expectation"}))
        case_id = case["case_id"]
        if type(case_id) is not str or not CASE_ID_RE.match(case_id) or case_id in case_ids:
            raise RunnerError("duplicate_or_invalid_case_id")
        case_ids.add(case_id)
        mode = case["mode"]
        if type(mode) is not str or mode not in CASE_MODES:
            raise RunnerError("case_mode_refused")
        actor = case.get("actor")
        if mode == "actor":
            if actor not in ACTORS:
                raise RunnerError("case_actor_invalid")
        elif actor is not None:
            raise RunnerError("case_actor_invalid")
        qualified = case["qualified_name"]
        if type(qualified) is not str:
            raise RunnerError("case_read_not_allowlisted")
        if _is_unresolved(qualified):
            unresolved = True
        elif qualified not in reads:
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
        if type(status) is not int or not 100 <= status <= 599:
            raise RunnerError("expectation_status_invalid")
        error_code = expectation.get("error_code")
        if error_code is not None and type(error_code) is not str:
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
            if any(type(part) not in (str, int) for part in path):
                raise RunnerError("expectation_body_invalid")
            if type(expected) is float and not math.isfinite(expected):
                raise RunnerError("expectation_nonfinite")
            if type(expected) not in (str, int, float, bool, type(None)):
                raise RunnerError("expectation_body_invalid")
            body_checks.append((tuple(path), expected))
        parsed_cases.append(CaseSpec(
            case_id=case_id,
            mode=mode,
            actor=actor if mode == "actor" else None,
            qualified_name=qualified,
            params=_freeze(params),
            expectation=harness.ReadExpectation(status, error_code, tuple(body_checks)),
        ))

    if execution == "OFF" or unresolved:
        execution = "OFF"

    if approval is not None:
        if raw_sha256 != approval.expected_spec_sha256:
            raise RunnerError("spec_hash_mismatch")
        if approval.expires_at.tzinfo is None or approval.expires_at <= dt.datetime.now(dt.timezone.utc):
            raise RunnerError("approval_expired")
        if not approval.approval_id or type(approval.approval_id) is not str:
            raise RunnerError("approval_missing")
        if set(approval.approved_actions) - ALLOWED_ACTIONS or not approval.approved_actions:
            raise RunnerError("unsupported_action")
        if set(actions) - set(approval.approved_actions):
            raise RunnerError("unsupported_action")

    if unresolved and execution != "OFF":
        raise RunnerError("unresolved_sample_not_live")

    project_ref = target_data["project_ref"]
    host = target_data["host"]
    approval_id = target_data["approval_id"]
    for key in ALLOWED_TARGET_KEYS:
        if type(target_data[key]) is not str:
            raise RunnerError("invalid_target")
    if not unresolved:
        if project_ref == PRODUCTION or PRODUCTION in host:
            raise RunnerError("production_target_refused")
        if not re.fullmatch(r"[a-z]{20}", project_ref):
            raise RunnerError("invalid_target")
        if host != project_ref + ".supabase.co":
            raise RunnerError("unknown_host_refused")
        if target_data["provider_verified_ref"] != project_ref or target_data["database_verified_ref"] != project_ref:
            raise RunnerError("identity_not_reconciled")
        if expires_at <= dt.datetime.now(dt.timezone.utc):
            raise RunnerError("approval_expired")
        if approval is not None and approval.approval_id != approval_id:
            raise RunnerError("approval_id_mismatch")

    target = harness.Target(
        project_ref="abcdefghijklmnopqrst" if unresolved else project_ref,
        host=("abcdefghijklmnopqrst.supabase.co" if unresolved else host),
        provider_verified_ref="abcdefghijklmnopqrst" if unresolved else target_data["provider_verified_ref"],
        database_verified_ref="abcdefghijklmnopqrst" if unresolved else target_data["database_verified_ref"],
        approval_id="unresolved-offline" if unresolved else approval_id,
        approved_actions=frozenset(actions),
        expires_at=expires_at,
        reviewed_reads=frozenset(reads),
    )
    fixture_revision = data["fixture_revision"]
    marker = data["marker"]
    handoff_directory = data["handoff_directory"]
    if type(fixture_revision) is not str or type(marker) is not str or type(handoff_directory) is not str:
        raise RunnerError("spec_collection_invalid")
    return ValidatedSpec(
        raw_sha256=raw_sha256,
        execution=execution,
        unresolved=unresolved,
        target=target,
        fixture_revision=fixture_revision,
        marker=marker,
        actors=tuple(sorted(actors)),
        cases=tuple(parsed_cases),
        max_fixture_wait_seconds=data["max_fixture_wait_seconds"],
        handoff_directory=handoff_directory,
        phase_limits=frozen_limits,
    )


def validate_spec_document(
    data: dict,
    raw_sha256: str,
    approval: ExternalApproval | None = None,
) -> ValidatedSpec:
    """Public validation boundary: expose only fixed local failure codes."""
    try:
        return _validate_spec_document(data, raw_sha256, approval)
    except RunnerError:
        raise
    except Exception:
        raise RunnerError("runner_internal_error") from None


class TrustedFakeTransport:
    """Explicit offline fake transport. Never opens sockets."""

    def __init__(self, handler: Callable | None = None):
        self.calls: list[tuple] = []
        self.handler = handler

    def __call__(self, host, method, path, headers, body):
        self.calls.append((host, method, path, dict(headers), body))
        if self.handler is None:
            raise RunnerError("transport_handler_missing")
        return self.handler(host, method, path, headers, body)


class GuardTransport:
    def __call__(self, *args, **kwargs):
        raise RunnerError("real_network_refused")


def accept_transport(transport: Callable, approval: ExternalApproval) -> None:
    if isinstance(transport, TrustedFakeTransport):
        return
    if isinstance(transport, harness.HttpsTransport):
        if "real_https" not in approval.approved_phases:
            raise RunnerError("real_network_refused")
        return
    raise RunnerError("transport_not_trusted")


class ConsoleCredentialAdapter:
    def __init__(self, prompt_fn: Callable | None = None, stream_probe: Callable | None = None):
        self._prompt_fn = prompt_fn
        self._stream_probe = stream_probe or self._default_probe

    @staticmethod
    def _default_probe() -> dict:
        return {
            "stdin_isatty": sys.stdin.isatty(),
            "stdout_isatty": sys.stdout.isatty(),
            "stderr_isatty": sys.stderr.isatty(),
            "stdin_redirected": not sys.stdin.isatty(),
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
        try:
            with warnings.catch_warnings():
                warnings.simplefilter("error", getpass.GetPassWarning)
                value = getpass.getpass(prompt=f"{label}: ")
        except getpass.GetPassWarning:
            raise RunnerError("secret_echo_refused") from None
        except RunnerError:
            raise
        except Exception:
            raise RunnerError("secret_prompt_failed") from None
        if type(value) is not str or not value:
            raise RunnerError("secret_empty")
        return value


def actor_uuid_export(client: harness.Harness) -> dict[str, str]:
    mapping: dict[str, str] = {}
    for label, triple in client._actors.items():
        if label not in ACTORS:
            raise RunnerError("actor_export_invalid")
        try:
            mapping[label] = str(uuid.UUID(triple[0]))
        except (ValueError, TypeError, AttributeError):
            raise RunnerError("actor_export_invalid") from None
    if set(mapping) != set(ACTORS) or len(mapping) != 4:
        raise RunnerError("actor_export_incomplete")
    if len(set(mapping.values())) != 4:
        raise RunnerError("actor_export_duplicate_uuid")
    return mapping


def _is_reparse_point(path: Path) -> bool:
    if os.path.islink(path):
        return True
    if os.name == "nt":
        try:
            import ctypes
            attrs = ctypes.windll.kernel32.GetFileAttributesW(str(path))
            if attrs == -1:
                return False
            return bool(attrs & 0x400)
        except Exception:
            raise RunnerError("handoff_path_guarantee_unsupported") from None
    return False


def write_uuid_handoff(destination_dir: str, payload: dict, *, worktree_root: Path) -> str:
    if worktree_root is None:
        raise RunnerError("handoff_root_required")
    if set(payload) != ALLOWED_EXPORT_KEYS:
        raise RunnerError("handoff_payload_invalid")
    for key in ("target_ref", "spec_sha256", "fixture_revision"):
        if type(payload[key]) is not str or not payload[key] or _is_unresolved(payload[key]):
            raise RunnerError("handoff_payload_invalid")
    actors = payload["actor_uuids"]
    if not isinstance(actors, dict) or set(actors) != set(ACTORS):
        raise RunnerError("handoff_payload_invalid")
    values = []
    for label, value in actors.items():
        if type(value) is not str:
            raise RunnerError("handoff_payload_invalid")
        try:
            values.append(str(uuid.UUID(value)))
        except (ValueError, TypeError, AttributeError):
            raise RunnerError("handoff_payload_invalid") from None
    if len(set(values)) != 4:
        raise RunnerError("actor_export_duplicate_uuid")

    if type(destination_dir) is not str or not destination_dir:
        raise RunnerError("handoff_path_invalid")
    dest = Path(destination_dir)
    if not dest.is_absolute():
        raise RunnerError("handoff_path_not_absolute")
    try:
        resolved_root = worktree_root.resolve()
    except Exception:
        raise RunnerError("handoff_path_unsupported") from None

    # Inspect every existing ancestor even when the leaf is absent.
    cursor = dest
    chain = [cursor, *list(cursor.parents)]
    for node in chain:
        if node.exists() and _is_reparse_point(node):
            raise RunnerError("handoff_symlink_refused")
    if not dest.exists():
        raise RunnerError("handoff_dest_missing")
    if not dest.is_dir():
        raise RunnerError("handoff_path_invalid")
    try:
        resolved_dest = dest.resolve()
    except Exception:
        raise RunnerError("handoff_path_unsupported") from None
    if resolved_dest == resolved_root or resolved_root in resolved_dest.parents:
        raise RunnerError("handoff_inside_worktree")
    if _is_reparse_point(resolved_dest):
        raise RunnerError("handoff_symlink_refused")

    path = dest / "wp04-actor-uuid-handoff.json"
    if path.exists():
        raise RunnerError("handoff_overwrite_refused")
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
        written = os.write(fd, encoded)
        if written != len(encoded):
            raise RunnerError("handoff_write_failed")
    except RunnerError:
        os.close(fd)
        try:
            os.unlink(path)
        except OSError:
            pass
        raise
    except Exception:
        os.close(fd)
        try:
            os.unlink(path)
        except OSError:
            pass
        raise RunnerError("handoff_write_failed") from None
    else:
        os.close(fd)
    return str(path)


def validate_fixture_acknowledgement(ack: dict, expected: dict) -> None:
    if not isinstance(ack, dict) or set(ack) != ALLOWED_ACK_KEYS:
        raise RunnerError("ack_invalid")
    if ack.get("verified") is not True:
        raise RunnerError("ack_not_verified")
    for key in ("target_ref", "spec_sha256", "fixture_revision"):
        if ack.get(key) != expected.get(key):
            raise RunnerError("ack_identity_mismatch")
    if ack.get("actor_uuids") != expected.get("actor_uuids"):
        raise RunnerError("ack_actor_mismatch")


class OfflineRunner:
    def __init__(
        self,
        *,
        transport: Callable | None = None,
        prompt: ConsoleCredentialAdapter | None = None,
        worktree_root: Path | None = None,
        clock: Callable[[], float] | None = None,
        package_dir: Path | None = None,
    ):
        self.transport = transport if transport is not None else GuardTransport()
        self.prompt = prompt or ConsoleCredentialAdapter()
        self.worktree_root = worktree_root
        self.clock = clock or time.monotonic
        self.package_dir = package_dir or Path(__file__).resolve().parent
        self.spec: ValidatedSpec | None = None
        self.spec_bytes: bytes | None = None
        self.spec_source: Path | None = None
        self.client: harness.Harness | None = None
        self.stage = Stage.INIT
        self.create_attempted: set[str] = set()
        self.create_confirmed: set[str] = set()
        self._paused_deadline: float | None = None
        self._pause_used = False
        self._export_payload: dict | None = None
        self._ack_verified = False
        self._terminal_failure = False
        self._reconciliation: dict[str, str] = {}
        self._retained_spec_fingerprint: tuple | None = None
        self._retained_approval_fingerprint: tuple | None = None
        self._expected_case_ids: tuple[str, ...] | None = None

    def default_report(self) -> dict:
        return safe_report(mode="offline_wrapper", notes="default_cli_off")

    def load_spec(
        self,
        raw: bytes,
        approval: ExternalApproval | None = None,
        *,
        source_path: Path | None = None,
    ) -> ValidatedSpec:
        data, digest = parse_spec_bytes(raw)
        if approval is not None:
            approval.assert_unchanged()
            verify_source_artifacts(
                approval,
                self.package_dir / HARNESS_FILENAME,
                self.package_dir / WRAPPER_FILENAME,
            )
            self._retained_approval_fingerprint = approval.fingerprint()
        validated = validate_spec_document(data, digest, approval)
        self.spec_bytes = bytes(raw)
        self.spec = validated
        self.spec_source = source_path
        self._retained_spec_fingerprint = _fingerprint_spec(validated)
        self._expected_case_ids = tuple(case.case_id for case in validated.cases)
        return validated

    def _assert_bindings(self, approval: ExternalApproval | None) -> None:
        if self._retained_spec_fingerprint is None or self.spec is None:
            raise RunnerError("spec_not_loaded")
        if _fingerprint_spec(self.spec) != self._retained_spec_fingerprint:
            raise RunnerError("spec_drift")
        if approval is not None:
            approval.assert_unchanged()
            if self._retained_approval_fingerprint is None:
                raise RunnerError("approval_binding_changed")
            if approval.fingerprint() != self._retained_approval_fingerprint:
                raise RunnerError("approval_binding_changed")

    def revalidate_frozen_spec(self, approval: ExternalApproval | None = None) -> ValidatedSpec:
        if self.spec is None or self.spec_bytes is None:
            raise RunnerError("spec_not_loaded")
        if self._terminal_failure:
            raise RunnerError("setup_failure_terminal")
        try:
            self._assert_bindings(approval)
            if self.spec_source is not None:
                try:
                    disk = self.spec_source.read_bytes()
                except OSError:
                    raise RunnerError("spec_source_required") from None
                disk_norm = disk.replace(b"\r\n", b"\n") if b"\r\n" in disk else disk
                retained_norm = (
                    self.spec_bytes.replace(b"\r\n", b"\n")
                    if b"\r\n" in self.spec_bytes else self.spec_bytes
                )
                if hashlib.sha256(disk_norm).hexdigest() != self.spec.raw_sha256:
                    raise RunnerError("spec_drift")
                if disk_norm != retained_norm:
                    raise RunnerError("spec_drift")
            if approval is not None:
                verify_source_artifacts(
                    approval,
                    self.package_dir / HARNESS_FILENAME,
                    self.package_dir / WRAPPER_FILENAME,
                )
            data, digest = parse_spec_bytes(self.spec_bytes)
            if digest != self.spec.raw_sha256:
                raise RunnerError("spec_hash_mismatch")
            validated = validate_spec_document(data, digest, approval)
            if _fingerprint_spec(validated) != self._retained_spec_fingerprint:
                raise RunnerError("spec_drift")
            self.spec = validated
            return self.spec
        except (KeyboardInterrupt, SystemExit):
            self._dispose_terminal()
            raise
        except Exception as exc:
            self._critical_fail(_code(exc))

    def _critical_fail(self, code: str) -> None:
        if self.client is not None:
            self._fail_terminal(code)
        raise RunnerError(code)

    def _fail_terminal(self, code: str) -> None:
        self._dispose_terminal()
        raise RunnerError(code)

    def _dispose_terminal(self) -> None:
        self._terminal_failure = True
        self.stage = Stage.FAILED
        self._ack_verified = False
        self._paused_deadline = None
        if self.client is not None:
            for label in sorted(self.create_attempted):
                status = "confirmed" if label in self.create_confirmed else "uncertain"
                self._reconciliation[label] = status
            self.client.forget()

    def offline_preflight(self) -> dict:
        transport = TrustedFakeTransport(
            handler=lambda *a, **k: (_ for _ in ()).throw(RunnerError("preflight_network_refused"))
        )
        probe = {
            "stdin_isatty": True, "stdout_isatty": True, "stderr_isatty": True,
            "stdin_redirected": False, "stdout_redirected": False, "stderr_redirected": False,
        }

        def fake_prompt(label: str) -> str:
            return "fake-not-a-real-secret"

        adapter = ConsoleCredentialAdapter(prompt_fn=fake_prompt, stream_probe=lambda: probe)
        adapter.assert_private_console()
        fake_pub = adapter.prompt_secret("publishable")
        fake_sec = adapter.prompt_secret("secret")
        if "fake" not in fake_pub or "fake" not in fake_sec:
            raise RunnerError("preflight_values_invalid")
        client = harness.Harness(
            target=None, execute=False,
            publishable_key="sb_publishable_fake_offline",
            admin_key="sb_secret_fake_offline",
            transport=transport,
        )
        with _patched_https_guard():
            harness.preparation_report()
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
        return safe_report(mode="offline_preflight", phases=["preflight"], notes="fake_preflight_only")


class GuardedLiveOrchestrator:
    def __init__(self, runner: OfflineRunner, approval: ExternalApproval):
        self.runner = runner
        self.approval = approval
        if "live_orchestrate" not in approval.approved_phases:
            raise RunnerError("live_phase_not_approved")

    def bind_client(self, publishable_key: str, admin_key: str, transport: Callable) -> harness.Harness:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage not in (Stage.INIT,):
            raise RunnerError("stage_refused")
        if self.runner.spec is None or self.runner.spec.execution != "REVIEWED_LIVE" or self.runner.spec.unresolved:
            raise RunnerError("live_spec_not_ready")
        accept_transport(transport, self.approval)
        if "auth_create" not in self.approval.approved_actions:
            raise RunnerError("live_phase_not_approved")
        client = harness.Harness(
            self.runner.spec.target,
            execute=True,
            publishable_key=publishable_key,
            admin_key=admin_key,
            transport=transport,
        )
        self.runner.client = client
        self.runner.stage = Stage.BOUND
        return client

    def create_actors(self) -> dict[str, str]:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage != Stage.BOUND:
            raise RunnerError("stage_refused")
        client = self.runner.client
        if client is None:
            raise RunnerError("client_not_bound")
        limits = self.runner.spec.phase_limits
        if limits["max_create_actors"] != 4:
            raise RunnerError("phase_limit_cardinality")
        for label in sorted(ACTORS):
            self.runner.revalidate_frozen_spec(self.approval)
            self.approval.assert_unchanged()
            if label in self.runner.create_attempted and label not in self.runner.create_confirmed:
                self.runner._fail_terminal("create_uncertain_stop")
            self.runner.create_attempted.add(label)
            try:
                result = client.create_actor(label)
            except (KeyboardInterrupt, SystemExit):
                self.runner._dispose_terminal()
                raise
            except Exception:
                self.runner._fail_terminal("create_uncertain_stop")
            if not isinstance(result, dict) or result.get("created") is not True or label not in client._actors:
                self.runner._fail_terminal("create_uncertain_stop")
            self.runner.create_confirmed.add(label)
        mapping = actor_uuid_export(client)
        self.runner.stage = Stage.ACTORS_CREATED
        return mapping

    def export_nonsecret_mapping(self) -> str:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage != Stage.ACTORS_CREATED:
            raise RunnerError("stage_refused")
        if self.runner.worktree_root is None:
            raise RunnerError("handoff_root_required")
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
        try:
            path = write_uuid_handoff(
                self.runner.spec.handoff_directory,
                payload,
                worktree_root=self.runner.worktree_root,
            )
        except (KeyboardInterrupt, SystemExit):
            self.runner._dispose_terminal()
            raise
        except Exception as exc:
            self.runner._fail_terminal(_code(exc))
        self.runner._export_payload = payload
        self.runner.stage = Stage.EXPORTED
        return path

    def begin_fixture_pause(self) -> float:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage != Stage.EXPORTED:
            raise RunnerError("stage_refused")
        if self.runner._pause_used:
            raise RunnerError("pause_already_used")
        if self.runner.spec is None:
            raise RunnerError("spec_not_loaded")
        deadline = self.runner.clock() + float(self.runner.spec.max_fixture_wait_seconds)
        self.runner._paused_deadline = deadline
        self.runner._pause_used = True
        self.runner.stage = Stage.PAUSED
        return deadline

    def continue_after_acknowledgement(self, ack: dict) -> None:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage != Stage.PAUSED:
            raise RunnerError("stage_refused")
        if self.runner._paused_deadline is None or self.runner._export_payload is None:
            raise RunnerError("pause_not_active")
        if self.runner.clock() > self.runner._paused_deadline:
            self.runner._fail_terminal("fixture_wait_expired")
        if self.approval.expires_at <= dt.datetime.now(dt.timezone.utc):
            self.runner._fail_terminal("approval_expired")
        try:
            self.approval.assert_unchanged()
            if self.approval.fingerprint() != self.runner._retained_approval_fingerprint:
                raise RunnerError("approval_binding_changed")
            validate_fixture_acknowledgement(ack, self.runner._export_payload)
        except (KeyboardInterrupt, SystemExit):
            self.runner._dispose_terminal()
            raise
        except Exception as exc:
            self.runner._fail_terminal(_code(exc))
        self.runner._ack_verified = True
        self.runner.stage = Stage.ACKED

    def run_proof_cases(self) -> list[dict]:
        self.runner.revalidate_frozen_spec(self.approval)
        if self.runner.stage != Stage.ACKED or not self.runner._ack_verified:
            raise RunnerError("proof_not_ready")
        client = self.runner.client
        spec = self.runner.spec
        if client is None or spec is None:
            raise RunnerError("proof_not_ready")
        self.approval.assert_unchanged()
        if "rpc_read" not in self.approval.approved_actions or "auth_signin" not in self.approval.approved_actions:
            raise RunnerError("live_phase_not_approved")
        expected_ids = list(self.runner._expected_case_ids or ())
        if expected_ids != [case.case_id for case in spec.cases]:
            raise RunnerError("proof_incomplete")
        if len(expected_ids) > spec.phase_limits["max_cases"]:
            raise RunnerError("phase_limit_cardinality")
        results = []
        for case in spec.cases:
            self.runner.revalidate_frozen_spec(self.approval)
            self.approval.assert_unchanged()
            kwargs = {"expectation": case.expectation}
            if case.mode == "actor":
                kwargs["actor"] = case.actor
            elif case.mode == "invalid_session":
                kwargs["invalid_session"] = True
            try:
                if case.mode == "actor":
                    client.sign_in(case.actor)
                    self.runner.revalidate_frozen_spec(self.approval)
                    self.approval.assert_unchanged()
                params = _thaw_dict(case.params)
                outcome = client.read_rpc(case.qualified_name, params, **kwargs)
            except (KeyboardInterrupt, SystemExit):
                self.runner._dispose_terminal()
                raise
            except Exception as exc:
                results.append({
                    "case_id": case.case_id,
                    "assertion": "SETUP_FAILURE",
                    "failure_code": _code(exc),
                })
                self.runner._fail_terminal("setup_failure_terminal")
            assertion = outcome.get("assertion")
            results.append({
                "case_id": case.case_id,
                "assertion": assertion,
                "http_status": outcome.get("http_status"),
                "body_shape": outcome.get("body_shape"),
            })
        if [item["case_id"] for item in results] != expected_ids:
            raise RunnerError("proof_incomplete")
        self.runner.stage = Stage.PROOF_DONE
        return results

    @staticmethod
    def overall_from_cases(
        case_results: list[dict],
        *,
        setup_failure: bool,
        expected_case_ids: list[str] | None = None,
    ) -> str:
        if setup_failure:
            return "SETUP_FAILURE"
        if expected_case_ids is None:
            return "NOT_RUN"
        if not case_results:
            return "NOT_RUN"
        got = [item.get("case_id") for item in case_results]
        if got != list(expected_case_ids):
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


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    package_dir = Path(__file__).resolve().parent
    runner = OfflineRunner(worktree_root=package_dir.parents[2], package_dir=package_dir)
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
