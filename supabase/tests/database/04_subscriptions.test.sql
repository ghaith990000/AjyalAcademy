-- Subscriptions: pricing (pinned to docs/05-business-rules.md), create/record_payment/cancel rules,
-- discounts, overlap, coach isolation on the views, activity logging.
-- See 01_access_control.test.sql for how to run. Ids: tests.u(n) = f7000000-…-n.
--   users: admin u(1), coach1 u(2), coach2 u(3)
--   players (full_name sp-A1…): A1–A9 = u(11)–u(19) and A10 = u(20) belong to coach1; B1–B4 = u(21)–u(24) to coach2
--   u(31) is a removed player, u(32) is used for status fixtures.  A1, A2, B1, B2 are "returning" (prior subscription s0).
begin;

create extension if not exists pgtap with schema extensions;
select no_plan();

create schema tests;
grant usage on schema tests to public;

create function tests.u(n integer) returns uuid language sql immutable as $$
  select ('f7000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid
$$;
create table tests.ids (k text primary key, id uuid not null);
grant all on tests.ids to public;
create function tests.s(k text) returns uuid language sql stable as $$ select id from tests.ids where tests.ids.k = $1 $$;
-- [{player_id, transport?, tshirt?}] for players given as small ints
create function tests.pj(p_ids integer[], p_transport integer[] default '{}', p_tshirt jsonb default '{}')
returns jsonb language sql stable as $$
  select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
    'player_id', tests.u(i), 'transport', i = any (p_transport), 'tshirt', (p_tshirt ->> i::text)::boolean)) order by ord)
  from unnest(p_ids) with ordinality as t (i, ord)
$$;
create function tests.err_detail(p_sql text) returns text language plpgsql as $$
declare d text;
begin
  execute p_sql;
  return null;
exception when others then
  get stacked diagnostics d = pg_exception_detail;
  return d;
end $$;
create function tests.act_as(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', jsonb_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
end $$;
create function tests.act_as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  set local role anon;
end $$;
create function tests.reset() returns void language plpgsql as $$
begin
  reset role;
  perform set_config('request.jwt.claims', '', true);
end $$;
grant execute on all functions in schema tests to public;

-- Fixtures ------------------------------------------------------------------------------------------
insert into auth.users (id, email) values
  (tests.u(1), 'admin@tests.invalid'), (tests.u(2), 'coach1@tests.invalid'), (tests.u(3), 'coach2@tests.invalid');
insert into public.profiles (id, full_name, email, role) values
  (tests.u(1), 'Admin A', 'admin@tests.invalid', 'admin'),
  (tests.u(2), 'Coach One', 'coach1@tests.invalid', 'coach'),
  (tests.u(3), 'Coach Two', 'coach2@tests.invalid', 'coach');

-- Independent of whatever the real settings/plans are: pin the placeholder values from the docs.
update public.settings set tshirt_fee_fils = 5000, transport_fee_fils = 10000, expiring_soon_days = 7;
update public.plans set price_fils = 20000, active = true where code = 'solo';
update public.plans set price_fils = 35000, active = true where code = 'duo';
update public.plans set price_fils = 50000, active = true where code = 'trio';
update public.plans set price_fils = 60000, active = true where code = 'quad';

insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id)
select tests.u(n), 'sp-A' || (n - 10), '91000' || lpad(n::text, 4, '0'), '2015-01-01', '39000000', tests.u(2)
from generate_series(11, 19) n;
insert into public.players (id, full_name, cpr, date_of_birth, phone, coach_id) values
  (tests.u(20), 'sp-A10', '910000020', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(21), 'sp-B1', '910000021', '2015-01-01', '39000000', tests.u(3)),
  (tests.u(22), 'sp-B2', '910000022', '2015-01-01', '39000000', tests.u(3)),
  (tests.u(23), 'sp-B3', '910000023', '2015-01-01', '39000000', tests.u(3)),
  (tests.u(24), 'sp-B4', '910000024', '2015-01-01', '39000000', tests.u(3)),
  (tests.u(31), 'sp-removed', '910000031', '2015-01-01', '39000000', tests.u(2)),
  (tests.u(32), 'sp-status', '910000032', '2015-01-01', '39000000', tests.u(2));
