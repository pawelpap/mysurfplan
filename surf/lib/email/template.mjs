const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Shared, table-based shell for email-client compatibility. Branding uses one
// public, static image shared by every message, with no recipient/job URL data.
// Tracking remains disabled in the provider adapter. Copy is escaped, never HTML.
export function supportEmail({ title, paragraphs, staging = false }) {
  const heading = `${staging ? '[Staging] ' : ''}${title}`;
  const text = `MyWavePlan\n\n${heading}\n\n${paragraphs.join('\n\n')}\n\nMyWavePlan Support Team\nsupport@mywaveplan.com\nhttps://mywaveplan.com`;
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(heading)}</title></head>
<body style="margin:0;padding:0;background-color:#f2f6f6;color:#193139;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="#f2f6f6"><tr><td align="center" style="padding:28px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="max-width:560px;background-color:#ffffff;border:1px solid #dce7e8;border-radius:16px;overflow:hidden">
<tr><td bgcolor="#087b86" style="height:5px;font-size:0;line-height:0">&nbsp;</td></tr>
<tr><td style="padding:28px 28px 24px">
<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>
<td width="44"><img src="https://mywaveplan.com/icons/icon-192.png" width="44" height="44" alt="" style="display:block;border:0;border-radius:10px"></td>
<td style="padding-left:12px;color:#193139;font-size:21px;font-weight:bold;letter-spacing:-0.4px">MyWavePlan</td>
</tr></table>
</td></tr>
<tr><td style="padding:0 28px 28px;color:#193139">
<h1 style="margin:0 0 18px;font-size:25px;line-height:1.3;font-weight:bold;letter-spacing:-0.4px">${escape(heading)}</h1>
${paragraphs.map(p => `<p style="margin:0 0 16px;font-size:16px;line-height:1.6;color:#435b63">${escape(p)}</p>`).join('')}
</td></tr>
<tr><td style="padding:22px 28px;border-top:1px solid #e1eaeb;background-color:#f8fafa;color:#435b63;font-size:14px;line-height:1.7">
<strong style="color:#193139">MyWavePlan Support Team</strong><br>
<a href="mailto:support@mywaveplan.com" style="color:#087b86;text-decoration:none">support@mywaveplan.com</a><br>
<a href="https://mywaveplan.com" style="color:#087b86;text-decoration:none">mywaveplan.com</a>
</td></tr></table></td></tr></table></body></html>`;
  return { text, html };
}
