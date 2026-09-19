# Documentation index

Ajyal Academy Management System. This folder is the **source of truth** for what we are building and why. Claude (and humans) should rely on it instead of re-deriving context.

## How to use these docs (Claude)

1. Open [ROADMAP.md](ROADMAP.md) → find the phase marked **In progress** (or the next **Not started**).
2. Open that phase's file in [phases/](phases/) — it lists tasks, acceptance criteria and which reference docs to read.
3. Read only those reference docs. Keep them accurate as you work (see Definition of Done in [09-conventions.md](09-conventions.md)).
4. When you make a non-obvious choice, add an entry to [08-decisions.md](08-decisions.md).
5. On finishing a phase: tick the checklist, update [ROADMAP.md](ROADMAP.md), write the **Handoff notes** at the bottom of the phase file.

## Map

| Doc                                          | What it answers                                                              |
| -------------------------------------------- | ---------------------------------------------------------------------------- |
| [01-overview.md](01-overview.md)             | What is the product? Who uses it? Glossary (EN/AR).                          |
| [02-requirements.md](02-requirements.md)     | Every original requirement (R-01…R-16) mapped to phases, with status.        |
| [03-architecture.md](03-architecture.md)     | Stack, folder layout, data flow, patterns to follow.                         |
| [04-data-model.md](04-data-model.md)         | Tables, columns, constraints, RLS matrix, triggers, RPCs.                    |
| [05-business-rules.md](05-business-rules.md) | Pricing, fees, discounts, payments, reports — formulas with worked examples. |
| [06-design-system.md](06-design-system.md)   | Brand, tokens, components, mobile + RTL rules.                               |
| [07-i18n.md](07-i18n.md)                     | Arabic/English rules, key naming, formatting of numbers/dates/currency.      |
| [08-decisions.md](08-decisions.md)           | Decision log (ADR style), assumptions, open questions.                       |
| [09-conventions.md](09-conventions.md)       | Code style, testing, Definition of Done.                                     |
| [10-deployment.md](10-deployment.md)         | Deploying: Supabase project, Edge Function, hosting, first admin, backups.   |
| [11-user-guide.md](11-user-guide.md)         | Short guide for coaches and admins, in English and Arabic.                   |
| [ROADMAP.md](ROADMAP.md)                     | Phase status table — single source of progress.                              |
| [phases/](phases/)                           | One file per build phase (PHASE-0 … PHASE-8).                                |

Root file [../CLAUDE.md](../CLAUDE.md) holds the short list of hard rules and commands.
