# ApexLend

Production lending operations platform built with Next.js and Supabase.

## Local development

1. Install Node.js 22 or later.
2. Run `npm ci`.
3. Copy `.env.example` to `.env.local` and supply development-only values.
4. Run `npm run dev`.

## Verification

Run `npm run lint`, `npm test`, and `npm run build` before deployment.

Production configuration and secrets must be stored in Vercel and Supabase, never committed to this repository.
