"""WP04 operator launcher. Default CLI stays OFF with zero network/prompts."""
from __future__ import annotations

import hashlib
import json
import os
import stat
import sys
import time
import types
from pathlib import Path
from typing import Any, Callable

PACKAGE_DIR = Path(__file__).resolve().parent
HARNESS_NAME = "auth_api_harness.py"
WRAPPER_NAME = "test_runner.py"
LAUNCHER_NAME = "operator_launcher.py"
ACK_BASENAME = "wp04-fixture-ack.json"
MAX_AUTHORITY_BYTES = 65536
POLL_SECONDS = 1.0

EXPECTED_HARNESS_SHA256 = "3fad74acdbf82ea14c6aa05027c9e43f566e46588ceca905daa904857f7a5eed"
EXPECTED_WRAPPER_SHA256 = "36b897a0d1f2596a99c19631bb0bf6117f7757a658de28f3b45cc1d40386abdb"

APPROVAL_KEYS = frozenset({
    "expected_spec_sha256",
    "expected_harness_sha256",
    "expected_wrapper_sha256",
    "expected_launcher_sha256",
    "approval_id",
    "expires_at",
    "approved_phases",
    "approved_actions",
})
REQUIRED_PHASES = frozenset({"live_orchestrate", "real_https"})
REQUIRED_ACTIONS = frozenset({"auth_create", "auth_signin", "rpc_read"})
HEX64 = frozenset("0123456789abcdef")

REPORT_FIELDS = (
    "mode", "execution", "native_auth", "api_permissions", "network_calls",
    "overall", "phases", "cases", "setup_failure", "failure_code", "cleanup", "notes",
)
ALLOWED_MODES = frozenset({"operator_launcher"})
ALLOWED_EXECUTION = frozenset({"OFF", "SIMULATED_OFFLINE", "REVIEWED_LIVE"})
ALLOWED_NATIVE = frozenset({"NOT_RUN", "ATTEMPTED"})
ALLOWED_OVERALL = frozenset({
    "NOT_RUN", "SETUP_FAILURE", "FAIL", "PASS_REVIEWED_ASSERTIONS_ONLY",
})
ALLOWED_NOTES = frozenset({
    "default_cli_off", "operator_failure", "operator_cancelled", "operator_complete",
})
ALLOWED_CLEANUP = frozenset({"local_forget_only"})
ALLOWED_ASSERTIONS = frozenset({
    "MATCH", "MISMATCH", "UNVERIFIED", "NOT_RUN", "SETUP_FAILURE",
})
ALLOWED_PHASE_VALUES = frozenset({
    "bound", "actors_created", "exported", "paused", "acked", "proof_done",
})
CASE_ID_RE_TEXT = r"^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$"

KNOWN_CODES = frozenset({
    "launcher_internal_error", "launch_args_invalid", "approval_file_invalid",
    "approval_hash_mismatch", "approval_too_large", "approval_json_invalid",
    "approval_schema_invalid", "approval_type_invalid", "approval_phase_incomplete",
    "approval_action_incomplete", "approval_expired", "approval_binding_changed",
    "launcher_hash_mismatch", "source_hash_mismatch", "source_load_failed",
    "spec_source_invalid", "spec_too_large", "ack_path_invalid", "ack_preexisting",
    "ack_symlink_refused", "ack_not_regular", "ack_too_large", "ack_read_failed",
    "ack_json_invalid", "ack_schema_invalid", "fixture_wait_expired",
    "console_not_private", "secret_prompt_failed", "secret_empty",
    "report_value_refused", "setup_failure_terminal", "cancelled",
    "spec_bytes_required", "spec_json_invalid", "spec_not_object", "spec_drift",
    "spec_hash_mismatch", "spec_not_loaded", "harness_hash_mismatch",
    "wrapper_hash_mismatch", "harness_artifact_drift", "approval_missing",
    "approval_id_mismatch", "live_phase_not_approved", "live_spec_not_ready",
    "unsupported_action", "transport_not_trusted", "real_network_refused",
    "stage_refused", "client_not_bound", "create_uncertain_stop",
    "export_not_ready", "handoff_root_required", "handoff_path_not_absolute",
    "handoff_inside_worktree", "handoff_symlink_refused", "handoff_dest_missing",
    "handoff_overwrite_refused", "handoff_write_failed", "handoff_create_failed",
    "handoff_path_invalid", "handoff_path_unsupported", "handoff_path_guarantee_unsupported",
    "ack_invalid", "ack_not_verified", "ack_identity_mismatch", "ack_actor_mismatch",
    "proof_not_ready", "proof_incomplete", "production_target_refused",
    "invalid_target", "unresolved_sample_not_live", "runner_internal_error",
    "secret_echo_refused", "pause_already_used", "pause_not_active",
})


