import { supabase } from './supabase';

export async function signUp({email,password,username,displayName}) {
  const {data,error}=await supabase.auth.signUp({
    email,password,
    options:{data:{username,display_name:displayName||username}}
  });
  if(error) throw error;

  if(data.user){
    const {error:profileError}=await supabase.from('profiles').upsert({
      id:data.user.id,
      username,
      display_name:displayName||username
    });
    if(profileError && profileError.code!=='42501') throw profileError;
  }
  return data;
}

export async function signIn(email,password){
  const {data,error}=await supabase.auth.signInWithPassword({email,password});
  if(error) throw error;
  return data;
}

export async function signOut(){
  const {error}=await supabase.auth.signOut();
  if(error) throw error;
}