update public.players set deleted_at = now() where id = tests.u(31);

-- s0: an old subscription that makes A1, A2, B1, B2 "returning" players.
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils)
  select tests.u(100), id, public.today_bh() - 300, public.today_bh() - 271, price_fils, price_fils from public.plans where code = 'quad';
insert into public.subscription_players (subscription_id, player_id) values
  (tests.u(100), tests.u(11)), (tests.u(100), tests.u(12)), (tests.u(100), tests.u(21)), (tests.u(100), tests.u(22));

insert into public.discounts (id, name, code, type, value, active, valid_from, valid_to, max_uses) values
  (tests.u(301), 'Ten percent', 'ZTEN', 'percent', 1000, true, null, null, null),
  (tests.u(302), 'Switched off', 'ZOFF', 'percent', 1000, false, null, null, null),
  (tests.u(303), 'Ended', 'ZOLD', 'percent', 1000, true, null, public.today_bh() - 1, null),
  (tests.u(304), 'Not yet', 'ZFUT', 'percent', 1000, true, public.today_bh() + 1, null, null),
  (tests.u(305), 'Once only', 'ZONE', 'fixed', 5000, true, null, null, 1);

delete from public.activity_log; -- exact counts below (rolled back with everything else)

-- ---------------------------------------------------------------------------
-- calc_subscription_total — the worked examples, and rounding
-- ---------------------------------------------------------------------------
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(20000, 0, 0, null, null)), '0/20000', '#1 solo, returning');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(20000, 5000, 0, null, null)), '0/25000', '#2 solo, first-time (T-shirt)');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(35000, 5000, 10000, 'percent', 1000)), '5000/45000', '#3 duo with T-shirt, transport and 10%');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(20000, 5000, 0, 'fixed', 3000)), '3000/22000', '#4 fixed discount');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(20000, 0, 0, 'fixed', 30000)), '20000/0', '#5 discount capped at the subtotal');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(60000, 0, 20000, 'percent', 1500)), '12000/68000', '#6 quad, two with transport, 15%');
select is((select discount_fils || '/' || total_fils from public.calc_subscription_total(20000, 5000, 10000, 'percent', 1250)), '4375/30625', '#7 12.5% of 35.000');
select is((select discount_fils from public.calc_subscription_total(20004, 0, 0, 'percent', 1250)), 2501, 'percent rounds half up (2500.5 → 2501)');
select is((select discount_fils from public.calc_subscription_total(20003, 0, 0, 'percent', 1250)), 2500, 'and rounds down below the half (2500.375 → 2500)');
select is((select subtotal_fils from public.calc_subscription_total(20000, 5000, 10000, null, null)), 35000, 'the subtotal is plan + T-shirt + transport');

-- ---------------------------------------------------------------------------
-- status (mirrors src/lib/subscription-status.ts)
-- ---------------------------------------------------------------------------
insert into public.subscriptions (id, plan_id, start_date, end_date, plan_price_fils, total_fils, cancelled_at)
select tests.u(n), id, s, e, price_fils, price_fils, c
from public.plans, (values
  (201, public.today_bh() + 1,  public.today_bh() + 30, null::timestamptz),
  (202, public.today_bh() - 5,  public.today_bh() + 30, null),
  (203, public.today_bh() - 20, public.today_bh() + 7,  null),
  (204, public.today_bh() - 20, public.today_bh() + 8,  null),
  (205, public.today_bh() - 40, public.today_bh() - 1,  null),
  (206, public.today_bh() - 5,  public.today_bh() + 30, now()),
  (207, public.today_bh(),      public.today_bh(),      null)
) as v (n, s, e, c)
where code = 'solo';
select is((select status from public.subscription_overview where id = tests.u(201)), 'upcoming', 'starts tomorrow → upcoming');
select is((select status from public.subscription_overview where id = tests.u(202)), 'active', 'running with a month left → active');
select is((select status from public.subscription_overview where id = tests.u(203)), 'expiring_soon', '7 days left → expiring soon');
select is((select status from public.subscription_overview where id = tests.u(204)), 'active', '8 days left → still active');
select is((select status from public.subscription_overview where id = tests.u(205)), 'expired', 'ended yesterday → expired');
select is((select status from public.subscription_overview where id = tests.u(206)), 'cancelled', 'cancelled wins over the dates');
select is((select status from public.subscription_overview where id = tests.u(207)), 'expiring_soon', 'a one-day subscription today → expiring soon (last day)');

