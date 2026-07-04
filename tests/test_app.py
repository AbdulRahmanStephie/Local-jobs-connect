import shutil
import tempfile
import unittest
from pathlib import Path

import app as local_jobs_app


class ApplicantAccessTests(unittest.TestCase):
    def setUp(self):
        self.temp_dir = tempfile.TemporaryDirectory()
        self.db_path = Path(self.temp_dir.name) / "localjobs.db"
        local_jobs_app.DB_PATH = self.db_path
        local_jobs_app.init_db()

    def tearDown(self):
        shutil.rmtree(self.temp_dir.name, ignore_errors=True)

    def test_matching_employer_phone_can_view_applicants(self):
        with local_jobs_app.connect() as db:
            job_id = db.execute(
                """
                INSERT INTO jobs (title, category, area, pay, schedule, employer_phone, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Weekend cleaner",
                    "Cleaning",
                    "Area 25",
                    "MWK 10,000",
                    "Saturday",
                    "0888 111 222",
                    "Deep clean the house",
                ),
            ).lastrowid
            db.execute(
                """
                INSERT INTO applications (job_id, applicant_name, phone, area, message)
                VALUES (?, ?, ?, ?, ?)
                """,
                (job_id, "Ada", "0999 000 111", "Kawale", "I am available"),
            )
            db.commit()

        applications = local_jobs_app.get_applications_for_job(job_id, "0888 111 222")

        self.assertEqual(len(applications), 1)
        self.assertEqual(applications[0]["applicant_name"], "Ada")

    def test_mismatched_phone_is_denied(self):
        with local_jobs_app.connect() as db:
            job_id = db.execute(
                """
                INSERT INTO jobs (title, category, area, pay, schedule, employer_phone, details)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    "Garden helper",
                    "Gardening",
                    "Kawale",
                    "MWK 15,000",
                    "Sunday",
                    "0999 555 666",
                    "Water plants",
                ),
            ).lastrowid
            db.commit()

        with self.assertRaises(PermissionError):
            local_jobs_app.get_applications_for_job(job_id, "0888 111 222")


if __name__ == "__main__":
    unittest.main()
