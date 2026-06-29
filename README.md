# Local Jobs Connect

This is a small database-backed website for local jobs such as cleaners, gardeners, house help, security guards, and shop assistants.

## How to run in VS Code

1. Open this folder in VS Code:
   `C:\Users\mercy\Documents\Codex\2026-06-26\a\outputs\local-jobs-website`
2. Open the VS Code terminal.
3. Run:
   ```powershell
   python app.py
   ```
4. Open this address in your browser:
   `http://127.0.0.1:8000/`

## Pages

- `index.html` - home page
- `jobs.html` - browse and search jobs
- `post.html` - employer job posting form
- `apply.html` - job application form
- `applications.html` - saved applications from the database

## Database

The website uses SQLite through Python's built-in `sqlite3` module, so no extra installation is needed. When `app.py` runs, it creates:

- `localjobs.db`
- `jobs` table
- `applications` table

The first run also adds sample local jobs for demonstration.

## Suggested project explanation

This prototype follows the Group 6 Local Jobs Web Platform idea. It separates the presentation pages from the backend API, saves job postings and applications in a database, and supports the main required features: job posting, job searching, and job application submission.
