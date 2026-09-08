import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { supabase } from './supabase';
import { signIn, signUp, signOut } from './auth';
import './styles.css';

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  async function submit(e) {
    e.preventDefault();
    setBusy(true); setMessage('');
    try {
      if (mode === 'signup') {
        if (!username.trim()) throw new Error('Choose a username.');
        const data = await signUp({ email, password, username: username.trim(), displayName: displayName.trim() });
        if (!data.session) {
          setMessage('Account created. Check your email to verify your FragRank account, then log in.');
          setMode('login');
        } else {
          onAuth(data.session.user);
        }
      } else {
        const data = await signIn(email, password);
        onAuth(data.user);
      }
    } catch (err) {
      setMessage(err.message || 'Something went wrong.');
    } finally { setBusy(false); }
  }

  return <div className="auth-page">
    <div className="auth-card">
      <div className="brand-mark">F</div>
      <div className="eyebrow">TRACK. COMPETE. DOMINATE.</div>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your FragRank account'}</h1>
      <p className="muted">{mode === 'login' ? 'Sign in to continue to your gaming dashboard.' : 'Build your profile, track your stats, and compete with friends.'}</p>
      <form onSubmit={submit}>
        {mode === 'signup' && <>
          <label>Username<input value={username} onChange={e=>setUsername(e.target.value)} placeholder="FragRank username" required /></label>
          <label>Display name<input value={displayName} onChange={e=>setDisplayName(e.target.value)} placeholder="Your display name" /></label>
        </>}
        <label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="you@example.com" required /></label>
        <label>Password<input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="At least 6 characters" minLength="6" required /></label>
        {message && <div className="auth-message">{message}</div>}
        <button className="primary-btn" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log In' : 'Create Account'}</button>
      </form>
      <button className="text-btn" onClick={()=>{setMode(mode==='login'?'signup':'login');setMessage('')}}>
        {mode === 'login' ? 'Need an account? Create one' : 'Already have an account? Log in'}
      </button>
    </div>
  </div>
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({data}) => { setSession(data.session); setLoading(false); });
    const {data: listener} = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => listener.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="loading-screen">Loading FragRank…</div>;
  if (!session) return <AuthScreen onAuth={()=>{}} />;

  const email = session.user.email || 'FragRank Player';
  return <div className="app-shell">
    <header className="topbar">
      <div className="logo">FRAGRANK</div>
      <div className="top-actions"><span className="user-email">{email}</span><button className="secondary-btn" onClick={signOut}>Log Out</button></div>
    </header>
    <main className="dashboard">
      <section className="hero">
        <div className="eyebrow">TRACK. COMPETE. DOMINATE.</div>
        <h1>Welcome to FragRank.</h1>
        <p>Your Supabase account is connected. Your next step is building the real profile, stats, friends, rankings, and social data on top of this authenticated session.</p>
        <div className="status-card"><strong>✓ Account connected</strong><span>{email}</span></div>
      </section>
      <section className="feature-grid">
        {['Stats Dashboard','Friends & Leaderboards','Achievements','Posts & Clips','Chat & Clans','Tournaments'].map(x=><div className="feature-card" key={x}><h3>{x}</h3><p>FragRank feature foundation ready for real Supabase data.</p></div>)}
      </section>
    </main>
  </div>
}

createRoot(document.getElementById('root')).render(<App />);