class LauncherError(Exception):
    def __init__(self, code: str):
        if code not in KNOWN_CODES:
            code = "launcher_internal_error"
        super().__init__(code)


def _code(exc: BaseException) -> str:
    text = str(exc)
    if text in KNOWN_CODES:
        return text
    return "launcher_internal_error"


def _lf_sha256(data: bytes) -> str:
    if b"\r\n" in data:
        data = data.replace(b"\r\n", b"\n")
    return hashlib.sha256(data).hexdigest()


def _raw_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _reject_duplicates(pairs: list[tuple[str, Any]], *, code: str = "approval_json_invalid") -> dict:
    seen: set[str] = set()
    out: dict[str, Any] = {}
    for key, value in pairs:
        if key in seen:
            raise LauncherError(code)
        seen.add(key)
        out[key] = value
    return out


def _is_hex64(value: Any) -> bool:
    return type(value) is str and len(value) == 64 and set(value) <= HEX64


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
            raise LauncherError("ack_path_invalid") from None
    return False


def _assert_safe_path_chain(path: Path) -> None:
    # Inspect every ancestor and the leaf via lexists so dangling symlinks fail closed.
    chain = [path, *list(path.parents)]
    for node in chain:
        if os.path.lexists(str(node)) and _is_reparse_point(node):
            raise LauncherError("ack_symlink_refused")


def read_bounded_file(path: Path, *, too_large_code: str, read_failed_code: str) -> bytes:
    """Binary bounded read with path↔descriptor identity checks. Not race-proof."""
    path = Path(path)
    _assert_safe_path_chain(path)
    if os.path.islink(path) or (os.path.lexists(str(path)) and _is_reparse_point(path)):
        raise LauncherError("ack_symlink_refused")
    if not path.exists():
        raise LauncherError(read_failed_code)
    try:
        pre = path.stat()
    except OSError:
        raise LauncherError(read_failed_code) from None
    if not stat.S_ISREG(pre.st_mode):
        raise LauncherError("ack_not_regular")
    if pre.st_size > MAX_AUTHORITY_BYTES:
        raise LauncherError(too_large_code)
    flags = os.O_RDONLY
    if hasattr(os, "O_BINARY"):
        flags |= os.O_BINARY
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    try:
        fd = os.open(str(path), flags)
    except OSError:
        raise LauncherError(read_failed_code) from None
    try:
        opened = os.fstat(fd)
        if not stat.S_ISREG(opened.st_mode):
            raise LauncherError("ack_not_regular")
        if (opened.st_ino, opened.st_dev, opened.st_size, opened.st_mtime_ns) != (
            pre.st_ino, pre.st_dev, pre.st_size, pre.st_mtime_ns
        ):
            raise LauncherError(read_failed_code)
        if opened.st_size > MAX_AUTHORITY_BYTES:
            raise LauncherError(too_large_code)
        chunks = []
        remaining = opened.st_size
        while remaining > 0:
            piece = os.read(fd, remaining)
            if not piece:
                raise LauncherError(read_failed_code)
            chunks.append(piece)
            remaining -= len(piece)
        data = b"".join(chunks)
        if len(data) != opened.st_size or len(data) > MAX_AUTHORITY_BYTES:
            raise LauncherError(read_failed_code if len(data) != opened.st_size else too_large_code)
        after = os.fstat(fd)
        if (after.st_ino, after.st_dev, after.st_size, after.st_mtime_ns) != (
            opened.st_ino, opened.st_dev, opened.st_size, opened.st_mtime_ns
        ):
            raise LauncherError(read_failed_code)
        # Path still points at same identity after complete read.
        try:
            post_path = path.stat()
        except OSError:
            raise LauncherError(read_failed_code) from None
        if (post_path.st_ino, post_path.st_dev, post_path.st_size, post_path.st_mtime_ns) != (
            opened.st_ino, opened.st_dev, opened.st_size, opened.st_mtime_ns
        ):
            raise LauncherError(read_failed_code)
        return data
    except LauncherError:
        raise
    except OSError:
        raise LauncherError(read_failed_code) from None
    finally:
        os.close(fd)


