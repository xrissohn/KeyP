import { ScrollViewStyleReset } from "expo-router/html";
import { type PropsWithChildren } from "react";

const SW_REGISTER = `
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('/sw.js').catch(function () {});
  });
}
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ko">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover"
        />
        <meta
          name="description"
          content="관심사를 등록하고 실시간 속보를 가장 먼저 받아보세요."
        />
        <meta name="theme-color" content="#5B7FFF" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" type="image/png" sizes="192x192" href="/icon-192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/icon-512.png" />
        <link rel="shortcut icon" type="image/png" href="/icon-mark.png" />
        <link rel="apple-touch-icon" sizes="192x192" href="/icon-192.png" />
        <link rel="apple-touch-icon" sizes="512x512" href="/icon-512.png" />
        <link rel="apple-touch-icon" href="/icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta
          name="apple-mobile-web-app-status-bar-style"
          content="default"
        />
        <meta name="apple-mobile-web-app-title" content="KeyP" />
        <title>KeyP — 속보 알림</title>
        <ScrollViewStyleReset />
        <script dangerouslySetInnerHTML={{ __html: SW_REGISTER }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
