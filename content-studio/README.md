# Lemida Content Studio

The admin app for the shared **Lemida question bank**: import question files, review them, edit them and
approve them. It is a separate app from SchoolManager (its own login screen, its own build, its own address)
and talks to the same backend through the `/bank` API.

Only an account the question bank accepts can sign in. Today that means **super admin** only
(see `server/modules/questionBank/permissions.js`).

## What it does

- **Dashboard** – counts of approved, draft and rejected questions per subject and topic, and per pool
  (`public` or `reserved`; reserved questions are for school mocks only).
- **Questions** – filter by subject, topic, status, pool, exam and search; approve, reject (with a note) and edit
  questions, one at a time or in bulk.
- **Import** – choose a `.json` question file from your computer, read the dry-run report (errors per question,
  approved questions that will need re-approval, theory questions skipped), then confirm. The file is read in
  the browser and sent to the API; it is never stored in this repo.

> **Never commit question files.** Real questions are imported through the Import page. `.gitignore` blocks
> `question-data/` and `*.questions.json`, and test fixtures in the repo use clearly fake sample questions.

## Run it locally

```bash
cd content-studio
cp .env.example .env        # then check VITE_API_URL
npm install
npm run dev                 # http://localhost:5174
```

The backend must allow the dev origin: add `http://localhost:5174` to `ALLOWED_ORIGINS` in `server/.env`
(see `server/.env.example`).

Other commands: `npm run build` (output in `dist/`), `npm run lint`, `npm run preview`.

## Deploy on Cloudflare Pages (free)

Cloudflare Pages builds this straight from GitHub. The GitHub Actions workflows for SchoolManager ignore
changes under `content-studio/`.

1. In the Cloudflare dashboard go to **Workers & Pages → Create → Pages → Connect to Git** and choose this
   repository. (If the repository is private, Cloudflare asks you to grant its GitHub app access to it.)
2. Build settings:

   | Setting | Value |
   | --- | --- |
   | Framework preset | None (or Vite) |
   | Root directory | `content-studio` |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Environment variable | `VITE_API_URL` = `https://api.lemidaitsolutions.com` |

   If the build complains about the Node version, also add `NODE_VERSION` = `24`.
3. `public/_redirects` (`/* /index.html 200`) is already in the repo so page refreshes work.
4. **Custom domain**: in the Pages project open **Custom domains → Set up a domain** and add
   `content.lemidaitsolutions.com`. Because the domain is in Cloudflare, it creates the DNS record for you.
5. Make sure the `tenant-router` Worker does not catch this address: Content Studio must not be treated as a
   school subdomain (exclude `content.lemidaitsolutions.com/*` from the Worker route).

The backend already accepts requests from any `https://*.lemidaitsolutions.com` origin, so no CORS change is
needed for `https://content.lemidaitsolutions.com`. A Cloudflare Pages preview URL (`*.pages.dev`) is only
allowed if you add it to `ALLOWED_ORIGINS` on the server.

## Settings

| Variable | Meaning |
| --- | --- |
| `VITE_API_URL` | Base URL of the Lemida API, no trailing slash. Baked in at build time. |

The login token is kept in the browser under its own key, `contentStudioToken`. A 401 from the API signs you
out.
