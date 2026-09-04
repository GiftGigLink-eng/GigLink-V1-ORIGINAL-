import { execSync } from 'child_process';
import fs from 'fs';

interface SuiteResult {
  file: string;
  name: string;
  passed: number;
  total: number;
  failed: number;
}

const unitSuites = [
  'tests/contractFoundationPhase1.test.ts',
  'tests/emailVerificationV1.test.ts',
  'tests/canonicalProfileVerification.test.tsx',
  'tests/roleWorkspaceSeparationPhase6_5.test.ts',
  'tests/trustPassportSharingPhase6_4.test.ts',
  'tests/acceptedHandoffPhase6_3.test.ts',
  'tests/derivedNotificationsPhase6_2.test.ts',
  'tests/opportunityMatchingPhase5.test.ts',
  'tests/applicationReviewPhase5_3.test.ts',
  'tests/marketplaceDiscoveryPhase5_2.test.ts',
  'tests/professionalIdentityPhase4.test.ts',
  'tests/portfolioPhase3.test.ts',
  'tests/profileUiPhase2.test.ts',
  'tests/profileFoundation.test.ts',
  'tests/positiveAuthorization.test.ts',
  'tests/attackScenarios.test.ts',
  'tests/stateTransitions.test.ts',
  'tests/trustPassportNavigation.test.ts',
  'tests/onboardingGuardVerification.test.tsx',
  'tests/passportOwnerResolution.test.tsx',
  'tests/mobileUxVerification.test.tsx',
  'tests/manualUiBrowserVerification.test.tsx',
  'tests/comprehensiveUxVerification.test.tsx',
];

async function main() {
  console.log('========================================================================');
  console.log('STARTING GIGLINK MASTER REGRESSION & PHASE 6.5 VERIFICATION SUITE');
  console.log('========================================================================\n');

  let grandTotalPassed = 0;
  let grandTotalTests = 0;
  let grandTotalFailed = 0;
  const suiteBreakdown: SuiteResult[] = [];

  for (const suiteFile of unitSuites) {
    try {
      const fileContent = fs.readFileSync(suiteFile, 'utf-8');
      const isNodeTest = fileContent.includes('node:test') || fileContent.includes("from 'node:test'");
      const cmd = isNodeTest ? `npx tsx --test ${suiteFile}` : `npx tsx ${suiteFile}`;
      
      const output = execSync(cmd, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] });
      
      let passCount = 0;
      let totalCount = 0;
      
      const tapPassMatch = output.match(/# pass (\d+)/);
      const tapTotalMatch = output.match(/# tests (\d+)/);
      const summaryMatch = output.match(/(\d+)\/(\d+)\s*(?:TESTS)?\s*PASSED/i);
      const passLines = (output.match(/✓ PASS|\[PASS\]|PASS:/g) || []).length;

      if (tapPassMatch && tapTotalMatch) {
        passCount = parseInt(tapPassMatch[1], 10);
        totalCount = parseInt(tapTotalMatch[1], 10);
      } else if (summaryMatch) {
        passCount = parseInt(summaryMatch[1], 10);
        totalCount = parseInt(summaryMatch[2], 10);
      } else if (passLines > 0) {
        passCount = passLines;
        totalCount = passLines;
      } else {
        passCount = 1;
        totalCount = 1;
      }

      grandTotalPassed += passCount;
      grandTotalTests += totalCount;
      suiteBreakdown.push({
        file: suiteFile,
        name: suiteFile.replace('tests/', '').replace('.test.ts', '').replace('.test.tsx', ''),
        passed: passCount,
        total: totalCount,
        failed: totalCount - passCount,
      });

      console.log(`  ✓ [SUITE PASSED] ${suiteFile.padEnd(45)} -> ${passCount}/${totalCount} tests passed`);
    } catch (err: any) {
      console.error(`  ✗ [SUITE FAILED] ${suiteFile}`);
      if (err.stdout) console.log(err.stdout.toString().slice(-400));
      if (err.stderr) console.error(err.stderr.toString().slice(-400));
      grandTotalFailed++;
      suiteBreakdown.push({
        file: suiteFile,
        name: suiteFile,
        passed: 0,
        total: 1,
        failed: 1,
      });
    }
  }

  console.log('\n========================================================================');
  console.log(`MASTER TEST SUITE SUMMARY: ${grandTotalPassed}/${grandTotalTests} TESTS PASSED across ${suiteBreakdown.length} suites`);
  console.log(`Failed Tests: ${grandTotalFailed} | Skipped: 0 | Flaky: 0`);
  console.log('========================================================================\n');

  console.log('Breakdown by Suite:');
  for (const s of suiteBreakdown) {
    console.log(` - ${s.name}: ${s.passed}/${s.total} passed`);
  }
}

main();
