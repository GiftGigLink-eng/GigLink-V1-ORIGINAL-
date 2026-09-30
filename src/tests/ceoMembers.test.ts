import { getAuthoritativeCeoMembers } from '../server/ceoMetricsService';

interface TestResult {
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(name: string, condition: boolean, message?: string) {
  results.push({ name, passed: condition, message });
  if (condition) {
    console.log(`  ✓ ${name}`);
  } else {
    console.error(`  ✗ ${name}: ${message || 'Assertion failed'}`);
  }
}

export async function runCeoMembersAudit() {
  console.log('\n--- CEO MEMBER DIRECTORY VERIFICATION AUDIT ---');

  const data = await getAuthoritativeCeoMembers();

  assert('MEM-01: Returns response with ISO timestamp and totalMembers', Boolean(data.timestamp && typeof data.totalMembers === 'number'));
  assert('MEM-02: Total members matches actual member array length', data.totalMembers === data.members.length);

  // Check UTC calculations
  const now = new Date();
  const startOfTodayUtc = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0);
  const sevenDaysAgoUtc = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgoUtc = now.getTime() - 30 * 24 * 60 * 60 * 1000;

  let allUtcBucketsValid = true;
  let noAllowedRolesLeaked = true;
  let noEmailsOrPii = true;
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;

  for (const m of data.members) {
    if ('allowedRoles' in m) noAllowedRolesLeaked = false;
    if (emailRegex.test(m.displayName)) noEmailsOrPii = false;

    const createdTime = new Date(m.createdAt).getTime();
    if (createdTime >= startOfTodayUtc) {
      if (m.timeBucket !== 'today') allUtcBucketsValid = false;
    } else if (createdTime >= sevenDaysAgoUtc) {
      if (m.timeBucket !== 'last_7_days') allUtcBucketsValid = false;
    } else if (createdTime >= thirtyDaysAgoUtc) {
      if (m.timeBucket !== 'last_30_days') allUtcBucketsValid = false;
    } else {
      if (m.timeBucket !== 'older') allUtcBucketsValid = false;
    }
  }

  assert('MEM-03: No allowedRoles exposed in any member record', noAllowedRolesLeaked);
  assert('MEM-04: No email/PII in display names', noEmailsOrPii);
  assert('MEM-05: Exact UTC timeBucket categorization matches createdAt timestamps', allUtcBucketsValid);

  // Print brief preview of real members returned
  console.log(`\nAudit sample: Found ${data.totalMembers} real member documents in Firestore users collection.`);
  data.members.slice(0, 3).forEach((m, idx) => {
    console.log(`  [${idx + 1}] ID: ${m.id} | Name: ${m.displayName} | Persona: ${m.activePersona} | Role: ${m.activeRole || 'unassigned'} | Bucket: ${m.timeBucket}`);
  });

  const passed = results.filter((r) => r.passed).length;
  console.log(`\nResult: ${passed}/${results.length} assertions passed.\n`);
  return results.filter((r) => !r.passed).length;
}

runCeoMembersAudit().then((failed) => {
  if (failed > 0) process.exit(1);
});
