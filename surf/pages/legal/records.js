// Keep existing links working while account settings live in the workspace.
export default function LegalRecordsRedirect() { return null; }
export async function getServerSideProps({ res }) {
  res.setHeader('Cache-Control', 'private, no-store');
  return { redirect: { destination: '/?view=privacy', permanent: false } };
}
