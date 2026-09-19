-- Ajyal Academy — LOCAL DEVELOPMENT seed. Never run against production.
-- (Plans and settings are inserted by the core_schema migration so every environment has them.)
--
-- Demo accounts (password for all three: Ajyal#Dev2026)
--   admin@ajyal.local   — Admin
--   coach1@ajyal.local  — Coach  (Khalid)
--   coach2@ajyal.local  — Coach  (Sara)

-- Fixed ids so tests and docs can refer to them.
--   admin  00000000-0000-0000-0000-0000000000a1
--   coach1 00000000-0000-0000-0000-0000000000c1
--   coach2 00000000-0000-0000-0000-0000000000c2

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Ajyal#Dev2026', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', ''
from (values
  ('00000000-0000-0000-0000-0000000000a1'::uuid, 'admin@ajyal.local', 'Demo Admin'),
  ('00000000-0000-0000-0000-0000000000c1'::uuid, 'coach1@ajyal.local', 'Khalid Al Dosari'),
  ('00000000-0000-0000-0000-0000000000c2'::uuid, 'coach2@ajyal.local', 'Sara Al Khalifa')
) as u (id, email, full_name);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), u.id, u.id::text,
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from auth.users u
where u.email like '%@ajyal.local';

insert into public.profiles (id, full_name, email, role, phone, monthly_salary_fils, preferred_language) values
  ('00000000-0000-0000-0000-0000000000a1', 'Demo Admin', 'admin@ajyal.local', 'admin', '39006938', 0, 'ar'),
  ('00000000-0000-0000-0000-0000000000c1', 'Khalid Al Dosari', 'coach1@ajyal.local', 'coach', '36000001', 250000, 'ar'),
  ('00000000-0000-0000-0000-0000000000c2', 'Sara Al Khalifa', 'coach2@ajyal.local', 'coach', '36000002', 200000, 'en');

insert into public.players (
  full_name, cpr, date_of_birth, address, school, phone, has_disease, disease_description, coach_id
) values
  ('Yousef Al Mahmood', '150312345', '2015-03-12', 'Riffa, Block 901', 'Al Rifa'' Primary School', '39111001', false, null, '00000000-0000-0000-0000-0000000000c1'),
  ('Ali Hassan', '140708821', '2014-08-07', 'Riffa, Block 917', 'Al Rifa'' Primary School', '39111002', true, 'Asthma — carries an inhaler', '00000000-0000-0000-0000-0000000000c1'),
  ('Mohammed Al Khalifa', '160115530', '2016-01-15', 'Hamad Town, Round 4', 'Hamad Town Boys School', '39111003', false, null, '00000000-0000-0000-0000-0000000000c1'),
  ('Abdulla Ebrahim', '130921174', '2013-09-21', 'Riffa, Block 933', 'Al Rifa'' Intermediate School', '39111004', false, null, '00000000-0000-0000-0000-0000000000c1'),
  ('Hamad Salman', '170430912', '2017-04-30', 'Riffa, Block 905', 'Al Rifa'' Primary School', '39111005', false, null, '00000000-0000-0000-0000-0000000000c1'),
  ('Khalifa Nasser', '150627403', '2015-06-27', 'Hamad Town, Round 2', 'Hamad Town Boys School', '39111006', false, null, '00000000-0000-0000-0000-0000000000c2'),
  ('Salman Jassim', '141102266', '2014-11-02', 'Hamad Town, Round 7', 'Hamad Town Boys School', '39111007', true, 'Peanut allergy', '00000000-0000-0000-0000-0000000000c2'),
  ('Rashid Faisal', '160309785', '2016-03-09', 'Riffa, Block 921', 'Al Rifa'' Primary School', '39111008', false, null, '00000000-0000-0000-0000-0000000000c2'),
  ('Isa Mubarak', '120518349', '2012-05-18', 'Riffa, Block 929', 'Al Rifa'' Intermediate School', '39111009', false, null, '00000000-0000-0000-0000-0000000000c2'),
  ('Zayed Al Ansari', '180212657', '2018-02-12', 'Hamad Town, Round 3', null, '39111010', false, null, null);

-- The inserts above fired the activity triggers; a fresh dev database should start with an empty feed.
delete from public.activity_log;
