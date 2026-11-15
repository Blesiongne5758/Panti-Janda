# Production Release Verification Checklist

Use this checklist for each production release of Panti Janda. It reflects the current release workflow in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml); update it if the deployment pipeline changes.

> **Release rule:** a successful `git push` is not proof of deployment. Confirm that GitHub Actions completed successfully for the exact release commit, then verify the live site and critical user flows.

## Release record

- Release / change: ______________________________
- Target commit SHA: _____________________________
- GitHub Actions run URL / ID: ___________________
- Release operator: ______________________________
- Release date and time (timezone): ______________
- Previous known-good SHA / rollback target: ______
- Database migration IDs, or `none`: _____________

## 1. Release authorization and source

- [ ] The release is approved and its scope is understood; high-impact data, payment, or permission changes have separate approval where required.
- [ ] The intended commit is on `main`; the commit SHA is recorded and matches the reviewed change.
- [ ] The working tree is clean, no unrelated changes are included, and the release contains no secrets, local fixture data, temporary diagnostics, or generated test captures.
- [ ] The relevant change has been reviewed, and the release note records user-visible changes and known limitations.
- [ ] The rollback target and the person responsible for initiating rollback are identified before deployment starts.

## 2. Pre-deployment validation

Run checks against the release commit and a local or isolated test fixture—not the production database.

- [ ] Node.js matches the project engine (`>=22.12.0 <23`); dependencies install reproducibly with `npm ci`.
- [ ] `npm run check:function` passes. This checks backend syntax and call-signaling synchronization.
- [ ] `npm run build` passes, including TypeScript checking, and produces the expected `dist/` output.
- [ ] Run the documented fixture suites that cover the changed areas:
  - [ ] `node dev/smoke.mjs`
  - [ ] `node dev/e2e-phase-a.mjs`
  - [ ] `node dev/e2e-esport-006.mjs`
  - [ ] `node dev/e2e-transfer.mjs`
  - [ ] `node dev/e2e-calendar.mjs`
- [ ] Start a fresh in-memory fixture for each suite that mutates fixture state; record pass/fail totals and investigate every failure instead of treating a zero exit code alone as proof.
- [ ] For dashboard, auth, or navigation changes, run the mobile menu-to-dashboard flow at narrow phone widths (at least 360 px and 390 px). Check visible content, role-specific branches, active navigation, horizontal overflow, API failures, and browser console errors.
- [ ] Test the relevant account states: non-janda/public, verified member, pending member, higher-tier member, and admin. Use dedicated test accounts; keep credentials out of logs and reports.
- [ ] If a role has no real test account, a UI-only mocked/overridden role may validate rendering, but **does not** validate backend authentication or authorization. Obtain an appropriate isolated/staging account for those checks.
- [ ] No local fixture, smoke test, or test write is pointed at production. Payment tests use sandbox configuration; destructive, payment, and financial flows are not part of a routine production smoke test.

## 3. Database and migration gate

- [ ] Compare the release with `supabase/migrations/` and identify whether schema or database-function changes are required.
- [ ] Confirm GitHub Actions' read-only migration check compares local files with the production migration history and previews pending migrations.
- [ ] If the workflow reports a pending migration or history mismatch, stop the release; apply or reconcile it through the reviewed migration procedure, then rerun the workflow.
- [ ] Apply required migrations through the approved, reviewed process and confirm their completion before deploying code that depends on them.
- [ ] Confirm the new and previous application versions remain compatible during rollout, especially for expand/contract or data backfill changes.
- [ ] If no migration is needed, record `none` in the release record.

