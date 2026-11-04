const pingPattern = /^https:\/\/hc-ping\.com\/[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export function monitorPingUrl(value) {
  return typeof value === 'string' && pingPattern.test(value) ? value : null;
}

export async function reportEmailHealth(query, config, fetchImpl = fetch) {
  if (!['production','staging'].includes(config.environment) || !config.monitorUrl) return;
  try {
    const [health] = await query(`
      SELECT
        EXISTS(SELECT 1 FROM job_outbox WHERE environment=$1 AND status='pending'
          AND (due_at<now()-interval '10 minutes'
            OR (type='email.account_reset' AND expires_at<now()+interval '10 minutes'))) AS backlog,
        EXISTS(SELECT 1 FROM job_outbox WHERE environment=$1 AND updated_at>now()-interval '30 minutes'
          AND (status='delivery_unknown' OR (status='expired' AND type<>'email.delivery_check')
            OR error_code IN ('provider_rejected_401','provider_rejected_403'))) AS delivery_issue,
        (SELECT count(*)>=3 FROM job_outbox WHERE environment=$1 AND updated_at>now()-interval '30 minutes'
          AND status='failed' AND error_code LIKE 'provider%rejected%') AS repeated_rejection,
        EXISTS(SELECT 1 FROM email_usage WHERE environment=$1 AND
          ((period='day' AND starts_on=(now() AT TIME ZONE 'UTC')::date AND attempts>=$2)
            OR (period='month' AND starts_on=date_trunc('month',now() AT TIME ZONE 'UTC')::date AND attempts>=$3))) AS quota
    `, [config.environment, config.dailyLimit, config.monthlyLimit]);
    const reasons = ['backlog','delivery_issue','repeated_rejection','quota'].filter(key => health[key]);
    const response = await fetchImpl(config.monitorUrl + (reasons.length ? '/fail' : ''), {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(3000),
      body: reasons.join(','),
    });
    if (!response.ok) throw new Error('Email monitor rejected ping');
  } catch {
    // A missing heartbeat is independently detected. Keep credentials and customer data out of logs.
    console.error('email_monitor_ping_failed');
  }
}
