// surf/lib/cms.js
import { createClient } from 'contentful';

const space = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

if (!space || !accessToken) {
  throw new Error('Missing CONTENTFUL_SPACE_ID or CONTENTFUL_ACCESS_TOKEN');
}

const cf = createClient({ space, accessToken });

// helpers
const pickAsset = (a) =>
  a
    ? {
        id: a.sys.id,
        url: a.fields?.file?.url ? `https:${a.fields.file.url}` : '',
        contentType: a.fields?.file?.contentType || '',
        width: a.fields?.file?.details?.image?.width,
        height: a.fields?.file?.details?.image?.height,
      }
    : null;

export async function getSettings() {
  const res = await cf.getEntries({ content_type: 'globalSettings', limit: 1 });
  const i = res.items?.[0];
  if (!i) return { siteName: 'MyWavePlan', logo: null };
  return {
    siteName: i.fields.siteName || 'MyWavePlan',
    logo: pickAsset(i.fields.logo),
  };
}
