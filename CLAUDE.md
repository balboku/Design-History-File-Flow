# CLAUDE.md

## Project Overview

This project is an MVP project management platform designed for medical device R&D teams. The system must reflect the intent of ISO 13485 and FDA Design Controls while remaining practical for fast-moving engineering teams.

The product should help teams manage design history, traceability, compliance deliverables, gated project progression, and post-transfer design changes in a way that is operationally lightweight but audit-friendly.

## Core Product Intent

- Support medical device development workflows with strong traceability between engineering execution and quality/compliance outputs.
- Enforce a dual-track model where development work and required quality deliverables are explicitly linked.
- Allow controlled flexibility through soft phase-gates and managed work-at-risk behavior.
- Require strict completion and approval at final design transfer.
- Lock transferred records and require formal design change workflows for any post-transfer modifications.

## Regulatory and Quality Principles

The application must be designed to align with the spirit of:

- ISO 13485
- FDA Design Controls
- Design History File (DHF) expectations
- Traceability, accountability, reviewability, and change control

This MVP does not need to implement a full eQMS, but its data model, workflows, and audit behavior should be compatible with regulated product development expectations.

## Core Business Logic

### 1. Dual-Track Management

The system must enforce a dual-track relationship between:

- Engineering `Task`
- QA / compliance `Deliverable Placeholder`

Rules:

- Every engineering `Task` must be linked to at least one compliance `Deliverable Placeholder`.
- Tasks must not exist as compliance-orphaned work.
- Deliverable placeholders may represent required outputs such as plans, protocols, reports, reviews, approvals, specifications, verification evidence, validation evidence, or transfer records.
- The link between task and deliverable must be queryable for traceability and audit review.
- UI and API behavior should make this association explicit and hard to bypass.

### 2. Soft Phase-Gate, Work at Risk, and Phase-Independent Tasks

Project phases represent regulatory / program status. They must not be treated as a hard permission boundary for engineering execution.

Core principle:

- Decouple the project's regulatory phase status from the engineer's day-to-day execution state.
- Regulatory expectations may be waterfall-shaped, but the product must support agile execution with controlled auditability.
- The system must support "Work at Risk" instead of forcing engineers to work outside the system.

Rules:

- Engineers are allowed to start and progress `Task` work ahead of the officially advanced project phase.
- The system must not hard-lock task execution purely because the project has not yet been promoted to the next phase.
- This behavior is intentional and represents controlled "Work at Risk".
- The system should still surface visibility that work is occurring ahead of phase progression.
- `Task` planning phase and `Project.currentPhase` are intentionally related but not strictly coupled.
- Do not enforce a rule such as `task.plannedPhase <= project.currentPhase` for normal task creation or task progress.

Expected behavior:

- Tasks can be created, assigned, and progressed even if they belong to a future or not-yet-approved phase.
- Dashboards and reports should distinguish normal work from work being executed at risk.
- If an engineer opens a future-phase task while the project is still in an earlier phase, the system should allow it and mark it as ahead-of-phase / at-risk work rather than blocking it.

### 3. Conditional Go / Proceed with Exceptions

When a PM attempts to move the project into the next phase, the system must validate whether the required deliverables for the current phase are complete.

Rules:

- If required deliverables are incomplete, the system must show a warning.
- The warning must clearly identify missing or unapproved deliverables.
- The PM or delegated approver may still proceed using a conditional override.
- This override is a deliberate risk acceptance decision and should be captured as an auditable event.
- The UX may label this action as `Conditional Go`, `Override`, or `Proceed with Exceptions`.

When override is used:

- The project is allowed to enter the next phase.
- All incomplete deliverables from the prior phase must automatically convert into `Pending Items`.
- Pending items remain visible until completed and approved.
- The system should preserve who approved the override, when it occurred, and optionally the rationale.
- `Pending Items` and `Action Items` are equivalent concepts for this MVP.

### 4. Ultimate Hard Gate at Design Transfer

The final `Design Transfer` phase is a strict gate and must not allow override-based progression.

Rules:

- All pending items must be fully completed before passing design transfer.
- All required deliverables must be approved.
- Completion must be 100%.
- No open compliance gaps may remain.
- No soft override is permitted at this stage.

This is the single mandatory hard gate in the MVP.

If a later release adds an explicit regulatory submission gate, it should follow the same hard-gate philosophy.

### 5. Design Change Management After Transfer

Once design transfer is completed, transferred design records become locked.

Rules:

- Post-transfer documents and records must not be directly edited in place.
- Any modification requires a formal `Change Request`.
- Every change request must include `Impact Analysis`.
- Approved changes result in a new versioned record rather than silent mutation.
- The system must preserve change history and version lineage.

Impact analysis should consider:

- Regulatory impact
- Product risk impact
- Verification impact
- Validation impact
- Manufacturing / transfer impact
- Documentation impact

