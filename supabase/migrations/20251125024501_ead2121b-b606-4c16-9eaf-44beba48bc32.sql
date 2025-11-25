-- Drop existing constraint and recreate it properly
ALTER TABLE public.account_users
DROP CONSTRAINT IF EXISTS account_users_user_id_fkey;

-- Add foreign key relationship between account_users and profiles
ALTER TABLE public.account_users
ADD CONSTRAINT account_users_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;