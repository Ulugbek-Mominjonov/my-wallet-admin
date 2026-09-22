import { z } from 'zod'

/** `create_household` bilan bir xil chegara (`invalid_name`). */
export const HOUSEHOLD_NAME_MAX = 80

/** BR-012: taklif kodi — 8 belgi, adashtiradigan belgilarsiz (I, O, 0, 1 yo'q). */
export const INVITE_CODE_LENGTH = 8

export const createHouseholdSchema = z.object({
  name: z.string().trim().min(1).max(HOUSEHOLD_NAME_MAX),
})

export const joinHouseholdSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(new RegExp(`^[A-HJ-NP-Z2-9]{${INVITE_CODE_LENGTH}}$`)),
})
