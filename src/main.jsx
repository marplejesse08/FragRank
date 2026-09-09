import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  Award,
  BarChart3,
  Bell,
  ChevronRight,
  Crown,
  Gamepad2,
  Globe2,
  Home,
  LogOut,
  Menu,
  Save,
  Search,
  Settings,
  Shield,
  Swords,
  Trophy,
  User,
  UserPlus,
  Users,
  X,
  Zap
} from 'lucide-react';

import { supabase } from './supabase';
import { signIn, signOut, signUp } from './auth';
import './styles.css';


/* =========================================================
   HELPERS
========================================================= */

function number(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function formatNumber(value) {
  return number(value).toLocaleString();
}

function formatDecimal(value) {
  return number(value).toFixed(2);
}

function shortGameName(name = '') {
  const lower = name.toLowerCase();

  if (lower.includes('call of duty')) return 'COD';
  if (lower.includes('fortnite')) return 'FN';
  if (lower.includes('apex')) return 'APEX';

  return name
    .split(' ')
    .map((word) => word[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
}


/* =========================================================
   SUPABASE PROFILE
========================================================= */

async function getMyProfile(user) {
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Could not load profile:', error);
    return null;
  }

  return data;
}


async function updateMyProfile(user, updates) {
  if (!user) {
    throw new Error('You must be signed in.');
  }

  const cleanUpdates = {
    display_name: updates.display_name?.trim() || null,
    bio: updates.bio?.trim() || null,
    title: updates.title?.trim() || null
  };

  const { data, error } = await supabase
    .from('profiles')
    .update(cleanUpdates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}


/* =========================================================
   SUPABASE GAME STATS
========================================================= */

async function getMyGameStats(user) {
  if (!user) return [];

  const { data, error } = await supabase
    .from('game_stats')
    .select(`
      id,
      games_played,
      wins,
      kills,
      deaths,
      headshots,
      updated_at,
      game:games (
        id,
        name
      )
    `)
    .eq('user_id', user.id);

  if (error) {
    console.error('Could not load game stats:', error);
    throw error;
  }

  return (data || []).map((row) => {
    const gamesPlayed = number(row.games_played);
    const wins = number(row.wins);
    const kills = number(row.kills);
    const deaths = number(row.deaths);

    return {
      id: row.id,
      gameId: row.game?.id,

      name:
        row.game?.name ||
        'Unknown Game',

      short:
        shortGameName(
          row.game?.name ||
          'Game'
        ),

      games:
        gamesPlayed,

      wins,

      kills,

      deaths,

      headshots:
        number(row.headshots),

      winRate:
        gamesPlayed > 0
          ? (wins / gamesPlayed) * 100
          : 0,

      kpg:
        gamesPlayed > 0
          ? kills / gamesPlayed
          : 0,

      kd:
        deaths > 0
          ? kills / deaths
          : kills,

      updatedAt:
        row.updated_at
    };
  });
}


function calculateTotals(gameStats) {
  const totals = gameStats.reduce(
    (result, game) => {

      result.games +=
        number(game.games);

      result.wins +=
        number(game.wins);

      result.kills +=
        number(game.kills);

      result.deaths +=
        number(game.deaths);

      result.headshots +=
        number(game.headshots);

      return result;
    },

    {
      games: 0,
      wins: 0,
      kills: 0,
      deaths: 0,
      headshots: 0
    }
  );

  return {
    ...totals,

    winRate:
      totals.games > 0
        ? (totals.wins /
            totals.games) *
          100
        : 0,

    kpg:
      totals.games > 0
        ? totals.kills /
          totals.games
        : 0,

    kd:
      totals.deaths > 0
        ? totals.kills /
          totals.deaths
        : totals.kills
  };
}


/* =========================================================
   AUTH
========================================================= */

function Auth() {
  const [mode, setMode] =
    useState('login');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [username, setUsername] =
    useState('');

  const [displayName, setDisplayName] =
    useState('');

  const [busy, setBusy] =
    useState(false);

  const [msg, setMsg] =
    useState('');

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setMsg('');

    try {

      if (mode === 'login') {

        await signIn(
          email,
          password
        );

      } else {

        await signUp({
          email,
          password,
          username,
          displayName
        });

        setMsg(
          'Account created. Check your email if confirmation is enabled.'
        );

        setMode('login');
      }

    } catch (err) {

      setMsg(
        err.message ||
        'Something went wrong.'
      );

    } finally {

      setBusy(false);
    }
  }

  return (
    <div className="auth-page">

      <div className="auth-card">

        <div className="brand-mark">
          F
        </div>

        <div className="brand">
          FRAGRANK
        </div>

        <div className="tagline">
          TRACK. COMPETE. DOMINATE.
        </div>

        <h1>
          {mode === 'login'
            ? 'Welcome back.'
            : 'Create your player account.'}
        </h1>

        <p className="muted">
          {mode === 'login'
            ? 'Sign in to continue to your competitive profile.'
            : 'Build your profile and start climbing.'}
        </p>

        <form onSubmit={submit}>

          {mode === 'signup' && (
            <>

              <label>
                Username

                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  required
                />
              </label>

              <label>
                Display name

                <input
                  value={displayName}
                  onChange={(e) =>
                    setDisplayName(
                      e.target.value
                    )
                  }
                />
              </label>

            </>
          )}

          <label>
            Email

            <input
              type="email"
              value={email}
              onChange={(e) =>
                setEmail(
                  e.target.value
                )
              }
              required
            />
          </label>

          <label>
            Password

            <input
              type="password"
              minLength="6"
              value={password}
              onChange={(e) =>
                setPassword(
                  e.target.value
                )
              }
              required
            />
          </label>

          {msg && (
            <div className="notice">
              {msg}
            </div>
          )}

          <button
            className="primary full"
            disabled={busy}
          >
            {busy
              ? 'Please wait…'
              : mode === 'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>

        </form>

        <button
          className="text-button"
          onClick={() =>
            setMode(
              mode === 'login'
                ? 'signup'
                : 'login'
            )
          }
        >
          {mode === 'login'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </button>

      </div>

    </div>
  );
}


/* =========================================================
   STAT CARD
========================================================= */

function Stat({
  icon: Icon,
  label,
  value,
  sub
}) {
  return (
    <div className="stat">

      <div className="stat-icon">
        <Icon size={19} />
      </div>

      <div>

        <span>
          {label}
        </span>

        <b>
          {value}
        </b>

        {sub && (
          <small>
            {sub}
          </small>
        )}

      </div>

    </div>
  );
}


/* =========================================================
   KPG CHART
========================================================= */

function Chart() {
  const vals = [
    5.4,
    5.8,
    5.6,
    6.1,
    6.0,
    6.4,
    6.2,
    6.7,
    6.5,
    6.87
  ];

  const max =
    Math.max(...vals);

  const min =
    Math.min(...vals);

  return (
    <div className="chart">

      <div className="bars">

        {vals.map((v, i) => (

          <div
            className="barwrap"
            key={i}
          >

            <div
              className="bar"
              style={{
                height: `${
                  28 +
                  ((v - min) /
                    (max - min)) *
                    68
                }%`
              }}
            />

          </div>

        ))}

      </div>

      <div className="axis">

        <span>
          10 games ago
        </span>

        <span>
          Recent
        </span>

      </div>

    </div>
  );
}


/* =========================================================
   DASHBOARD
========================================================= */

function Dashboard({
  setPage,
  user,
  profile,
  totals,
  gameStats,
  statsLoading
}) {

  const playerName =
    profile?.display_name ||
    profile?.username ||
    user?.user_metadata
      ?.display_name ||
    user?.user_metadata
      ?.username ||
    'Player';

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            PLAYER DASHBOARD
          </div>

          <h1>
            {playerName}
          </h1>

          {profile?.title && (
            <div className="pill">
              {profile.title}
            </div>
          )}

          <p>
            Here’s your competitive snapshot.
          </p>

        </div>

        <button
          className="primary"
          onClick={() =>
            setPage('stats')
          }
        >
          <BarChart3 size={17} />

          View full stats
        </button>

      </div>

      <div className="demo-note">
        Your profile and stored game
        statistics are connected to
        Supabase.
      </div>

      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Total Games"
          value={
            statsLoading
              ? '...'
              : formatNumber(
                  totals.games
                )
          }
          sub="Stored in Supabase"
        />

        <Stat
          icon={Trophy}
          label="Win Rate"
          value={
            statsLoading
              ? '...'
              : `${totals.winRate.toFixed(
                  1
                )}%`
          }
          sub={`${formatNumber(
            totals.wins
          )} wins`}
        />

        <Stat
          icon={Swords}
          label="Total Kills"
          value={
            statsLoading
              ? '...'
              : formatNumber(
                  totals.kills
                )
          }
          sub={`${formatNumber(
            totals.deaths
          )} deaths`}
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={
            statsLoading
              ? '...'
              : formatDecimal(
                  totals.kpg
                )
          }
          sub={`K/D ${formatDecimal(
            totals.kd
          )}`}
        />

      </div>

      <div className="twocol">

        <section className="panel">

          <div className="panel-head">

            <div>

              <h2>
                Kills per Game
              </h2>

              <span>
                Historical chart placeholder
              </span>

            </div>

            <span className="pill">
              {formatDecimal(
                totals.kpg
              )} KPG
            </span>

          </div>

          <Chart />

        </section>

        <section className="panel rank">

          <div className="rank-logo">
            <Crown size={34} />
          </div>

          <span className="eyebrow">
            CURRENT RANK
          </span>

          <h2>
            Unranked
          </h2>

          <div className="progress">
            <i
              style={{
                width: '0%'
              }}
            />
          </div>

          <div className="progress-label">

            <span>
              0 XP
            </span>

            <span>
              Rank system next
            </span>

          </div>

        </section>

      </div>

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Game Performance
            </h2>

            <span>
              Stored stats for each game
            </span>

          </div>

          <button
            className="linkbtn"
            onClick={() =>
              setPage('stats')
            }
          >
            See all

            <ChevronRight size={16} />
          </button>

        </div>

        {statsLoading ? (

          <p className="muted">
            Loading game statistics…
          </p>

        ) : gameStats.length === 0 ? (

          <p className="muted">
            No game stats have been
            added to your FragRank
            account yet.
          </p>

        ) : (

          <div className="gamegrid">

            {gameStats.map((g) => (

              <div
                className="gamecard"
                key={`${g.gameId}-${g.id}`}
              >

                <div className="glogo">
                  {g.short}
                </div>

                <div>

                  <b>
                    {g.name}
                  </b>

                  <small>
                    {formatNumber(
                      g.games
                    )} games •{' '}
                    {formatNumber(
                      g.wins
                    )} wins
                  </small>

                </div>

                <div className="kpg">

                  <b>
                    {formatDecimal(
                      g.kpg
                    )}
                  </b>

                  <small>
                    KPG
                  </small>

                </div>

              </div>

            ))}

          </div>

        )}

      </section>

    </div>
  );
}


/* =========================================================
   PROFILE SETTINGS
========================================================= */

function ProfileSettings({
  user,
  profile,
  onProfileUpdated
}) {

  const [displayName, setDisplayName] =
    useState(
      profile?.display_name ||
      ''
    );

  const [bio, setBio] =
    useState(
      profile?.bio ||
      ''
    );

  const [title, setTitle] =
    useState(
      profile?.title ||
      ''
    );

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  useEffect(() => {

    setDisplayName(
      profile?.display_name ||
      ''
    );

    setBio(
      profile?.bio ||
      ''
    );

    setTitle(
      profile?.title ||
      ''
    );

  }, [profile]);


  async function saveProfile(e) {
    e.preventDefault();

    setSaving(true);
    setMessage('');

    try {

      const updated =
        await updateMyProfile(
          user,
          {
            display_name:
              displayName,

            bio,

            title
          }
        );

      onProfileUpdated(
        updated
      );

      setMessage(
        'Profile saved successfully.'
      );

    } catch (error) {

      console.error(
        'Could not update profile:',
        error
      );

      setMessage(
        error.message ||
        'Could not save profile.'
      );

    } finally {

      setSaving(false);
    }
  }


  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            PLAYER PROFILE
          </div>

          <h1>
            Edit Profile
          </h1>

          <p>
            Customize how other players
            see you on FragRank.
          </p>

        </div>

      </div>

      <section
        className="panel"
        style={{
          maxWidth: '700px'
        }}
      >

        <div
          style={{
            display: 'flex',
            gap: '16px',
            alignItems: 'center',
            marginBottom: '25px'
          }}
        >

          <div
            className="avatar"
            style={{
              width: '64px',
              height: '64px',
              fontSize: '24px'
            }}
          >
            {(
              displayName ||
              profile?.username ||
              'P'
            )
              .charAt(0)
              .toUpperCase()}
          </div>

          <div>

            <b
              style={{
                fontSize: '20px'
              }}
            >
              {profile?.username ||
                'Player'}
            </b>

            <div className="muted">
              @{profile?.username ||
                'player'}
            </div>

          </div>

        </div>


        <form
          onSubmit={saveProfile}
        >

          <label>
            Username

            <input
              value={
                profile?.username ||
                ''
              }
              disabled
            />
          </label>

          <label>
            Display Name

            <input
              value={displayName}
              maxLength={40}
              onChange={(e) =>
                setDisplayName(
                  e.target.value
                )
              }
              placeholder="Your display name"
            />
          </label>

          <label>
            Player Title

            <input
              value={title}
              maxLength={40}
              onChange={(e) =>
                setTitle(
                  e.target.value
                )
              }
              placeholder="Example: Headshot Hunter"
            />
          </label>

          <label>
            Bio

            <input
              value={bio}
              maxLength={160}
              onChange={(e) =>
                setBio(
                  e.target.value
                )
              }
              placeholder="Tell players about yourself"
            />
          </label>


          {message && (

            <div
              className="notice"
              style={{
                marginBottom: '15px'
              }}
            >
              {message}
            </div>

          )}


          <button
            className="primary"
            disabled={saving}
          >

            <Save size={17} />

            {saving
              ? 'Saving…'
              : 'Save Profile'}

          </button>

        </form>

      </section>

    </div>
  );
}


/* =========================================================
   STATS
========================================================= */

function Stats({
  totals,
  gameStats,
  statsLoading
}) {

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            ANALYTICS
          </div>

          <h1>
            My Stats
          </h1>

          <p>
            Your stored statistics by
            game.
          </p>

        </div>

      </div>

      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Games Played"
          value={
            statsLoading
              ? '...'
              : formatNumber(
                  totals.games
                )
          }
        />

        <Stat
          icon={Trophy}
          label="Wins"
          value={
            statsLoading
              ? '...'
              : formatNumber(
                  totals.wins
                )
          }
        />

        <Stat
          icon={Swords}
          label="K/D"
          value={
            statsLoading
              ? '...'
              : formatDecimal(
                  totals.kd
                )
          }
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={
            statsLoading
              ? '...'
              : formatDecimal(
                  totals.kpg
                )
          }
        />

      </div>

      <section className="panel tablepanel">

        <div className="panel-head">

          <h2>
            Game Breakdown
          </h2>

          <span>
            Live FragRank database
          </span>

        </div>

        <div className="tablewrap">

          <table>

            <thead>

              <tr>
                <th>Game</th>
                <th>Games</th>
                <th>Wins</th>
                <th>Win Rate</th>
                <th>Kills</th>
                <th>Deaths</th>
                <th>K/D</th>
                <th>KPG</th>
              </tr>

            </thead>

            <tbody>

              {gameStats.length === 0 ? (

                <tr>

                  <td colSpan="8">
                    No game statistics
                    have been stored yet.
                  </td>

                </tr>

              ) : (

                gameStats.map((g) => (

                  <tr
                    key={`${g.gameId}-${g.id}`}
                  >

                    <td>
                      <b>{g.name}</b>
                    </td>

                    <td>
                      {formatNumber(
                        g.games
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        g.wins
                      )}
                    </td>

                    <td>
                      {g.winRate.toFixed(
                        1
                      )}%
                    </td>

                    <td>
                      {formatNumber(
                        g.kills
                      )}
                    </td>

                    <td>
                      {formatNumber(
                        g.deaths
                      )}
                    </td>

                    <td>
                      {formatDecimal(
                        g.kd
                      )}
                    </td>

                    <td className="accent">
                      {formatDecimal(
                        g.kpg
                      )}
                    </td>

                  </tr>

                ))

              )}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   PLACEHOLDER FEATURES
========================================================= */

function Foundation({
  title,
  Icon,
  description
}) {

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            FRAGRANK V2
          </div>

          <h1>
            {title}
          </h1>

          <p>
            {description}
          </p>

        </div>

      </div>

      <section className="panel coming">

        <Icon size={44} />

        <h2>
          {title} foundation included
        </h2>

        <p>
          The Supabase database
          foundation already exists for
          this feature. We will connect
          it to live data as development
          continues.
        </p>

      </section>

    </div>
  );
}


/* =========================================================
   MAIN APP
========================================================= */

function App() {

  const [session, setSession] =
    useState(null);

  const [profile, setProfile] =
    useState(null);

  const [gameStats, setGameStats] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [statsLoading, setStatsLoading] =
    useState(true);

  const [page, setPage] =
    useState('dashboard');

  const [open, setOpen] =
    useState(false);


  async function loadPlayerData(user) {

    if (!user) {

      setProfile(null);
      setGameStats([]);
      setStatsLoading(false);

      return;
    }

    setStatsLoading(true);

    try {

      const [
        playerProfile,
        playerStats
      ] =
        await Promise.all([
          getMyProfile(user),
          getMyGameStats(user)
        ]);

      setProfile(
        playerProfile
      );

      setGameStats(
        playerStats
      );

    } catch (error) {

      console.error(
        'Could not load FragRank player data:',
        error
      );

      setGameStats([]);

    } finally {

      setStatsLoading(false);
    }
  }


  useEffect(() => {

    let mounted = true;


    async function initialize() {

      try {

        const {
          data: {
            session: initialSession
          },
          error
        } =
          await supabase.auth.getSession();


        if (error) {
          throw error;
        }


        if (!mounted) {
          return;
        }


        setSession(
          initialSession
        );


        if (
          initialSession?.user
        ) {

          await loadPlayerData(
            initialSession.user
          );

        } else {

          setStatsLoading(
            false
          );
        }

      } catch (error) {

        console.error(
          'FragRank initialization error:',
          error
        );

      } finally {

        if (mounted) {
          setLoading(false);
        }
      }
    }


    initialize();


    const {
      data: {
        subscription
      }
    } =
      supabase.auth.onAuthStateChange(
        async (
          _event,
          newSession
        ) => {

          setSession(
            newSession
          );


          if (
            newSession?.user
          ) {

            await loadPlayerData(
              newSession.user
            );

          } else {

            setProfile(null);

            setGameStats([]);

            setStatsLoading(
              false
            );
          }


          if (mounted) {
            setLoading(false);
          }
        }
      );


    return () => {

      mounted = false;

      subscription.unsubscribe();
    };

  }, []);


  const totals =
    useMemo(
      () =>
        calculateTotals(
          gameStats
        ),
      [gameStats]
    );


  if (loading) {

    return (
      <div className="loading">
        Loading FragRank…
      </div>
    );
  }


  if (!session) {

    return <Auth />;
  }


  const displayName =
    profile?.display_name ||
    profile?.username ||
    session.user
      .user_metadata
      ?.display_name ||
    session.user
      .user_metadata
      ?.username ||
    'Player';


  const nav = [

    [
      'dashboard',
      'Overview',
      Home
    ],

    [
      'profile',
      'Profile',
      User
    ],

    [
      'stats',
      'My Stats',
      BarChart3
    ],

    [
      'friends',
      'Friends',
      Users
    ],

    [
      'leaderboard',
      'Leaderboard',
      Globe2
    ],

    [
      'achievements',
      'Achievements',
      Award
    ],

    [
      'challenges',
      'Challenges',
      Zap
    ],

    [
      'tournaments',
      'Tournaments',
      Trophy
    ],

    [
      'clans',
      'Clans',
      Shield
    ],

    [
      'activity',
      'Activity',
      Activity
    ]

  ];


  const pages = {

    dashboard: (
      <Dashboard
        setPage={setPage}
        user={session.user}
        profile={profile}
        totals={totals}
        gameStats={gameStats}
        statsLoading={statsLoading}
      />
    ),


    profile: (
      <ProfileSettings
        user={session.user}
        profile={profile}
        onProfileUpdated={
          setProfile
        }
      />
    ),


    stats: (
      <Stats
        totals={totals}
        gameStats={gameStats}
        statsLoading={statsLoading}
      />
    ),


    friends: (
      <Foundation
        title="Friends"
        Icon={Users}
        description="Friend requests, friend profiles, and friend leaderboards."
      />
    ),


    leaderboard: (
      <Foundation
        title="Global Leaderboard"
        Icon={Globe2}
        description="Global and game-specific competitive rankings."
      />
    ),


    achievements: (
      <Foundation
        title="Achievements"
        Icon={Award}
        description="Track milestones, rarity, XP, and achievement progress."
      />
    ),


    challenges: (
      <Foundation
        title="Challenges"
        Icon={Zap}
        description="Head-to-head competitive challenges and tracked goals."
      />
    ),


    tournaments: (
      <Foundation
        title="Tournaments"
        Icon={Trophy}
        description="Custom tournaments, brackets, and competitive events."
      />
    ),


    clans: (
      <Foundation
        title="Clans"
        Icon={Shield}
        description="Teams, clan members, clan stats, chat, and wars."
      />
    ),


    activity: (
      <Foundation
        title="Activity Feed"
        Icon={Activity}
        description="Posts, clips, comments, reactions, and player activity."
      />
    )

  };


  return (
    <div className="app">

      <aside
        className={`sidebar ${
          open
            ? 'open'
            : ''
        }`}
      >

        <div className="side-brand">

          <div className="mini-mark">
            F
          </div>

          <b>
            FRAGRANK
          </b>

          <button
            className="iconbtn close"
            onClick={() =>
              setOpen(false)
            }
          >
            <X />
          </button>

        </div>


        <div className="side-tag">
          TRACK. COMPETE. DOMINATE.
        </div>


        <nav>

          {nav.map(
            ([
              id,
              label,
              Icon
            ]) => (

              <button
                key={id}
                className={
                  page === id
                    ? 'active'
                    : ''
                }
                onClick={() => {

                  setPage(id);

                  setOpen(
                    false
                  );
                }}
              >

                <Icon size={18} />

                {label}

              </button>

            )
          )}

        </nav>


        <div className="spacer" />


        <div className="mini-profile">

          <div className="avatar">

            {displayName
              .charAt(0)
              .toUpperCase()}

          </div>

          <div>

            <b>
              {displayName}
            </b>

            <small>
              {profile?.title ||
                `${formatNumber(
                  totals.games
                )} games`}
            </small>

          </div>

        </div>


        <button
          className="logout"
          onClick={signOut}
        >

          <LogOut size={17} />

          Sign out

        </button>

      </aside>


      <main className="main">

        <header className="topbar">

          <button
            className="iconbtn menu"
            onClick={() =>
              setOpen(true)
            }
          >
            <Menu />
          </button>


          <div className="search">

            <Search size={17} />

            <input
              placeholder="Search players, games, clans…"
            />

          </div>


          <div className="topactions">

            <button className="iconbtn">
              <Bell size={18} />
            </button>

            <button
              className="iconbtn"
              onClick={() =>
                setPage(
                  'profile'
                )
              }
            >
              <Settings size={18} />
            </button>

          </div>

        </header>


        {pages[page]}

      </main>

    </div>
  );
}


createRoot(
  document.getElementById('root')
).render(
  <App />
);
