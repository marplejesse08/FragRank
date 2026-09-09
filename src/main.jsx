import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  Award,
  BarChart3,
  Bell,
  ChevronLeft,
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
  Target,
  Trophy,
  User,
  Users,
  X,
  Zap
} from 'lucide-react';

import { supabase } from './supabase';
import { signIn, signOut, signUp } from './auth';
import './styles.css';


/* =========================
   HELPERS
========================= */

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


/* =========================
   PROFILE DATA
========================= */

async function getMyProfile(user) {
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .maybeSingle();

  if (error) {
    console.error('Profile load error:', error);
    return null;
  }

  return data;
}

async function updateMyProfile(user, updates) {
  if (!user) {
    throw new Error('You must be signed in.');
  }

  const { data, error } = await supabase
    .from('profiles')
    .update({
      display_name: updates.display_name?.trim() || null,
      bio: updates.bio?.trim() || null,
      title: updates.title?.trim() || null
    })
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}


/* =========================
   GAME STATS DATA
========================= */

async function getMyGameStats(user) {
  if (!user) return [];

  const {
    data: statRows,
    error: statsError
  } = await supabase
    .from('game_stats')
    .select(`
      id,
      user_id,
      game_id,
      games_played,
      wins,
      kills,
      deaths,
      headshots,
      updated_at
    `)
    .eq('user_id', user.id)
    .order('game_id');

  if (statsError) {
    console.error('game_stats query failed:', statsError);
    throw statsError;
  }

  if (!statRows || statRows.length === 0) {
    return [];
  }

  const gameIds = [
    ...new Set(
      statRows
        .map((row) => row.game_id)
        .filter(Boolean)
    )
  ];

  const {
    data: gameRows,
    error: gamesError
  } = await supabase
    .from('games')
    .select('id,name')
    .in('id', gameIds);

  if (gamesError) {
    console.error('games query failed:', gamesError);
    throw gamesError;
  }

  const gameMap = {};

  for (const game of gameRows || []) {
    gameMap[String(game.id)] = game;
  }

  return statRows.map((row) => {
    const game =
      gameMap[String(row.game_id)] || {
        id: row.game_id,
        name: `Game ${row.game_id}`
      };

    const gamesPlayed = number(row.games_played);
    const wins = number(row.wins);
    const kills = number(row.kills);
    const deaths = number(row.deaths);

    return {
      id: row.id,
      gameId: row.game_id,

      name: game.name,
      short: shortGameName(game.name),

      games: gamesPlayed,
      wins,
      kills,
      deaths,
      headshots: number(row.headshots),

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

      updatedAt: row.updated_at
    };
  });
}