-- ---------------------------------------------------------------------------
-- create_subscription as a coach: fees, first-time rule, snapshots
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
insert into tests.ids select 'T1', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[13]));
select is((select total_fils from public.subscriptions where id = tests.s('T1')), 25000, '#2 a first-time player: plan 20.000 + T-shirt 5.000');
select is((select tshirt_fee_fils || '/' || transport_fee_fils from public.subscription_players where subscription_id = tests.s('T1')), '5000/0', 'fees are snapshotted per player');
select is((select plan_price_fils || '/' || tshirt_total_fils || '/' || transport_total_fils || '/' || discount_fils from public.subscriptions where id = tests.s('T1')), '20000/5000/0/0', 'the stored parts add up');
select is((select created_by from public.subscriptions where id = tests.s('T1')), tests.u(2), 'created_by is the coach');
select is((select paid_fils || '/' || balance_fils || '/' || status from public.subscription_overview where id = tests.s('T1')), '0/25000/active', 'unpaid by default: paid 0, balance = total');

insert into tests.ids select 'T1b', public.create_subscription(public.today_bh() + 30, public.today_bh() + 59, tests.pj(array[13]));
select is((select total_fils from public.subscriptions where id = tests.s('T1b')), 20000, 'a returning player pays no T-shirt');

insert into tests.ids select 'T2', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[14]));
select public.cancel_subscription(tests.s('T2'), 'created by mistake');
insert into tests.ids select 'T2b', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[14]));
select is((select total_fils from public.subscriptions where id = tests.s('T2b')), 20000, 'a cancelled first subscription does not re-trigger the T-shirt fee');
select is((select count(*)::int from public.subscriptions s join public.subscription_players sp on sp.subscription_id = s.id where sp.player_id = tests.u(14) and s.cancelled_at is null), 1, 'and a cancelled subscription does not block the same dates');

insert into tests.ids select 'T3', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[15, 11], array[15]), 'ZTEN', null, null, null, 45000, 'benefit');
select is((select discount_fils || '/' || total_fils from public.subscriptions where id = tests.s('T3')), '5000/45000', '#3 duo: A first-time + transport, B returning, 10% code');
select is((select plan_code from public.subscription_overview where id = tests.s('T3')), 'duo', 'two players → the duo plan');
select is((select discount_id from public.subscriptions where id = tests.s('T3')), tests.u(301), 'the code is linked');
select is((select discount_type::text || '/' || discount_value from public.subscriptions where id = tests.s('T3')), 'percent/1000', 'and its type and value are snapshotted');
select is((select paid_fils || '/' || balance_fils from public.subscription_overview where id = tests.s('T3')), '45000/0', 'paid in full at creation');
select is((select method::text || '/' || paid_at::text from public.payments where subscription_id = tests.s('T3')), 'benefit/' || public.today_bh()::text, 'the initial payment uses the chosen method, dated today');

insert into tests.ids select 'T5', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[16], array[16]), null, 'percent', 1250, '  Staff child ', 10000);
select is((select discount_fils || '/' || total_fils from public.subscriptions where id = tests.s('T5')), '4375/30625', '#7 manual 12.5% with rounding');
select is((select discount_reason from public.subscriptions where id = tests.s('T5')), 'Staff child', 'the manual reason is trimmed and stored');
select is((select discount_id from public.subscriptions where id = tests.s('T5')), null, 'a manual discount has no code');
select is((select paid_fils || '/' || balance_fils from public.subscription_overview where id = tests.s('T5')), '10000/20625', 'a partial initial payment leaves a balance');

