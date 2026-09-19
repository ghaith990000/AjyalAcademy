# Overview

## Product

A web app (works on phones, installable as a PWA) for **Ajyal Academy** (أكاديمية أجيال), a youth football academy in Bahrain — branches in Al-Rifa' and Hamad City. It replaces paper/WhatsApp record keeping for:

- the **player registry** (with medical conditions),
- **subscriptions** and fees (plans by number of players, T-shirt, transport, discounts, payments),
- **training sessions** and **attendance**,
- **finances**: money collected, expenses, profit margin,
- an **activity log** so admins can see who did what.

Currency is Bahraini Dinar (BD / BHD, 3 decimals). Tagline (their Linktree): "رمز الثقة في تعليم أساسيات كرة القدم" — "the symbol of trust in teaching the fundamentals of football".

## Users and roles

| Role      | Who                | Can do                                                                                                                                                                                                                                   |
| --------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin** | Academy management | Everything: manage coaches, assign players to coaches, plans/fees settings, discounts, expenses, reports, full activity feed, and all coach actions on any player.                                                                       |
| **Coach** | Trainer            | Add/edit/remove **their own** players; create subscriptions and record payments for their own players; schedule their own sessions and take attendance; see their own activity. Cannot see other coaches' players, finances, or reports. |

Authoritative permission matrix: [04-data-model.md](04-data-model.md#rls-matrix).

## Core workflows

1. **Register player** (admin or coach) → player gets a coach (auto-assigned to the creating coach; admin can reassign).
2. **Subscribe** → choose 1–4 players (siblings/group) → plan price is set by player count → dates → per-player T-shirt (first time) and transport → optional discount → payment.
3. **Train** → coach/admin schedules sessions → coach marks who attended.
4. **Report** → admin sees collected fees (month/year), expenses, profit and margin.
5. **Audit** → home screen shows a live feed of who added/removed players, created subscriptions, etc.

## Glossary

| English                   | العربية                       | Meaning in this system                                              |
| ------------------------- | ----------------------------- | ------------------------------------------------------------------- |
| Player                    | لاعب                          | A child registered at the academy.                                  |
| Coach / Trainer           | مدرب                          | Staff who trains players and takes attendance.                      |
| Admin                     | مدير / مشرف                   | Academy management user.                                            |
| CPR                       | الرقم الشخصي (CPR)            | Bahraini 9-digit personal number; unique per player.                |
| Subscription              | اشتراك                        | A paid period (start–end) covering 1–4 players under one plan.      |
| Plan (Solo/Duo/Trio/Quad) | باقة (فردي/ثنائي/ثلاثي/رباعي) | Price tier decided by how many players the subscription covers.     |
| T-shirt fee               | رسوم القميص                   | One-time fee on a player's first ever subscription.                 |
| Transportation fee        | رسوم المواصلات                | Optional per-player fee if the player uses academy transport.       |
| Discount                  | خصم                           | Percentage or fixed reduction on a subscription (code or manual).   |
| Payment                   | دفعة                          | Money actually received against a subscription ("collected").       |
| Training session          | حصة تدريبية                   | A scheduled training with date, start time and end time.            |
| Attendance                | الحضور                        | Present/absent record per player per session.                       |
| Expense                   | مصروف                         | Money the academy spends: coach salary, field rent, transport, etc. |
| Profit margin             | هامش الربح                    | (Collected − Expenses) ÷ Collected.                                 |
| BD / BHD, fils            | دينار بحريني، فلس             | 1 BD = 1000 fils. All money is stored as integer fils.              |
