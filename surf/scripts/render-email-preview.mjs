import { mkdir, writeFile } from 'node:fs/promises';
import { deliveryCheckMessage } from '../lib/email/mailjet.mjs';

// Use the actual delivery-check renderer. Preview data never reaches a provider.
const { HTMLPart } = deliveryCheckMessage(
  { id: '00000000-0000-4000-8000-000000000000' },
  'preview@example.invalid',
  { environment: 'production', from: 'support@mywaveplan.com', callbackSecret: 'preview-only-not-a-live-credential' },
);
const html = HTMLPart.replace('<head>', '<head><meta name="robots" content="noindex,nofollow">');
const outputs = [
  ['../docs/assets/email/support-email-preview.html', html],
  // Relative assets let the same static preview use either live environment.
  ['../public/email-preview/support.html', html.replaceAll('https://mywaveplan.com/fonts/', '/fonts/')],
];
for (const [path, content] of outputs) {
  const url = new URL(path, import.meta.url);
  await mkdir(new URL('.', url), { recursive: true });
  await writeFile(url, content);
  console.log(`Rendered ${url.pathname}`);
}
