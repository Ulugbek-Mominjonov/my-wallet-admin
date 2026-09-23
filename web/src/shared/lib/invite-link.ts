import { env } from '@/shared/config/env'

/**
 * E30-T01 (BR-012): taklif havolasi — mobil ilova deep link'i
 * (`mywallet://invite/<kod>`). Sxema muhit bo'yicha (mobil flavor'lari
 * bilan bir xil): lokal — `mywallet-dev`, staging — `mywallet-stg`.
 */
const SCHEME: Record<string, string> = {
  local: 'mywallet-dev',
  staging: 'mywallet-stg',
  production: 'mywallet',
}

export function inviteLink(code: string): string {
  return `${SCHEME[env.VITE_APP_ENV] ?? 'mywallet'}://invite/${code}`
}
