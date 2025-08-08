import { Html, Head, Main, NextScript } from 'next/document'

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <script src="https://cdn.tailwindcss.com" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <body className="bg-gray-50 text-gray-900">
        <Main />
        <NextScript />
      </body>
    </Html>
  )
}
