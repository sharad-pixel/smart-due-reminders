-- Make user_id nullable for pending invitations
ALTER TABLE public.account_users ALTER COLUMN user_id DROP NOT NULL;

-- Drop the existing unique constraint that includes user_id
ALTER TABLE public.account_users DROP CONSTRAINT IF EXISTS account_users_account_id_user_id_key;

-- Add a new unique constraint on account_id + email for pending invites
ALTER TABLE public.account_users ADD CONSTRAINT account_users_account_email_unique UNIQUE (account_id, email);