-- 1. Make user_id nullable for inbound webhook messages
ALTER TABLE public.messages ALTER COLUMN user_id DROP NOT NULL;

-- 2. Add type constraint if it doesn't exist (drop first if exists to ensure correct values)
ALTER TABLE public.messages DROP CONSTRAINT IF EXISTS messages_type_check;
ALTER TABLE public.messages
ADD CONSTRAINT messages_type_check
CHECK (type IN ('inbound', 'outbound', 'ai_summary'));

-- 3. Ensure RLS is enabled
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing RLS policies on messages table
DROP POLICY IF EXISTS "Users can view own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can insert own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.messages;
DROP POLICY IF EXISTS "Users can delete own messages" ON public.messages;
DROP POLICY IF EXISTS "Service role can insert messages" ON public.messages;

-- 4a. Users can view only their own messages
CREATE POLICY "Users can view own messages"
ON public.messages
FOR SELECT
TO authenticated
USING (user_id IS NOT NULL AND auth.uid() = user_id);

-- 4b. Users can insert only their own outbound messages
CREATE POLICY "Users can insert own messages"
ON public.messages
FOR INSERT
TO authenticated
WITH CHECK (user_id IS NOT NULL AND auth.uid() = user_id);

-- 4c. Service role can insert any messages (for webhooks/backend jobs)
CREATE POLICY "Service role can insert messages"
ON public.messages
FOR INSERT
TO service_role
WITH CHECK (true);

-- 5. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_messages_invoice_id ON public.messages(invoice_id);
CREATE INDEX IF NOT EXISTS idx_messages_debtor_id ON public.messages(debtor_id);
CREATE INDEX IF NOT EXISTS idx_messages_user_id ON public.messages(user_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages(created_at DESC);