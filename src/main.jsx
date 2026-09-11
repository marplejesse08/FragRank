import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  Award,
  BarChart3
  Bell,
  Check,
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
    .map(word => word[0])
    .join('')
    .slice(0, 5)
    .toUpperCase();
}


/* =========================================================
   PROFILE
========================================================= */

async function getProfile(userId) {
  if (!userId) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  return data;
}

async function updateMyProfile(user, updates) {
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


/* =========================================================
   GAME STATS
========================================================= */

async function getGameStats(userId) {
  if (!userId) return [];

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
    .eq('user_id', userId)
    .order('game_id');

  if (statsError) throw statsError;

  if (!statRows?.length) {
    return [];
  }

  const gameIds = [
    ...new Set(
      statRows
        .map(row => row.game_id)
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

  if (gamesError) throw gamesError;

  const gameMap = {};

  for (const game of gameRows || []) {
    gameMap[String(game.id)] = game;
  }

  return statRows.map(row => {
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
          : kills
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


/* =========================================================
   FRIENDS
========================================================= */

async function searchPlayers(text, currentUserId) {
  const query = text.trim();

  if (!query) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      title,
      avatar_url
    `)
    .neq('id', currentUserId)
    .or(
      `username.ilike.%${query}%,display_name.ilike.%${query}%`
    )
    .limit(15);

  if (error) throw error;

  return data || [];
}

async function sendFriendRequest(
  currentUserId,
  otherUserId
) {
  const {
    data: existing,
    error: existingError
  } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `and(requester.eq.${currentUserId},addressee.eq.${otherUserId}),and(requester.eq.${otherUserId},addressee.eq.${currentUserId})`
    );

  if (existingError) throw existingError;

  if (existing?.length) {
    throw new Error(
      existing[0].status === 'accepted'
        ? 'You are already friends.'
        : 'A friend request already exists.'
    );
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester: currentUserId,
      addressee: otherUserId,
      status: 'pending'
    });

  if (error) throw error;
}

async function getFriendships(userId) {
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .or(
      `requester.eq.${userId},addressee.eq.${userId}`
    )
    .order('created_at', {
      ascending: false
    });

  if (error) throw error;

  const rows = data || [];

  if (!rows.length) {
    return {
      friends: [],
      incoming: [],
      outgoing: []
    };
  }

  const profileIds = [
    ...new Set(
      rows.flatMap(row => [
        row.requester,
        row.addressee
      ])
    )
  ].filter(id => id !== userId);

  const {
    data: profiles,
    error: profilesError
  } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      title,
      avatar_url
    `)
    .in('id', profileIds);

  if (profilesError) throw profilesError;

  const profileMap = {};

  for (const profile of profiles || []) {
    profileMap[profile.id] = profile;
  }

  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const row of rows) {
    const otherId =
      row.requester === userId
        ? row.addressee
        : row.requester;

    const other = profileMap[otherId];

    if (!other) continue;

    const item = {
      friendshipId: row.id,
      status: row.status,
      requester: row.requester,
      addressee: row.addressee,
      profile: other
    };

    if (row.status === 'accepted') {
      friends.push(item);

    } else if (
      row.status === 'pending' &&
      row.addressee === userId
    ) {
      incoming.push(item);

    } else if (
      row.status === 'pending' &&
      row.requester === userId
    ) {
      outgoing.push(item);
    }
  }

  return {
    friends,
    incoming,
    outgoing
  };
}

async function respondToFriendRequest(
  friendshipId,
  status
) {
  const { error } = await supabase
    .from('friendships')
    .update({
      status
    })
    .eq('id', friendshipId);

  if (error) throw error;
}

async function removeFriend(friendshipId) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('id', friendshipId);

  if (error) throw error;
}


/* =========================================================
   LEADERBOARD
========================================================= */

async function loadOverallLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard_overall')
    .select('*');

  if (error) throw error;

  return data || [];
}

async function loadGameLeaderboard() {
  const { data, error } = await supabase
    .from('leaderboard_by_game')
    .select('*');

  if (error) throw error;

  return data || [];
}


/* =========================================================
   ACHIEVEMENTS
========================================================= */

const achievementRules = {
  'First Blood': {
    target: 1,
    getValue: totals => totals.kills,
    label: 'kills'
  },

  Winner: {
    target: 100,
    getValue: totals => totals.wins,
    label: 'wins'
  },

  Veteran: {
    target: 1000,
    getValue: totals => totals.games,
    label: 'games'
  },

  Sharpshooter: {
    target: 1000,
    getValue: totals => totals.headshots,
    label: 'headshots'
  },

  'Killing Machine': {
    target: 5000,
    getValue: totals => totals.kills,
    label: 'kills'
  },

  'Frag Master': {
    target: 10000,
    getValue: totals => totals.kills,
    label: 'kills'
  }
};

async function syncAchievements(
  userId,
  totals
) {
  const {
    data: achievements,
    error: achievementsError
  } = await supabase
    .from('achievements')
    .select('*')
    .order('points');

  if (achievementsError) {
    throw achievementsError;
  }

  const {
    data: currentRows,
    error: currentError
  } = await supabase
    .from('user_achievements')
    .select('*')
    .eq('user_id', userId);

  if (currentError) {
    throw currentError;
  }

  const currentMap = {};

  for (const row of currentRows || []) {
    currentMap[row.achievement_id] = row;
  }

  const updates = [];

  for (const achievement of achievements || []) {
    const rule =
      achievementRules[achievement.name];

    if (!rule) {
      continue;
    }

    const currentValue =
      number(
        rule.getValue(totals)
      );

    const progress =
      Math.min(
        currentValue,
        rule.target
      );

    const unlocked =
      currentValue >= rule.target;

    const existing =
      currentMap[
        achievement.id
      ];

    updates.push({
      user_id: userId,
      achievement_id: achievement.id,
      progress: Math.floor(progress),

      unlocked_at:
        existing?.unlocked_at ||
        (
          unlocked
            ? new Date().toISOString()
            : null
        )
    });
  }

  if (updates.length) {
    const { error } = await supabase
      .from('user_achievements')
      .upsert(
        updates,
        {
          onConflict:
            'user_id,achievement_id'
        }
      );

    if (error) {
      throw error;
    }
  }
}

async function getUserAchievements(
  userId
) {
  const [
    achievementsResult,
    progressResult
  ] = await Promise.all([
    supabase
      .from('achievements')
      .select('*')
      .order('points'),

    supabase
      .from('user_achievements')
      .select('*')
      .eq('user_id', userId)
  ]);

  if (achievementsResult.error) {
    throw achievementsResult.error;
  }

  if (progressResult.error) {
    throw progressResult.error;
  }

  const progressMap = {};

  for (
    const row
    of progressResult.data || []
  ) {
    progressMap[
      row.achievement_id
    ] = row;
  }

  return (
    achievementsResult.data || []
  ).map(achievement => ({
    ...achievement,

    userProgress:
      progressMap[
        achievement.id
      ] || null
  }));
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
                  onChange={e =>
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
                  onChange={e =>
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
              onChange={e =>
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
              onChange={e =>
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
   CHART
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

        {vals.map(
          (value, index) => (

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

          )
        )}

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


/* =========================================================
   DASHBOARD
========================================================= */

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
              : formatNumber(
                  totals.games
                )
          }
          sub="Supabase"
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
                Historical tracking coming next
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
              Rank system coming
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

        <div className="gamegrid">

          {gameStats.map(game => (

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
                    {formatNumber(
                      game.games
                    )} games •{' '}
                    {formatNumber(
                      game.wins
                    )} wins
                  </small>

                </div>

                <div className="kpg">

                  <b>
                    {formatDecimal(
                      game.kpg
                    )}
                  </b>

                  <small>
                    KPG
                  </small>

                </div>

              </div>

            </button>

          ))}

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   MY STATS
========================================================= */

function Stats({
  totals,
  gameStats,
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
          value={formatNumber(
            totals.games
          )}
        />

        <Stat
          icon={Trophy}
          label="Wins"
          value={formatNumber(
            totals.wins
          )}
        />

        <Stat
          icon={Swords}
          label="K/D"
          value={formatDecimal(
            totals.kd
          )}
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={formatDecimal(
            totals.kpg
          )}
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

              {gameStats.map(game => (

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
                    <b>{game.name}</b>
                  </td>

                  <td>
                    {formatNumber(
                      game.games
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      game.wins
                    )}
                  </td>

                  <td>
                    {game.winRate.toFixed(
                      1
                    )}%
                  </td>

                  <td>
                    {formatNumber(
                      game.kills
                    )}
                  </td>

                  <td>
                    {formatNumber(
                      game.deaths
                    )}
                  </td>

                  <td>
                    {formatDecimal(
                      game.kd
                    )}
                  </td>

                  <td className="accent">
                    {formatDecimal(
                      game.kpg
                    )}
                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      </section>

    </div>
  );
}


/* =========================================================
   GAME DETAIL
========================================================= */

function GameDetail({
  game,
  back
}) {
  if (!game) return null;

  return (
    <div className="page">

      <button
        className="linkbtn"
        onClick={back}
      >
        <ChevronLeft size={18} />
        Back to My Stats
      </button>

      <div className="page-head">

        <div>

          <div className="eyebrow">
            GAME DETAILS
          </div>

          <h1>
            {game.name}
          </h1>

          <p>
            Live performance data.
          </p>

        </div>

      </div>

      <section className="panel">

        <div
          style={{
            display: 'flex',
            gap: '18px',
            alignItems: 'center'
          }}
        >

          <div
            className="glogo"
            style={{
              width: '72px',
              height: '72px'
            }}
          >
            {game.short}
          </div>

          <div>

            <div className="eyebrow">
              CONNECTED GAME
            </div>

            <h2>
              {game.name}
            </h2>

            <span>
              Live stats from Supabase
            </span>

          </div>

        </div>

      </section>

      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Games Played"
          value={formatNumber(
            game.games
          )}
        />

        <Stat
          icon={Trophy}
          label="Wins"
          value={formatNumber(
            game.wins
          )}
          sub={`${game.winRate.toFixed(
            1
          )}% win rate`}
        />

        <Stat
          icon={Swords}
          label="Kills"
          value={formatNumber(
            game.kills
          )}
        />

        <Stat
          icon={Shield}
          label="Deaths"
          value={formatNumber(
            game.deaths
          )}
        />

        <Stat
          icon={Target}
          label="K/D"
          value={formatDecimal(
            game.kd
          )}
        />

        <Stat
          icon={Zap}
          label="Kills / Game"
          value={formatDecimal(
            game.kpg
          )}
        />

        <Stat
          icon={Target}
          label="Headshots"
          value={formatNumber(
            game.headshots
          )}
        />

        <Stat
          icon={Trophy}
          label="Win Rate"
          value={`${game.winRate.toFixed(
            1
          )}%`}
        />

      </div>

    </div>
  );
}


/* =========================================================
   LEADERBOARD PAGE
========================================================= */

function LeaderboardPage({
  currentUserId
}) {
  const [overallRows, setOverallRows] =
    useState([]);

  const [gameRows, setGameRows] =
    useState([]);

  const [gameFilter, setGameFilter] =
    useState('Overall');

  const [metric, setMetric] =
    useState('kills');

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  useEffect(() => {
    async function loadLeaderboard() {
      setLoading(true);
      setError('');

      try {
        const [
          overall,
          byGame
        ] = await Promise.all([
          loadOverallLeaderboard(),
          loadGameLeaderboard()
        ]);

        setOverallRows(overall);
        setGameRows(byGame);

      } catch (err) {
        setError(
          err.message ||
          'Could not load leaderboard.'
        );

      } finally {
        setLoading(false);
      }
    }

    loadLeaderboard();
  }, []);

  const rows = useMemo(() => {
    let source;

    if (gameFilter === 'Overall') {
      source = [...overallRows];

    } else {
      source = gameRows.filter(
        row =>
          row.game_name === gameFilter
      );
    }

    return source.sort(
      (a, b) =>
        number(b[metric]) -
        number(a[metric])
    );
  }, [
    overallRows,
    gameRows,
    gameFilter,
    metric
  ]);

  function metricValue(row) {
    if (
      metric === 'kd' ||
      metric === 'kpg'
    ) {
      return formatDecimal(
        row[metric]
      );
    }

    return formatNumber(
      row[metric]
    );
  }

  function metricTitle() {
    if (metric === 'kills') {
      return 'KILLS';
    }

    if (metric === 'wins') {
      return 'WINS';
    }

    if (metric === 'kd') {
      return 'K/D';
    }

    return 'KPG';
  }

  const games = [
    'Overall',
    'Call of Duty',
    'Fortnite',
    'Apex Legends'
  ];

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            COMPETE
          </div>

          <h1>
            Global Leaderboard
          </h1>

          <p>
            See how FragRank players stack up.
          </p>

        </div>

      </div>

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Choose Game
            </h2>

            <span>
              Overall or game-specific rankings
            </span>

          </div>

        </div>

        <div className="tabs">

          {games.map(game => (

            <button
              key={game}
              className={
                gameFilter === game
                  ? 'active'
                  : ''
              }
              onClick={() =>
                setGameFilter(game)
              }
            >
              {game}
            </button>

          ))}

        </div>

      </section>

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Rank By
            </h2>

            <span>
              Choose the competitive metric
            </span>

          </div>

        </div>

        <div className="tabs">

          <button
            className={
              metric === 'kills'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric('kills')
            }
          >
            Kills
          </button>

          <button
            className={
              metric === 'wins'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric('wins')
            }
          >
            Wins
          </button>

          <button
            className={
              metric === 'kd'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric('kd')
            }
          >
            K/D
          </button>

          <button
            className={
              metric === 'kpg'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric('kpg')
            }
          >
            KPG
          </button>

        </div>

      </section>

      {error && (
        <div className="notice">
          Leaderboard could not be loaded: {error}
        </div>
      )}

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Rankings
            </h2>

            <span>
              {gameFilter}
            </span>

          </div>

          <span className="pill">
            {metricTitle()}
          </span>

        </div>

        {loading ? (

          <p className="muted">
            Loading leaderboard…
          </p>

        ) : rows.length === 0 ? (

          <p className="muted">
            No ranked players yet.
          </p>

        ) : (

          <div>

            {rows.map(
              (row, index) => {

                const isMe =
                  row.user_id ===
                  currentUserId;

                const playerName =
                  row.display_name ||
                  row.username ||
                  'Player';

                return (
                  <div
                    className="friend"
                    key={`${row.user_id}-${row.game_id || 'overall'}`}
                    style={
                      isMe
                        ? {
                            background:
                              'rgba(53, 153, 255, 0.12)'
                          }
                        : undefined
                    }
                  >

                    <div
                      style={{
                        minWidth: '40px',
                        fontWeight: '800',
                        fontSize: '18px'
                      }}
                    >
                      #{index + 1}
                    </div>

                    <div className="avatar">
                      {playerName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div
                      style={{
                        flex: 1
                      }}
                    >

                      <b>
                        {playerName}
                      </b>

                      <small>
                        @{row.username}
                        {isMe
                          ? ' • YOU'
                          : ''}
                      </small>

                    </div>

                    <div className="metric">

                      <b>
                        {metricValue(row)}
                      </b>

                      <small>
                        {metricTitle()}
                      </small>

                    </div>

                  </div>
                );
              }
            )}

          </div>

        )}

      </section>

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Player Stats
            </h2>

            <span>
              Additional leaderboard details
            </span>

          </div>

        </div>

        {rows.map(row => {
          const playerName =
            row.display_name ||
            row.username ||
            'Player';

          return (
            <div
              className="gamecard"
              key={`stats-${row.user_id}-${row.game_id || 'overall'}`}
              style={{
                marginBottom: '12px'
              }}
            >

              <div className="glogo">
                {playerName
                  .charAt(0)
                  .toUpperCase()}
              </div>

              <div>

                <b>
                  {playerName}
                </b>

                <small>
                  {formatNumber(
                    row.games_played
                  )} games •{' '}
                  {formatNumber(
                    row.wins
                  )} wins •{' '}
                  {formatNumber(
                    row.kills
                  )} kills
                </small>

              </div>

              <div className="kpg">

                <b>
                  {formatDecimal(
                    row.kpg
                  )}
                </b>

                <small>
                  KPG
                </small>

              </div>

            </div>
          );
        })}

      </section>

    </div>
  );
}


/* =========================================================
   ACHIEVEMENTS PAGE
========================================================= */

function AchievementsPage({
  user,
  totals
}) {
  const [
    achievements,
    setAchievements
  ] = useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');

  async function load() {
    setLoading(true);
    setError('');

    try {
      await syncAchievements(
        user.id,
        totals
      );

      const rows =
        await getUserAchievements(
          user.id
        );

      setAchievements(rows);

    } catch (err) {
      setError(
        err.message ||
        'Could not load achievements.'
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [
    user.id,
    totals.games,
    totals.wins,
    totals.kills,
    totals.headshots
  ]);

  const unlocked =
    achievements.filter(
      achievement =>
        Boolean(
          achievement
            .userProgress
            ?.unlocked_at
        )
    );

  const earnedPoints =
    unlocked.reduce(
      (sum, achievement) =>
        sum +
        number(
          achievement.points
        ),
      0
    );

  const totalPossiblePoints =
    achievements.reduce(
      (sum, achievement) =>
        sum +
        number(
          achievement.points
        ),
      0
    );

  function getProgress(
    achievement
  ) {
    const rule =
      achievementRules[
        achievement.name
      ];

    if (!rule) {
      return {
        supported: false,
        current: 0,
        target: 0,
        percent: 0,
        label:
          'Match-history tracking required'
      };
    }

    const current =
      number(
        rule.getValue(totals)
      );

    const percent =
      Math.min(
        100,
        rule.target > 0
          ? (
              current /
              rule.target
            ) * 100
          : 0
      );

    return {
      supported: true,
      current,
      target: rule.target,
      percent,

      label:
        `${formatNumber(
          Math.min(
            current,
            rule.target
          )
        )} / ${formatNumber(
          rule.target
        )} ${rule.label}`
    };
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            PROGRESSION
          </div>

          <h1>
            Achievements
          </h1>

          <p>
            Unlock milestones by playing and climbing FragRank.
          </p>

        </div>

        <div className="achievement-points">
          <Award size={18} />

          {earnedPoints} points
        </div>

      </div>

      <div className="stats">

        <Stat
          icon={Award}
          label="Unlocked"
          value={`${unlocked.length} / ${achievements.length}`}
        />

        <Stat
          icon={Trophy}
          label="Achievement Points"
          value={formatNumber(
            earnedPoints
          )}
          sub={`${formatNumber(
            totalPossiblePoints
          )} possible`}
        />

        <Stat
          icon={Swords}
          label="Total Kills"
          value={formatNumber(
            totals.kills
          )}
        />

        <Stat
          icon={Target}
          label="Headshots"
          value={formatNumber(
            totals.headshots
          )}
        />

      </div>

      {error && (
        <div className="notice">
          Achievements could not be loaded: {error}
        </div>
      )}

      {loading ? (

        <section className="panel">

          <p className="muted">
            Loading achievements…
          </p>

        </section>

      ) : (

        <div className="achievement-grid">

          {achievements.map(
            achievement => {

              const progress =
                getProgress(
                  achievement
                );

              const isUnlocked =
                Boolean(
                  achievement
                    .userProgress
                    ?.unlocked_at
                );

              return (
                <div
                  key={achievement.id}
                  className={`achievement ${
                    isUnlocked
                      ? 'unlocked'
                      : ''
                  }`}
                >

                  <div className="ach-icon">
                    <Award />
                  </div>

                  <div
                    style={{
                      flex: 1
                    }}
                  >

                    <span>
                      {achievement.rarity}
                    </span>

                    <h3>
                      {achievement.name}
                    </h3>

                    <p>
                      {achievement.description}
                    </p>

                    <b>
                      {achievement.points} points
                    </b>

                    {progress.supported ? (
                      <>

                        <div
                          className="progress"
                          style={{
                            marginTop:
                              '12px'
                          }}
                        >
                          <i
                            style={{
                              width:
                                `${progress.percent}%`
                            }}
                          />
                        </div>

                        <small>
                          {progress.label}
                        </small>

                      </>
                    ) : (

                      <small>
                        Match-history tracking required
                      </small>

                    )}

                  </div>

                  <strong
                    style={{
                      fontSize: '22px'
                    }}
                  >
                    {isUnlocked
                      ? '✓'
                      : '○'}
                  </strong>

                </div>
              );
            }
          )}

        </div>

      )}

    </div>
  );
}


/* =========================================================
   FRIENDS PAGE
========================================================= */

function FriendsPage({
  user,
  openFriend
}) {
  const [friends, setFriends] =
    useState([]);

  const [incoming, setIncoming] =
    useState([]);

  const [outgoing, setOutgoing] =
    useState([]);

  const [searchText, setSearchText] =
    useState('');

  const [searchResults, setSearchResults] =
    useState([]);

  const [message, setMessage] =
    useState('');

  const [loading, setLoading] =
    useState(true);

  async function loadFriends() {
    setLoading(true);

    try {
      const result =
        await getFriendships(
          user.id
        );

      setFriends(
        result.friends
      );

      setIncoming(
        result.incoming
      );

      setOutgoing(
        result.outgoing
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load friends.'
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFriends();
  }, [user.id]);

  async function runSearch(e) {
    e.preventDefault();

    setMessage('');

    try {
      const results =
        await searchPlayers(
          searchText,
          user.id
        );

      setSearchResults(
        results
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Search failed.'
      );
    }
  }

  async function addFriend(profile) {
    try {
      await sendFriendRequest(
        user.id,
        profile.id
      );

      setMessage(
        `Friend request sent to ${
          profile.display_name ||
          profile.username
        }.`
      );

      await loadFriends();

    } catch (error) {
      setMessage(
        error.message ||
        'Could not send request.'
      );
    }
  }

  async function respond(
    friendshipId,
    status
  ) {
    try {
      await respondToFriendRequest(
        friendshipId,
        status
      );

      await loadFriends();

    } catch (error) {
      setMessage(
        error.message ||
        'Could not update request.'
      );
    }
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            SOCIAL
          </div>

          <h1>
            Friends
          </h1>

          <p>
            Find players, send requests, and compare stats.
          </p>

        </div>

      </div>

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Find Players
            </h2>

            <span>
              Search by username or display name
            </span>

          </div>

        </div>

        <form
          onSubmit={runSearch}
          style={{
            display: 'flex',
            gap: '10px'
          }}
        >

          <input
            value={searchText}
            onChange={e =>
              setSearchText(
                e.target.value
              )
            }
            placeholder="Search players..."
            style={{
              flex: 1
            }}
          />

          <button className="primary">
            <Search size={17} />
            Search
          </button>

        </form>

        {message && (
          <div
            className="notice"
            style={{
              marginTop: '15px'
            }}
          >
            {message}
          </div>
        )}

        {searchResults.map(profile => (

          <div
            className="friend"
            key={profile.id}
          >

            <div className="avatar">
              {(
                profile.display_name ||
                profile.username ||
                'P'
              )[0].toUpperCase()}
            </div>

            <div>

              <b>
                {profile.display_name ||
                  profile.username}
              </b>

              <small>
                @{profile.username}
              </small>

            </div>

            <button
              className="primary"
              onClick={() =>
                addFriend(profile)
              }
            >
              <UserPlus size={16} />
              Add
            </button>

          </div>

        ))}

      </section>

      {incoming.length > 0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Friend Requests
            </h2>

            <span className="pill">
              {incoming.length}
            </span>

          </div>

          {incoming.map(item => {

            const profile =
              item.profile;

            return (
              <div
                className="friend"
                key={item.friendshipId}
              >

                <div className="avatar">
                  {(
                    profile.display_name ||
                    profile.username
                  )[0].toUpperCase()}
                </div>

                <div>

                  <b>
                    {profile.display_name ||
                      profile.username}
                  </b>

                  <small>
                    @{profile.username}
                  </small>

                </div>

                <button
                  className="primary"
                  onClick={() =>
                    respond(
                      item.friendshipId,
                      'accepted'
                    )
                  }
                >
                  <Check size={16} />
                  Accept
                </button>

                <button
                  className="iconbtn"
                  onClick={() =>
                    respond(
                      item.friendshipId,
                      'rejected'
                    )
                  }
                >
                  <X size={16} />
                </button>

              </div>
            );
          })}

        </section>

      )}

      <section className="panel">

        <div className="panel-head">

          <h2>
            My Friends
          </h2>

          <span className="pill">
            {friends.length}
          </span>

        </div>

        {loading ? (

          <p className="muted">
            Loading friends…
          </p>

        ) : friends.length === 0 ? (

          <p className="muted">
            You haven't added any friends yet.
          </p>

        ) : (

          friends.map(item => {

            const profile =
              item.profile;

            return (
              <button
                key={item.friendshipId}
                style={{
                  all: 'unset',
                  display: 'block',
                  width: '100%',
                  cursor: 'pointer'
                }}
                onClick={() =>
                  openFriend(
                    profile,
                    item.friendshipId
                  )
                }
              >

                <div className="friend">

                  <div className="avatar">
                    {(
                      profile.display_name ||
                      profile.username
                    )[0].toUpperCase()}
                  </div>

                  <div>

                    <b>
                      {profile.display_name ||
                        profile.username}
                    </b>

                    <small>
                      @{profile.username}
                    </small>

                  </div>

                  <ChevronRight size={18} />

                </div>

              </button>
            );
          })

        )}

      </section>

      {outgoing.length > 0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Sent Requests
            </h2>

          </div>

          {outgoing.map(item => (

            <div
              className="friend"
              key={item.friendshipId}
            >

              <div className="avatar">
                {(
                  item.profile.display_name ||
                  item.profile.username
                )[0].toUpperCase()}
              </div>

              <div>

                <b>
                  {item.profile.display_name ||
                    item.profile.username}
                </b>

                <small>
                  Pending
                </small>

              </div>

            </div>

          ))}

        </section>

      )}

    </div>
  );
}


/* =========================================================
   FRIEND PROFILE
========================================================= */

function FriendProfile({
  profile,
  friendshipId,
  back
}) {
  const [gameStats, setGameStats] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [message, setMessage] =
    useState('');

  useEffect(() => {

    async function load() {
      try {
        const stats =
          await getGameStats(
            profile.id
          );

        setGameStats(stats);

      } catch (error) {
        setMessage(
          error.message ||
          'Could not load stats.'
        );

      } finally {
        setLoading(false);
      }
    }

    load();

  }, [profile.id]);

  const totals =
    useMemo(
      () =>
        calculateTotals(
          gameStats
        ),
      [gameStats]
    );

  async function remove() {
    try {
      await removeFriend(
        friendshipId
      );

      back();

    } catch (error) {
      setMessage(
        error.message ||
        'Could not remove friend.'
      );
    }
  }

  return (
    <div className="page">

      <button
        className="linkbtn"
        onClick={back}
      >
        <ChevronLeft size={18} />
        Back to Friends
      </button>

      <div className="page-head">

        <div>

          <div className="eyebrow">
            FRIEND PROFILE
          </div>

          <h1>
            {profile.display_name ||
              profile.username}
          </h1>

          <p>
            @{profile.username}
          </p>

          {profile.title && (
            <span className="pill">
              {profile.title}
            </span>
          )}

        </div>

      </div>

      {profile.bio && (

        <section className="panel">

          <h2>
            Bio
          </h2>

          <p>
            {profile.bio}
          </p>

        </section>

      )}

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <div className="stats">

        <Stat
          icon={Gamepad2}
          label="Games"
          value={
            loading
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
            loading
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
            loading
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
            loading
              ? '...'
              : formatDecimal(
                  totals.kpg
                )
          }
        />

      </div>

      <section className="panel">

        <div className="panel-head">

          <h2>
            Game Stats
          </h2>

        </div>

        {gameStats.length === 0 ? (

          <p className="muted">
            No game stats available yet.
          </p>

        ) : (

          <div className="gamegrid">

            {gameStats.map(game => (

              <div
                className="gamecard"
                key={game.id}
              >

                <div className="glogo">
                  {game.short}
                </div>

                <div>

                  <b>
                    {game.name}
                  </b>

                  <small>
                    {formatNumber(
                      game.games
                    )} games •{' '}
                    {formatNumber(
                      game.wins
                    )} wins
                  </small>

                </div>

                <div className="kpg">

                  <b>
                    {formatDecimal(
                      game.kpg
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

      <button
        className="logout"
        onClick={remove}
        style={{
          marginTop: '20px'
        }}
      >
        Remove Friend
      </button>

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

      <section className="panel">

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
              onChange={e =>
                setDisplayName(
                  e.target.value
                )
              }
            />
          </label>

          <label>
            Player Title

            <input
              value={title}
              onChange={e =>
                setTitle(
                  e.target.value
                )
              }
              placeholder="Example: FragRank Founder"
            />
          </label>

          <label>
            Bio

            <input
              value={bio}
              onChange={e =>
                setBio(
                  e.target.value
                )
              }
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


/* =========================================================
   PLACEHOLDER PAGES
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
          {title} foundation ready
        </h2>

        <p>
          This feature will be connected to live data next.
        </p>

      </section>

    </div>
  );
}


/* =========================================================
   APP
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
    useState(false);

  const [statsError, setStatsError] =
    useState('');

  const [page, setPage] =
    useState('dashboard');

  const [selectedGame, setSelectedGame] =
    useState(null);

  const [selectedFriend, setSelectedFriend] =
    useState(null);

  const [
    selectedFriendshipId,
    setSelectedFriendshipId
  ] = useState(null);

  const [open, setOpen] =
    useState(false);

  async function loadPlayerData(user) {
    if (!user) return;

    setStatsLoading(true);
    setStatsError('');

    try {
      const playerProfile =
        await getProfile(
          user.id
        );

      setProfile(
        playerProfile
      );

      const playerStats =
        await getGameStats(
          user.id
        );

      setGameStats(
        playerStats
      );

    } catch (error) {
      setStatsError(
        error.message ||
        'Unknown Supabase error'
      );

    } finally {
      setStatsLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function start() {
      try {
        const {
          data: {
            session: currentSession
          }
        } =
          await supabase.auth.getSession();

        if (!alive) return;

        setSession(
          currentSession
        );

        if (
          currentSession?.user
        ) {
          await loadPlayerData(
            currentSession.user
          );
        }

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

          setSession(
            nextSession
          );

          if (
            nextSession?.user
          ) {
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
    'Player';

  function openGame(game) {
    setSelectedGame(
      game
    );

    setPage(
      'game-detail'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

  function openFriend(
    friend,
    friendshipId
  ) {
    setSelectedFriend(
      friend
    );

    setSelectedFriendshipId(
      friendshipId
    );

    setPage(
      'friend-profile'
    );

    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  }

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
        onProfileUpdated={
          setProfile
        }
      />
    ),

    stats: (
      <Stats
        totals={totals}
        gameStats={gameStats}
        openGame={openGame}
      />
    ),

    'game-detail': (
      <GameDetail
        game={selectedGame}
        back={() => {
          setPage('stats');
          setSelectedGame(null);
        }}
      />
    ),

    friends: (
      <FriendsPage
        user={session.user}
        openFriend={openFriend}
      />
    ),

    'friend-profile': (
      selectedFriend ? (
        <FriendProfile
          profile={selectedFriend}
          friendshipId={
            selectedFriendshipId
          }
          back={() => {
            setSelectedFriend(null);
            setSelectedFriendshipId(null);
            setPage('friends');
          }}
        />
      ) : null
    ),

    leaderboard: (
      <LeaderboardPage
        currentUserId={
          session.user.id
        }
      />
    ),

    achievements: (
      <AchievementsPage
        user={session.user}
        totals={totals}
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
        description="Custom tournaments and brackets."
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
        description="Posts, clips, reactions, and comments."
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
                  setSelectedFriend(null);

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
              {formatNumber(
                totals.games
              )} games
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
                setPage('profile')
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
