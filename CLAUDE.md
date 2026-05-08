# Branviq Vendor Quiz

Lead generation quiz for Branviq — connects Atlanta-area appliance repair technicians with local job leads.

## Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + shadcn/ui
- **Backend**: Supabase Edge Functions (Deno runtime)
- **Hosting**: Vercel (auto-deploy from `Berezhnoy1/quizq` on push)
- **Database/Auth**: Supabase (project `bkrlgkbjyfitgpikzvkl`)
- **Calendar**: Google Calendar API v3 via Service Account JWT
- **Sheets**: Google Sheets API v4 via Service Account JWT
- **Email**: Resend API (domain verification pending)
- **Notifications**: Telegram Bot API
- **Tracking**: Facebook Pixel (fbq), UTM params

## Project Structure

```
src/
  components/quiz/    # Quiz steps, Logo, ProgressBar, NextButton, SlotPicker
  components/ui/      # shadcn/ui components (do not edit manually)
  integrations/supabase/  # Supabase client + generated types
  lib/pixel.ts        # Facebook Pixel helpers
  lib/utm.ts          # UTM parameter extraction
  pages/Index.tsx     # Single page — renders Quiz
  App.tsx             # Router setup
  index.css           # Custom styles: btn-gradient, quiz-card, trust-badge, animations

supabase/functions/
  calendar-book/      # Creates Google Calendar event (service account, no attendees)
  calendar-availability/  # Checks available slots (uses Lovable gateway — may need migration)
  sheets-append/      # Appends lead data to Google Sheets
  send-confirmation-email/  # Sends HTML email via Resend
  send-telegram/      # Sends lead notification to Telegram
```

## Quiz Flow (9 visual steps, 7 internal)

1. Hero + trust signals
2. How it works (3 cards)
3. Select service areas (multi-select, map images)
4. Team size
5. Slot picker (date + time)
6. Contact form (name, phone, email, consent)
7. Processing → success screen

On submit: parallel calls to sheets-append, calendar-book, send-telegram, send-confirmation-email.

## Key Decisions

- **Service Account** (`claude@pioneering-flag-495520-g2.iam.gserviceaccount.com`) handles Calendar + Sheets
- Service accounts on personal Gmail **cannot add attendees** — needs Google Workspace Domain-Wide Delegation
- Calendar events are created but invites don't reach leads until Workspace is configured
- Resend emails only reach account owner until domain is verified
- Telegram notifications work reliably

## Environment

- Supabase secrets: `GOOGLE_SERVICE_ACCOUNT_JSON`, `RESEND_API_KEY`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID`
- Frontend env: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (in Vercel + .env)
- Calendar ID: `alexbouch15@gmail.com`

## Commands

```bash
npm run dev       # Vite dev server on :8080
npm run build     # Production build
git push          # Auto-deploys to Vercel
```

## Pending

- Resend domain verification (for emails to non-owner recipients)
- Google Workspace Domain-Wide Delegation (for calendar invites to leads)
- calendar-availability may need migration from Lovable gateway to direct API
