"use client";
import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [user, setUser] = useState<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    createClient().auth.getUser().then(({ data }) => setUser(data.user?.email ?? null));
  }, []);

  const signIn = async () => {
    if (!isSupabaseConfigured) { setStatus("Supabase env keys not set yet — add NEXT_PUBLIC_SUPABASE_URL + ANON_KEY to .env.local, then this button sends a magic link."); return; }
    setStatus("Sending magic link…");
    const { error } = await createClient().auth.signInWithOtp({ email, options: { emailRedirectTo: location.origin } });
    setStatus(error ? error.message : "Check your inbox for the magic link.");
  };
  const signOut = async () => { await createClient().auth.signOut(); setUser(null); };

  return (
    <section className="mx-auto max-w-[520px] px-6 py-24">
      <p className="label-caps text-[#999]">Account</p>
      <h1 className="narrative mt-3 text-[54px]">Welcome back.</h1>
      {user ? (
        <div className="card mt-8 p-8">
          <p className="text-[16px]">Signed in as {user}</p>
          <button onClick={signOut} className="btn-ghost mt-6">Sign out</button>
        </div>
      ) : (
        <div className="card mt-8 p-8">
          <label className="label-caps text-[#999]">Email</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} type="email" placeholder="you@example.com" className="field mt-2" />
          <button onClick={signIn} className="btn-cream mt-6 w-full">Continue with email</button>
          {status && <p className="mt-4 text-[14px] text-[#999]">{status}</p>}
        </div>
      )}
    </section>
  );
}
