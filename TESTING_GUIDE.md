# Testing and Preview Environments

The live site is deployed separately from testing. Never give a Preview deployment production database, GitHub, or email credentials.

## Local development

1. Install dependencies with `npm install`.
2. Install or authenticate the Vercel CLI.
3. Create a local `.env` based on `.env.example`.
4. Set `APP_ENV=preview`, `NODE_ENV=development`, and `ALLOW_EXTERNAL_WRITES=false`.
5. Use a test Postgres database if database-backed pages are being tested.
6. Run `vercel dev` and open the local URL shown by Vercel.

In this mode, email delivery, analytics writes, and external file writes are disabled by default.

### Database-free local mode

For UI and workflow testing without Postgres, set `DEV_MEMORY_DB=true` in the local `.env`. The server starts with one disposable demo customer and invoice, including retainage. Customer and invoice CRUD, status changes, and retainage tracking use the local-only `.local-test-state.json` file, which is not a database and is ignored by Git. Delete that file to reset the demo state.

This flag is refused when `NODE_ENV=production`, `APP_ENV=preview`, or `VERCEL_ENV=preview` is active. It cannot affect the live site or a Vercel Preview deployment.

## Vercel Preview

Create a Preview deployment with `vercel` or by pushing a branch. In Vercel, configure these variables for the **Preview** environment only:

```text
APP_ENV=preview
ALLOW_EXTERNAL_WRITES=false
POSTGRES_URL=<preview database>
JWT_SECRET=<preview-only secret>
ADMIN_PASSWORD_HASH=<preview-only password hash>
GITHUB_TOKEN=<test repository token, only when uploads are needed>
GITHUB_REPO_OWNER=<test repository owner>
GITHUB_REPO_NAME=<test repository name>
```

Set `ALLOW_EXTERNAL_WRITES=true` only when the Preview deployment is pointed at a dedicated test GitHub repository and test email services. Never point those variables at the production repository or production email account.

## Production protection

Production keeps its existing behavior when `APP_ENV=production` and `VERCEL_ENV=production`. Production variables should remain configured only in Vercel's **Production** environment. Do not promote a Preview deployment until its workflows have been verified.