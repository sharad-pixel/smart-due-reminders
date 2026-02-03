-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can insert system config" ON system_config;
DROP POLICY IF EXISTS "Authenticated users can update system config" ON system_config;

-- Create admin-only policies
CREATE POLICY "Only admins can insert system config" 
ON system_config FOR INSERT 
WITH CHECK (is_recouply_admin(auth.uid()));

CREATE POLICY "Only admins can update system config" 
ON system_config FOR UPDATE 
USING (is_recouply_admin(auth.uid()))
WITH CHECK (is_recouply_admin(auth.uid()));