> **Important:** the workflow runs [`supabase migration list`](https://supabase.com/docs/reference/cli/supabase-migration-list) and [`supabase db push --dry-run`](https://supabase.com/docs/reference/cli/supabase-db-push). The dry-run does not apply SQL; this gate blocks when it detects pending migrations. The history comparison is version-based and does not detect edits to the SQL content of an already-applied migration. It is not a SQL execution or schema-behavior test. Migration application remains a separate reviewed step.

## 4. Production configuration and secrets

Before starting the workflow, verify that the GitHub Environment named `production` is attached to the job and the required secret *names* are configured. Do not print or copy secret values into logs, this checklist, or release notes.

- [ ] Build/runtime configuration: `SUPABASE_URL`, `SUPABASE_ANON_KEY`.
- [ ] Supabase deployment and function secrets: `SUPABASE_ACCESS_TOKEN`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
- [ ] Database password used by the migration preflight: `SUPABASE_DB_PASSWORD`, stored as a masked secret in the `production` GitHub Environment. This remains a privileged database credential; restrict access to the production environment and never expose its value.
- [ ] FTP deployment credentials: `FTP_SERVER`, `FTP_USERNAME`, `FTP_PASSWORD`.
- [ ] Confirm the Supabase URL resolves to the intended production project and the FTP destination is the intended site root (`/htdocs/`).
- [ ] Confirm any other runtime secrets required by the changed feature are already configured in the production Supabase project.
- [ ] Confirm no service-role key or other server-only secret is exposed through Vite build variables or bundled frontend assets.

## 5. Deploy and verify the workflow

The workflow runs on pushes to `main` and supports `workflow_dispatch`. After dependency installation, backend validation, and build, it derives the Supabase project ref and checks local/remote migration history with a non-applying dry-run. Only if that gate passes does it configure Cloudinary function secrets, deploy Supabase Edge Function `app`, and sync `dist/` to `/htdocs/` over FTP.

- [ ] Start the deployment only after sections 1–4 are complete.
- [ ] Open **Actions → Deploy Website** and select the run for the recorded commit SHA.
- [ ] Confirm each relevant step completed: checkout, dependency install, backend validation, build, project-ref derivation, migration history/dry-run gate, function-secret configuration, Edge Function deployment, and FTP sync.
- [ ] Confirm the final run conclusion is `success` and the run's commit SHA exactly matches the intended release SHA.
- [ ] If a run is `cancelled`, confirm whether the concurrency rule (`cancel-in-progress: true`) replaced it with a newer release; verify the newest run's SHA and completion instead of assuming the earlier push deployed.
- [ ] If any step fails, record the failed step and stop treating the release as complete. Diagnose before retrying; do not claim production is current based on the push alone.

## 6. Production smoke verification

After a successful workflow, use an approved production test account and read-only actions wherever possible. Record UTC/local time, tested role, route, and result—never passwords, session tokens, or personal profile data.

- [ ] Open `https://www.panijanda.my.id/`; verify HTTPS, expected page content, and no redirect loop or blank screen.
- [ ] Verify the built frontend and its static assets load successfully (no broken JavaScript/CSS or unexpected 404/500 responses).
- [ ] Verify the app's hash routes work, including login and the dashboard route `/#/dasbor`.
- [ ] On mobile, open the menu/drawer and select **Dasbor**; confirm the route changes, the drawer closes, and the dashboard heading/content render.
- [ ] Repeat at a narrow Android-sized viewport (e.g. 360 × 800) and a common phone viewport (e.g. 390 × 844); confirm no horizontal overflow and that bottom navigation remains usable.
- [ ] Cover the role branches present in `src/lib/constants.ts`: `public`, `kades`, `walikota`, `gubernur`, `panglima`, `presiden`, `ceo`, `sultan`, `wonder_woman`, `sosialita`, `high_society`, `the_ceo`, and `admin`. Use real authenticated accounts for backend/permission verification; do not infer authorization from mocked UI roles.
- [ ] Verify state-specific behavior where applicable: pending profiles show the pending-verification notice; verified members see their profile content; non-janda roles see their support/community content; admin can reach the dashboard from the mobile menu.
- [ ] Check browser console and application API responses for uncaught errors, failed dashboard calls, or unexpected 4xx/5xx responses. Confirm idle voice-call polling does not generate server errors.
- [ ] Limit the smoke test to safe reads and login/session setup. Do not create payments, donations, posts, accounts, or other production records unless that specific action has been separately authorized and is part of an approved test plan.

## 7. Post-release monitoring and sign-off

- [ ] Observe the site and Supabase function logs for errors after release; redact tokens, personal data, and secret values from any incident notes.
- [ ] Confirm the deployed frontend and Edge Function are serving the intended release and are not a mismatched partial rollout.
- [ ] Record smoke-test results, exceptions, open issues, and the monitoring window.
- [ ] Notify stakeholders that the release is complete only after workflow and production smoke checks pass.

## 8. Failure and rollback

- [ ] If the release is broken, capture the failed workflow URL, exact SHA, error time, affected route/role, and sanitized error evidence.
- [ ] Decide whether the failure is frontend-only, Edge Function-only, migration-related, or a mixed/partial deployment before rolling back.
- [ ] For application-code rollback, use a reviewed revert or redeploy the known-good commit through the normal workflow; do not force-push or rewrite `main` history.
- [ ] If frontend and Edge Function are rolled back separately, verify their API contracts remain compatible and then repeat the production smoke checks.
- [ ] Do not automatically roll back database migrations. Use the migration's documented recovery plan; prefer a reviewed forward fix when rollback could lose or corrupt data.
- [ ] Confirm the rollback itself completed for the intended SHA/version and record the outcome and follow-up actions.

## Release sign-off

- Pre-deployment checks: _________________________
- Migration status: ______________________________
- Actions run and exact SHA: _____________________
- Production smoke result: _______________________
- Monitoring / rollback notes: ___________________
- Final status: `PASS` / `BLOCKED` / `ROLLED BACK`
