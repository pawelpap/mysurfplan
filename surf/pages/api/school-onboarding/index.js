import { sql } from '../../../lib/db';
import { requireAuth } from '../../../lib/auth';
import { schoolOnboardingHandler } from '../../../lib/school-onboarding-server.mjs';
export default schoolOnboardingHandler({ sql, requireAuth });