insert into tests.ids select 'T5b', public.create_subscription(public.today_bh() + 30, public.today_bh() + 59, tests.pj(array[16]));
select is((select total_fils from public.subscriptions where id = tests.s('T5b')), 20000, 'the day after the previous one ends is allowed (adjacent, not overlapping)');

insert into tests.ids select 'T7', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[17]), null, 'fixed', 3000, 'Loyalty');
select is((select discount_fils || '/' || total_fils from public.subscriptions where id = tests.s('T7')), '3000/22000', '#4 manual fixed discount');

insert into tests.ids select 'T9', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[19], '{}', '{"19": false}'));
select is((select total_fils from public.subscriptions where id = tests.s('T9')), 25000, 'a coach cannot waive the T-shirt fee (the override is ignored)');

select tests.act_as(tests.u(1));
insert into tests.ids select 'T8', public.create_subscription(public.today_bh(), public.today_bh() + 29, tests.pj(array[18], '{}', '{"18": false}'));
select is((select total_fils from public.subscriptions where id = tests.s('T8')), 20000, 'an admin can waive the T-shirt fee for a first-time player');
insert into tests.ids select 'T8b', public.create_subscription(public.today_bh() + 200, public.today_bh() + 229, tests.pj(array[12], '{}', '{"12": true}'));
select is((select total_fils from public.subscriptions where id = tests.s('T8b')), 25000, 'and charge it to a returning one');

insert into tests.ids select 'Q', public.create_subscription(public.today_bh() + 100, public.today_bh() + 129, tests.pj(array[11, 12, 21, 22], array[11, 21]), null, 'percent', 1500, 'Sibling promo');
select is((select plan_code || '/' || discount_fils || '/' || total_fils from public.subscription_overview where id = tests.s('Q')), 'quad/12000/68000', '#6 an admin can mix any coaches'' players: quad, 15%, two with transport');
select is((select count(*)::int from public.subscription_players where subscription_id = tests.s('Q')), 4, 'all four players are stored');

insert into tests.ids select 'T6', public.create_subscription(public.today_bh() + 300, public.today_bh() + 329, tests.pj(array[12]), null, 'fixed', 30000, 'Free month', 0);
select is((select discount_fils || '/' || total_fils from public.subscriptions where id = tests.s('T6')), '20000/0', '#5 the discount is capped: a total of zero, never negative');
select is((select count(*)::int from public.payments where subscription_id = tests.s('T6')), 0, 'a fully discounted subscription creates no payment');

-- plan price changes never rewrite history
select tests.reset();
update public.plans set price_fils = 99999 where code = 'solo';
select is((select plan_price_fils from public.subscriptions where id = tests.s('T1')), 20000, 'the plan price is snapshotted on the subscription');
update public.plans set price_fils = 20000 where code = 'solo';

-- ---------------------------------------------------------------------------
-- create_subscription: who and what is refused
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[21]))$$, 'P0002', 'ajyal:player_not_found', 'a coach cannot use another coach''s player');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[13, 21]))$$, 'P0002', 'ajyal:player_not_found', 'not even in a mix with their own');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[31]))$$, 'P0002', 'ajyal:player_not_found', 'a removed player cannot be subscribed');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, '[]'::jsonb)$$, '22023', 'ajyal:invalid_players', 'at least one player');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[11, 12, 13, 14, 15]))$$, '22023', 'ajyal:invalid_players', 'at most four players');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[13, 13]))$$, '22023', 'ajyal:invalid_players', 'the same player twice');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, '[{"player_id": "nope"}]'::jsonb)$$, '22023', 'ajyal:invalid_players', 'a malformed player id');
select throws_ok($$select public.create_subscription(public.today_bh() + 529, public.today_bh() + 500, tests.pj(array[13]))$$, '22023', 'ajyal:invalid_dates', 'the end cannot precede the start');
select throws_ok($$select public.create_subscription(public.today_bh() + 10, public.today_bh() + 20, tests.pj(array[13]))$$, '23P01', 'ajyal:overlap', 'overlapping the same player''s subscription is refused');
select is(tests.err_detail($$select public.create_subscription(public.today_bh() + 10, public.today_bh() + 20, tests.pj(array[13, 19]))$$), tests.u(13)::text || ',' || tests.u(19)::text, 'and the conflicting players are named in the error detail');
select throws_ok($$select public.create_subscription(public.today_bh() + 29, public.today_bh() + 40, tests.pj(array[17]))$$, '23P01', 'ajyal:overlap', 'the last day is inclusive: starting on it still overlaps');
select is((select count(*)::int from public.subscription_players where player_id = tests.u(13)), 2, 'refused calls wrote nothing');

