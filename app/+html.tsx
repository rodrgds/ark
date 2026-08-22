import { ScrollViewStyleReset } from 'expo-router/html';
import { type PropsWithChildren } from 'react';

// Web-only root HTML for statically rendered pages. Runs in Node.js, without DOM or browser APIs.
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="en" className="bg-background">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />

        {/* Disable body scrolling on web so ScrollView behaves like native. */}
        <ScrollViewStyleReset />
      </head>
      <body>{children}</body>
    </html>
  );
}