def launcher_report(**fields: Any) -> dict:
    out = {
        "mode": "operator_launcher",
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
        "notes": "default_cli_off",
    }
    out.update(fields)
    return _validate_launcher_report(out)


def _validate_launcher_report(report: dict) -> dict:
    import re
    if not isinstance(report, dict) or set(report) != set(REPORT_FIELDS):
        raise LauncherError("report_value_refused")
    if type(report["mode"]) is not str or report["mode"] not in ALLOWED_MODES:
        raise LauncherError("report_value_refused")
    if type(report["execution"]) is not str or report["execution"] not in ALLOWED_EXECUTION:
        raise LauncherError("report_value_refused")
    if type(report["native_auth"]) is not str or report["native_auth"] not in ALLOWED_NATIVE:
        raise LauncherError("report_value_refused")
    if type(report["api_permissions"]) is not str or report["api_permissions"] not in ALLOWED_NATIVE:
        raise LauncherError("report_value_refused")
    if type(report["network_calls"]) is not int or report["network_calls"] < 0:
        raise LauncherError("report_value_refused")
    if type(report["overall"]) is not str or report["overall"] not in ALLOWED_OVERALL:
        raise LauncherError("report_value_refused")
    if type(report["notes"]) is not str or report["notes"] not in ALLOWED_NOTES:
        raise LauncherError("report_value_refused")
    if type(report["cleanup"]) is not str or report["cleanup"] not in ALLOWED_CLEANUP:
        raise LauncherError("report_value_refused")
    if type(report["setup_failure"]) is not bool:
        raise LauncherError("report_value_refused")
    if report["failure_code"] is not None and (
        type(report["failure_code"]) is not str or report["failure_code"] not in KNOWN_CODES
    ):
        raise LauncherError("report_value_refused")
    if not isinstance(report["phases"], list):
        raise LauncherError("report_value_refused")
    for item in report["phases"]:
        if type(item) is not str or item not in ALLOWED_PHASE_VALUES:
            raise LauncherError("report_value_refused")
    if not isinstance(report["cases"], list):
        raise LauncherError("report_value_refused")
    # Forbid contradictory PASS/setup/notes/count states.
    if report["overall"] == "PASS_REVIEWED_ASSERTIONS_ONLY":
        if report["setup_failure"] or report["failure_code"] is not None:
            raise LauncherError("report_value_refused")
        if report["notes"] != "operator_complete":
            raise LauncherError("report_value_refused")
        if report["network_calls"] < 1:
            raise LauncherError("report_value_refused")
        if report["execution"] == "OFF" or report["native_auth"] == "NOT_RUN":
            raise LauncherError("report_value_refused")
    if report["execution"] == "OFF" and report["network_calls"] != 0:
        raise LauncherError("report_value_refused")
    cleaned = []
    for item in report["cases"]:
        if not isinstance(item, dict):
            raise LauncherError("report_value_refused")
        case_id = item.get("case_id")
        assertion = item.get("assertion")
        if type(case_id) is not str or not re.match(CASE_ID_RE_TEXT, case_id):
            raise LauncherError("report_value_refused")
        if type(assertion) is not str or assertion not in ALLOWED_ASSERTIONS:
            raise LauncherError("report_value_refused")
        entry = {"case_id": case_id, "assertion": assertion}
        if "failure_code" in item:
            code = item["failure_code"]
            if code is not None and (type(code) is not str or code not in KNOWN_CODES):
                raise LauncherError("report_value_refused")
            entry["failure_code"] = code
        if "http_status" in item:
            status = item["http_status"]
            if type(status) is not int or not 100 <= status <= 599:
                raise LauncherError("report_value_refused")
            entry["http_status"] = status
        if "body_shape" in item:
            shape = item["body_shape"]
            if type(shape) is not str or shape not in ("object", "array", "other"):
                raise LauncherError("report_value_refused")
            entry["body_shape"] = shape
        if set(item) - set(entry):
            raise LauncherError("report_value_refused")
        cleaned.append(entry)
    report = dict(report)
    report["cases"] = cleaned
    return report


