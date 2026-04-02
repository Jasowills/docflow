# Supabase Edge Functions - Email Invitations

This directory contains Supabase Edge Functions for sending emails.

## Setup

### 1. Deploy the Edge Function

```bash
cd supabase/functions
supabase functions deploy send-invitation-email
```

### 2. Set Environment Variables in Supabase Dashboard

Go to your Supabase project > Edge Functions > Environment Variables and add:

- `RESEND_API_KEY` - Your Resend API key

### 3. Update Server Configuration

Add to your server `.env`:

```
SUPABASE_EDGE_FUNCTION_URL=https://your-project.supabase.co/functions/v1
```

### 4. Get Your Edge Function URL

After deployment, your edge function URL will be:
```
https://your-project.supabase.co/functions/v1/send-invitation-email
```

Update `SUPABASE_EDGE_FUNCTION_URL` to:
```
https://your-project.supabase.co/functions/v1
```

## Testing Locally

```bash
cd supabase/functions
supabase functions serve send-invitation-email
```

## Email Template

The invitation email includes:
- Workspace name
- Inviter's name
- Role assignment
- Accept invitation button
- Expiration notice

## Resend Setup

1. Create a Resend account at https://resend.com
2. Add a domain or use the default `onboarding@resend.dev` for testing
3. Get your API key from https://resend.com/api-keys
