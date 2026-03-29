# Remediation Roadmap

## Immediate

- Replace string-based change impact notes with structured `ImpactAnalysis` data and keep it linked 1:1 with each `ChangeRequest`.
- Persist formal `Approval` records for QA release / rejection decisions so deliverable approval is queryable by actor, decision, timestamp, and revision.
- Require review-decision actors for deliverable release / return actions and reject release when no revision evidence exists.
- Require locked-deliverable revisions to reference an approved `ChangeRequest` that is explicitly linked to the same deliverable.
- Restore delivery hygiene by keeping `build` green and `test` non-empty.

## Near-Term

- Add explicit audit events for automatic `PendingItem` resolve / reopen behaviors so background workflow changes are reviewable.
- Split `Design Transfer` gate semantics from post-transfer baseline locking so the workflow matches the product intent more precisely.
- Introduce a dedicated `OverrideDecision` object instead of storing override detail only on `PhaseTransition`.
- Add actor capture to phase API entry points and stop allowing major regulated actions with implicit system actors.
- Tighten file / document release rules so approvals point to the exact accepted revision and not just the deliverable shell.

## Product / Workflow

- Redefine `At-Risk` reporting to mean ahead-of-phase execution only; track lagging work separately.
- Add aging, ownership, and SLA-style views for `PendingItem` follow-up.
- Add project-level gate review summaries that show missing deliverables, prior overrides, open pending items, and upcoming hard-gate blockers together.
- Add post-transfer change dashboards that show baseline revision, approved CR, implementation state, and affected deliverables / parts in one place.

## Governance

- Add role-aware authorization so PM, QA, RD, and Admin actions are enforced by identity instead of free-form actor selection.
- Add immutable workflow exports for audit review: approvals, phase transitions, pending-item history, and change lineage.
- Add domain-level integration tests for gate evaluation, override conversion, pending-item reopening, locked-record change control, and approval traceability.
