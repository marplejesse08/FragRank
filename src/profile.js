import { supabase } from './supabase';

export async function getMyProfile() {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from('profiles')
    .select(`
      id,
      username,
      display_name,
      bio,
      avatar_url,
      banner_url,
      title,
      profile_frame,
      created_at
    `)
    .eq('id', user.id)
    .single();

  if (error) throw error;

  return data;
}

export async function updateMyProfile(updates) {
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) throw new Error('You must be signed in.');

  const allowedUpdates = {
    display_name: updates.display_name,
    bio: updates.bio,
    avatar_url: updates.avatar_url,
    banner_url: updates.banner_url,
    title: updates.title,
    profile_frame: updates.profile_frame
  };

  Object.keys(allowedUpdates).forEach(key => {
    if (allowedUpdates[key] === undefined) {
      delete allowedUpdates[key];
    }
  });

  const { data, error } = await supabase
    .from('profiles')
    .update(allowedUpdates)
    .eq('id', user.id)
    .select()
    .single();

  if (error) throw error;

  return data;
}
