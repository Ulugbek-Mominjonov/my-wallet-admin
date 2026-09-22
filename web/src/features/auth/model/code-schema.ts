import { z } from 'zod'

/** N xonali raqamli kod (email kodi, TOTP) — forma va API bir sxemadan. */
export const digitCodeSchema = (length: number) =>
  z.object({
    code: z
      .string()
      .trim()
      .regex(new RegExp(`^\\d{${String(length)}}$`)),
  })
