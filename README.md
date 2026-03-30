# The Content Lab AI (Next.js)

Simple internal AI chat app for The Content Lab.

## Stack

- Next.js (App Router)
- TypeScript
- Tailwind CSS
- Vercel-ready deployment

## Features

- Backend-only OpenRouter integration (`/api/chat`)
- Hardcoded API key in backend route (temporary)
- Fixed model + injected system prompt
- Streaming responses to UI
- Dark chat interface with neon accents
- Copy assistant response button
- Clear chat action

## Folder structure

```txt
.
├── app
│   ├── api
│   │   └── chat
│   │       └── route.ts
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components
│   └── chat-app.tsx
├── next-env.d.ts
├── next.config.ts
├── package.json
├── postcss.config.mjs
├── tailwind.config.ts
├── tsconfig.json
└── README.md
```

## Local setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Update API key in `app/api/chat/route.ts`:
   ```ts
   const OPENROUTER_API_KEY = "sk-or-v1-REPLACE_WITH_REAL_KEY";
   ```
3. Start dev server:
   ```bash
   npm run dev
   ```
4. Open `http://localhost:3000`

## Deploy to Vercel

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** and import the repo.
3. Keep framework preset as **Next.js**.
4. Deploy.

> Since this version hardcodes the OpenRouter key in backend code, rotate the key if shared. For production, move the key into Vercel environment variables.

