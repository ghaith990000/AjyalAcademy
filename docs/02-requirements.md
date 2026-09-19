# Requirements traceability

Original requests from the product owner, each with an ID, the phase that delivers it, and status. Update the **Status** column as phases complete. `[ ]` = not done, `[x]` = done and verified.

| ID   | Requirement                                                                                                                   | Phase(s)                                   | Status |
| ---- | ----------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ | ------ |
| R-01 | Store players: name, CPR, date of birth, address, school, phone number, has-disease flag, and disease description if so       | 2 (schema), 3                              | [x]    |
| R-02 | Player can subscribe: start date, end date, subscription fee, T-shirt fee for first-time joining, optional transportation fee | 2 (schema), 4                              | [x]    |
| R-03 | Coaches can track who attended a training session                                                                             | 5                                          | [x]    |
| R-04 | Schedule training sessions with start time and end time                                                                       | 5                                          | [x]    |
| R-05 | Web app is accessible/usable on mobile phones                                                                                 | 1 (foundation), 8 (verify) — every phase   | [x]    |
| R-06 | Every coach can manage a list of players                                                                                      | 3                                          | [x]    |
| R-07 | Administrator distributes players to coaches                                                                                  | 3                                          | [x]    |
| R-08 | Calculate total fees collected from players per month and per year                                                            | 6                                          | [x]    |
| R-09 | Profit margin report: total revenue vs total expenses (coach salaries, football field rent, transportation, …)                | 6                                          | [x]    |
| R-10 | Plan prices: Solo 20 BD, Duo 35 BD, 3 players 50 BD, 4 players 60 BD                                                          | 2 (seed), 4                                | [x]    |
| R-11 | Track user activity: who added/removed a player, who added a subscription — visible on the home screen                        | 2 (triggers), 7 (UI)                       | [x]    |
| R-12 | Discount feature on subscriptions                                                                                             | 4                                          | [x]    |
| R-13 | Built with React + TypeScript                                                                                                 | 0                                          | [x]    |
| R-14 | Support Arabic and English                                                                                                    | 0 (i18n base), 1 (RTL/switch), every phase | [x]    |
| R-15 | Beautiful UI for admins and trainers matching Ajyal Academy's theme                                                           | 1, then every phase                        | [x]    |
| R-16 | Build in phases and document everything in Markdown so Claude can rely on the docs                                            | 0, continuous                              | [x]    |

## Confirmed clarifications (from the product owner)

- Backend is **Supabase**.
- Pricing plans: **one shared subscription per group, billed monthly** — the subscription covers 1–4 players; plan picked by player count.
- Discounts: **admin-defined reusable discount codes (percent or fixed BD) plus a one-off manual discount per subscription**.

## Not in scope (unless asked later)

Online payments/gateway, parent/player login, SMS/WhatsApp notifications, multiple branches as separate tenants, match/tournament management, inventory. Design should not block them, but do not build them.
