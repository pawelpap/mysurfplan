import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`body { font-family: "Space Grotesk", system-ui, -apple-system, sans-serif; }`}</style>
      </Head>
      <body className="bg-gray-50 text-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