def load_verified_components(package_dir: Path) -> tuple[Any, Any]:
    """Hash-check then exec accepted harness/wrapper bytes (avoids stale bytecode)."""
    harness_path = package_dir / HARNESS_NAME
    wrapper_path = package_dir / WRAPPER_NAME
    try:
        harness_raw = harness_path.read_bytes()
        wrapper_raw = wrapper_path.read_bytes()
    except OSError:
        raise LauncherError("source_load_failed") from None
    if _lf_sha256(harness_raw) != EXPECTED_HARNESS_SHA256:
        raise LauncherError("source_hash_mismatch")
    if _lf_sha256(wrapper_raw) != EXPECTED_WRAPPER_SHA256:
        raise LauncherError("source_hash_mismatch")
    try:
        harness_mod = types.ModuleType("auth_api_harness")
        harness_mod.__file__ = str(harness_path.resolve())
        sys.modules["auth_api_harness"] = harness_mod
        exec(compile(harness_raw.replace(b"\r\n", b"\n").decode("utf-8"),
                     harness_mod.__file__, "exec"), harness_mod.__dict__)
        wrapper_mod = types.ModuleType("test_runner")
        wrapper_mod.__file__ = str(wrapper_path.resolve())
        sys.modules["test_runner"] = wrapper_mod
        exec(compile(wrapper_raw.replace(b"\r\n", b"\n").decode("utf-8"),
                     wrapper_mod.__file__, "exec"), wrapper_mod.__dict__)
    except LauncherError:
        raise
    except Exception:
        raise LauncherError("source_load_failed") from None
    return harness_mod, wrapper_mod


def parse_approval_document(raw: bytes) -> dict:
    if len(raw) > MAX_AUTHORITY_BYTES:
        raise LauncherError("approval_too_large")
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        raise LauncherError("approval_json_invalid") from None
    try:
        data = json.loads(
            text,
            object_pairs_hook=lambda pairs: _reject_duplicates(pairs, code="approval_json_invalid"),
        )
    except LauncherError:
        raise
    except Exception:
        raise LauncherError("approval_json_invalid") from None
    if not isinstance(data, dict) or set(data) != APPROVAL_KEYS:
        raise LauncherError("approval_schema_invalid")
    return data


def validate_approval_fields(data: dict, *, launcher_lf_sha: str) -> dict:
    import datetime as dt
    for key in (
        "expected_spec_sha256", "expected_harness_sha256",
        "expected_wrapper_sha256", "expected_launcher_sha256",
    ):
        if not _is_hex64(data[key]):
            raise LauncherError("approval_type_invalid")
    if data["expected_harness_sha256"] != EXPECTED_HARNESS_SHA256:
        raise LauncherError("source_hash_mismatch")
    if data["expected_wrapper_sha256"] != EXPECTED_WRAPPER_SHA256:
        raise LauncherError("source_hash_mismatch")
    if data["expected_launcher_sha256"] != launcher_lf_sha:
        raise LauncherError("launcher_hash_mismatch")
    if type(data["approval_id"]) is not str or not data["approval_id"]:
        raise LauncherError("approval_type_invalid")
    if type(data["expires_at"]) is not str:
        raise LauncherError("approval_type_invalid")
    try:
        expires = dt.datetime.fromisoformat(data["expires_at"].replace("Z", "+00:00"))
    except ValueError:
        raise LauncherError("approval_type_invalid") from None
    if expires.tzinfo is None:
        raise LauncherError("approval_type_invalid")
    if expires <= dt.datetime.now(dt.timezone.utc):
        raise LauncherError("approval_expired")
    phases = data["approved_phases"]
    actions = data["approved_actions"]
    if not isinstance(phases, list) or not isinstance(actions, list):
        raise LauncherError("approval_type_invalid")
    if any(type(item) is not str for item in phases + actions):
        raise LauncherError("approval_type_invalid")
    phase_set = frozenset(phases)
    action_set = frozenset(actions)
    if len(phase_set) != len(phases) or len(action_set) != len(actions):
        raise LauncherError("approval_schema_invalid")
    if phase_set != REQUIRED_PHASES:
        raise LauncherError("approval_phase_incomplete")
    if action_set != REQUIRED_ACTIONS:
        raise LauncherError("approval_action_incomplete")
    return {
        "expected_spec_sha256": data["expected_spec_sha256"],
        "expected_harness_sha256": data["expected_harness_sha256"],
        "expected_wrapper_sha256": data["expected_wrapper_sha256"],
        "expected_launcher_sha256": data["expected_launcher_sha256"],
        "approval_id": data["approval_id"],
        "expires_at": expires,
        "approved_phases": phase_set,
        "approved_actions": action_set,
    }