function calculateTotals(gameStats) {
  const totals = gameStats.reduce(
    (result, game) => {
      result.games += number(game.games);
      result.wins += number(game.wins);
      result.kills += number(game.kills);
      result.deaths += number(game.deaths);
      result.headshots += number(game.headshots);

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
        ? (totals.wins / totals.games) * 100
        : 0,

    kpg:
      totals.games > 0
        ? totals.kills / totals.games
        : 0,

    kd:
      totals.deaths > 0
        ? totals.kills / totals.deaths
        : totals.kills
  };
}


/* =========================
   AUTH
========================= */

function Auth() {
  const [mode, setMode] = useState('login');

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setMsg('');

    try {
      if (mode === 'login') {
        await signIn(email, password);
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
    } catch (error) {
      setMsg(
        error.message ||
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
                    setUsername(e.target.value)
                  }
                  required
                />
              </label>

              <label>
                Display name

                <input
                  value={displayName}
                  onChange={(e) =>
                    setDisplayName(e.target.value)
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
                setEmail(e.target.value)
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
                setPassword(e.target.value)
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
          onClick={() => {
            setMode(
              mode === 'login'
                ? 'signup'
                : 'login'
            );

            setMsg('');
          }}
        >
          {mode === 'login'
            ? 'Need an account? Create one'
            : 'Already have an account? Sign in'}
        </button>

      </div>
    </div>
  );
}


/* =========================
   STAT CARD
========================= */

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
        <span>{label}</span>

        <b>{value}</b>

        {sub && (
          <small>{sub}</small>
        )}
      </div>

    </div>
  );
}


/* =========================
   CHART
========================= */

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

  const max = Math.max(...vals);
  const min = Math.min(...vals);

  return (
    <div className="chart">

      <div className="bars">

        {vals.map((value, index) => (
          <div
            className="barwrap"
            key={index}
          >
            <div
              className="bar"
              style={{
                height: `${
                  28 +
                  ((value - min) /
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
          Historical data
        </span>

        <span>
          Coming soon
        </span>
      </div>

    </div>
  );
}


/* =========================
   DASHBOARD
========================= */

function Dashboard({
  setPage,
  openGame,
  user,
  profile,
  totals,
  gameStats,
  statsLoading,
  statsError
}) {
  const playerName =
    profile?.display_name ||
    profile?.username ||
    user?.user_metadata?.display_name ||
    user?.user_metadata?.username ||
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

      {statsError ? (
        <div className="notice">
          Game stats could not be loaded: {statsError}
        </div>
      ) : (
        <div className="demo-note">
          Live statistics loaded from your FragRank Supabase database.
        </div>
      )}

      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Total Games"
          value={
            statsLoading
              ? '...'
              : formatNumber(totals.games)
          }
          sub="Supabase"
        />

        <Stat
          icon={Trophy}
          label="Win Rate"
          value={
            statsLoading
              ? '...'
              : `${totals.winRate.toFixed(1)}%`
          }
          sub={`${formatNumber(totals.wins)} wins`}
        />

        <Stat
          icon={Swords}
          label="Total Kills"
          value={
            statsLoading
              ? '...'
              : formatNumber(totals.kills)
          }
          sub={`${formatNumber(totals.deaths)} deaths`}
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={
            statsLoading
              ? '...'
              : formatDecimal(totals.kpg)
          }
          sub={`K/D ${formatDecimal(totals.kd)}`}
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
                Historical tracking coming next
              </span>
            </div>

            <span className="pill">
              {formatDecimal(totals.kpg)} KPG
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
            <span>0 XP</span>
            <span>Rank system coming</span>
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
              Tap a game for detailed statistics
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
            Loading stats…
          </p>

        ) : gameStats.length === 0 ? (

          <p className="muted">
            No stats found for this account.
          </p>

        ) : (

          <div className="gamegrid">

            {gameStats.map((game) => (

              <button
                key={game.id}
                onClick={() =>
                  openGame(game)
                }
                style={{
                  all: 'unset',
                  cursor: 'pointer',
                  display: 'block'
                }}
              >

                <div className="gamecard">

                  <div className="glogo">
                    {game.short}
                  </div>

                  <div>

                    <b>
                      {game.name}
                    </b>

                    <small>
                      {formatNumber(game.games)} games •{' '}
                      {formatNumber(game.wins)} wins
                    </small>

                  </div>

                  <div className="kpg">

                    <b>
                      {formatDecimal(game.kpg)}
                    </b>

                    <small>
                      KPG
                    </small>

                  </div>

                </div>

              </button>

            ))}

          </div>

        )}

      </section>

    </div>
  );
}


/* =========================
   FULL STATS PAGE
========================= */

function Stats({
  totals,
  gameStats,
  statsLoading,
  openGame
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
            Tap a game to view detailed statistics.
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
              : formatNumber(totals.games)
          }
        />

        <Stat
          icon={Trophy}
          label="Wins"
          value={
            statsLoading
              ? '...'
              : formatNumber(totals.wins)
          }
        />

        <Stat
          icon={Swords}
          label="K/D"
          value={
            statsLoading
              ? '...'
              : formatDecimal(totals.kd)
          }
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={
            statsLoading
              ? '...'
              : formatDecimal(totals.kpg)
          }
        />

      </div>

      <section className="panel tablepanel">

        <div className="panel-head">

          <h2>
            Game Breakdown
          </h2>

          <span>
            Tap any game
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
                    No game statistics found.
                  </td>
                </tr>

              ) : (

                gameStats.map((game) => (

                  <tr
                    key={game.id}
                    onClick={() =>
                      openGame(game)
                    }
                    style={{
                      cursor: 'pointer'
                    }}
                  >

                    <td>
                      <b>
                        {game.name}
                      </b>
                    </td>

                    <td>
                      {formatNumber(game.games)}
                    </td>

                    <td>
                      {formatNumber(game.wins)}
                    </td>

                    <td>
                      {game.winRate.toFixed(1)}%
                    </td>

                    <td>
                      {formatNumber(game.kills)}
                    </td>

                    <td>
                      {formatNumber(game.deaths)}
                    </td>

                    <td>
                      {formatDecimal(game.kd)}
                    </td>

                    <td className="accent">
                      {formatDecimal(game.kpg)}
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


/* =========================
   INDIVIDUAL GAME PAGE
========================= */

function GameDetail({
  game,
  back
}) {
  if (!game) {
    return null;
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <button
            className="linkbtn"
            onClick={back}
            style={{
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px'
            }}
          >
            <ChevronLeft size={18} />

            Back to My Stats
          </button>

          <div className="eyebrow">
            GAME DETAILS
          </div>

          <h1>
            {game.name}
          </h1>

          <p>
            Your FragRank performance for {game.name}.
          </p>

        </div>

      </div>


      <section
        className="panel"
        style={{
          marginBottom: '18px'
        }}
      >

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '18px'
          }}
        >

          <div
            className="glogo"
            style={{
              width: '72px',
              height: '72px',
              fontSize: '16px'
            }}
          >
            {game.short}
          </div>

          <div>

            <div className="eyebrow">
              CONNECTED GAME
            </div>

            <h2
              style={{
                margin: '6px 0'
              }}
            >
              {game.name}
            </h2>

            <span className="muted">
              Live stats from Supabase
            </span>

          </div>

        </div>

      </section>


      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Games Played"
          value={formatNumber(game.games)}
        />

        <Stat
          icon={Trophy}
          label="Wins"
          value={formatNumber(game.wins)}
          sub={`${game.winRate.toFixed(1)}% win rate`}
        />

        <Stat
          icon={Swords}
          label="Kills"
          value={formatNumber(game.kills)}
        />

        <Stat
          icon={Shield}
          label="Deaths"
          value={formatNumber(game.deaths)}
        />

      </div>


      <div className="stats">

        <Stat
          icon={Target}
          label="K/D"
          value={formatDecimal(game.kd)}
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={formatDecimal(game.kpg)}
        />

        <Stat
          icon={Target}
          label="Headshots"
          value={formatNumber(game.headshots)}
        />

        <Stat
          icon={Trophy}
          label="Win Rate"
          value={`${game.winRate.toFixed(1)}%`}
        />

      </div>


      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Performance Summary
            </h2>

            <span>
              Current stored statistics
            </span>

          </div>

        </div>

        <div
          style={{
            display: 'grid',
            gap: '16px'
          }}
        >

          <div className="gamecard">

            <div className="stat-icon">
              <Gamepad2 size={20} />
            </div>

            <div>
              <b>
                Matches
              </b>

              <small>
                {formatNumber(game.games)} games played
              </small>
            </div>

          </div>


          <div className="gamecard">

            <div className="stat-icon">
              <Trophy size={20} />
            </div>

            <div>
              <b>
                Victories
              </b>

              <small>
                {formatNumber(game.wins)} wins •{' '}
                {game.winRate.toFixed(1)}% win rate
              </small>
            </div>

          </div>


          <div className="gamecard">

            <div className="stat-icon">
              <Swords size={20} />
            </div>

            <div>
              <b>
                Combat
              </b>

              <small>
                {formatNumber(game.kills)} kills •{' '}
                {formatNumber(game.deaths)} deaths •{' '}
                {formatDecimal(game.kd)} K/D
              </small>
            </div>

          </div>


          <div className="gamecard">

            <div className="stat-icon">
              <Target size={20} />
            </div>

            <div>
              <b>
                Accuracy Milestone
              </b>

              <small>
                {formatNumber(game.headshots)} headshots recorded
              </small>
            </div>

          </div>

        </div>

      </section>

    </div>
  );
}


/* =========================
   PROFILE SETTINGS
========================= */

function ProfileSettings({
  user,
  profile,
  onProfileUpdated
}) {
  const [displayName, setDisplayName] =
    useState('');

  const [bio, setBio] =
    useState('');

  const [title, setTitle] =
    useState('');

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState('');

  useEffect(() => {
    setDisplayName(
      profile?.display_name || ''
    );

    setBio(
      profile?.bio || ''
    );

    setTitle(
      profile?.title || ''
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
            display_name: displayName,
            bio,
            title
          }
        );

      onProfileUpdated(updated);

      setMessage(
        'Profile saved successfully.'
      );
    } catch (error) {
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
            Customize your FragRank identity.
          </p>
        </div>

      </div>

      <section
        className="panel"
        style={{
          maxWidth: '700px'
        }}
      >

        <form onSubmit={saveProfile}>

          <label>
            Username

            <input
              value={
                profile?.username || ''
              }
              disabled
            />
          </label>

          <label>
            Display Name

            <input
              value={displayName}
              onChange={(e) =>
                setDisplayName(e.target.value)
              }
              maxLength={40}
            />
          </label>

          <label>
            Player Title

            <input
              value={title}
              onChange={(e) =>
                setTitle(e.target.value)
              }
              maxLength={40}
              placeholder="Example: FragRank Founder"
            />
          </label>

          <label>
            Bio

            <input
              value={bio}
              onChange={(e) =>
                setBio(e.target.value)
              }
              maxLength={160}
            />
          </label>

          {message && (
            <div className="notice">
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


/* =========================
   FUTURE PAGES
========================= */

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
          {title} foundation ready
        </h2>

        <p>
          This feature will be connected to live Supabase data during the next development phases.
        </p>

      </section>

    </div>
  );
}


/* =========================
   MAIN APP
========================= */

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
    useState(false);

  const [statsError, setStatsError] =
    useState('');

  const [page, setPage] =
    useState('dashboard');

  const [selectedGame, setSelectedGame] =
    useState(null);

  const [open, setOpen] =
    useState(false);


  async function loadPlayerData(user) {
    if (!user) return;

    setStatsLoading(true);
    setStatsError('');

    try {
      const playerProfile =
        await getMyProfile(user);

      setProfile(playerProfile);

      const playerStats =
        await getMyGameStats(user);

      setGameStats(playerStats);

    } catch (error) {
      console.error(
        'FragRank data load failed:',
        error
      );

      setStatsError(
        error.message ||
        'Unknown Supabase error'
      );

      setGameStats([]);

    } finally {
      setStatsLoading(false);
    }
  }


  function openGame(game) {
    setSelectedGame(game);
    setPage('game-detail');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }


  function closeGame() {
    setSelectedGame(null);
    setPage('stats');

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }


  useEffect(() => {
    let alive = true;

    async function start() {
      try {
        const {
          data: {
            session: currentSession
          },
          error
        } =
          await supabase.auth.getSession();

        if (error) throw error;

        if (!alive) return;

        setSession(currentSession);

        if (currentSession?.user) {
          await loadPlayerData(
            currentSession.user
          );
        }

      } catch (error) {
        console.error(
          'FragRank startup error:',
          error
        );

      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    start();

    const {
      data: {
        subscription
      }
    } =
      supabase.auth.onAuthStateChange(
        (_event, nextSession) => {

          setSession(nextSession);

          if (nextSession?.user) {
            setTimeout(() => {
              loadPlayerData(
                nextSession.user
              );
            }, 0);
          } else {
            setProfile(null);
            setGameStats([]);
          }

        }
      );

    return () => {
      alive = false;
      subscription.unsubscribe();
    };

  }, []);


  const totals =
    useMemo(
      () =>
        calculateTotals(gameStats),
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
    ['dashboard', 'Overview', Home],
    ['profile', 'Profile', User],
    ['stats', 'My Stats', BarChart3],
    ['friends', 'Friends', Users],
    ['leaderboard', 'Leaderboard', Globe2],
    ['achievements', 'Achievements', Award],
    ['challenges', 'Challenges', Zap],
    ['tournaments', 'Tournaments', Trophy],
    ['clans', 'Clans', Shield],
    ['activity', 'Activity', Activity]
  ];


  const pages = {

    dashboard: (
      <Dashboard
        setPage={setPage}
        openGame={openGame}
        user={session.user}
        profile={profile}
        totals={totals}
        gameStats={gameStats}
        statsLoading={statsLoading}
        statsError={statsError}
      />
    ),

    profile: (
      <ProfileSettings
        user={session.user}
        profile={profile}
        onProfileUpdated={setProfile}
      />
    ),

    stats: (
      <Stats
        totals={totals}
        gameStats={gameStats}
        statsLoading={statsLoading}
        openGame={openGame}
      />
    ),

    'game-detail': (
      <GameDetail
        game={selectedGame}
        back={closeGame}
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
        description="Milestones, rarity, progression, and achievement rewards."
      />
    ),

    challenges: (
      <Foundation
        title="Challenges"
        Icon={Zap}
        description="Head-to-head competitive challenges."
      />
    ),

    tournaments: (
      <Foundation
        title="Tournaments"
        Icon={Trophy}
        description="Custom tournaments and competitive brackets."
      />
    ),

    clans: (
      <Foundation
        title="Clans"
        Icon={Shield}
        description="Teams, clan stats, chat, and clan competition."
      />
    ),

    activity: (
      <Foundation
        title="Activity Feed"
        Icon={Activity}
        description="Posts, clips, reactions, comments, and player activity."
      />
    )

  };


  return (
    <div className="app">

      <aside
        className={`sidebar ${
          open ? 'open' : ''
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
            ([id, label, Icon]) => (

              <button
                key={id}
                className={
                  page === id
                    ? 'active'
                    : ''
                }
                onClick={() => {
                  setPage(id);
                  setSelectedGame(null);
                  setOpen(false);
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
              {formatNumber(totals.games)} games
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
              onClick={() => {
                setPage('profile');
                setSelectedGame(null);
              }}
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
