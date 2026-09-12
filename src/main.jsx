import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';

import {
  Activity,
  Award,
  BarChart3,
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
  RefreshCw,
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

function getPlayerName(profile) {
  return (
    profile?.display_name ||
    profile?.username ||
    'Player'
  );
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
      display_name:
        updates.display_name?.trim() || null,

      bio:
        updates.bio?.trim() || null,

      title:
        updates.title?.trim() || null
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

async function getGames() {
  const { data, error } = await supabase
    .from('games')
    .select('id,name')
    .order('id');

  if (error) throw error;

  return data || [];
}

async function getRawGameStat(userId, gameId) {
  const { data, error } = await supabase
    .from('game_stats')
    .select(`
      games_played,
      wins,
      kills,
      deaths,
      headshots
    `)
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw error;

  return data || {
    games_played: 0,
    wins: 0,
    kills: 0,
    deaths: 0,
    headshots: 0
  };
}

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

    const gamesPlayed =
      number(row.games_played);

    const wins =
      number(row.wins);

    const kills =
      number(row.kills);

    const deaths =
      number(row.deaths);

    return {
      id: row.id,
      gameId: row.game_id,
      name: game.name,
      short:
        shortGameName(game.name),

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
          : kills
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
        ? (
            totals.wins /
            totals.games
          ) * 100
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
   FRIENDS
========================================================= */

async function searchPlayers(
  text,
  currentUserId
) {
  const query =
    text.trim();

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
    .neq(
      'id',
      currentUserId
    )
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

  if (existingError) {
    throw existingError;
  }

  if (existing?.length) {
    throw new Error(
      existing[0].status ===
        'accepted'
        ? 'You are already friends.'
        : 'A friend request already exists.'
    );
  }

  const { error } = await supabase
    .from('friendships')
    .insert({
      requester:
        currentUserId,

      addressee:
        otherUserId,

      status:
        'pending'
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
    .order(
      'created_at',
      {
        ascending: false
      }
    );

  if (error) throw error;

  const rows =
    data || [];

  if (!rows.length) {
    return {
      friends: [],
      incoming: [],
      outgoing: []
    };
  }

  const profileIds = [
    ...new Set(
      rows.flatMap(
        row => [
          row.requester,
          row.addressee
        ]
      )
    )
  ].filter(
    id =>
      id !== userId
  );

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
    .in(
      'id',
      profileIds
    );

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = {};

  for (
    const profile
    of profiles || []
  ) {
    profileMap[
      profile.id
    ] = profile;
  }

  const friends = [];
  const incoming = [];
  const outgoing = [];

  for (const row of rows) {
    const otherId =
      row.requester === userId
        ? row.addressee
        : row.requester;

    const other =
      profileMap[otherId];

    if (!other) {
      continue;
    }

    const item = {
      friendshipId:
        row.id,

      status:
        row.status,

      requester:
        row.requester,

      addressee:
        row.addressee,

      profile:
        other
    };

    if (
      row.status ===
      'accepted'
    ) {
      friends.push(item);

    } else if (
      row.status ===
        'pending' &&
      row.addressee ===
        userId
    ) {
      incoming.push(item);

    } else if (
      row.status ===
        'pending' &&
      row.requester ===
        userId
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
    .eq(
      'id',
      friendshipId
    );

  if (error) throw error;
}

async function removeFriend(
  friendshipId
) {
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq(
      'id',
      friendshipId
    );

  if (error) throw error;
}


/* =========================================================
   LEADERBOARD
========================================================= */

async function loadOverallLeaderboard() {
  const { data, error } = await supabase
    .from(
      'leaderboard_overall'
    )
    .select('*');

  if (error) throw error;

  return data || [];
}

async function loadGameLeaderboard() {
  const { data, error } = await supabase
    .from(
      'leaderboard_by_game'
    )
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
    getValue:
      totals =>
        totals.kills,
    label: 'kills'
  },

  Winner: {
    target: 100,
    getValue:
      totals =>
        totals.wins,
    label: 'wins'
  },

  Veteran: {
    target: 1000,
    getValue:
      totals =>
        totals.games,
    label: 'games'
  },

  Sharpshooter: {
    target: 1000,
    getValue:
      totals =>
        totals.headshots,
    label:
      'headshots'
  },

  'Killing Machine': {
    target: 5000,
    getValue:
      totals =>
        totals.kills,
    label: 'kills'
  },

  'Frag Master': {
    target: 10000,
    getValue:
      totals =>
        totals.kills,
    label: 'kills'
  }
};

async function syncAchievements(
  userId,
  totals
) {
  const {
    data: achievements,
    error:
      achievementsError
  } = await supabase
    .from('achievements')
    .select('*')
    .order('points');

  if (
    achievementsError
  ) {
    throw achievementsError;
  }

  const {
    data: currentRows,
    error: currentError
  } = await supabase
    .from(
      'user_achievements'
    )
    .select('*')
    .eq(
      'user_id',
      userId
    );

  if (currentError) {
    throw currentError;
  }

  const currentMap = {};

  for (
    const row
    of currentRows || []
  ) {
    currentMap[
      row.achievement_id
    ] = row;
  }

  const updates = [];

  for (
    const achievement
    of achievements || []
  ) {
    const rule =
      achievementRules[
        achievement.name
      ];

    if (!rule) {
      continue;
    }

    const currentValue =
      number(
        rule.getValue(
          totals
        )
      );

    const progress =
      Math.min(
        currentValue,
        rule.target
      );

    const unlocked =
      currentValue >=
      rule.target;

    const existing =
      currentMap[
        achievement.id
      ];

    updates.push({
      user_id:
        userId,

      achievement_id:
        achievement.id,

      progress:
        Math.floor(
          progress
        ),

      unlocked_at:
        existing
          ?.unlocked_at ||
        (
          unlocked
            ? new Date()
                .toISOString()
            : null
        )
    });
  }

  if (
    updates.length
  ) {
    const { error } =
      await supabase
        .from(
          'user_achievements'
        )
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
      .from(
        'user_achievements'
      )
      .select('*')
      .eq(
        'user_id',
        userId
      )
  ]);

  if (
    achievementsResult.error
  ) {
    throw achievementsResult.error;
  }

  if (
    progressResult.error
  ) {
    throw progressResult.error;
  }

  const progressMap = {};

  for (
    const row
    of progressResult.data ||
    []
  ) {
    progressMap[
      row.achievement_id
    ] = row;
  }

  return (
    achievementsResult.data ||
    []
  ).map(
    achievement => ({
      ...achievement,

      userProgress:
        progressMap[
          achievement.id
        ] || null
    })
  );
}


/* =========================================================
   CHALLENGES
========================================================= */

const challengeMetricOptions = [
  {
    value: 'kills',
    label: 'Kills'
  },
  {
    value: 'wins',
    label: 'Wins'
  },
  {
    value: 'headshots',
    label: 'Headshots'
  },
  {
    value:
      'games_played',
    label:
      'Games Played'
  }
];

function challengeMetricLabel(
  metric
) {
  return (
    challengeMetricOptions
      .find(
        option =>
          option.value ===
          metric
      )
      ?.label ||
    metric
  );
}

function statValueForMetric(
  stat,
  metric
) {
  if (!stat) return 0;

  if (
    metric === 'kills'
  ) {
    return number(
      stat.kills
    );
  }

  if (
    metric === 'wins'
  ) {
    return number(
      stat.wins
    );
  }

  if (
    metric ===
    'headshots'
  ) {
    return number(
      stat.headshots
    );
  }

  if (
    metric ===
    'games_played'
  ) {
    return number(
      stat.games_played
    );
  }

  return 0;
}

async function getChallenges(
  userId
) {
  const { data, error } =
    await supabase
      .from(
        'challenge_details'
      )
      .select('*')
      .or(
        `creator_id.eq.${userId},opponent_id.eq.${userId}`
      )
      .order(
        'created_at',
        {
          ascending:
            false
        }
      );

  if (error) throw error;

  return data || [];
}

async function createChallenge({
  creatorId,
  opponentId,
  gameId,
  metric,
  target
}) {
  const creatorStat =
    await getRawGameStat(
      creatorId,
      gameId
    );

  const creatorStart =
    statValueForMetric(
      creatorStat,
      metric
    );

  const { error } =
    await supabase
      .from('challenges')
      .insert({
        creator_id:
          creatorId,

        opponent_id:
          opponentId,

        game_id:
          gameId,

        metric,

        target:
          number(target),

        reward:
          0,

        status:
          'pending',

        creator_start_value:
          creatorStart,

        opponent_start_value:
          0,

        creator_progress:
          0,

        opponent_progress:
          0
      });

  if (error) throw error;
}

async function acceptChallenge(
  challenge
) {
  const [
    creatorStat,
    opponentStat
  ] = await Promise.all([
    getRawGameStat(
      challenge.creator_id,
      challenge.game_id
    ),

    getRawGameStat(
      challenge.opponent_id,
      challenge.game_id
    )
  ]);

  const creatorStart =
    statValueForMetric(
      creatorStat,
      challenge.metric
    );

  const opponentStart =
    statValueForMetric(
      opponentStat,
      challenge.metric
    );

  const { error } =
    await supabase
      .from('challenges')
      .update({
        status:
          'active',

        accepted_at:
          new Date()
            .toISOString(),

        creator_start_value:
          creatorStart,

        opponent_start_value:
          opponentStart,

        creator_progress:
          0,

        opponent_progress:
          0
      })
      .eq(
        'id',
        challenge.id
      );

  if (error) throw error;
}

async function declineChallenge(
  challengeId
) {
  const { error } =
    await supabase
      .from('challenges')
      .update({
        status:
          'declined'
      })
      .eq(
        'id',
        challengeId
      );

  if (error) throw error;
}

async function cancelChallenge(
  challengeId
) {
  const { error } =
    await supabase
      .from('challenges')
      .delete()
      .eq(
        'id',
        challengeId
      );

  if (error) throw error;
}

async function refreshChallenge(
  challenge
) {
  if (
    challenge.status !==
    'active'
  ) {
    return;
  }

  const [
    creatorStat,
    opponentStat
  ] = await Promise.all([
    getRawGameStat(
      challenge.creator_id,
      challenge.game_id
    ),

    getRawGameStat(
      challenge.opponent_id,
      challenge.game_id
    )
  ]);

  const creatorCurrent =
    statValueForMetric(
      creatorStat,
      challenge.metric
    );

  const opponentCurrent =
    statValueForMetric(
      opponentStat,
      challenge.metric
    );

  const creatorProgress =
    Math.max(
      0,
      creatorCurrent -
      number(
        challenge
          .creator_start_value
      )
    );

  const opponentProgress =
    Math.max(
      0,
      opponentCurrent -
      number(
        challenge
          .opponent_start_value
      )
    );

  const target =
    number(
      challenge.target
    );

  let winnerId =
    null;

  if (
    creatorProgress >=
      target &&
    opponentProgress >=
      target
  ) {
    winnerId =
      creatorProgress >=
      opponentProgress
        ? challenge
            .creator_id
        : challenge
            .opponent_id;

  } else if (
    creatorProgress >=
    target
  ) {
    winnerId =
      challenge
        .creator_id;

  } else if (
    opponentProgress >=
    target
  ) {
    winnerId =
      challenge
        .opponent_id;
  }

  const update = {
    creator_progress:
      creatorProgress,

    opponent_progress:
      opponentProgress
  };

  if (winnerId) {
    update.status =
      'completed';

    update.winner_id =
      winnerId;

    update.completed_at =
      new Date()
        .toISOString();
  }

  const { error } =
    await supabase
      .from('challenges')
      .update(update)
      .eq(
        'id',
        challenge.id
      );

  if (error) throw error;
}


/* =========================================================
   TOURNAMENTS
========================================================= */

async function getTournamentDetails() {
  const { data, error } =
    await supabase
      .from(
        'tournament_details'
      )
      .select('*')
      .order(
        'created_at',
        {
          ascending:
            false
        }
      );

  if (error) throw error;

  return data || [];
}

async function getMyTournamentMemberships(
  userId
) {
  const { data, error } =
    await supabase
      .from(
        'tournament_players'
      )
      .select(`
        tournament_id,
        user_id,
        seed
      `)
      .eq(
        'user_id',
        userId
      );

  if (error) throw error;

  return data || [];
}

async function getTournamentPlayers(
  tournamentId
) {
  const {
    data: rows,
    error
  } = await supabase
    .from(
      'tournament_players'
    )
    .select(`
      tournament_id,
      user_id,
      seed
    `)
    .eq(
      'tournament_id',
      tournamentId
    )
    .order('seed');

  if (error) throw error;

  if (!rows?.length) {
    return [];
  }

  const ids =
    rows.map(
      row =>
        row.user_id
    );

  const {
    data: profiles,
    error: profilesError
  } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      title
    `)
    .in(
      'id',
      ids
    );

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = {};

  for (
    const profile
    of profiles || []
  ) {
    profileMap[
      profile.id
    ] = profile;
  }

  return rows.map(
    row => ({
      ...row,

      profile:
        profileMap[
          row.user_id
        ] || null
    })
  );
}

async function createTournament({
  creatorId,
  name,
  description,
  gameId,
  maxPlayers
}) {
  const {
    data:
      tournament,
    error
  } = await supabase
    .from('tournaments')
    .insert({
      name:
        name.trim(),

      description:
        description
          .trim() ||
        null,

      max_players:
        number(
          maxPlayers
        ),

      status:
        'open',

      creator_id:
        creatorId,

      game_id:
        number(gameId)
    })
    .select()
    .single();

  if (error) throw error;

  const {
    error: joinError
  } = await supabase
    .from(
      'tournament_players'
    )
    .insert({
      tournament_id:
        tournament.id,

      user_id:
        creatorId,

      seed:
        1
    });

  if (joinError) {
    throw joinError;
  }

  return tournament;
}

async function joinTournament({
  tournamentId,
  userId
}) {
  const {
    data: existing,
    error: existingError
  } = await supabase
    .from(
      'tournament_players'
    )
    .select(`
      tournament_id,
      user_id
    `)
    .eq(
      'tournament_id',
      tournamentId
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new Error(
      'You already joined this tournament.'
    );
  }

  const {
    data:
      tournament,
    error:
      tournamentError
  } = await supabase
    .from(
      'tournament_details'
    )
    .select('*')
    .eq(
      'id',
      tournamentId
    )
    .single();

  if (
    tournamentError
  ) {
    throw tournamentError;
  }

  if (
    tournament.status !==
    'open'
  ) {
    throw new Error(
      'This tournament is not open.'
    );
  }

  if (
    number(
      tournament
        .player_count
    ) >=
    number(
      tournament
        .max_players
    )
  ) {
    throw new Error(
      'This tournament is full.'
    );
  }

  const {
    data: players,
    error: playersError
  } = await supabase
    .from(
      'tournament_players'
    )
    .select('user_id')
    .eq(
      'tournament_id',
      tournamentId
    );

  if (playersError) {
    throw playersError;
  }

  const { error } =
    await supabase
      .from(
        'tournament_players'
      )
      .insert({
        tournament_id:
          tournamentId,

        user_id:
          userId,

        seed:
          (
            players
              ?.length ||
            0
          ) + 1
      });

  if (error) throw error;
}

async function leaveTournament({
  tournamentId,
  userId
}) {
  const { error } =
    await supabase
      .from(
        'tournament_players'
      )
      .delete()
      .eq(
        'tournament_id',
        tournamentId
      )
      .eq(
        'user_id',
        userId
      );

  if (error) throw error;
}

async function updateTournamentStatus(
  tournamentId,
  status
) {
  const update = {
    status
  };

  if (
    status ===
    'active'
  ) {
    update.start_at =
      new Date()
        .toISOString();
  }

  if (
    status ===
    'completed'
  ) {
    update.completed_at =
      new Date()
        .toISOString();
  }

  const { error } =
    await supabase
      .from('tournaments')
      .update(update)
      .eq(
        'id',
        tournamentId
      );

  if (error) throw error;
}

async function deleteTournament(
  tournamentId
) {
  const { error } =
    await supabase
      .from('tournaments')
      .delete()
      .eq(
        'id',
        tournamentId
      );

  if (error) throw error;
}


/* =========================================================
   CLANS
========================================================= */

async function getClanDetails() {
  const { data, error } =
    await supabase
      .from(
        'clan_details'
      )
      .select('*')
      .order(
        'created_at',
        {
          ascending:
            false
        }
      );

  if (error) throw error;

  return data || [];
}

async function getMyClanMemberships(
  userId
) {
  const { data, error } =
    await supabase
      .from(
        'clan_members'
      )
      .select(`
        clan_id,
        user_id,
        role
      `)
      .eq(
        'user_id',
        userId
      );

  if (error) throw error;

  return data || [];
}

async function getClanMembers(
  clanId
) {
  const {
    data: rows,
    error
  } = await supabase
    .from('clan_members')
    .select(`
      clan_id,
      user_id,
      role
    `)
    .eq(
      'clan_id',
      clanId
    );

  if (error) throw error;

  if (!rows?.length) {
    return [];
  }

  const ids =
    rows.map(
      row =>
        row.user_id
    );

  const {
    data: profiles,
    error: profilesError
  } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      title
    `)
    .in(
      'id',
      ids
    );

  if (profilesError) {
    throw profilesError;
  }

  const profileMap = {};

  for (
    const profile
    of profiles || []
  ) {
    profileMap[
      profile.id
    ] = profile;
  }

  return rows.map(
    row => ({
      ...row,

      profile:
        profileMap[
          row.user_id
        ] || null
    })
  );
}

async function createClan({
  ownerId,
  name,
  description,
  gameId,
  maxMembers,
  isPublic
}) {
  const {
    data: clan,
    error
  } = await supabase
    .from('clans')
    .insert({
      name:
        name.trim(),

      owner_id:
        ownerId,

      description:
        description
          .trim() ||
        null,

      game_id:
        number(gameId),

      max_members:
        number(
          maxMembers
        ),

      is_public:
        Boolean(
          isPublic
        ),

      updated_at:
        new Date()
          .toISOString()
    })
    .select()
    .single();

  if (error) throw error;

  const {
    error: memberError
  } = await supabase
    .from('clan_members')
    .insert({
      clan_id:
        clan.id,

      user_id:
        ownerId,

      role:
        'owner'
    });

  if (memberError) {
    throw memberError;
  }

  return clan;
}

async function joinClan({
  clanId,
  userId
}) {
  const {
    data: existing,
    error: existingError
  } = await supabase
    .from('clan_members')
    .select(`
      clan_id,
      user_id
    `)
    .eq(
      'clan_id',
      clanId
    )
    .eq(
      'user_id',
      userId
    )
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    throw new Error(
      'You are already in this clan.'
    );
  }

  const {
    data: clan,
    error: clanError
  } = await supabase
    .from('clan_details')
    .select('*')
    .eq(
      'id',
      clanId
    )
    .single();

  if (clanError) {
    throw clanError;
  }

  if (
    !clan.is_public
  ) {
    throw new Error(
      'This clan is private.'
    );
  }

  if (
    number(
      clan.member_count
    ) >=
    number(
      clan.max_members
    )
  ) {
    throw new Error(
      'This clan is full.'
    );
  }

  const { error } =
    await supabase
      .from('clan_members')
      .insert({
        clan_id:
          clanId,

        user_id:
          userId,

        role:
          'member'
      });

  if (error) throw error;
}

async function leaveClan({
  clanId,
  userId
}) {
  const { error } =
    await supabase
      .from('clan_members')
      .delete()
      .eq(
        'clan_id',
        clanId
      )
      .eq(
        'user_id',
        userId
      );

  if (error) throw error;
}

async function updateClan(
  clanId,
  updates
) {
  const { error } =
    await supabase
      .from('clans')
      .update({
        ...updates,

        updated_at:
          new Date()
            .toISOString()
      })
      .eq(
        'id',
        clanId
      );

  if (error) throw error;
}

async function deleteClan(
  clanId
) {
  const { error } =
    await supabase
      .from('clans')
      .delete()
      .eq(
        'id',
        clanId
      );

  if (error) throw error;
}


/* =========================================================
   AUTH
========================================================= */

function Auth() {
  const [
    mode,
    setMode
  ] = useState(
    'login'
  );

  const [
    email,
    setEmail
  ] = useState('');

  const [
    password,
    setPassword
  ] = useState('');

  const [
    username,
    setUsername
  ] = useState('');

  const [
    displayName,
    setDisplayName
  ] = useState('');

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    msg,
    setMsg
  ] = useState('');

  async function submit(e) {
    e.preventDefault();

    setBusy(true);
    setMsg('');

    try {
      if (
        mode ===
        'login'
      ) {
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

        setMode(
          'login'
        );
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

        <form
          onSubmit={
            submit
          }
        >

          {mode ===
            'signup' && (
            <>

              <label>
                Username

                <input
                  value={
                    username
                  }
                  onChange={
                    e =>
                      setUsername(
                        e.target
                          .value
                      )
                  }
                  required
                />
              </label>

              <label>
                Display name

                <input
                  value={
                    displayName
                  }
                  onChange={
                    e =>
                      setDisplayName(
                        e.target
                          .value
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
              value={
                email
              }
              onChange={
                e =>
                  setEmail(
                    e.target
                      .value
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
              value={
                password
              }
              onChange={
                e =>
                  setPassword(
                    e.target
                      .value
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
              : mode ===
                  'login'
              ? 'Sign In'
              : 'Create Account'}
          </button>

        </form>

        <button
          className="text-button"
          onClick={() => {
            setMode(
              mode ===
                'login'
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
    Math.max(
      ...vals
    );

  const min =
    Math.min(
      ...vals
    );

  return (
    <div className="chart">

      <div className="bars">

        {vals.map(
          (
            value,
            index
          ) => (

            <div
              className="barwrap"
              key={index}
            >

              <div
                className="bar"
                style={{
                  height: `${
                    28 +
                    (
                      (
                        value -
                        min
                      ) /
                      (
                        max -
                        min
                      )
                    ) *
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
    profile
      ?.display_name ||
    profile
      ?.username ||
    user
      ?.user_metadata
      ?.display_name ||
    user
      ?.user_metadata
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

          {profile
            ?.title && (
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
            setPage(
              'stats'
            )
          }
        >
          <BarChart3
            size={17}
          />

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
            <Crown
              size={34}
            />
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
                width:
                  '0%'
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
              setPage(
                'stats'
              )
            }
          >
            See all

            <ChevronRight
              size={16}
            />
          </button>

        </div>

        <div className="gamegrid">

          {gameStats.map(
            game => (

              <button
                key={
                  game.id
                }
                onClick={() =>
                  openGame(
                    game
                  )
                }
                style={{
                  all:
                    'unset',

                  cursor:
                    'pointer',

                  display:
                    'block'
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

            )
          )}

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
                <th>
                  Game
                </th>

                <th>
                  Games
                </th>

                <th>
                  Wins
                </th>

                <th>
                  Win Rate
                </th>

                <th>
                  Kills
                </th>

                <th>
                  Deaths
                </th>

                <th>
                  K/D
                </th>

                <th>
                  KPG
                </th>
              </tr>

            </thead>

            <tbody>

              {gameStats.map(
                game => (

                  <tr
                    key={
                      game.id
                    }
                    onClick={() =>
                      openGame(
                        game
                      )
                    }
                    style={{
                      cursor:
                        'pointer'
                    }}
                  >

                    <td>
                      <b>
                        {game.name}
                      </b>
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

                )
              )}

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
  if (!game) {
    return null;
  }

  return (
    <div className="page">

      <button
        className="linkbtn"
        onClick={back}
      >
        <ChevronLeft
          size={18}
        />

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
            display:
              'flex',

            gap:
              '18px',

            alignItems:
              'center'
          }}
        >

          <div
            className="glogo"
            style={{
              width:
                '72px',

              height:
                '72px'
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
  const [
    overallRows,
    setOverallRows
  ] = useState([]);

  const [
    gameRows,
    setGameRows
  ] = useState([]);

  const [
    gameFilter,
    setGameFilter
  ] = useState(
    'Overall'
  );

  const [
    metric,
    setMetric
  ] = useState(
    'kills'
  );

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState('');

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

        setOverallRows(
          overall
        );

        setGameRows(
          byGame
        );

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

  const rows =
    useMemo(() => {
      let source;

      if (
        gameFilter ===
        'Overall'
      ) {
        source = [
          ...overallRows
        ];

      } else {
        source =
          gameRows.filter(
            row =>
              row.game_name ===
              gameFilter
          );
      }

      return source.sort(
        (a, b) =>
          number(
            b[metric]
          ) -
          number(
            a[metric]
          )
      );

    }, [
      overallRows,
      gameRows,
      gameFilter,
      metric
    ]);

  function metricValue(
    row
  ) {
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
    if (
      metric === 'kills'
    ) {
      return 'KILLS';
    }

    if (
      metric === 'wins'
    ) {
      return 'WINS';
    }

    if (
      metric === 'kd'
    ) {
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

          {games.map(
            game => (

              <button
                key={
                  game
                }
                className={
                  gameFilter ===
                  game
                    ? 'active'
                    : ''
                }
                onClick={() =>
                  setGameFilter(
                    game
                  )
                }
              >
                {game}
              </button>

            )
          )}

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
              metric ===
              'kills'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric(
                'kills'
              )
            }
          >
            Kills
          </button>

          <button
            className={
              metric ===
              'wins'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric(
                'wins'
              )
            }
          >
            Wins
          </button>

          <button
            className={
              metric ===
              'kd'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric(
                'kd'
              )
            }
          >
            K/D
          </button>

          <button
            className={
              metric ===
              'kpg'
                ? 'active'
                : ''
            }
            onClick={() =>
              setMetric(
                'kpg'
              )
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

        ) : rows.length ===
          0 ? (

          <p className="muted">
            No ranked players yet.
          </p>

        ) : (

          <div>

            {rows.map(
              (
                row,
                index
              ) => {

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
                        minWidth:
                          '40px',

                        fontWeight:
                          '800',

                        fontSize:
                          '18px'
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
                        flex:
                          1
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
                        {metricValue(
                          row
                        )}
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

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    error,
    setError
  ] = useState('');

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

      setAchievements(
        rows
      );

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
      (
        sum,
        achievement
      ) =>
        sum +
        number(
          achievement
            .points
        ),
      0
    );

  const totalPossiblePoints =
    achievements.reduce(
      (
        sum,
        achievement
      ) =>
        sum +
        number(
          achievement
            .points
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
        supported:
          false,

        percent:
          0,

        label:
          'Match-history tracking required'
      };
    }

    const current =
      number(
        rule.getValue(
          totals
        )
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
      supported:
        true,

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

          <Award
            size={18}
          />

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
                  key={
                    achievement.id
                  }
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
                      flex:
                        1
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
                      fontSize:
                        '22px'
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
   CHALLENGES PAGE
========================================================= */

function ChallengesPage({
  user
}) {
  const [
    games,
    setGames
  ] = useState([]);

  const [
    friends,
    setFriends
  ] = useState([]);

  const [
    challenges,
    setChallenges
  ] = useState([]);

  const [
    opponentId,
    setOpponentId
  ] = useState('');

  const [
    gameId,
    setGameId
  ] = useState('');

  const [
    metric,
    setMetric
  ] = useState(
    'kills'
  );

  const [
    target,
    setTarget
  ] = useState(
    '100'
  );

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState('');

  async function load() {
    setLoading(true);

    try {
      const [
        gameList,
        friendshipData,
        challengeRows
      ] = await Promise.all([
        getGames(),

        getFriendships(
          user.id
        ),

        getChallenges(
          user.id
        )
      ]);

      setGames(
        gameList
      );

      setFriends(
        friendshipData
          .friends
      );

      setChallenges(
        challengeRows
      );

      if (
        !gameId &&
        gameList.length
      ) {
        setGameId(
          String(
            gameList[0].id
          )
        );
      }

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load challenges.'
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user.id]);

  async function submitChallenge(
    e
  ) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      if (
        !opponentId
      ) {
        throw new Error(
          'Choose a friend to challenge.'
        );
      }

      if (!gameId) {
        throw new Error(
          'Choose a game.'
        );
      }

      if (
        number(
          target
        ) <= 0
      ) {
        throw new Error(
          'Target must be greater than zero.'
        );
      }

      await createChallenge({
        creatorId:
          user.id,

        opponentId,

        gameId:
          number(
            gameId
          ),

        metric,

        target:
          number(
            target
          )
      });

      await load();

      setMessage(
        'Challenge sent.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not create challenge.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function accept(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await acceptChallenge(
        row
      );

      await load();

      setMessage(
        'Challenge accepted.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not accept challenge.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function decline(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await declineChallenge(
        row.id
      );

      await load();

      setMessage(
        'Challenge declined.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not decline challenge.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function cancel(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await cancelChallenge(
        row.id
      );

      await load();

      setMessage(
        'Challenge cancelled.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not cancel challenge.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function refreshAll() {
    setBusy(true);
    setMessage('');

    try {
      const active =
        challenges.filter(
          row =>
            row.status ===
            'active'
        );

      for (
        const challenge
        of active
      ) {
        await refreshChallenge(
          challenge
        );
      }

      await load();

      setMessage(
        'Challenge progress refreshed.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not refresh challenge progress.'
      );

    } finally {
      setBusy(false);
    }
  }

  const incoming =
    challenges.filter(
      row =>
        row.status ===
          'pending' &&
        row.opponent_id ===
          user.id
    );

  const sent =
    challenges.filter(
      row =>
        row.status ===
          'pending' &&
        row.creator_id ===
          user.id
    );

  const active =
    challenges.filter(
      row =>
        row.status ===
        'active'
    );

  const completed =
    challenges.filter(
      row =>
        row.status ===
        'completed'
    );

  function opponentName(
    row
  ) {
    if (
      row.creator_id ===
      user.id
    ) {
      return (
        row.opponent_display_name ||
        row.opponent_username ||
        'Player'
      );
    }

    return (
      row.creator_display_name ||
      row.creator_username ||
      'Player'
    );
  }

  function challengeCard(
    row
  ) {
    const targetValue =
      Math.max(
        1,
        number(
          row.target
        )
      );

    const myProgress =
      row.creator_id ===
      user.id
        ? number(
            row
              .creator_progress
          )
        : number(
            row
              .opponent_progress
          );

    const theirProgress =
      row.creator_id ===
      user.id
        ? number(
            row
              .opponent_progress
          )
        : number(
            row
              .creator_progress
          );

    const myPercent =
      Math.min(
        100,
        (
          myProgress /
          targetValue
        ) * 100
      );

    const theirPercent =
      Math.min(
        100,
        (
          theirProgress /
          targetValue
        ) * 100
      );

    const name =
      opponentName(
        row
      );

    const iWon =
      row.status ===
        'completed' &&
      row.winner_id ===
        user.id;

    return (
      <div
        className="panel"
        key={row.id}
        style={{
          marginBottom:
            '16px'
        }}
      >

        <div className="panel-head">

          <div>

            <div className="eyebrow">
              {row.game_name ||
                'GAME'}
            </div>

            <h2>
              You vs {name}
            </h2>

            <span>
              First to{' '}
              {formatNumber(
                row.target
              )}{' '}
              {challengeMetricLabel(
                row.metric
              )}
            </span>

          </div>

          <span className="pill">
            {String(
              row.status
            ).toUpperCase()}
          </span>

        </div>

        {row.status ===
          'active' && (
          <>

            <div
              style={{
                marginBottom:
                  '16px'
              }}
            >

              <div className="progress-label">

                <span>
                  You:{' '}
                  {formatNumber(
                    myProgress
                  )}
                </span>

                <span>
                  {formatNumber(
                    row.target
                  )}
                </span>

              </div>

              <div className="progress">

                <i
                  style={{
                    width:
                      `${myPercent}%`
                  }}
                />

              </div>

            </div>

            <div>

              <div className="progress-label">

                <span>
                  {name}:{' '}
                  {formatNumber(
                    theirProgress
                  )}
                </span>

                <span>
                  {formatNumber(
                    row.target
                  )}
                </span>

              </div>

              <div className="progress">

                <i
                  style={{
                    width:
                      `${theirPercent}%`
                  }}
                />

              </div>

            </div>

          </>
        )}

        {row.status ===
          'completed' && (
          <div
            className="notice"
            style={{
              marginTop:
                '12px'
            }}
          >
            {iWon
              ? '🏆 You won this challenge!'
              : `Challenge won by ${name}.`}
          </div>
        )}

      </div>
    );
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            LIVE CHALLENGES
          </div>

          <h1>
            Challenges
          </h1>

          <p>
            Challenge friends and race toward a competitive target.
          </p>

        </div>

        <button
          className="primary"
          onClick={
            refreshAll
          }
          disabled={busy}
        >
          <RefreshCw
            size={17}
          />

          Refresh
        </button>

      </div>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Create Challenge
            </h2>

            <span>
              Challenge an accepted FragRank friend
            </span>

          </div>

        </div>

        {friends.length ===
          0 ? (

          <p className="muted">
            Add at least one friend before creating a challenge.
          </p>

        ) : (

          <form
            onSubmit={
              submitChallenge
            }
          >

            <label>
              Opponent

              <select
                value={
                  opponentId
                }
                onChange={
                  e =>
                    setOpponentId(
                      e.target.value
                    )
                }
                required
              >

                <option value="">
                  Choose friend
                </option>

                {friends.map(
                  item => (
                    <option
                      key={
                        item.profile
                          .id
                      }
                      value={
                        item.profile
                          .id
                      }
                    >
                      {getPlayerName(
                        item.profile
                      )}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              Game

              <select
                value={
                  gameId
                }
                onChange={
                  e =>
                    setGameId(
                      e.target.value
                    )
                }
                required
              >

                {games.map(
                  game => (
                    <option
                      key={
                        game.id
                      }
                      value={
                        game.id
                      }
                    >
                      {game.name}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              Stat

              <select
                value={
                  metric
                }
                onChange={
                  e =>
                    setMetric(
                      e.target.value
                    )
                }
              >

                {challengeMetricOptions.map(
                  option => (
                    <option
                      key={
                        option.value
                      }
                      value={
                        option.value
                      }
                    >
                      {option.label}
                    </option>
                  )
                )}

              </select>

            </label>

            <label>
              Target

              <input
                type="number"
                min="1"
                step="1"
                value={
                  target
                }
                onChange={
                  e =>
                    setTarget(
                      e.target.value
                    )
                }
                required
              />
            </label>

            <button
              className="primary"
              disabled={busy}
            >
              <Zap
                size={17}
              />

              Send Challenge
            </button>

          </form>

        )}

      </section>

      {incoming.length >
        0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Incoming Challenges
            </h2>

            <span className="pill">
              {incoming.length}
            </span>

          </div>

          {incoming.map(
            row => (

              <div
                className="friend"
                key={
                  row.id
                }
              >

                <div className="avatar">
                  {(
                    row.creator_display_name ||
                    row.creator_username ||
                    'P'
                  )[0].toUpperCase()}
                </div>

                <div
                  style={{
                    flex:
                      1
                  }}
                >

                  <b>
                    {row.creator_display_name ||
                      row.creator_username ||
                      'Player'}
                  </b>

                  <small>
                    {row.game_name} • First to{' '}
                    {formatNumber(
                      row.target
                    )}{' '}
                    {challengeMetricLabel(
                      row.metric
                    )}
                  </small>

                </div>

                <button
                  className="primary"
                  onClick={() =>
                    accept(
                      row
                    )
                  }
                  disabled={busy}
                >
                  <Check
                    size={16}
                  />

                  Accept
                </button>

                <button
                  className="iconbtn"
                  onClick={() =>
                    decline(
                      row
                    )
                  }
                  disabled={busy}
                >
                  <X
                    size={16}
                  />
                </button>

              </div>

            )
          )}

        </section>

      )}

      {active.length >
        0 && (

        <section>

          <div
            className="panel-head"
            style={{
              marginBottom:
                '14px'
            }}
          >

            <div>

              <h2>
                Active Challenges
              </h2>

              <span>
                Progress begins when the challenge is accepted
              </span>

            </div>

          </div>

          {active.map(
            challengeCard
          )}

        </section>

      )}

      {sent.length >
        0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Sent Challenges
            </h2>

          </div>

          {sent.map(
            row => (

              <div
                className="friend"
                key={
                  row.id
                }
              >

                <div className="avatar">
                  {(
                    row.opponent_display_name ||
                    row.opponent_username ||
                    'P'
                  )[0].toUpperCase()}
                </div>

                <div
                  style={{
                    flex:
                      1
                  }}
                >

                  <b>
                    {row.opponent_display_name ||
                      row.opponent_username ||
                      'Player'}
                  </b>

                  <small>
                    Pending • {row.game_name}
                  </small>

                </div>

                <button
                  className="logout"
                  onClick={() =>
                    cancel(
                      row
                    )
                  }
                  disabled={busy}
                >
                  Cancel
                </button>

              </div>

            )
          )}

        </section>

      )}

      {completed.length >
        0 && (

        <section>

          <div
            className="panel-head"
            style={{
              marginBottom:
                '14px'
            }}
          >

            <h2>
              Completed Challenges
            </h2>

          </div>

          {completed.map(
            challengeCard
          )}

        </section>

      )}

      {!loading &&
        challenges.length ===
          0 && (

        <section className="panel coming">

          <Zap
            size={44}
          />

          <h2>
            No challenges yet
          </h2>

          <p>
            Create your first challenge against a FragRank friend.
          </p>

        </section>

      )}

      {loading && (

        <section className="panel">

          <p className="muted">
            Loading challenges…
          </p>

        </section>

      )}

    </div>
  );
}


/* =========================================================
   TOURNAMENTS PAGE
========================================================= */

function TournamentsPage({
  user
}) {
  const [
    tournaments,
    setTournaments
  ] = useState([]);

  const [
    memberships,
    setMemberships
  ] = useState([]);

  const [
    games,
    setGames
  ] = useState([]);

  const [
    selectedTournament,
    setSelectedTournament
  ] = useState(null);

  const [
    players,
    setPlayers
  ] = useState([]);

  const [
    name,
    setName
  ] = useState('');

  const [
    description,
    setDescription
  ] = useState('');

  const [
    gameId,
    setGameId
  ] = useState('');

  const [
    maxPlayers,
    setMaxPlayers
  ] = useState('8');

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState('');

  async function load() {
    setLoading(true);

    try {
      const [
        tournamentRows,
        membershipRows,
        gameRows
      ] = await Promise.all([
        getTournamentDetails(),

        getMyTournamentMemberships(
          user.id
        ),

        getGames()
      ]);

      setTournaments(
        tournamentRows
      );

      setMemberships(
        membershipRows
      );

      setGames(
        gameRows
      );

      if (
        !gameId &&
        gameRows.length
      ) {
        setGameId(
          String(
            gameRows[0].id
          )
        );
      }

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load tournaments.'
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user.id]);

  function isJoined(
    tournamentId
  ) {
    return memberships.some(
      membership =>
        membership
          .tournament_id ===
        tournamentId
    );
  }

  async function create(
    e
  ) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      if (!name.trim()) {
        throw new Error(
          'Enter a tournament name.'
        );
      }

      if (!gameId) {
        throw new Error(
          'Choose a game.'
        );
      }

      await createTournament({
        creatorId:
          user.id,

        name,

        description,

        gameId:
          number(
            gameId
          ),

        maxPlayers:
          number(
            maxPlayers
          )
      });

      setName('');
      setDescription('');
      setMaxPlayers(
        '8'
      );

      await load();

      setMessage(
        'Tournament created.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not create tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function openTournament(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      const result =
        await getTournamentPlayers(
          row.id
        );

      setSelectedTournament(
        row
      );

      setPlayers(
        result
      );

      window.scrollTo({
        top:
          0,

        behavior:
          'smooth'
      });

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function join(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await joinTournament({
        tournamentId:
          row.id,

        userId:
          user.id
      });

      await load();

      setMessage(
        `You joined ${row.name}.`
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not join tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function leave(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      if (
        row.creator_id ===
        user.id
      ) {
        throw new Error(
          'The tournament creator cannot leave. Delete the tournament instead.'
        );
      }

      await leaveTournament({
        tournamentId:
          row.id,

        userId:
          user.id
      });

      setSelectedTournament(
        null
      );

      setPlayers([]);

      await load();

      setMessage(
        `You left ${row.name}.`
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not leave tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function start(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      if (
        number(
          row.player_count
        ) < 2
      ) {
        throw new Error(
          'At least 2 players are required to start.'
        );
      }

      await updateTournamentStatus(
        row.id,
        'active'
      );

      await load();

      setSelectedTournament({
        ...row,
        status:
          'active'
      });

      setMessage(
        'Tournament started.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not start tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function complete(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await updateTournamentStatus(
        row.id,
        'completed'
      );

      await load();

      setSelectedTournament({
        ...row,
        status:
          'completed'
      });

      setMessage(
        'Tournament completed.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not complete tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function remove(
    row
  ) {
    const confirmed =
      window.confirm(
        `Delete "${row.name}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await deleteTournament(
        row.id
      );

      setSelectedTournament(
        null
      );

      setPlayers([]);

      await load();

      setMessage(
        'Tournament deleted.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not delete tournament.'
      );

    } finally {
      setBusy(false);
    }
  }

  if (
    selectedTournament
  ) {
    const row =
      selectedTournament;

    const creator =
      row.creator_id ===
      user.id;

    const joined =
      isJoined(
        row.id
      );

    const full =
      number(
        row.player_count
      ) >=
      number(
        row.max_players
      );

    return (
      <div className="page">

        <button
          className="linkbtn"
          onClick={() => {
            setSelectedTournament(
              null
            );

            setPlayers([]);
          }}
        >
          <ChevronLeft
            size={18}
          />

          Back to Tournaments
        </button>

        <div className="page-head">

          <div>

            <div className="eyebrow">
              LIVE TOURNAMENT
            </div>

            <h1>
              {row.name}
            </h1>

            <p>
              {row.game_name ||
                'FragRank Tournament'}
            </p>

          </div>

          <span className="pill">
            {String(
              row.status
            ).toUpperCase()}
          </span>

        </div>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <div className="stats">

          <Stat
            icon={Users}
            label="Players"
            value={`${formatNumber(
              row.player_count
            )} / ${formatNumber(
              row.max_players
            )}`}
          />

          <Stat
            icon={Gamepad2}
            label="Game"
            value={
              row.game_name ||
              'Game'
            }
          />

          <Stat
            icon={Crown}
            label="Host"
            value={
              row.creator_display_name ||
              row.creator_username ||
              'Player'
            }
          />

          <Stat
            icon={Trophy}
            label="Status"
            value={String(
              row.status
            ).toUpperCase()}
          />

        </div>

        {row.description && (

          <section className="panel">

            <h2>
              About
            </h2>

            <p>
              {row.description}
            </p>

          </section>

        )}

        <section className="panel">

          <div className="panel-head">

            <div>

              <h2>
                Tournament Players
              </h2>

              <span>
                {formatNumber(
                  players.length
                )} players
              </span>

            </div>

          </div>

          {players.length ===
            0 ? (

            <p className="muted">
              No players yet.
            </p>

          ) : (

            players.map(
              (
                item,
                index
              ) => {

                const player =
                  item.profile;

                const playerName =
                  player
                    ?.display_name ||
                  player
                    ?.username ||
                  'Player';

                return (
                  <div
                    className="friend"
                    key={
                      item.user_id
                    }
                  >

                    <div
                      style={{
                        minWidth:
                          '35px',

                        fontWeight:
                          '800'
                      }}
                    >
                      #{item.seed ||
                        index + 1}
                    </div>

                    <div className="avatar">
                      {playerName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div
                      style={{
                        flex:
                          1
                      }}
                    >

                      <b>
                        {playerName}
                      </b>

                      <small>
                        @{player
                          ?.username ||
                          'player'}
                      </small>

                    </div>

                  </div>
                );
              }
            )

          )}

        </section>

        <section className="panel">

          <div className="panel-head">

            <h2>
              Tournament Actions
            </h2>

          </div>

          <div
            style={{
              display:
                'flex',

              flexWrap:
                'wrap',

              gap:
                '10px'
            }}
          >

            {!joined &&
              row.status ===
                'open' &&
              !full && (

              <button
                className="primary"
                onClick={() =>
                  join(
                    row
                  )
                }
                disabled={busy}
              >
                <UserPlus
                  size={17}
                />

                Join Tournament
              </button>

            )}

            {joined &&
              !creator &&
              row.status ===
                'open' && (

              <button
                className="logout"
                onClick={() =>
                  leave(
                    row
                  )
                }
                disabled={busy}
              >
                Leave Tournament
              </button>

            )}

            {creator &&
              row.status ===
                'open' && (

              <button
                className="primary"
                onClick={() =>
                  start(
                    row
                  )
                }
                disabled={busy}
              >
                <Trophy
                  size={17}
                />

                Start Tournament
              </button>

            )}

            {creator &&
              row.status ===
                'active' && (

              <button
                className="primary"
                onClick={() =>
                  complete(
                    row
                  )
                }
                disabled={busy}
              >
                <Check
                  size={17}
                />

                Complete Tournament
              </button>

            )}

            {creator && (

              <button
                className="logout"
                onClick={() =>
                  remove(
                    row
                  )
                }
                disabled={busy}
              >
                Delete Tournament
              </button>

            )}

          </div>

        </section>

      </div>
    );
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            LIVE TOURNAMENTS
          </div>

          <h1>
            Tournaments
          </h1>

          <p>
            Create competitions and compete against FragRank players.
          </p>

        </div>

        <button
          className="primary"
          onClick={
            load
          }
          disabled={busy}
        >
          <RefreshCw
            size={17}
          />

          Refresh
        </button>

      </div>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Create Tournament
            </h2>

            <span>
              Create a competitive FragRank event
            </span>

          </div>

        </div>

        <form
          onSubmit={
            create
          }
        >

          <label>
            Tournament Name

            <input
              value={
                name
              }
              onChange={
                e =>
                  setName(
                    e.target.value
                  )
              }
              placeholder="Example: FragRank Showdown"
              required
            />
          </label>

          <label>
            Description

            <input
              value={
                description
              }
              onChange={
                e =>
                  setDescription(
                    e.target.value
                  )
              }
              placeholder="Tell players about the tournament"
            />
          </label>

          <label>
            Game

            <select
              value={
                gameId
              }
              onChange={
                e =>
                  setGameId(
                    e.target.value
                  )
              }
              required
            >

              {games.map(
                game => (

                  <option
                    key={
                      game.id
                    }
                    value={
                      game.id
                    }
                  >
                    {game.name}
                  </option>

                )
              )}

            </select>

          </label>

          <label>
            Maximum Players

            <select
              value={
                maxPlayers
              }
              onChange={
                e =>
                  setMaxPlayers(
                    e.target.value
                  )
              }
            >

              <option value="2">
                2 Players
              </option>

              <option value="4">
                4 Players
              </option>

              <option value="8">
                8 Players
              </option>

              <option value="16">
                16 Players
              </option>

              <option value="32">
                32 Players
              </option>

            </select>

          </label>

          <button
            className="primary"
            disabled={busy}
          >
            <Trophy
              size={17}
            />

            Create Tournament
          </button>

        </form>

      </section>

      {loading ? (

        <section className="panel">

          <p className="muted">
            Loading tournaments…
          </p>

        </section>

      ) : tournaments.length ===
        0 ? (

        <section className="panel coming">

          <Trophy
            size={44}
          />

          <h2>
            No tournaments yet
          </h2>

          <p>
            Create the first FragRank tournament.
          </p>

        </section>

      ) : (

        tournaments.map(
          row => {

            const joined =
              isJoined(
                row.id
              );

            const full =
              number(
                row.player_count
              ) >=
              number(
                row.max_players
              );

            return (
              <section
                className="panel"
                key={
                  row.id
                }
                style={{
                  marginBottom:
                    '16px'
                }}
              >

                <div className="panel-head">

                  <div>

                    <div className="eyebrow">
                      {row.game_name ||
                        'TOURNAMENT'}
                    </div>

                    <h2>
                      {row.name}
                    </h2>

                    <span>
                      {formatNumber(
                        row.player_count
                      )} / {formatNumber(
                        row.max_players
                      )} players
                    </span>

                  </div>

                  <span className="pill">
                    {String(
                      row.status
                    ).toUpperCase()}
                  </span>

                </div>

                {row.description && (
                  <p>
                    {row.description}
                  </p>
                )}

                <div
                  className="friend"
                  style={{
                    marginTop:
                      '12px'
                  }}
                >

                  <div className="avatar">

                    <Trophy
                      size={18}
                    />

                  </div>

                  <div
                    style={{
                      flex:
                        1
                    }}
                  >

                    <b>
                      {row.creator_display_name ||
                        row.creator_username ||
                        'Player'}
                    </b>

                    <small>
                      Host • {full
                        ? 'Tournament full'
                        : `${Math.max(
                            0,
                            number(
                              row.max_players
                            ) -
                            number(
                              row.player_count
                            )
                          )} spots remaining`}
                    </small>

                  </div>

                  {joined && (
                    <span className="pill">
                      JOINED
                    </span>
                  )}

                  {row.creator_id ===
                    user.id && (
                    <span className="pill">
                      HOST
                    </span>
                  )}

                </div>

                <div
                  style={{
                    display:
                      'flex',

                    flexWrap:
                      'wrap',

                    gap:
                      '10px',

                    marginTop:
                      '14px'
                  }}
                >

                  <button
                    className="primary"
                    onClick={() =>
                      openTournament(
                        row
                      )
                    }
                    disabled={busy}
                  >
                    View Tournament

                    <ChevronRight
                      size={16}
                    />
                  </button>

                  {!joined &&
                    row.status ===
                      'open' &&
                    !full && (

                    <button
                      className="linkbtn"
                      onClick={() =>
                        join(
                          row
                        )
                      }
                      disabled={busy}
                    >
                      <UserPlus
                        size={16}
                      />

                      Join
                    </button>

                  )}

                </div>

              </section>
            );
          }
        )

      )}

    </div>
  );
}


/* =========================================================
   CLANS PAGE
========================================================= */

function ClansPage({
  user
}) {
  const [
    clans,
    setClans
  ] = useState([]);

  const [
    memberships,
    setMemberships
  ] = useState([]);

  const [
    games,
    setGames
  ] = useState([]);

  const [
    selectedClan,
    setSelectedClan
  ] = useState(null);

  const [
    clanMembers,
    setClanMembers
  ] = useState([]);

  const [
    name,
    setName
  ] = useState('');

  const [
    description,
    setDescription
  ] = useState('');

  const [
    gameId,
    setGameId
  ] = useState('');

  const [
    maxMembers,
    setMaxMembers
  ] = useState(
    '25'
  );

  const [
    isPublic,
    setIsPublic
  ] = useState(true);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    busy,
    setBusy
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState('');

  async function load() {
    setLoading(true);

    try {
      const [
        clanRows,
        membershipRows,
        gameRows
      ] = await Promise.all([
        getClanDetails(),

        getMyClanMemberships(
          user.id
        ),

        getGames()
      ]);

      setClans(
        clanRows
      );

      setMemberships(
        membershipRows
      );

      setGames(
        gameRows
      );

      if (
        !gameId &&
        gameRows.length
      ) {
        setGameId(
          String(
            gameRows[0].id
          )
        );
      }

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load clans.'
      );

    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [user.id]);

  function isMember(
    clanId
  ) {
    return memberships.some(
      membership =>
        membership.clan_id ===
        clanId
    );
  }

  function myRole(
    clanId
  ) {
    return memberships.find(
      membership =>
        membership.clan_id ===
        clanId
    )?.role;
  }

  async function create(
    e
  ) {
    e.preventDefault();

    setBusy(true);
    setMessage('');

    try {
      if (!name.trim()) {
        throw new Error(
          'Enter a clan name.'
        );
      }

      if (!gameId) {
        throw new Error(
          'Choose a primary game.'
        );
      }

      if (
        number(
          maxMembers
        ) < 2
      ) {
        throw new Error(
          'A clan needs at least 2 member slots.'
        );
      }

      await createClan({
        ownerId:
          user.id,

        name,

        description,

        gameId:
          number(
            gameId
          ),

        maxMembers:
          number(
            maxMembers
          ),

        isPublic
      });

      setName('');
      setDescription('');

      setMaxMembers(
        '25'
      );

      setIsPublic(
        true
      );

      await load();

      setMessage(
        'Clan created successfully.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not create clan.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function join(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      await joinClan({
        clanId:
          row.id,

        userId:
          user.id
      });

      await load();

      setMessage(
        `You joined ${row.name}.`
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not join clan.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function leave(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      if (
        row.owner_id ===
        user.id
      ) {
        throw new Error(
          'The clan owner cannot leave. Delete the clan instead.'
        );
      }

      await leaveClan({
        clanId:
          row.id,

        userId:
          user.id
      });

      setSelectedClan(
        null
      );

      setClanMembers(
        []
      );

      await load();

      setMessage(
        `You left ${row.name}.`
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not leave clan.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function openClan(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      const members =
        await getClanMembers(
          row.id
        );

      setSelectedClan(
        row
      );

      setClanMembers(
        members
      );

      window.scrollTo({
        top:
          0,

        behavior:
          'smooth'
      });

    } catch (error) {
      setMessage(
        error.message ||
        'Could not load clan members.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function togglePrivacy(
    row
  ) {
    setBusy(true);
    setMessage('');

    try {
      const nextValue =
        !row.is_public;

      await updateClan(
        row.id,
        {
          is_public:
            nextValue
        }
      );

      setSelectedClan({
        ...row,

        is_public:
          nextValue
      });

      await load();

      setMessage(
        nextValue
          ? 'Clan is now public.'
          : 'Clan is now private.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not update clan.'
      );

    } finally {
      setBusy(false);
    }
  }

  async function removeClan(
    row
  ) {
    const confirmed =
      window.confirm(
        `Delete "${row.name}"? This cannot be undone.`
      );

    if (!confirmed) {
      return;
    }

    setBusy(true);
    setMessage('');

    try {
      await deleteClan(
        row.id
      );

      setSelectedClan(
        null
      );

      setClanMembers(
        []
      );

      await load();

      setMessage(
        'Clan deleted.'
      );

    } catch (error) {
      setMessage(
        error.message ||
        'Could not delete clan.'
      );

    } finally {
      setBusy(false);
    }
  }

  if (selectedClan) {
    const row =
      selectedClan;

    const owner =
      row.owner_id ===
      user.id;

    const joined =
      isMember(
        row.id
      );

    const full =
      number(
        row.member_count
      ) >=
      number(
        row.max_members
      );

    return (
      <div className="page">

        <button
          className="linkbtn"
          onClick={() => {
            setSelectedClan(
              null
            );

            setClanMembers(
              []
            );
          }}
        >
          <ChevronLeft
            size={18}
          />

          Back to Clans
        </button>

        <div className="page-head">

          <div>

            <div className="eyebrow">
              LIVE CLAN
            </div>

            <h1>
              {row.name}
            </h1>

            <p>
              {row.game_name ||
                'FragRank Clan'}
            </p>

          </div>

          <span className="pill">
            {row.is_public
              ? 'PUBLIC'
              : 'PRIVATE'}
          </span>

        </div>

        {message && (
          <div className="notice">
            {message}
          </div>
        )}

        <div className="stats">

          <Stat
            icon={Users}
            label="Members"
            value={`${formatNumber(
              row.member_count
            )} / ${formatNumber(
              row.max_members
            )}`}
          />

          <Stat
            icon={Gamepad2}
            label="Primary Game"
            value={
              row.game_name ||
              'Game'
            }
          />

          <Stat
            icon={Crown}
            label="Owner"
            value={
              row.owner_display_name ||
              row.owner_username ||
              'Player'
            }
          />

          <Stat
            icon={Shield}
            label="Your Role"
            value={
              owner
                ? 'OWNER'
                : (
                    myRole(
                      row.id
                    ) ||
                    'MEMBER'
                  ).toUpperCase()
            }
          />

        </div>

        {row.description && (

          <section className="panel">

            <h2>
              About
            </h2>

            <p>
              {row.description}
            </p>

          </section>

        )}

        <section className="panel">

          <div className="panel-head">

            <div>

              <h2>
                Clan Members
              </h2>

              <span>
                {formatNumber(
                  clanMembers.length
                )} members
              </span>

            </div>

          </div>

          {clanMembers.length ===
            0 ? (

            <p className="muted">
              No members yet.
            </p>

          ) : (

            clanMembers.map(
              member => {

                const player =
                  member.profile;

                const playerName =
                  player
                    ?.display_name ||
                  player
                    ?.username ||
                  'Player';

                return (
                  <div
                    className="friend"
                    key={
                      member.user_id
                    }
                  >

                    <div className="avatar">
                      {playerName
                        .charAt(0)
                        .toUpperCase()}
                    </div>

                    <div
                      style={{
                        flex:
                          1
                      }}
                    >

                      <b>
                        {playerName}
                      </b>

                      <small>
                        @{player
                          ?.username ||
                          'player'}
                      </small>

                    </div>

                    <span className="pill">
                      {String(
                        member.role ||
                        'member'
                      ).toUpperCase()}
                    </span>

                  </div>
                );
              }
            )

          )}

        </section>

        <section className="panel">

          <div className="panel-head">

            <h2>
              Clan Actions
            </h2>

          </div>

          <div
            style={{
              display:
                'flex',

              gap:
                '10px',

              flexWrap:
                'wrap'
            }}
          >

            {!joined &&
              row.is_public &&
              !full && (

              <button
                className="primary"
                onClick={() =>
                  join(
                    row
                  )
                }
                disabled={busy}
              >
                <UserPlus
                  size={17}
                />

                Join Clan
              </button>

            )}

            {joined &&
              !owner && (

              <button
                className="logout"
                onClick={() =>
                  leave(
                    row
                  )
                }
                disabled={busy}
              >
                Leave Clan
              </button>

            )}

            {owner && (

              <button
                className="primary"
                onClick={() =>
                  togglePrivacy(
                    row
                  )
                }
                disabled={busy}
              >
                <Shield
                  size={17}
                />

                {row.is_public
                  ? 'Make Private'
                  : 'Make Public'}
              </button>

            )}

            {owner && (

              <button
                className="logout"
                onClick={() =>
                  removeClan(
                    row
                  )
                }
                disabled={busy}
              >
                Delete Clan
              </button>

            )}

          </div>

        </section>

      </div>
    );
  }

  return (
    <div className="page">

      <div className="page-head">

        <div>

          <div className="eyebrow">
            LIVE CLANS
          </div>

          <h1>
            Clans
          </h1>

          <p>
            Build a team, recruit players, and compete together.
          </p>

        </div>

        <button
          className="primary"
          onClick={
            load
          }
          disabled={busy}
        >
          <RefreshCw
            size={17}
          />

          Refresh
        </button>

      </div>

      {message && (
        <div className="notice">
          {message}
        </div>
      )}

      <section className="panel">

        <div className="panel-head">

          <div>

            <h2>
              Create Clan
            </h2>

            <span>
              Build your FragRank team
            </span>

          </div>

        </div>

        <form
          onSubmit={
            create
          }
        >

          <label>
            Clan Name

            <input
              value={
                name
              }
              onChange={
                e =>
                  setName(
                    e.target.value
                  )
              }
              placeholder="Example: Neon Reapers"
              required
            />
          </label>

          <label>
            Description

            <input
              value={
                description
              }
              onChange={
                e =>
                  setDescription(
                    e.target.value
                  )
              }
              placeholder="Tell players about your clan"
            />
          </label>

          <label>
            Primary Game

            <select
              value={
                gameId
              }
              onChange={
                e =>
                  setGameId(
                    e.target.value
                  )
              }
              required
            >

              {games.map(
                game => (

                  <option
                    key={
                      game.id
                    }
                    value={
                      game.id
                    }
                  >
                    {game.name}
                  </option>

                )
              )}

            </select>

          </label>

          <label>
            Maximum Members

            <select
              value={
                maxMembers
              }
              onChange={
                e =>
                  setMaxMembers(
                    e.target.value
                  )
              }
            >

              <option value="5">
                5 Members
              </option>

              <option value="10">
                10 Members
              </option>

              <option value="25">
                25 Members
              </option>

              <option value="50">
                50 Members
              </option>

            </select>

          </label>

          <label>
            Clan Privacy

            <select
              value={
                isPublic
                  ? 'public'
                  : 'private'
              }
              onChange={
                e =>
                  setIsPublic(
                    e.target.value ===
                    'public'
                  )
              }
            >

              <option value="public">
                Public
              </option>

              <option value="private">
                Private
              </option>

            </select>

          </label>

          <button
            className="primary"
            disabled={busy}
          >
            <Shield
              size={17}
            />

            Create Clan
          </button>

        </form>

      </section>

      {loading ? (

        <section className="panel">

          <p className="muted">
            Loading clans…
          </p>

        </section>

      ) : clans.length ===
        0 ? (

        <section className="panel coming">

          <Shield
            size={44}
          />

          <h2>
            No clans yet
          </h2>

          <p>
            Create the first FragRank clan.
          </p>

        </section>

      ) : (

        clans.map(
          row => {

            const joined =
              isMember(
                row.id
              );

            const full =
              number(
                row.member_count
              ) >=
              number(
                row.max_members
              );

            return (
              <section
                className="panel"
                key={
                  row.id
                }
                style={{
                  marginBottom:
                    '16px'
                }}
              >

                <div className="panel-head">

                  <div>

                    <div className="eyebrow">
                      {row.game_name ||
                        'CLAN'}
                    </div>

                    <h2>
                      {row.name}
                    </h2>

                    <span>
                      Led by{' '}
                      {row.owner_display_name ||
                        row.owner_username ||
                        'Player'}
                    </span>

                  </div>

                  <span className="pill">
                    {row.is_public
                      ? 'PUBLIC'
                      : 'PRIVATE'}
                  </span>

                </div>

                {row.description && (
                  <p>
                    {row.description}
                  </p>
                )}

                <div
                  className="friend"
                  style={{
                    marginTop:
                      '12px'
                  }}
                >

                  <div className="avatar">

                    <Users
                      size={18}
                    />

                  </div>

                  <div
                    style={{
                      flex:
                        1
                    }}
                  >

                    <b>
                      {formatNumber(
                        row.member_count
                      )} / {formatNumber(
                        row.max_members
                      )} Members
                    </b>

                    <small>
                      {full
                        ? 'Clan full'
                        : `${Math.max(
                            0,
                            number(
                              row.max_members
                            ) -
                            number(
                              row.member_count
                            )
                          )} spots remaining`}
                    </small>

                  </div>

                  {joined && (
                    <span className="pill">
                      MEMBER
                    </span>
                  )}

                  {row.owner_id ===
                    user.id && (
                    <span className="pill">
                      OWNER
                    </span>
                  )}

                </div>

                <div
                  style={{
                    display:
                      'flex',

                    gap:
                      '10px',

                    flexWrap:
                      'wrap',

                    marginTop:
                      '14px'
                  }}
                >

                  <button
                    className="primary"
                    onClick={() =>
                      openClan(
                        row
                      )
                    }
                    disabled={busy}
                  >
                    View Clan

                    <ChevronRight
                      size={16}
                    />
                  </button>

                  {!joined &&
                    row.is_public &&
                    !full && (

                    <button
                      className="linkbtn"
                      onClick={() =>
                        join(
                          row
                        )
                      }
                      disabled={busy}
                    >
                      <UserPlus
                        size={16}
                      />

                      Join
                    </button>

                  )}

                </div>

              </section>
            );
          }
        )

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
  const [
    friends,
    setFriends
  ] = useState([]);

  const [
    incoming,
    setIncoming
  ] = useState([]);

  const [
    outgoing,
    setOutgoing
  ] = useState([]);

  const [
    searchText,
    setSearchText
  ] = useState('');

  const [
    searchResults,
    setSearchResults
  ] = useState([]);

  const [
    message,
    setMessage
  ] = useState('');

  const [
    loading,
    setLoading
  ] = useState(true);

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

  async function runSearch(
    e
  ) {
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

  async function addFriend(
    profile
  ) {
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
          onSubmit={
            runSearch
          }
          style={{
            display:
              'flex',

            gap:
              '10px'
          }}
        >

          <input
            value={
              searchText
            }
            onChange={
              e =>
                setSearchText(
                  e.target.value
                )
            }
            placeholder="Search players..."
            style={{
              flex:
                1
            }}
          />

          <button className="primary">

            <Search
              size={17}
            />

            Search
          </button>

        </form>

        {message && (
          <div
            className="notice"
            style={{
              marginTop:
                '15px'
            }}
          >
            {message}
          </div>
        )}

        {searchResults.map(
          profile => (

            <div
              className="friend"
              key={
                profile.id
              }
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
                  addFriend(
                    profile
                  )
                }
              >
                <UserPlus
                  size={16}
                />

                Add
              </button>

            </div>

          )
        )}

      </section>

      {incoming.length >
        0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Friend Requests
            </h2>

            <span className="pill">
              {incoming.length}
            </span>

          </div>

          {incoming.map(
            item => {

              const friendProfile =
                item.profile;

              return (
                <div
                  className="friend"
                  key={
                    item.friendshipId
                  }
                >

                  <div className="avatar">
                    {(
                      friendProfile.display_name ||
                      friendProfile.username
                    )[0].toUpperCase()}
                  </div>

                  <div>

                    <b>
                      {friendProfile.display_name ||
                        friendProfile.username}
                    </b>

                    <small>
                      @{friendProfile.username}
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
                    <Check
                      size={16}
                    />

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
                    <X
                      size={16}
                    />
                  </button>

                </div>
              );
            }
          )}

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

        ) : friends.length ===
          0 ? (

          <p className="muted">
            You haven't added any friends yet.
          </p>

        ) : (

          friends.map(
            item => {

              const friendProfile =
                item.profile;

              return (
                <button
                  key={
                    item.friendshipId
                  }
                  style={{
                    all:
                      'unset',

                    display:
                      'block',

                    width:
                      '100%',

                    cursor:
                      'pointer'
                  }}
                  onClick={() =>
                    openFriend(
                      friendProfile,
                      item.friendshipId
                    )
                  }
                >

                  <div className="friend">

                    <div className="avatar">
                      {(
                        friendProfile.display_name ||
                        friendProfile.username
                      )[0].toUpperCase()}
                    </div>

                    <div>

                      <b>
                        {friendProfile.display_name ||
                          friendProfile.username}
                      </b>

                      <small>
                        @{friendProfile.username}
                      </small>

                    </div>

                    <ChevronRight
                      size={18}
                    />

                  </div>

                </button>
              );
            }
          )

        )}

      </section>

      {outgoing.length >
        0 && (

        <section className="panel">

          <div className="panel-head">

            <h2>
              Sent Requests
            </h2>

          </div>

          {outgoing.map(
            item => (

              <div
                className="friend"
                key={
                  item.friendshipId
                }
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

            )
          )}

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
  const [
    gameStats,
    setGameStats
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    message,
    setMessage
  ] = useState('');

  useEffect(() => {

    async function load() {
      try {
        const stats =
          await getGameStats(
            profile.id
          );

        setGameStats(
          stats
        );

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
        <ChevronLeft
          size={18}
        />

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

        {gameStats.length ===
          0 ? (

          <p className="muted">
            No game stats available yet.
          </p>

        ) : (

          <div className="gamegrid">

            {gameStats.map(
              game => (

                <div
                  className="gamecard"
                  key={
                    game.id
                  }
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

              )
            )}

          </div>

        )}

      </section>

      <button
        className="logout"
        onClick={remove}
        style={{
          marginTop:
            '20px'
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
  const [
    displayName,
    setDisplayName
  ] = useState('');

  const [
    bio,
    setBio
  ] = useState('');

  const [
    title,
    setTitle
  ] = useState('');

  const [
    saving,
    setSaving
  ] = useState(false);

  const [
    message,
    setMessage
  ] = useState('');

  useEffect(() => {
    setDisplayName(
      profile
        ?.display_name ||
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

  async function saveProfile(
    e
  ) {
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

        <form
          onSubmit={
            saveProfile
          }
        >

          <label>
            Username

            <input
              value={
                profile
                  ?.username ||
                ''
              }
              disabled
            />
          </label>

          <label>
            Display Name

            <input
              value={
                displayName
              }
              onChange={
                e =>
                  setDisplayName(
                    e.target.value
                  )
              }
            />
          </label>

          <label>
            Player Title

            <input
              value={
                title
              }
              onChange={
                e =>
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
              value={
                bio
              }
              onChange={
                e =>
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
            <Save
              size={17}
            />

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
   PLACEHOLDER
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

        <Icon
          size={44}
        />

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
  const [
    session,
    setSession
  ] = useState(null);

  const [
    profile,
    setProfile
  ] = useState(null);

  const [
    gameStats,
    setGameStats
  ] = useState([]);

  const [
    loading,
    setLoading
  ] = useState(true);

  const [
    statsLoading,
    setStatsLoading
  ] = useState(false);

  const [
    statsError,
    setStatsError
  ] = useState('');

  const [
    page,
    setPage
  ] = useState(
    'dashboard'
  );

  const [
    selectedGame,
    setSelectedGame
  ] = useState(null);

  const [
    selectedFriend,
    setSelectedFriend
  ] = useState(null);

  const [
    selectedFriendshipId,
    setSelectedFriendshipId
  ] = useState(null);

  const [
    open,
    setOpen
  ] = useState(false);

  async function loadPlayerData(
    user
  ) {
    if (!user) return;

    setStatsLoading(
      true
    );

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
      setStatsLoading(
        false
      );
    }
  }

  useEffect(() => {
    let alive =
      true;

    async function start() {
      try {
        const {
          data: {
            session:
              currentSession
          }
        } =
          await supabase
            .auth
            .getSession();

        if (!alive) {
          return;
        }

        setSession(
          currentSession
        );

        if (
          currentSession
            ?.user
        ) {
          await loadPlayerData(
            currentSession.user
          );
        }

      } finally {
        if (alive) {
          setLoading(
            false
          );
        }
      }
    }

    start();

    const {
      data: {
        subscription
      }
    } =
      supabase.auth
        .onAuthStateChange(
          (
            _event,
            nextSession
          ) => {

            setSession(
              nextSession
            );

            if (
              nextSession
                ?.user
            ) {
              setTimeout(
                () => {
                  loadPlayerData(
                    nextSession.user
                  );
                },
                0
              );

            } else {
              setProfile(
                null
              );

              setGameStats(
                []
              );
            }

          }
        );

    return () => {
      alive =
        false;

      subscription
        .unsubscribe();
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
    return (
      <Auth />
    );
  }

  const displayName =
    profile
      ?.display_name ||
    profile
      ?.username ||
    'Player';

  function openGame(
    game
  ) {
    setSelectedGame(
      game
    );

    setPage(
      'game-detail'
    );

    window.scrollTo({
      top:
        0,

      behavior:
        'smooth'
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
      top:
        0,

      behavior:
        'smooth'
    });
  }

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
        setPage={
          setPage
        }
        openGame={
          openGame
        }
        user={
          session.user
        }
        profile={
          profile
        }
        totals={
          totals
        }
        gameStats={
          gameStats
        }
        statsLoading={
          statsLoading
        }
        statsError={
          statsError
        }
      />
    ),

    profile: (
      <ProfileSettings
        user={
          session.user
        }
        profile={
          profile
        }
        onProfileUpdated={
          setProfile
        }
      />
    ),

    stats: (
      <Stats
        totals={
          totals
        }
        gameStats={
          gameStats
        }
        openGame={
          openGame
        }
      />
    ),

    'game-detail': (
      <GameDetail
        game={
          selectedGame
        }
        back={() => {
          setPage(
            'stats'
          );

          setSelectedGame(
            null
          );
        }}
      />
    ),

    friends: (
      <FriendsPage
        user={
          session.user
        }
        openFriend={
          openFriend
        }
      />
    ),

    'friend-profile': (
      selectedFriend ? (
        <FriendProfile
          profile={
            selectedFriend
          }
          friendshipId={
            selectedFriendshipId
          }
          back={() => {
            setSelectedFriend(
              null
            );

            setSelectedFriendshipId(
              null
            );

            setPage(
              'friends'
            );
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
        user={
          session.user
        }
        totals={
          totals
        }
      />
    ),

    challenges: (
      <ChallengesPage
        user={
          session.user
        }
      />
    ),

    tournaments: (
      <TournamentsPage
        user={
          session.user
        }
      />
    ),

    clans: (
      <ClansPage
        user={
          session.user
        }
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
              setOpen(
                false
              )
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
            (
              [
                id,
                label,
                Icon
              ]
            ) => (

              <button
                key={
                  id
                }
                className={
                  page === id
                    ? 'active'
                    : ''
                }
                onClick={() => {

                  setPage(
                    id
                  );

                  setSelectedGame(
                    null
                  );

                  setSelectedFriend(
                    null
                  );

                  setOpen(
                    false
                  );
                }}
              >

                <Icon
                  size={18}
                />

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
          onClick={
            signOut
          }
        >
          <LogOut
            size={17}
          />

          Sign out
        </button>

      </aside>

      <main className="main">

        <header className="topbar">

          <button
            className="iconbtn menu"
            onClick={() =>
              setOpen(
                true
              )
            }
          >
            <Menu />
          </button>

          <div className="search">

            <Search
              size={17}
            />

            <input
              placeholder="Search players, games, clans…"
            />

          </div>

          <div className="topactions">

            <button className="iconbtn">
              <Bell
                size={18}
              />
            </button>

            <button
              className="iconbtn"
              onClick={() =>
                setPage(
                  'profile'
                )
              }
            >
              <Settings
                size={18}
              />
            </button>

          </div>

        </header>

        {pages[page]}

      </main>

    </div>
  );
}


createRoot(
  document.getElementById(
    'root'
  )
).render(
  <App />
);
