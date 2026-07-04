from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import sqlite3
from urllib.parse import parse_qs, urlparse

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "localjobs.db"

SEED_JOBS = [
    (
        "Part-time house cleaner",
        "Cleaning",
        "Area 25",
        "MWK 12,000 per week",
        "Mondays, Wednesdays, Fridays",
        "0888 111 222",
        "Sweep, mop, wash dishes, and keep a family home tidy.",
    ),
    (
        "Garden boy needed",
        "Gardening",
        "Kawale",
        "MWK 20,000 per month",
        "Three mornings each week",
        "0999 222 333",
        "Water plants, trim grass, remove weeds, and keep the yard clean.",
    ),
    (
        "Live-out house help",
        "House Help",
        "Chilinde",
        "MWK 35,000 per month",
        "Monday to Saturday",
        "0888 333 444",
        "Help with laundry, cleaning, cooking preparation, and daily home tasks.",
    ),
    (
        "Night security guard",
        "Security",
        "Likuni",
        "MWK 45,000 per month",
        "6 PM to 6 AM",
        "0999 444 555",
        "Watch a small shop at night and report any suspicious activity.",
    ),
    (
        "Shop assistant",
        "Shop Assistant",
        "Old Town",
        "MWK 25,000 per month",
        "Weekdays",
        "0888 555 666",
        "Serve customers, arrange stock, and help keep records simple and clear.",
    ),
]


def connect():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection


def normalize_phone(phone):
    return "".join(char for char in str(phone or "") if char.isdigit())


def build_whatsapp_url(phone):
    digits = normalize_phone(phone)
    return f"https://wa.me/{digits}" if digits else None


