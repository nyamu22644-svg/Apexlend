'use client';

import { FormEvent, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';

export default function StaffActivationPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [message, setMessage] = useState('Checking your invitation…');

  useEffect(() => {
    const check = async () => {
      const { data } = await supabase.auth.getSession();
      setReady(Boolean(data.session));
      setMessage(data.session ? 'Create a password for your staff account.' : 'This invitation link is invalid or has expired. Ask your administrator to send a new invitation.');
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setReady(Boolean(session));
      if (session) setMessage('Create a password for your staff account.');
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return setMessage('Use at least 8 characters for the password.');
    if (password !== confirm) return setMessage('The passwords do not match.');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return setMessage(error.message);
    setMessage('Password created. You can now sign in to the staff portal.');
    window.setTimeout(() => { window.location.assign('/'); }, 1000);
  };

  return <main className="min-h-screen grid place-items-center p-4 bg-[#F5F7FA]"><form onSubmit={submit} className="w-full max-w-md rounded-2xl bg-white border p-7 space-y-4 shadow-sm"><div><h1 className="text-xl font-bold">Activate staff account</h1><p className="mt-1 text-sm text-slate-600">{message}</p></div>{ready && <><label className="block text-sm font-medium">New password<input required type="password" autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" /></label><label className="block text-sm font-medium">Confirm password<input required type="password" autoComplete="new-password" value={confirm} onChange={e => setConfirm(e.target.value)} className="mt-1 w-full rounded-lg border p-2.5" /></label><button className="w-full rounded-lg bg-[#167D78] py-2.5 text-sm font-bold text-white">Set password and continue</button></>}</form></main>;
}
