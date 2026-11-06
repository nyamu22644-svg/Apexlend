# PayHero STK setup

The PayHero integration runs only in Supabase Edge Functions. Do not add PayHero credentials to `.env.local`, browser code, or source control.

From this project folder, set the three Supabase secrets once. Replace the placeholder values in your terminal; do not paste them into the application.

```powershell
supabase secrets set PAYHERO_BASIC_AUTH_TOKEN='your_payhero_api_token' PAYHERO_CHANNEL_ID='your_payhero_channel_id' PAYHERO_CALLBACK_TOKEN='a-long-random-unpredictable-value'
```

Generate the callback token with a password manager or another cryptographically secure random-value generator. It is not a PayHero credential; it protects the public callback endpoint from unsolicited requests.

The live callback address sent to PayHero for every STK request is:

```text
https://dktbguaggounkorfodcp.supabase.co/functions/v1/payhero-callback?token=YOUR_CALLBACK_TOKEN
```

The system sends this URL in the PayHero payment request, so no callback URL needs to be stored in frontend code.

## What happens after a customer pays

1. The authenticated customer requests an M-Pesa STK prompt from `payhero-stk`.
2. The function creates a payment request linked to that customer and loan, then asks PayHero to send the prompt.
3. PayHero calls `payhero-callback`.
4. Before recording a successful payment, the callback independently queries PayHero transaction status using the secret API token.
5. The database records the M-Pesa receipt exactly once, applies the funds to fees, interest, then principal, updates instalments and the loan balance, and notifies the customer. Any extra amount becomes unapplied cash for staff reconciliation.

Use PayHero sandbox/test credentials first and test a failed attempt, a successful instalment, a repeated callback, and an overpayment before accepting production payments.
