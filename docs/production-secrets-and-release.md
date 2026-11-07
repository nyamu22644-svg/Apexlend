# Production secrets and release procedure

## Vercel project environment variables

Set these for **Production** only (and separately for Preview if it needs a staging backend):

- `APP_URL`: the exact HTTPS production URL, for example `https://customer.example.co.ke`.
- `NEXT_PUBLIC_CUSTOMER_PORTAL_URL`: the customer portal URL, for example `https://customer.example.co.ke`.
- `NEXT_PUBLIC_STAFF_PORTAL_URL`: the staff-only URL, for example `https://staff.example.co.ke`.
- `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `SUPABASE_SECRET_KEY`.
- `KYC_PII_ENCRYPTION_KEY`: generate a new random value of at least 32 bytes. This is a Vercel-only server secret because KYC encryption happens in Next.js API routes.
- `KYC_PII_HASH_PEPPER`: a distinct random value of at least 32 bytes.
- `STAFF_INVITE_EMAIL_TOKEN`: a distinct random value of at least 32 bytes. Set the identical value as a Supabase Edge Function secret.

Never use the `NEXT_PUBLIC_` prefix for secrets. Do not rotate the KYC encryption key without a planned decrypt-and-re-encrypt migration: old records are encrypted with that key.

PowerShell generator (run locally; do not commit output):

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

### Safe Vercel and Supabase CLI setup (PowerShell)

Run this from the repository after installing/logging into the Vercel and Supabase CLIs. It generates secrets in memory, writes short-lived files only for the CLI, and removes them at the end. Replace `YOUR_SUPABASE_PROJECT_REF` with the project reference from the Supabase dashboard.

```powershell
npx vercel login
npx vercel link
npx supabase login

$secretFolder = Join-Path $env:TEMP "apexlend-secrets-$([guid]::NewGuid())"
New-Item -ItemType Directory -Path $secretFolder | Out-Null
function New-Secret { [Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 })) }

$kycKey = New-Secret
$kycPepper = New-Secret
$staffInviteToken = New-Secret

Set-Content -LiteralPath "$secretFolder\kyc-key" -Value $kycKey -NoNewline
Set-Content -LiteralPath "$secretFolder\kyc-pepper" -Value $kycPepper -NoNewline
Set-Content -LiteralPath "$secretFolder\staff-invite" -Value $staffInviteToken -NoNewline

npx vercel env add KYC_PII_ENCRYPTION_KEY production --sensitive < "$secretFolder\kyc-key"
npx vercel env add KYC_PII_HASH_PEPPER production --sensitive < "$secretFolder\kyc-pepper"
npx vercel env add STAFF_INVITE_EMAIL_TOKEN production --sensitive < "$secretFolder\staff-invite"

Set-Content -LiteralPath "$secretFolder\supabase.env" -Value "STAFF_INVITE_EMAIL_TOKEN=$staffInviteToken" -NoNewline
npx supabase secrets set --project-ref YOUR_SUPABASE_PROJECT_REF --env-file "$secretFolder\supabase.env"

Remove-Item -LiteralPath $secretFolder -Recurse -Force
```

If Vercel reports that a variable already exists, use `npx vercel env update NAME production --sensitive` and provide the corresponding temporary file through standard input. Do not paste secrets into source files, Git commits, terminal history, or chat.

## Supabase secrets and settings

Configure Edge Function secrets in Supabase for `FINOQ_API_USERNAME`, `FINOQ_API_PASSWORD`, `FINOQ_ACCOUNT_ID`, `FINOQ_CALLBACK_TOKEN`, PayHero credentials, email-provider credentials, `APP_URL`, and `STAFF_INVITE_EMAIL_TOKEN`.

In Supabase Auth, enable TOTP MFA, set a 12-character password minimum with upper/lowercase letters, numbers, and symbols, and add the exact Vercel domain to Site URL and Redirect URLs. Apply migrations before deploying the application; migration `20261106000022` makes staff permissions require MFA assurance level `aal2`.

### Supabase Auth production configuration

In **Supabase Dashboard → Authentication → URL Configuration** set **Site URL** to the customer portal URL, such as `https://customer.example.co.ke`. Add `https://customer.example.co.ke/**`, `https://staff.example.co.ke/**`, and specifically `https://staff.example.co.ke/staff/activate` under **Redirect URLs**. Add preview URLs only to the staging project, not production.

## Portal domain topology

Reserve `lending.com` for the future public website. Point `customer.lending.com` and `staff.lending.com` to this application deployment. The portal selector navigates between those canonical URLs; it is only an in-app preview switch on localhost. Customer and staff browser sessions remain separated by origin, while server-side role checks remain the authority for access control.

In **Authentication → Providers → Email**, configure a verified production SMTP sender and enable email confirmations for customer accounts. In **Authentication → MFA**, enable TOTP enrollment and verification. Staff will sign in with password, enroll once by scanning the in-app QR code, then enter an authenticator-app code before any staff permission works. Email OTP is suitable for email confirmation and recovery but is not used as the staff second factor.

## Deployment order

1. Create separate production Vercel and Supabase projects; never point previews at production data.
2. Add Vercel and Supabase secrets, configure production SMTP, custom domains, and redirect allow-lists.
3. Apply all migrations, deploy Edge Functions, and set their secrets.
4. Deploy Vercel from a protected `main` branch after CI passes.
5. Run a controlled UAT: staff TOTP enrollment, KYC upload, KYC review, maker-checker approval, a small real/sandbox repayment, and a small disbursement. Reconcile every test transaction in the provider dashboard and database.