class FrozenAuthority:
    """Immutable launch authority. Field assignment after construction is refused."""

    __slots__ = (
        "approval_path", "approval_bytes", "approval_sha_raw", "approval_sha_lf",
        "expected_approval_sha_lf", "launcher_path", "launcher_sha_lf",
        "spec_path", "spec_bytes", "spec_sha_lf", "spec_sha_raw", "ack_path",
        "approval_id", "expires_at", "approved_phases", "approved_actions",
        "expected_spec_sha256", "approval_fingerprint", "_frozen",
    )

    def __init__(self, **kwargs):
        object.__setattr__(self, "_frozen", False)
        for key, value in kwargs.items():
            object.__setattr__(self, key, value)
        object.__setattr__(self, "_frozen", True)

    def __setattr__(self, name, value):
        if getattr(self, "_frozen", False):
            raise LauncherError("approval_binding_changed")
        object.__setattr__(self, name, value)


def _authority_fingerprint(auth: FrozenAuthority) -> tuple:
    return (
        str(auth.approval_path),
        auth.approval_bytes,
        auth.approval_sha_raw,
        auth.approval_sha_lf,
        auth.expected_approval_sha_lf,
        str(auth.launcher_path),
        auth.launcher_sha_lf,
        str(auth.spec_path),
        auth.spec_bytes,
        auth.spec_sha_lf,
        auth.spec_sha_raw,
        str(auth.ack_path),
        auth.approval_id,
        auth.expires_at,
        frozenset(auth.approved_phases),
        frozenset(auth.approved_actions),
        auth.expected_spec_sha256,
        auth.approval_fingerprint,
    )


