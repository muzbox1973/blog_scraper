# Naver Blog Top 3 Web App

네이버 블로그 탭에서 키워드를 검색하고, 상위 3개 블로그 글의 제목, 본문, 키워드를 수집하는 Next.js 웹앱입니다.

## 로컬 실행

```powershell
npm.cmd install
npx.cmd playwright install chromium
npm.cmd run dev
```

브라우저에서 `http://localhost:3000` 을 열면 됩니다.

## 배포

Vercel에 그대로 배포할 수 있는 구조입니다.

```powershell
vercel
```

## API

- `POST /api/scrape`
- Body: `{ "keyword": "제주도 맛집" }`

## 참고

- 로컬에서는 `playwright` Chromium을 사용합니다.
- Vercel 환경에서는 `@sparticuz/chromium` + `playwright-core` 조합으로 실행되도록 구성했습니다.
- 네이버 검색/블로그 DOM 구조가 바뀌면 선택자 보정이 필요할 수 있습니다.
