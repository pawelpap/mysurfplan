// Retired after the one-off September 2026 test-data reconciliation.
// Never recreate obsolete tables or merge credentials across environments.
throw new Error(
  'This legacy reconciliation script is retired. Use versioned migrations and the EU migration runbook; staging and production data are independent.',
);
