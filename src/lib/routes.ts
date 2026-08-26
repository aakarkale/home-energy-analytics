// URL routing.
//
// Every screen has a real, linkable path — `/energy`, not `/#`. That is what
// makes analytics attributable per page, lets search engines index each screen,
// and makes back/forward, refresh and bookmarking behave the way people expect.
//
// Adding a screen means adding one entry to ROUTES: nothing else in the app
// needs to learn about it. Server config lives in vercel.json, which rewrites
// unknown paths to index.html so a deep link survives a refresh.

import { useEffect, useState } from 'react'
import type { Page } from '../types'

/** Screens that live inside the signed-in app shell. */
export const PAGE_PATHS: Record<Page, string> = {
  overview: '/overview',
  energy: '/energy',
  rates: '/rates',
  playbook: '/playbook',
  activity: '/activity',
  settings: '/settings',
  account: '/account',
}

/** Public paths that are not app pages. */
export const ROUTES = {
  landing: '/',
  signIn: '/signin',
  signUp: '/signup',
  /** Where a password-reset link lands. */
  resetPassword: '/reset-password',
} as const

/** Browser-tab title per path. Keeps each screen distinct in history and search. */
export const PAGE_TITLE: Record<Page, string> = {
  overview: 'Overview',
  energy: 'Energy',
  rates: 'Rates',
  playbook: 'AC Playbook',
  activity: 'Activity',
  settings: 'Settings',
  account: 'Account',
}

export const SITE_NAME = 'Hearth'

const BY_PATH = new Map<string, Page>(
  (Object.entries(PAGE_PATHS) as [Page, string][]).map(([page, path]) => [path, page]),
)

/** Trailing slashes and casing should never produce a different route. */
export function normalizePath(raw: string): string {
  const p = raw.split('?')[0].split('#')[0].toLowerCase()
  const trimmed = p.length > 1 ? p.replace(/\/+$/, '') : p
  return trimmed || '/'
}

export function pageForPath(raw: string): Page | null {
  return BY_PATH.get(normalizePath(raw)) ?? null
}

export interface Located {
  path: string
  page: Page | null
  /** An auth dialog the URL itself asks for. */
  authTab: 'create' | 'signin' | null
  isReset: boolean
}

export function locate(raw: string): Located {
  const path = normalizePath(raw)
  return {
    path,
    page: pageForPath(path),
    authTab: path === ROUTES.signUp ? 'create' : path === ROUTES.signIn ? 'signin' : null,
    isReset: path === ROUTES.resetPassword,
  }
}

/** Push a new URL without reloading; no-op when already there. */
export function navigate(path: string, replace = false): void {
  const next = normalizePath(path)
  if (normalizePath(window.location.pathname) === next && !window.location.hash) return
  window.history[replace ? 'replaceState' : 'pushState']({}, '', next)
  window.dispatchEvent(new PopStateEvent('popstate'))
}

/** The current path, kept in sync with back/forward and programmatic pushes. */
export function usePath(): string {
  const [path, setPath] = useState(() => normalizePath(window.location.pathname))
  useEffect(() => {
    const sync = () => setPath(normalizePath(window.location.pathname))
    window.addEventListener('popstate', sync)
    return () => window.removeEventListener('popstate', sync)
  }, [])
  return path
}

/** Sets the document title so history entries and search results read well. */
export function useDocumentTitle(title: string): void {
  useEffect(() => {
    document.title = title
  }, [title])
}
