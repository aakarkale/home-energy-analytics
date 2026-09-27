// Auth + data access over Supabase (GoTrue + PostgREST). All tables carry
// per-user RLS; the client only ever sees the signed-in user's rows.

import { createClient, type Session } from '@supabase/supabase-js'
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './config'
import { parseGreenButtonCsv, type ParsedUpload } from './parse'
import { ROUTES } from './routes'
import type { Fuel, Profile } from '../types'

/** What sign-in should say about an email link the visitor just followed. */
export type EmailNotice = { kind: 'confirmed'; email: string | null } | { kind: 'link-spent' }

/** The session a confirmation link carried, held only until it is revoked. */
let landingToken: string | null = null

/**
 * Reads what an email link brought this page load, before the client below can
 * see the address. A confirmation link arrives carrying the new account's
 * session and `type=signup`; one already used, or expired, arrives with an
 * error instead (confirmation links work once).
 */
function readEmailLanding(): EmailNotice | null {
  if (typeof window === 'undefined') return null
  const { pathname, search, hash: rawHash } = window.location
  const hash = new URLSearchParams(rawHash.replace(/^#/, ''))
  const token = hash.get('access_token')
  const type = hash.get('type')
  const confirmed = !!token && (type === 'signup' || type === 'email')
  // A spent password-reset link lands on its own page and is not this.
  const spent = !confirmed && !!hash.get('error_code') && pathname !== ROUTES.resetPassword
  if (!confirmed && !spent) return null
  // Sign-in explains either one, so both land there, links sent before it was
  // their target included. The hash goes in the same replace: Hearth asks
  // people to sign in themselves once confirmed, so the link's session is
  // never used, and its token never lingers in the address bar or history.
  window.history.replaceState(window.history.state, '', ROUTES.signIn + search)
  if (!confirmed) return { kind: 'link-spent' }
  landingToken = token
  return { kind: 'confirmed', email: tokenEmail(token) }
}

/** The address an access token was issued to: its `email` claim. */
function tokenEmail(token: string): string | null {
  try {
    const b64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
    const { email } = JSON.parse(new TextDecoder().decode(bytes))
    return typeof email === 'string' && email ? email : null
  } catch {
    return null
  }
}

export const emailLanding = readEmailLanding()

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)
export type { Session }

let landingSettled = emailLanding?.kind !== 'confirmed'
let landingSettle: Promise<void> | null = null

/** True until a confirmation landing has cleared any other account away. */
export const settlingEmailLanding = () => !landingSettled

/**
 * Leaves sign-in open for the address a confirmation link just confirmed. The
 * link's own session is revoked unused, and any other account signed in on this
 * browser is signed out, as the link would have replaced it anyway. Runs once
 * however often it is called.
 */
export function settleEmailLanding(): Promise<void> {
  landingSettle ??= (async () => {
    if (landingSettled) return
    if (landingToken) {
      // Nothing waits on the server tidying up.
      void supabase.auth.admin.signOut(landingToken, 'local').catch(() => {})
      landingToken = null
    }
    const { data } = await supabase.auth.getSession()
    if (data.session) await supabase.auth.signOut({ scope: 'local' })
    landingSettled = true
  })()
  return landingSettle
}

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
      // Confirmation links come back to sign-in on the origin the user signed
      // up on (production, preview or localhost), which then says the address
      // is confirmed. A full path, not a bare origin: see requestPasswordReset
      // for why only a path matches the allow-list's `/**` entries.
      emailRedirectTo: window.location.origin + ROUTES.signIn,
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

/** Sends the reset link.
 *
 *  The full path matters, not just the origin. Supabase treats `.` and `/` as
 *  glob separators, so a bare origin does not match an allow-list entry ending
 *  in `/**`; it would only be accepted where it happens to equal the Site URL
 *  exactly, and a reset started from a preview deploy or localhost would bounce
 *  the user to production instead. Sending the real path matches every entry,
 *  and lands on the new-password prompt without a detour through the landing
 *  page. */
export async function requestPasswordReset(email: string): Promise<{ error?: string }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + ROUTES.resetPassword,
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

/** Has this account finished setup before? Onboarding runs once per account. */
export async function fetchOnboarded(userId: string): Promise<boolean> {
  const { data } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', userId)
    .maybeSingle()
  return !!data?.onboarded_at
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

/** The uploads row for a parsed file, minus who owns it. */
function uploadRow(parsed: ParsedUpload, billing: { start: string; end: string } | null) {
  return {
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
  }
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
    .insert({ user_id: userId, ...uploadRow(parsed, billing) })
    .select('id')
    .single()
  if (error) {
    console.warn('insertUpload failed:', error.message)
    return null
  }
  return data.id
}

/**
 * Rewrites a saved upload with its merged history. Updating in place keeps the
 * row's id, and with it every annotation made against the days already saved.
 */
export async function updateUpload(
  id: string,
  parsed: ParsedUpload,
  billing: { start: string; end: string } | null,
): Promise<{ error?: string }> {
  const { data, error } = await supabase
    .from('uploads')
    .update(uploadRow(parsed, billing))
    .eq('id', id)
    .select('id')
  if (error) return { error: error.message }
  // RLS turns an update of someone else's row into zero rows, not an error.
  if (!data?.length) return { error: 'That upload is no longer on your account.' }
  return {}
}

export async function deleteUpload(id: string): Promise<void> {
  await supabase.from('annotations').delete().eq('upload_id', id)
  const { error } = await supabase.from('uploads').delete().eq('id', id)
  if (error) console.warn('deleteUpload failed:', error.message)
}

/**
 * Answer and annotation writes run one at a time, in the order they were made.
 * Otherwise a quick change of mind could land before the change it replaces, or
 * an archive could reach the server before the answer it files.
 */
let writeQueue: Promise<unknown> = Promise.resolve()
function inOrder<T>(write: () => Promise<T>): Promise<T> {
  const next = writeQueue.then(write)
  writeQueue = next.catch(() => {})
  return next
}

/** Splits `fuel:rest` keys by fuel. */
function byFuel(keys: string[]): Map<Fuel, string[]> {
  const out = new Map<Fuel, string[]>()
  for (const key of keys) {
    const i = key.indexOf(':')
    const fuel = key.slice(0, i) as Fuel
    out.set(fuel, [...(out.get(fuel) ?? []), key.slice(i + 1)])
  }
  return out
}

/** All answers keyed `${fuel}:${question_id}`, and which of them are archived. */
export async function fetchAnswers(
  userId: string,
): Promise<{ answers: Record<string, string[]>; archived: string[] }> {
  const { data } = await supabase
    .from('answers')
    .select('fuel, question_id, value, archived_at')
    .eq('user_id', userId)
  const answers: Record<string, string[]> = {}
  const archived: string[] = []
  for (const row of data ?? []) {
    if (!Array.isArray(row.value)) continue
    const key = `${row.fuel}:${row.question_id}`
    answers[key] = row.value
    if (row.archived_at) archived.push(key)
  }
  return { answers, archived }
}

export function saveAnswer(
  userId: string,
  fuel: Fuel,
  questionId: string,
  value: string[] | null,
): Promise<void> {
  return inOrder(async () => {
    if (value === null) {
      await supabase
        .from('answers')
        .delete()
        .eq('user_id', userId)
        .eq('fuel', fuel)
        .eq('question_id', questionId)
      return
    }
    // archived_at is left out, so changing an answer never files or unfiles it.
    const { error } = await supabase
      .from('answers')
      .upsert(
        { user_id: userId, fuel, question_id: questionId, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,fuel,question_id' },
      )
    if (error) console.warn('saveAnswer failed:', error.message)
  })
}

/** Files answers (keys `fuel:questionId`) away from Calibrate, or brings them back. */
export function setAnswersArchived(userId: string, keys: string[], archived: boolean): Promise<void> {
  return inOrder(async () => {
    const archived_at = archived ? new Date().toISOString() : null
    for (const [fuel, ids] of byFuel(keys)) {
      const { error } = await supabase
        .from('answers')
        .update({ archived_at })
        .eq('user_id', userId)
        .eq('fuel', fuel)
        .in('question_id', ids)
      if (error) console.warn('setAnswersArchived failed:', error.message)
    }
  })
}

export interface AnnotationRow {
  upload_id: string
  date_key: string
  away: boolean | null
  cause: string | null
  archived_at: string | null
}

/** Every event annotation on the account. Fetched by user rather than by upload
 *  so it can load alongside the uploads instead of after them. */
export async function fetchAnnotations(userId: string): Promise<AnnotationRow[]> {
  const { data } = await supabase
    .from('annotations')
    .select('upload_id, date_key, away, cause, archived_at')
    .eq('user_id', userId)
  return data ?? []
}

/** Annotations on the given uploads keyed `${fuel}:${date}`, and which of them
 *  are archived. Rows left over from a replaced upload are dropped. */
export function annotationsByFuel(
  rows: AnnotationRow[],
  uploadIds: Partial<Record<Fuel, string>>,
): { meta: Record<string, { away?: boolean; cause?: string }>; archived: string[] } {
  const byId = new Map(Object.entries(uploadIds).map(([fuel, id]) => [id, fuel]))
  const meta: Record<string, { away?: boolean; cause?: string }> = {}
  const archived: string[] = []
  for (const row of rows) {
    const fuel = byId.get(row.upload_id)
    if (!fuel) continue
    const key = `${fuel}:${row.date_key}`
    meta[key] = { away: !!row.away, cause: row.cause ?? undefined }
    if (row.archived_at) archived.push(key)
  }
  return { meta, archived }
}

export function saveAnnotation(
  userId: string,
  uploadId: string,
  date: string,
  meta: { away?: boolean; cause?: string },
): Promise<void> {
  return inOrder(async () => {
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
  })
}

/** Files event tags (keys `fuel:date`) away from Calibrate, or brings them back. */
export function setAnnotationsArchived(
  userId: string,
  uploadIds: Partial<Record<Fuel, string>>,
  keys: string[],
  archived: boolean,
): Promise<void> {
  return inOrder(async () => {
    const archived_at = archived ? new Date().toISOString() : null
    for (const [fuel, dates] of byFuel(keys)) {
      const uploadId = uploadIds[fuel]
      if (!uploadId) continue
      const { error } = await supabase
        .from('annotations')
        .update({ archived_at })
        .eq('user_id', userId)
        .eq('upload_id', uploadId)
        .in('date_key', dates)
      if (error) console.warn('setAnnotationsArchived failed:', error.message)
    }
  })
}

/**
 * Removes everything this account stores: uploads, answers, annotations and the
 * home-facts profile. The sign-in itself survives, since deleting an auth user
 * needs the service role and cannot be done from the browser.
 */
export async function deleteAllUserData(userId: string): Promise<{ error?: string }> {
  for (const table of ['annotations', 'answers', 'uploads'] as const) {
    const { error } = await supabase.from(table).delete().eq('user_id', userId)
    if (error) return { error: `${table}: ${error.message}` }
  }
  const { error } = await supabase
    .from('profiles')
    .update({
      zip: null,
      home_type: null,
      ac_type: null,
      occupancy: null,
      has_ev: false,
      has_pool: false,
      has_electric_dryer: false,
      onboarded_at: null,
    })
    .eq('id', userId)
  return error ? { error: error.message } : {}
}