## Recommended Domain Concepts

Use consistent domain language across schema, API, and UI:

- `Project`
- `Phase`
- `Task`
- `DeliverablePlaceholder`
- `PendingItem`
- `PhaseTransition`
- `OverrideDecision`
- `Approval`
- `DesignTransfer`
- `ChangeRequest`
- `ImpactAnalysis`
- `DocumentVersion`
- `AuditLog`

## Workflow Expectations

### Task and Deliverable Lifecycle

- A task is created with required ownership, status, and linked deliverables.
- Linked deliverables begin as placeholders until real output or approval evidence exists.
- Deliverables move through statuses such as draft, in progress, ready for review, approved, or pending.
- The system should allow traceability from deliverable back to task and project phase.

### Phase Advancement

- Before advancing a phase, the system evaluates all required deliverables for gate readiness.
- If gaps exist, show a warning and permit override except for design transfer.
- Override converts gaps into pending items.
- Pending items remain actionable after phase advancement.
- Task execution itself must remain available even when phase advancement has not yet been formally approved.
- Phase advancement is the compliance control point; task execution is not.

### Post-Transfer Change Flow

- Design transfer locks baseline artifacts.
- User submits change request.
- Impact analysis is completed.
- Review and approval occur.
- Approved change creates a new version.
- Audit trail remains immutable and reviewable.

## Technical Stack

This project uses:

- Next.js
- Prisma
- Tailwind CSS
- TypeScript

### Stack Expectations

- Use Next.js App Router conventions unless existing project structure clearly dictates otherwise.
- Use Prisma as the source of truth for persistence modeling and relational integrity.
- Use Tailwind for styling with reusable design primitives rather than ad hoc utility sprawl.
- Use TypeScript everywhere across frontend, backend, domain logic, and data contracts.

## Engineering Guidelines

### Code Quality

- Write clean, modular, maintainable code.
- Keep business logic out of UI components whenever possible.
- Prefer small, composable modules over large multi-purpose files.
- Separate domain logic, persistence logic, validation logic, and presentation logic.
- Avoid hidden coupling between workflow rules and UI-only state.

### TypeScript Standards

- Add complete and explicit TypeScript type definitions for domain entities, API payloads, service inputs, service outputs, and UI state where appropriate.
- Prefer well-named domain types over loose `any` or overly generic records.
- Encode important workflow constraints with enums, discriminated unions, and typed service contracts where useful.
- Validate untrusted input at system boundaries.
- Keep Prisma types and application domain types intentionally mapped rather than leaking database concerns everywhere.

### Architecture Guidance

- Centralize regulated workflow rules in domain services or policy modules.
- Make gate evaluation logic deterministic and easy to test.
- Represent override decisions and audit events as first-class persisted objects.
- Treat locking, versioning, and pending-item creation as explicit domain behaviors, not UI shortcuts.
- Design for traceability from `Task` to `DeliverablePlaceholder` to `Approval` to `PhaseTransition`.
- Preserve the intentional decoupling between `Project.currentPhase` and `Task.plannedPhase`.
- If a task is ahead of the project's current phase, model that as visible at-risk execution, not as a validation failure.

### UI / UX Guidance

- The UI should make compliance state understandable without overwhelming engineers.
- Show task-to-deliverable linkage clearly.
- Show when work is being performed at risk.
- Make it obvious that engineers can continue execution while the formal phase gate is still pending.
- Make missing deliverables and pending items highly visible during phase transitions.
- Make hard-gate conditions at design transfer unambiguous.
- Show document lock/version state clearly after transfer.

### Testing Guidance

- Unit test domain rules heavily, especially phase-gate evaluation, override behavior, pending-item generation, hard-gate enforcement, and change-control locking.
- Add integration tests for Prisma-backed workflow transitions.
- Test edge cases around partial approvals, reopened items, and post-transfer edits.
- Prefer tests that verify business invariants over shallow implementation details.

## Non-Negotiable Product Behaviors

- A `Task` cannot be created without linked deliverable placeholders.
- Task execution is not hard-blocked by current project phase.
- `Project.currentPhase` must not be treated as a hard authorization boundary for future-phase task work.
- Phase advancement warns on missing deliverables.
- PM override is allowed for intermediate phases only.
- Override generates pending items automatically.
- `Design Transfer` is a hard gate with zero incomplete items allowed.
- Post-transfer changes require `ChangeRequest` and `ImpactAnalysis`.
- Transferred records are versioned, not silently overwritten.
- Significant workflow actions must be auditable.

## Implementation Mindset

When implementing features in this project:

- Favor traceability over convenience.
- Favor explicit workflows over implicit state changes.
- Favor auditability over silent automation.
- Favor modular domain modeling over shortcut CRUD design.
- Keep the MVP lean, but never undermine the core compliance logic above.
