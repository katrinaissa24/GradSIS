import { supabase } from "./supabase";

/* ---------- SIGN UP ---------- */
export async function signUp(email, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;
  return data;
}

/* ---------- LOGIN ---------- */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

/* ---------- LOGOUT ---------- */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/* ---------- GET CURRENT SESSION ---------- */
export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}