select tests.reset();
update public.plans set active = false where code = 'solo';
select tests.act_as(tests.u(2));
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[20]))$$, '22023', 'ajyal:plan_unavailable', 'an inactive plan cannot be sold');
select tests.reset();
update public.plans set active = true where code = 'solo';

-- ---------------------------------------------------------------------------
-- discounts
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), 'NOPE')$$, 'P0002', 'ajyal:discount_not_found', 'an unknown code');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), 'ZOFF')$$, '22023', 'ajyal:discount_inactive', 'an inactive code');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), 'ZOLD')$$, '22023', 'ajyal:discount_expired', 'an expired code');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), 'ZFUT')$$, '22023', 'ajyal:discount_not_started', 'a code that has not started');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), 'ZTEN', 'fixed', 1000, 'r')$$, '22023', 'ajyal:discount_conflict', 'a code and a manual discount cannot be combined');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), null, 'percent', 1000, '   ')$$, '22023', 'ajyal:manual_discount_reason_required', 'a manual discount needs a reason');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), null, 'percent', 10001, 'r')$$, '22023', 'ajyal:manual_discount_invalid', 'a percentage above 100%');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), null, 'fixed', 0, 'r')$$, '22023', 'ajyal:manual_discount_invalid', 'a zero fixed discount');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), null, null, 1000, 'r')$$, '22023', 'ajyal:manual_discount_invalid', 'a value without a type');
select is((select count(*)::int from public.subscription_players where player_id = tests.u(23)), 0, 'none of the refused discounts left a subscription behind');

insert into tests.ids select 'TC', public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[23]), '  zten ');
select is((select discount_fils || '/' || total_fils from public.subscriptions where id = tests.s('TC')), '2500/22500', 'codes are case-insensitive and trimmed: 10% of 25.000');

insert into tests.ids select 'TONE', public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[24]), 'ZONE');
select throws_ok($$select public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[21]), 'ZONE')$$, '22023', 'ajyal:discount_exhausted', 'a code past its max uses');
select public.cancel_subscription(tests.s('TONE'), 'test');
insert into tests.ids select 'TONE2', public.create_subscription(public.today_bh() + 500, public.today_bh() + 529, tests.pj(array[21]), 'ZONE');
select is((select total_fils from public.subscriptions where id = tests.s('TONE2')), 15000, 'a cancelled subscription frees its use of the code');

-- ---------------------------------------------------------------------------
-- create_subscription is all-or-nothing
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select throws_ok($$select public.create_subscription(public.today_bh() + 700, public.today_bh() + 729, tests.pj(array[20]), null, null, null, null, 25001)$$, '22003', 'ajyal:overpayment', 'an initial payment above the total is refused');
select tests.reset();
select is((select count(*)::int from public.subscription_players where player_id = tests.u(20)), 0, 'and nothing was created (no subscription, no fees)');
select is((select count(*)::int from public.activity_log where (summary -> 'player_names') = '["sp-A10"]'::jsonb), 0, 'nor logged');