def get_applications_for_job(job_id, employer_phone):
    with connect() as db:
        job = db.execute("SELECT employer_phone FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if job is None:
            raise LookupError("Job not found")
        if normalize_phone(job["employer_phone"]) != normalize_phone(employer_phone):
            raise PermissionError("Only the job poster can view applicants for this job.")

        rows = db.execute(
            """
            SELECT
                applications.id,
                applications.applicant_name,
                applications.phone,
                applications.area,
                applications.message,
                applications.created_at,
                jobs.title AS job_title,
                jobs.category,
                jobs.employer_phone
            FROM applications
            JOIN jobs ON jobs.id = applications.job_id
            WHERE applications.job_id = ?
            ORDER BY applications.id DESC
            """,
            (job_id,),
        ).fetchall()
    return rows_to_dicts(rows)


def init_db():
    with connect() as db:
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS jobs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                category TEXT NOT NULL,
                area TEXT NOT NULL,
                pay TEXT NOT NULL,
                schedule TEXT NOT NULL,
                employer_phone TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        db.execute(
            """
            CREATE TABLE IF NOT EXISTS applications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                job_id INTEGER NOT NULL,
                applicant_name TEXT NOT NULL,
                phone TEXT NOT NULL,
                area TEXT NOT NULL,
                message TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (job_id) REFERENCES jobs (id)
            )
            """
        )
        job_count = db.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
        if job_count == 0:
            db.executemany(
                """
                INSERT INTO jobs
                (title, category, area, pay, schedule, employer_phone, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                SEED_JOBS,
            )
        db.commit()


def rows_to_dicts(rows):
    return [dict(row) for row in rows]


def read_json(handler):
    length = int(handler.headers.get("Content-Length", "0"))
    if length == 0:
        return {}
    return json.loads(handler.rfile.read(length).decode("utf-8"))


def validate_required(data, fields):
    missing = [field for field in fields if not str(data.get(field, "")).strip()]
    if missing:
        raise ValueError("Missing required fields: " + ", ".join(missing))


class LocalJobsHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(BASE_DIR), **kwargs)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def send_json(self, payload, status=200):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"error": message}, status)

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/":
            self.path = "/index.html"
            return super().do_GET()
        if parsed.path == "/api/jobs":
            return self.get_jobs(parsed)
        if parsed.path.startswith("/api/jobs/"):
            return self.get_job(parsed.path)
        if parsed.path == "/api/applications":
            return self.get_applications(parsed)
        return super().do_GET()

    def do_POST(self):
        parsed = urlparse(self.path)
        try:
            if parsed.path == "/api/jobs":
                return self.create_job()
            if parsed.path == "/api/applications":
                return self.create_application()
            return self.send_error_json("Route not found", 404)
        except ValueError as error:
            return self.send_error_json(str(error), 400)
        except json.JSONDecodeError:
            return self.send_error_json("Invalid JSON", 400)

    def get_jobs(self, parsed):
        query = parse_qs(parsed.query)
        search = query.get("search", [""])[0].strip()
        category = query.get("category", [""])[0].strip()
        area = query.get("area", [""])[0].strip()

        sql = "SELECT * FROM jobs WHERE 1 = 1"
        params = []

        if search:
            sql += " AND (title LIKE ? OR category LIKE ? OR area LIKE ? OR details LIKE ?)"
            search_value = f"%{search}%"
            params.extend([search_value, search_value, search_value, search_value])
        if category:
            sql += " AND category = ?"
            params.append(category)
        if area:
            sql += " AND area LIKE ?"
            params.append(f"%{area}%")

        sql += " ORDER BY id DESC"
        with connect() as db:
            rows = db.execute(sql, params).fetchall()
        self.send_json(rows_to_dicts(rows))

    def get_job(self, path):
        try:
            job_id = int(path.rsplit("/", 1)[1])
        except ValueError:
            return self.send_error_json("Invalid job id", 400)

        with connect() as db:
            row = db.execute("SELECT * FROM jobs WHERE id = ?", (job_id,)).fetchone()
        if row is None:
            return self.send_error_json("Job not found", 404)
        self.send_json(dict(row))

    def create_job(self):
        data = read_json(self)
        fields = ["title", "category", "area", "pay", "schedule", "employer_phone", "details"]
        validate_required(data, fields)

        with connect() as db:
            cursor = db.execute(
                """
                INSERT INTO jobs
                (title, category, area, pay, schedule, employer_phone, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                tuple(str(data[field]).strip() for field in fields),
            )
            db.commit()
        self.send_json({"id": cursor.lastrowid, "message": "Job created"}, 201)

    def create_application(self):
        data = read_json(self)
        fields = ["job_id", "name", "phone", "area", "message"]
        validate_required(data, fields)

        with connect() as db:
            job = db.execute("SELECT id FROM jobs WHERE id = ?", (data["job_id"],)).fetchone()
            if job is None:
                return self.send_error_json("Job not found", 404)
            cursor = db.execute(
                """
                INSERT INTO applications
                (job_id, applicant_name, phone, area, message)
                VALUES (?, ?, ?, ?, ?)
                """,
                (
                    int(data["job_id"]),
                    str(data["name"]).strip(),
                    str(data["phone"]).strip(),
                    str(data["area"]).strip(),
                    str(data["message"]).strip(),
                ),
            )
            db.commit()
        self.send_json({"id": cursor.lastrowid, "message": "Application created"}, 201)

    def get_applications(self, parsed=None):
        query = parse_qs(parsed.query if parsed else "")
        job_id = query.get("job_id", [""])[0].strip()
        employer_phone = query.get("employer_phone", [""])[0].strip()

        if job_id:
            try:
                rows = get_applications_for_job(int(job_id), employer_phone)
            except LookupError as error:
                return self.send_error_json(str(error), 404)
            except PermissionError as error:
                return self.send_error_json(str(error), 403)
            self.send_json(rows)
            return

        if employer_phone:
            with connect() as db:
                rows = db.execute(
                    """
                    SELECT
                        applications.id,
                        applications.applicant_name,
                        applications.phone,
                        applications.area,
                        applications.message,
                        applications.created_at,
                        jobs.title AS job_title,
                        jobs.category,
                        jobs.employer_phone
                    FROM applications
                    JOIN jobs ON jobs.id = applications.job_id
                    ORDER BY applications.id DESC
                    """
                ).fetchall()
            rows = [row for row in rows_to_dicts(rows) if normalize_phone(row["employer_phone"]) == normalize_phone(employer_phone)]
            self.send_json(rows)
            return

        with connect() as db:
            rows = db.execute(
                """
                SELECT
                    applications.id,
                    applications.applicant_name,
                    applications.phone,
                    applications.area,
                    applications.message,
                    applications.created_at,
                    jobs.title AS job_title,
                    jobs.category,
                    jobs.employer_phone
                FROM applications
                JOIN jobs ON jobs.id = applications.job_id
                ORDER BY applications.id DESC
                """
            ).fetchall()
        self.send_json(rows_to_dicts(rows))


def main():
    init_db()
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), LocalJobsHandler)
    print(f"Local Jobs Connect is running at http://{host}:{port}/")
    print(f"Open http://127.0.0.1:{port}/ locally")
    print(f"Database file: {DB_PATH}")
    server.serve_forever()


if __name__ == "__main__":
    main()
