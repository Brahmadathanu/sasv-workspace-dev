# SASV Workspace AI Development Standard

## Project Nature

Electron + PWA compatible internal ERP/workspace for manufacturing, production planning, costing, QA, stock, reconciliation, and reporting workflows.

## Development Principle

Server truth first. Client UI should display and operate on Supabase-backed views/RPCs, not maintain parallel business logic.

## AI Coding Workflow

1. Understand the requirement.
2. Identify reference module.
3. Identify affected files.
4. Prepare plan.
5. Implement only approved changes.
6. Preserve design language.
7. Provide smoke tests.
8. Avoid unrelated refactoring.

## Standard Module Completion Criteria

A module is complete only when:

- HTML structure is created.
- JS initialization is wired.
- Supabase loading works.
- Filters/search/reset work.
- Loading/empty/error states exist.
- Responsive layout works.
- Navigation integration works.
- Console has no avoidable errors.