-- ---------------------------------------------------------------------------
-- read models and coach isolation
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(3));
select is((select count(*)::int from public.subscription_overview where id in (tests.s('Q'), tests.u(100))), 2, 'coach 2 sees the subscriptions that contain one of their players');
select is((select count(*)::int from public.subscription_overview where id = tests.s('T1')), 0, 'and not one with only coach 1''s player');
select is((select player_names from public.subscription_overview where id = tests.s('Q')), 'sp-B1, sp-B2', 'and only their own players'' names in a mixed subscription');
select is((select player_count from public.subscription_overview where id = tests.s('Q')), 4, 'while the player count is still the whole subscription');
select is((select count(*)::int from public.subscription_players where subscription_id = tests.s('T1')), 0, 'the players of a foreign subscription stay hidden');
select tests.act_as(tests.u(2));
select is((select player_names from public.subscription_overview where id = tests.s('Q')), 'sp-A1, sp-A2', 'coach 1 sees their own names in the same subscription');
select is((select count(*)::int from public.subscription_overview where id in (tests.s('TC'), tests.s('TONE2'))), 0, 'and nothing of subscriptions that contain only coach 2''s players');
select tests.act_as(tests.u(1));
select is((select player_names from public.subscription_overview where id = tests.s('Q')), 'sp-A1, sp-A2, sp-B1, sp-B2', 'the admin sees every name');
select is((select status from public.player_subscription_status where player_id = tests.u(11)), 'active', 'a player with a running and an upcoming subscription shows as active');
select is((select status from public.player_subscription_status where player_id = tests.u(12)), 'upcoming', 'one with only future subscriptions shows as upcoming');
select is((select count(*)::int from public.player_subscription_status where player_id in (tests.u(11), tests.u(12), tests.u(13))), 3, 'exactly one row per player');
select is((select count(*)::int from public.player_subscription_status where player_id = tests.u(31)), 0, 'a player with no subscription has no row');
select tests.act_as_anon();
select throws_ok($$select * from public.subscription_overview$$, '42501', null, 'anon cannot read the overview');
select throws_ok($$select * from public.player_subscription_status$$, '42501', null, 'nor the player status view');
select tests.reset();

-- ---------------------------------------------------------------------------
-- record_payment
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
insert into tests.ids select 'P1', public.record_payment(tests.s('T1'), 10000);
select is((select method::text || '/' || paid_at::text from public.payments where id = tests.s('P1')), 'cash/' || public.today_bh()::text, 'defaults: cash, today');
select is((select paid_fils || '/' || balance_fils from public.subscription_overview where id = tests.s('T1')), '10000/15000', 'the balance follows the payments');
select throws_ok($$select public.record_payment(tests.s('T1'), 15001)$$, '22003', 'ajyal:overpayment', 'a payment above the balance is refused');
select lives_ok($$select public.record_payment(tests.s('T1'), 15000, 'bank_transfer', public.today_bh() - 2, '  Ref 123 ')$$, 'paying exactly the balance is fine, on an earlier date, with a note');
select is((select balance_fils from public.subscription_overview where id = tests.s('T1')), 0, 'settled');
select is((select note from public.payments where subscription_id = tests.s('T1') and amount_fils = 15000), 'Ref 123', 'the note is trimmed');
select throws_ok($$select public.record_payment(tests.s('T1'), 1)$$, '22003', 'ajyal:overpayment', 'nothing more can be paid once settled');
select throws_ok($$select public.record_payment(tests.s('T7'), 0)$$, '22023', 'ajyal:invalid_amount', 'a zero payment');
select throws_ok($$select public.record_payment(tests.s('T7'), -100)$$, '22023', 'ajyal:invalid_amount', 'a negative payment');
select throws_ok($$select public.record_payment(tests.s('T7'), 100, 'cash', public.today_bh() + 1)$$, '22023', 'ajyal:invalid_date', 'a payment dated in the future');
select throws_ok($$select public.record_payment(tests.s('T2'), 100)$$, '55000', 'ajyal:subscription_cancelled', 'a cancelled subscription takes no payments');
select tests.act_as(tests.u(3));
select throws_ok($$select public.record_payment(tests.s('T7'), 100)$$, 'P0002', 'ajyal:subscription_not_found', 'a coach cannot pay a subscription with none of their players');
select tests.act_as(tests.u(1));
select lives_ok($$select public.record_payment(tests.s('T7'), 100)$$, 'an admin can record a payment on any subscription');
select tests.act_as_anon();
select throws_ok($$select public.record_payment(tests.s('T7'), 100)$$, '42501', null, 'anon cannot call record_payment');
select tests.reset();

