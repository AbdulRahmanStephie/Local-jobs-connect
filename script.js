const page = document.body.dataset.page;
const toast = document.querySelector("#toast");

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

async function api(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || "Something went wrong");
  }
  return data;
}

function jobCard(job) {
  const article = document.createElement("article");
  article.className = "job-card";

  const tag = document.createElement("span");
  tag.className = "tag";
  tag.textContent = job.category;

  const title = document.createElement("h3");
  title.textContent = job.title;

  const details = document.createElement("p");
  details.textContent = job.details;

  const meta = document.createElement("div");
  meta.className = "job-meta";
  [
    ["Area:", job.area],
    ["Pay:", job.pay],
    ["Schedule:", job.schedule],
    ["Phone:", job.employer_phone]
  ].forEach(([label, value]) => {
    const row = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = label;
    row.append(strong, ` ${value}`);
    meta.append(row);
  });

  const applyLink = document.createElement("a");
  applyLink.className = "button secondary";
  applyLink.href = `/apply.html?job_id=${job.id}`;
  applyLink.textContent = "Apply now";

  article.append(tag, title, details, meta, applyLink);
  return article;
}

async function loadJobs() {
  const jobList = document.querySelector("#jobList");
  const searchInput = document.querySelector("#searchInput");
  const categoryInput = document.querySelector("#categoryInput");
  const areaInput = document.querySelector("#areaInput");

  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("search", searchInput.value.trim());
  if (categoryInput.value !== "all") params.set("category", categoryInput.value);
  if (areaInput.value.trim()) params.set("area", areaInput.value.trim());

  jobList.innerHTML = '<p class="empty">Loading jobs...</p>';
  const jobs = await api(`/api/jobs?${params.toString()}`);
  jobList.innerHTML = "";

  if (!jobs.length) {
    jobList.innerHTML = '<p class="empty">No jobs match those filters yet. Try another service or area.</p>';
    return;
  }

  jobs.forEach((job) => jobList.append(jobCard(job)));
}

function setupJobsPage() {
  ["#searchInput", "#categoryInput", "#areaInput"].forEach((selector) => {
    document.querySelector(selector).addEventListener("input", loadJobs);
  });
  loadJobs().catch((error) => showToast(error.message));
}

function setupPostPage() {
  const form = document.querySelector("#postJobForm");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));

    try {
      await api("/api/jobs", {
        method: "POST",
        body: JSON.stringify(data)
      });
      form.reset();
      showToast("Job saved to the database.");
      window.setTimeout(() => {
        window.location.href = "/jobs.html";
      }, 700);
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function setupApplyPage() {
  const params = new URLSearchParams(window.location.search);
  const jobId = params.get("job_id");
  const jobDetails = document.querySelector("#jobDetails");
  const form = document.querySelector("#applyForm");

  if (!jobId) {
    jobDetails.innerHTML = '<p class="empty">No job was selected. Please choose a job from the Jobs page.</p>';
    form.hidden = true;
    return;
  }

  try {
    const job = await api(`/api/jobs/${jobId}`);
    jobDetails.replaceWith(jobCard(job));
  } catch (error) {
    jobDetails.innerHTML = `<p class="empty">${error.message}</p>`;
    form.hidden = true;
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = Object.fromEntries(new FormData(form));
    data.job_id = Number(jobId);

    try {
      await api("/api/applications", {
        method: "POST",
        body: JSON.stringify(data)
      });
      form.reset();
      showToast("Application saved to the database.");
      window.setTimeout(() => {
        window.location.href = "/applications.html";
      }, 800);
    } catch (error) {
      showToast(error.message);
    }
  });
}

async function setupApplicationsPage() {
  const list = document.querySelector("#applicationList");
  list.innerHTML = '<p class="empty">Loading applications...</p>';

  try {
    const applications = await api("/api/applications");
    list.innerHTML = "";

    if (!applications.length) {
      list.innerHTML = '<p class="empty">No applications have been submitted yet.</p>';
      return;
    }

    applications.forEach((application) => {
      const card = document.createElement("article");
      card.className = "job-card";

      const tag = document.createElement("span");
      tag.className = "tag";
      tag.textContent = application.category;

      const name = document.createElement("h3");
      name.textContent = application.applicant_name;

      const message = document.createElement("p");
      message.textContent = application.message;

      const meta = document.createElement("div");
      meta.className = "job-meta";
      [
        ["Job:", application.job_title],
        ["Phone:", application.phone],
        ["Area:", application.area],
        ["Date:", application.created_at]
      ].forEach(([label, value]) => {
        const row = document.createElement("span");
        const strong = document.createElement("strong");
        strong.textContent = label;
        row.append(strong, ` ${value}`);
        meta.append(row);
      });

      card.append(tag, name, message, meta);
      list.append(card);
    });
  } catch (error) {
    list.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

if (page === "jobs") setupJobsPage();
if (page === "post") setupPostPage();
if (page === "apply") setupApplyPage();
if (page === "applications") setupApplicationsPage();
