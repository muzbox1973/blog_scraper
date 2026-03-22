import "./globals.css";

export const metadata = {
  title: "Naver Blog Top 3 Scraper",
  description: "Search Naver Blog and collect the top 3 posts with title, body, and extracted keywords."
};

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
