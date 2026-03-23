# Naver Blog Top 3 Web App

Next.js web app that searches Naver Blog for a keyword and collects the top 3 blog posts with title, body, and extracted keywords.

## Local Development

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run dev
```

Open `http://localhost:3000`.

## Deploy to Vercel

```powershell
vercel
```

For Vercel, set one of these environment variables and use a remote browser:

- `PLAYWRIGHT_WS_ENDPOINT`
- `CHROME_CDP_URL`

## API

- `POST /api/scrape`
- Body: `{ "keyword": "제주도 맛집" }`

## Notes

- Local development uses `playwright`.
- Vercel should use a remote browser endpoint because bundled Chromium may fail in serverless environments.
- If Naver changes its DOM structure, selectors may need to be updated.