class OperatorLauncher:
    def __init__(
        self,
        *,
        package_dir: Path | None = None,
        worktree_root: Path | None = None,
        clock: Callable[[], float] | None = None,
        sleep: Callable[[float], None] | None = None,
        prompt: Any = None,
        transport_factory: Callable[[], Any] | None = None,
        use_https: bool = False,
    ):
        self.package_dir = package_dir or PACKAGE_DIR
        self.worktree_root = worktree_root or self.package_dir.parents[2]
        self.clock = clock or time.monotonic
        self.sleep = sleep or time.sleep
        self.prompt = prompt
        self.transport_factory = transport_factory
        self.use_https = use_https
        self.harness = None
        self.runner_mod = None
        self.offline = None
        self.orch = None
        self.authority: FrozenAuthority | None = None
        self._retained_authority_fingerprint: tuple | None = None
        self._authority_id: int | None = None
        self._publishable: str | None = None
        self._secret: str | None = None
        self._transport = None
        self._terminal = False
        self._network_calls = 0
        self._used_fake_transport = False

    def default_report(self) -> dict:
        return launcher_report(notes="default_cli_off", network_calls=0, execution="OFF")

    def _dispose(self) -> None:
        self._terminal = True
        self._publishable = None
        self._secret = None
        if self.offline is not None and getattr(self.offline, "client", None) is not None:
            try:
                self.offline.client.forget()
            except Exception:
                pass
        if self.offline is not None and self.runner_mod is not None:
            try:
                self.offline._ack_verified = False
                self.offline._paused_deadline = None
                self.offline._terminal_failure = True
                self.offline.stage = getattr(self.runner_mod, "Stage").FAILED
            except Exception:
                pass

    def _fail(self, code: str) -> None:
        self._dispose()
        raise LauncherError(code)

    def _load_components(self) -> None:
        self.harness, self.runner_mod = load_verified_components(self.package_dir)

    def _launcher_lf_sha(self) -> str:
        path = self.package_dir / LAUNCHER_NAME
        try:
            return _lf_sha256(path.read_bytes())
        except OSError:
            raise LauncherError("source_load_failed") from None

    def _assert_authority(self) -> None:
        if self._terminal:
            raise LauncherError("setup_failure_terminal")
        if self.authority is None or self._retained_authority_fingerprint is None:
            raise LauncherError("approval_binding_changed")
        if id(self.authority) != self._authority_id:
            self._fail("approval_binding_changed")
        try:
            current_fp = _authority_fingerprint(self.authority)
        except LauncherError:
            self._fail("approval_binding_changed")
        if current_fp != self._retained_authority_fingerprint:
            self._fail("approval_binding_changed")
        auth = self.authority
        try:
            current = read_bounded_file(
                auth.approval_path,
                too_large_code="approval_too_large",
                read_failed_code="approval_file_invalid",
            )
        except LauncherError as exc:
            self._fail(_code(exc))
        if current != auth.approval_bytes or _lf_sha256(current) != auth.expected_approval_sha_lf:
            self._fail("approval_binding_changed")
        if self._launcher_lf_sha() != auth.launcher_sha_lf:
            self._fail("launcher_hash_mismatch")
        try:
            spec_now = auth.spec_path.read_bytes()
        except OSError:
            self._fail("spec_source_invalid")
        if spec_now != auth.spec_bytes or _lf_sha256(spec_now) != auth.spec_sha_lf:
            self._fail("spec_drift")
        import datetime as dt
        if auth.expires_at <= dt.datetime.now(dt.timezone.utc):
            self._fail("approval_expired")
        if str(auth.ack_path.name) != ACK_BASENAME:
            self._fail("ack_path_invalid")
        if self.offline is not None:
            try:
                appr = self.orch.approval if self.orch is not None else None
                if appr is not None:
                    appr.assert_unchanged()
                    if appr.fingerprint() != auth.approval_fingerprint:
                        self._fail("approval_binding_changed")
                self.offline.revalidate_frozen_spec(appr)
            except Exception as exc:
                self._fail(_code(exc))

    def bind_launch_files(
        self,
        *,
        spec_path: Path,
        approval_path: Path,
        expected_approval_sha_lf: str,
    ) -> FrozenAuthority:
        if not _is_hex64(expected_approval_sha_lf):
            raise LauncherError("launch_args_invalid")
        spec_path = Path(spec_path)
        approval_path = Path(approval_path)
        if not spec_path.is_absolute() or not approval_path.is_absolute():
            raise LauncherError("launch_args_invalid")

        self._load_components()
        launcher_sha = self._launcher_lf_sha()

        approval_bytes = read_bounded_file(
            approval_path,
            too_large_code="approval_too_large",
            read_failed_code="approval_file_invalid",
        )
        approval_sha_lf = _lf_sha256(approval_bytes)
        approval_sha_raw = _raw_sha256(approval_bytes)
        if approval_sha_lf != expected_approval_sha_lf:
            raise LauncherError("approval_hash_mismatch")

        parsed = parse_approval_document(approval_bytes)
        fields = validate_approval_fields(parsed, launcher_lf_sha=launcher_sha)

        try:
            spec_bytes_exact = spec_path.read_bytes()
        except OSError:
            raise LauncherError("spec_source_invalid") from None
        if len(spec_bytes_exact) > 1024 * 1024:
            raise LauncherError("spec_too_large")
        # LA-04: approval/spec bind LF-normalized digest; retain exact bytes for drift.
        spec_sha_lf = _lf_sha256(spec_bytes_exact)
        spec_sha_raw = _raw_sha256(spec_bytes_exact)
        if spec_sha_lf != fields["expected_spec_sha256"]:
            raise LauncherError("approval_hash_mismatch")
        spec_lf_bytes = (
            spec_bytes_exact.replace(b"\r\n", b"\n")
            if b"\r\n" in spec_bytes_exact else spec_bytes_exact
        )

        try:
            appr = self.runner_mod.ExternalApproval(
                expected_spec_sha256=fields["expected_spec_sha256"],
                expected_harness_sha256=fields["expected_harness_sha256"],
                expected_wrapper_sha256=fields["expected_wrapper_sha256"],
                approval_id=fields["approval_id"],
                expires_at=fields["expires_at"],
                approved_phases=fields["approved_phases"],
                approved_actions=fields["approved_actions"],
            )
        except Exception as exc:
            raise LauncherError(_code(exc)) from None

        offline = self.runner_mod.OfflineRunner(
            worktree_root=self.worktree_root,
            package_dir=self.package_dir,
            clock=self.clock,
            prompt=self.prompt or self.runner_mod.ConsoleCredentialAdapter(),
        )
        try:
            # Load LF bytes so runner digest matches LF approval; disk drift uses exact bytes.
            offline.load_spec(spec_lf_bytes, appr, source_path=spec_path)
        except Exception as exc:
            raise LauncherError(_code(exc)) from None
        if offline.spec is None or offline.spec.execution != "REVIEWED_LIVE" or offline.spec.unresolved:
            raise LauncherError("live_spec_not_ready")

        handoff = Path(offline.spec.handoff_directory)
        if not handoff.is_absolute():
            raise LauncherError("ack_path_invalid")
        ack_path = handoff / ACK_BASENAME
        _assert_safe_path_chain(ack_path)
        if ack_path.exists():
            raise LauncherError("ack_preexisting")

        authority = FrozenAuthority(
            approval_path=approval_path,
            approval_bytes=approval_bytes,
            approval_sha_raw=approval_sha_raw,
            approval_sha_lf=approval_sha_lf,
            expected_approval_sha_lf=expected_approval_sha_lf,
            launcher_path=self.package_dir / LAUNCHER_NAME,
            launcher_sha_lf=launcher_sha,
            spec_path=spec_path,
            spec_bytes=spec_bytes_exact,
            spec_sha_lf=spec_sha_lf,
            spec_sha_raw=spec_sha_raw,
            ack_path=ack_path,
            approval_id=fields["approval_id"],
            expires_at=fields["expires_at"],
            approved_phases=fields["approved_phases"],
            approved_actions=fields["approved_actions"],
            expected_spec_sha256=fields["expected_spec_sha256"],
            approval_fingerprint=appr.fingerprint(),
        )
        self.authority = authority
        self._retained_authority_fingerprint = _authority_fingerprint(authority)
        self._authority_id = id(authority)
        self.offline = offline
        self.orch = self.runner_mod.GuardedLiveOrchestrator(offline, appr)
        return authority

    def _make_guarded_transport(self):
        runner_mod = self.runner_mod
        harness = self.harness
        launcher = self

        if self.transport_factory is not None and not self.use_https:
            base = self.transport_factory()
            if isinstance(base, runner_mod.TrustedFakeTransport):
                class GuardedFake(runner_mod.TrustedFakeTransport):
                    def __call__(self, host, method, path, headers, body):
                        launcher._assert_authority()
                        result = super().__call__(host, method, path, headers, body)
                        launcher._network_calls = len(self.calls)
                        return result

                guarded = GuardedFake(handler=base.handler)
                guarded.calls = base.calls
                self._used_fake_transport = True
                return guarded
            raise LauncherError("transport_not_trusted")

        # Real HTTPS subclass path: authority rechecked per call; tests mock underlying send.
        class GuardedHttps(harness.HttpsTransport):
            def __init__(self):
                super().__init__()
                self.calls = []
                self._delegate = None

            def __call__(self, host, method, path, headers, body):
                launcher._assert_authority()
                self.calls.append((host, method, path))
                launcher._network_calls = len(self.calls)
                if self._delegate is not None:
                    return self._delegate(host, method, path, headers, body)
                return super().__call__(host, method, path, headers, body)

        guarded = GuardedHttps()
        if self.transport_factory is not None:
            # Test-only: factory returns a callable delegate that never opens sockets.
            guarded._delegate = self.transport_factory()
        self._used_fake_transport = guarded._delegate is not None
        return guarded

    def prompt_keys(self) -> tuple[str, str]:
        self._assert_authority()
        adapter = self.prompt or self.runner_mod.ConsoleCredentialAdapter()
        try:
            adapter.assert_private_console()
            pub = adapter.prompt_secret("publishable")
            if type(pub) is not str or not pub:
                raise LauncherError("secret_empty")
            sec = adapter.prompt_secret("secret")
            if type(sec) is not str or not sec:
                raise LauncherError("secret_empty")
        except (KeyboardInterrupt, SystemExit):
            self._publishable = None
            self._secret = None
            self._dispose()
            raise
        except Exception as exc:
            self._publishable = None
            self._secret = None
            self._fail(_code(exc))
        self._publishable = pub
        self._secret = sec
        return pub, sec

    def wait_for_acknowledgement(self) -> dict:
        if self.authority is None or self.orch is None or self.offline is None:
            raise LauncherError("setup_failure_terminal")
        auth = self.authority
        deadline = self.offline._paused_deadline
        if deadline is None:
            raise LauncherError("pause_not_active")
        while True:
            self._assert_authority()
            if self.clock() > deadline:
                self._fail("fixture_wait_expired")
            path = auth.ack_path
            # Missing ordinary file: wait. Symlink/nonregular: terminal via read_bounded_file.
            if os.path.lexists(str(path)) and (os.path.islink(path) or _is_reparse_point(path)):
                self._fail("ack_symlink_refused")
            if path.exists():
                try:
                    raw = read_bounded_file(
                        path,
                        too_large_code="ack_too_large",
                        read_failed_code="ack_read_failed",
                    )
                    try:
                        text = raw.decode("utf-8")
                        data = json.loads(
                            text,
                            object_pairs_hook=lambda pairs: _reject_duplicates(
                                pairs, code="ack_json_invalid"
                            ),
                        )
                    except LauncherError:
                        raise
                    except Exception:
                        raise LauncherError("ack_json_invalid") from None
                    if not isinstance(data, dict):
                        raise LauncherError("ack_schema_invalid")
                    return data
                except LauncherError as exc:
                    self._fail(_code(exc))
            remaining = deadline - self.clock()
            if remaining <= 0:
                self._fail("fixture_wait_expired")
            try:
                self.sleep(min(POLL_SECONDS, remaining))
            except (KeyboardInterrupt, SystemExit):
                self._dispose()
                raise

    def run_reviewed_sequence(self) -> dict:
        phases: list[str] = []
        cases: list[dict] = []
        try:
            self._assert_authority()
            pub, sec = self.prompt_keys()
            self._assert_authority()
            transport = self._make_guarded_transport()
            self._transport = transport
            self.orch.bind_client(pub, sec, transport)
            phases.append("bound")
            self._assert_authority()
            self.orch.create_actors()
            phases.append("actors_created")
            self._assert_authority()
            export_path = self.orch.export_nonsecret_mapping()
            print(f"UUID_HANDOFF_PATH {export_path}")
            phases.append("exported")
            self._assert_authority()
            self.orch.begin_fixture_pause()
            phases.append("paused")
            ack = self.wait_for_acknowledgement()
            self._assert_authority()
            self.orch.continue_after_acknowledgement(ack)
            phases.append("acked")
            self._assert_authority()
            cases = self.orch.run_proof_cases()
            phases.append("proof_done")
            expected = list(self.offline._expected_case_ids or ())
            overall = self.runner_mod.GuardedLiveOrchestrator.overall_from_cases(
                cases, setup_failure=False, expected_case_ids=expected,
            )
            notes = "operator_complete" if overall == "PASS_REVIEWED_ASSERTIONS_ONLY" else "operator_failure"
            calls = self._network_calls
            execution = "SIMULATED_OFFLINE" if self._used_fake_transport else "REVIEWED_LIVE"
            return launcher_report(
                execution=execution,
                native_auth="ATTEMPTED",
                api_permissions="ATTEMPTED",
                overall=overall,
                phases=phases,
                cases=[{
                    "case_id": item["case_id"],
                    "assertion": item["assertion"],
                    **({"http_status": item["http_status"]} if "http_status" in item else {}),
                    **({"body_shape": item["body_shape"]} if "body_shape" in item else {}),
                    **({"failure_code": item["failure_code"]} if "failure_code" in item else {}),
                } for item in cases],
                network_calls=calls,
                notes=notes,
                setup_failure=False,
            )
        except (KeyboardInterrupt, SystemExit):
            self._dispose()
            raise
        except LauncherError:
            self._dispose()
            raise
        except Exception as exc:
            self._fail(_code(exc))
        finally:
            self._publishable = None
            self._secret = None
            if self.offline is not None and getattr(self.offline, "client", None) is not None:
                try:
                    self.offline.client.forget()
                except Exception:
                    pass


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    launcher = OperatorLauncher()
    try:
        if not argv:
            report = launcher.default_report()
            print(json.dumps(report, sort_keys=True))
            return 0
        # Frozen ack basename only — no alternate CLI channel.
        if argv[0] != "run" or len(argv) != 4:
            report = launcher_report(
                overall="NOT_RUN",
                setup_failure=True,
                failure_code="launch_args_invalid",
                notes="operator_failure",
            )
            print(json.dumps(report, sort_keys=True))
            return 2
        spec = Path(argv[1])
        approval = Path(argv[2])
        expected_sha = argv[3]
        launcher.bind_launch_files(
            spec_path=spec,
            approval_path=approval,
            expected_approval_sha_lf=expected_sha,
        )
        report = launcher.run_reviewed_sequence()
        print(json.dumps(report, sort_keys=True))
        return 0 if report["overall"] == "PASS_REVIEWED_ASSERTIONS_ONLY" else 1
    except (KeyboardInterrupt, SystemExit):
        launcher._dispose()
        report = launcher_report(
            overall="NOT_RUN",
            setup_failure=True,
            failure_code="cancelled",
            notes="operator_cancelled",
            network_calls=max(0, launcher._network_calls),
        )
        print(json.dumps(report, sort_keys=True))
        return 130
    except Exception as exc:
        launcher._dispose()
        report = launcher_report(
            overall="SETUP_FAILURE" if launcher._network_calls else "NOT_RUN",
            setup_failure=True,
            failure_code=_code(exc),
            notes="operator_failure",
            network_calls=max(0, launcher._network_calls),
        )
        print(json.dumps(report, sort_keys=True))
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
