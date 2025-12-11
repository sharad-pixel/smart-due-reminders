-- Fix early_access_whitelist email exposure vulnerability
-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can check whitelist" ON early_access_whitelist;