-- ---------------------------------------------------------------------------
-- cancel_subscription
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(2));
select throws_ok($$select public.cancel_subscription(tests.s('T3'), '   ')$$, '22023', 'ajyal:reason_required', 'a reason is required');
select tests.act_as(tests.u(3));
select throws_ok($$select public.cancel_subscription(tests.s('T3'), 'not mine')$$, 'P0002', 'ajyal:subscription_not_found', 'a coach cannot cancel a subscription that is not theirs');
select tests.act_as(tests.u(2));
select lives_ok($$select public.cancel_subscription(tests.s('T3'), '  Moved away ')$$, 'a coach cancels their own subscription');
select tests.reset();
select is((select cancelled_by::text || '/' || cancel_reason from public.subscriptions where id = tests.s('T3')), tests.u(2)::text || '/Moved away', 'who and why are stored');
select is((select count(*)::int from public.payments where subscription_id = tests.s('T3')), 1, 'payments are kept (no refunds in scope)');
select is((select status from public.subscription_overview where id = tests.s('T3')), 'cancelled', 'the status is cancelled');
select tests.act_as(tests.u(2));
select throws_ok($$select public.cancel_subscription(tests.s('T3'), 'again')$$, '55000', 'ajyal:already_cancelled', 'it cannot be cancelled twice');
select tests.act_as_anon();
select throws_ok($$select public.cancel_subscription(tests.s('T5'), 'x')$$, '42501', null, 'anon cannot cancel');
select tests.reset();

-- ---------------------------------------------------------------------------
-- activity log: right actor, display snapshot
-- ---------------------------------------------------------------------------
select is((select count(*)::int from public.activity_log where action = 'subscription.created' and entity_id = tests.s('T3') and actor_id = tests.u(2)), 1, 'creation is logged once, by the coach');
select is((select (summary ->> 'plan') || '/' || (summary ->> 'total_fils') || '/' || (summary ->> 'discount_code') || '/' || (summary ->> 'actor_name') from public.activity_log where action = 'subscription.created' and entity_id = tests.s('T3')), 'duo/45000/ZTEN/Coach One', 'with plan, total, code and actor name');
select is((select summary -> 'player_names' from public.activity_log where action = 'subscription.created' and entity_id = tests.s('T3')), '["sp-A1", "sp-A5"]'::jsonb, 'and the players'' names');
select is((select summary ->> 'discount_reason' from public.activity_log where action = 'subscription.created' and entity_id = tests.s('T5')), 'Staff child', 'a manual discount''s reason is in the feed');
select is((select (summary ->> 'amount_fils') || '/' || (summary ->> 'method') || '/' || (summary ->> 'balance_fils') from public.activity_log where action = 'payment.recorded' and (summary ->> 'subscription_id')::uuid = tests.s('T3')), '45000/benefit/0', 'the initial payment is logged with method and balance');
select is((select count(*)::int from public.activity_log where action = 'payment.recorded' and actor_id = tests.u(2) and (summary ->> 'subscription_id')::uuid = tests.s('T1')), 2, 'each recorded payment is logged with its actor');
select is((select (summary ->> 'reason') || '/' || actor_id::text from public.activity_log where action = 'subscription.cancelled' and entity_id = tests.s('T3')), 'Moved away/' || tests.u(2)::text, 'cancellation is logged with the reason and the actor');
select is((select count(*)::int from public.activity_log where action = 'subscription.created' and (summary ->> 'plan') is null), 0, 'every creation row carries a snapshot');

-- ---------------------------------------------------------------------------
-- internal functions are not part of the API
-- ---------------------------------------------------------------------------
select tests.act_as(tests.u(1));
select throws_ok($$select * from public.calc_subscription_total(20000, 0, 0, null, null)$$, '42501', null, 'calc_subscription_total is internal (even for admins)');
select throws_ok($$select public.add_payment_internal(tests.s('T7'), 100, 'cash', public.today_bh(), null)$$, '42501', null, 'add_payment_internal is internal');
select throws_ok($$select public.subscription_player_names(tests.s('T7'))$$, '42501', null, 'subscription_player_names is internal');
select tests.reset();

select * from finish();
rollback;
