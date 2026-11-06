-- Make newly added RPC functions immediately visible to the Supabase REST API.
notify pgrst, 'reload schema';
