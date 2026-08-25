// Auth + data access over Supabase (GoTrue + PostgREST). All tables carry
// per-user RLS; the client only ever sees the signed-in user's rows.

import { createClient, type Session } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { parseGreenButtonCsv, type ParsedUpload } from './parse'
import type { Fuel, Profile } from '../types'

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
export type { Session }

export interface UploadRecord {
  id: string | null
  parsed: ParsedUpload
  billing: { start: string; end: string } | null
}

const EMPTY_PROFILE: Profile = {
  display_name: null,
  zip: null,
  home_type: null,
  ac_type: null,
  occupancy: null,
  has_ev: false,
  has_pool: false,
  has_electric_dryer: false,
}

export async function signUp(
  name: string,
  email: string,
  password: string,
): Promise<{ error?: string; needsConfirm?: boolean; alreadyRegistered?: boolean }> {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: name },
      // Confirmation links come back to the origin the user signed up on
      // (production, preview, or localhost) instead of the project-wide
      // Site URL: the origin must be in the auth Redirect URLs allow-list.
      emailRedirectTo: window.location.origin,
    },
  })
  if (error) return { error: error.message }
  // Signing up with an address that already exists returns a decoy user with
  // no identities and sends no email (GoTrue hides whether an account exists).
  // Without this check the UI would promise an inbox message that never comes.
  if (data.user && !data.session && (data.user.identities?.length ?? 0) === 0) {
    return { alreadyRegistered: true }
  }
  if (!data.session) return { needsConfirm: true }
  // Seed the profile with the display name right away.
  await supabase.from('profiles').upsert({ id: data.session.user.id, display_name: name })
  return {}
}

export async function signIn(email: string, password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  return error ? { error: error.message } : {}
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut()
}

/** Sends the reset link. The origin must be in the Redirect URLs allow-list. */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  })
  return error ? { error: error.message } : {}
}

/** Sets a new password for the recovery session created by the reset link. */
export async function updatePassword(password: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.updateUser({ password })
  return error ? { error: error.message } : {}
}

export async function fetchProfile(userId: string): Promise<Profile> {
  const { data } = await supabase
    .from('profiles')
    .select('display_name, zip, home_type, ac_type, occupancy, has_ev, has_pool, has_electric_dryer')
    .eq('id', userId)
    .maybeSingle()
  return { ...EMPTY_PROFILE, ...(data ?? {}) }
}

export async function saveProfile(userId: string, patch: Partial<Profile>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, ...patch, updated_at: new Date().toISOString() })
  if (error) console.warn('saveProfile failed:', error.message)
}

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .upsert({ id: userId, onboarded_at: new Date().toISOString() })
  if (error) console.warn('markOnboarded failed:', error.message)
}

/** Newest upload per fuel, parsed. Corrupt rows are skipped, not fatal. */
export async function fetchUploads(userId: string): Promise<Partial<Record<Fuel, UploadRecord>>> {
  const { data, error } = await supabase
    .from('uploads')
    .select('id, file_name, fuel, csv, billing_start, billing_end, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error || !data) return {}
  const out: Partial<Record<Fuel, UploadRecord>> = {}
  for (const row of data) {
    const fuel = row.fuel as Fuel
    if (out[fuel]) continue
    try {
      out[fuel] = {
        id: row.id,
        parsed: parseGreenButtonCsv(row.csv, row.file_name ?? 'upload.csv'),
        billing:
          row.billing_start && row.billing_end
            ? { start: row.billing_start, end: row.billing_end }
            : null,
      }
    } catch (e) {
      console.warn('skipping unparseable stored upload', row.id, e)
    }
  }
  return out
}

export async function insertUpload(
  userId: string,
  parsed: ParsedUpload,
  billing: { start: string; end: string } | null,
  replaceId: string | null,
): Promise<string | null> {
  if (replaceId) {
    await supabase.from('annotations').delete().eq('upload_id', replaceId)
    await supabase.from('uploads').delete().eq('id', replaceId)
  }
  const { data, error } = await supabase
    .from('uploads')
    .insert({
      user_id: userId,
      file_name: parsed.fileName,
      fuel: parsed.fuel,
      unit: parsed.unit,
      granularity: parsed.granularity,
      service_id: parsed.serviceRef ?? null,
      period_start: parsed.periodStart,
      period_end: parsed.periodEnd,
      row_count: parsed.rowCount,
      total_usage: parsed.totalUsage,
      total_cost: parsed.totalCost,
      csv: parsed.csv,
      billing_start: billing?.start ?? null,
      billing_end: billing?.end ?? null,
    })
    .select('id')
    .single()
  if (error) {
    console.warn('insertUpload failed:', error.message)
    return null
  }
  return data.id
}

export async function deleteUpload(id: string): Promise<void> {
  await supabase.from('annotations').delete().eq('upload_id', id)
  const { error } = await supabase.from('uploads').delete().eq('id', id)
  if (error) console.warn('deleteUpload failed:', error.message)
}

/** All answers keyed `${fuel}:${question_id}`. */
export async function fetchAnswers(userId: string): Promise<Record<string, string[]>> {
  const { data } = await supabase.from('answers').select('fuel, question_id, value').eq('user_id', userId)
  const out: Record<string, string[]> = {}
  for (const row of data ?? []) {
    if (Array.isArray(row.value)) out[`${row.fuel}:${row.question_id}`] = row.value
  }
  return out
}

export async function saveAnswer(
  userId: string,
  fuel: Fuel,
  questionId: string,
  value: string[] | null,
): Promise<void> {
  if (value === null) {
    await supabase
      .from('answers')
      .delete()
      .eq('user_id', userId)
      .eq('fuel', fuel)
      .eq('question_id', questionId)
    return
  }
  const { error } = await supabase
    .from('answers')
    .upsert(
      { user_id: userId, fuel, question_id: questionId, value, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,fuel,question_id' },
    )
  if (error) console.warn('saveAnswer failed:', error.message)
}

/** Event annotations keyed `${fuel}:${date}`. */
export async function fetchAnnotations(
  uploadIds: Partial<Record<Fuel, string>>,
): Promise<Record<string, { away?: boolean; cause?: string }>> {
  const ids = Object.values(uploadIds).filter(Boolean) as string[]
  if (!ids.length) return {}
  const { data } = await supabase
    .from('annotations')
    .select('upload_id, date_key, away, cause')
    .in('upload_id', ids)
  const byId = new Map(Object.entries(uploadIds).map(([fuel, id]) => [id, fuel]))
  const out: Record<string, { away?: boolean; cause?: string }> = {}
  for (const row of data ?? []) {
    const fuel = byId.get(row.upload_id)
    if (!fuel) continue
    out[`${fuel}:${row.date_key}`] = { away: !!row.away, cause: row.cause ?? undefined }
  }
  return out
}

export async function saveAnnotation(
  userId: string,
  uploadId: string,
  date: string,
  meta: { away?: boolean; cause?: string },
): Promise<void> {
  const { error } = await supabase
    .from('annotations')
    .upsert(
      {
        user_id: userId,
        upload_id: uploadId,
        date_key: date,
        away: !!meta.away,
        cause: meta.cause ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,upload_id,date_key' },
    )
  if (error) console.warn('saveAnnotation failed:', error.message)
}
