/* eslint-env node */

function startableEntryStatusReason(entryStatus) {
  const status = entryStatus == null || entryStatus === "" ? "NOT_STARTED" : String(entryStatus);
  if (status === "NOT_STARTED") return null;
  return `ENTRY_STATUS_NOT_STARTABLE: ${status}`;
}

function isStartableEntryStatus(entryStatus) {
  return startableEntryStatusReason(entryStatus) == null;
}

function isWorkerStartEligible({ isReadyForEntry, entryStatus, hasReadiness = true } = {}) {
  return (
    hasReadiness === true &&
    isReadyForEntry === true &&
    isStartableEntryStatus(entryStatus)
  );
}

module.exports = {
  startableEntryStatusReason,
  isStartableEntryStatus,
  isWorkerStartEligible,
};
