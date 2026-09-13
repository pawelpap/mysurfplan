const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
const fontFamily = "'Poppins',Arial,Helvetica,sans-serif";
const fontSubsets = {
  'latin-ext': 'U+0100-02BA,U+02BD-02C5,U+02C7-02CC,U+02CE-02D7,U+02DD-02FF,U+0304,U+0308,U+0329,U+1D00-1DBF,U+1E00-1E9F,U+1EF2-1EFF,U+2020,U+20A0-20AB,U+20AD-20C0,U+2113,U+2C60-2C7F,U+A720-A7FF',
  latin: 'U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD',
};

// Hide web fonts from Word-based Outlook, which can otherwise ignore the
// fallback stack. Assets are shared, self-hosted and contain no recipient data.
function fontStyles(staging) {
  const origin = staging ? 'https://staging.mywaveplan.com' : 'https://mywaveplan.com';
  const faces = [400, 700].flatMap(weight => Object.entries(fontSubsets).map(([subset, range]) =>
    `@font-face{font-family:'Poppins';font-style:normal;font-weight:${weight};font-display:swap;src:url('${origin}/fonts/poppins/poppins-v24-${subset}-${weight}.woff2') format('woff2');unicode-range:${range};}`
  )).join('\n');
  return `<!--[if !mso]><!--><style>${faces}</style><!--<![endif]-->
<!--[if mso]><style>body,table,td,h1,p,a,strong{font-family:Arial,Helvetica,sans-serif !important;}</style><![endif]-->`;
}

// Shared, table-based shell for email-client compatibility. Branding uses one
// public, static image shared by every message, with no recipient/job URL data.
// Tracking remains disabled in the provider adapter. Copy is escaped, never HTML.
export function supportEmail({ title, paragraphs, staging = false }) {
  const heading = `${staging ? '[Staging] ' : ''}${title}`;
  const text = `MyWavePlan\n\n${heading}\n\n${paragraphs.join('\n\n')}\n\nMyWavePlan Support Team\nsupport@mywaveplan.com\nhttps://mywaveplan.com`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(heading)}</title>${fontStyles(staging)}</head>
<body style="margin:0;padding:0;background-color:#f2f6f6;color:#193139;font-family:${fontFamily}">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f6f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dce7e8;border-radius:16px;overflow:hidden">
<tr><td bgcolor="#087b86" style="height:5px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 24px">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="44"><img src="https://mywaveplan.com/icons/icon-192.png" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px"></td>
<td style="padding-left:12px;color:#193139;font-family:${fontFamily};font-size:21px;font-weight:700;letter-spacing:-0.4px">MyWavePlan</td>
</tr></table>
</td></tr>
<tr><td style="padding:0 28px 28px;color:#193139;font-family:${fontFamily}">
<h1 style="margin:0 0 18px;font-family:${fontFamily};font-size:25px;line-height:1.3;font-weight:700;letter-spacing:-0.4px">${escape(heading)}</h1>
${paragraphs.map(p => `<p style="margin:0 0 16px;font-family:${fontFamily};font-size:16px;line-height:1.6;color:#435b63">${escape(p)}</p>`).join('')}
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e1eaeb;background-color:#f8fafa;color:#435b63;font-family:${fontFamily};font-size:14px;line-height:1.7">
<strong style="color:#193139;font-family:${fontFamily};font-weight:700">MyWavePlan Support Team</strong><br>
<a href="mailto:support@mywaveplan.com" style="color:#087b86;font-family:${fontFamily};text-decoration:none">support@mywaveplan.com</a><br>
<a href="https://mywaveplan.com" style="color:#087b86;font-family:${fontFamily};text-decoration:none">mywaveplan.com</a>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
