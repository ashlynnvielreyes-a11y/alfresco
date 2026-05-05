create extension if not exists pgcrypto;

create table if not exists public.otp_codes (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  otp_code text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  is_used boolean not null default false,
  verified_at timestamptz null,
  ip_address text null,
  user_agent text null
);

create index if not exists idx_otp_codes_email on public.otp_codes(email);
create index if not exists idx_otp_codes_created_at on public.otp_codes(created_at desc);
create index if not exists idx_otp_codes_email_is_used on public.otp_codes(email, is_used);
