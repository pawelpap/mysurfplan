import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <script src="https://cdn.tailwindcss.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style>{`body { font-family: "Poppins", system-ui, -apple-system, sans-serif; }`}</style>
      </Head>
      <body className="bg-[#f6faf7] text-[#11191f]">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
