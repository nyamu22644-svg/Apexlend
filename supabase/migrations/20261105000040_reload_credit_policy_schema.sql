-- Make newly added and replaced RPC functions visible to PostgREST immediately.
notify pgrst, 'reload schema';
