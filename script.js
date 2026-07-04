const page = document.body.dataset.page;
const toast = document.querySelector("#toast");

function setupSharedNavigation() {
  const nav = document.querySelector(".sidebar nav");
  if (!nav) return;

  const hasPostedJob = localStorage.getItem("hasPostedJob") === "true";
  const existingAppLink = nav.querySelector('a[href="/applications.html"]');

  if (hasPostedJob) {
    if (!existingAppLink) {
      const appLink = document.createElement("a");
      appLink.href = "/applications.html";
      appLink.textContent = "Application";
      nav.append(appLink);
    }
  } else if (existingAppLink) {
    existingAppLink.remove();
  }
}

function showToast(message) {
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function buildWhatsAppUrl(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function requestAccessPhone(message) {
  return new Promise((resolve) => {
    let dialog = document.querySelector("#accessDialog");
    if (!dialog) {
      dialog = document.createElement("dialog");
      dialog.id = "accessDialog";
      dialog.innerHTML = `
        <form class="access-dialog-form" method="dialog">
          <button class="close-button" type="button" aria-label="Close">×</button>
          <h3>Access restricted applicants</h3>
          <p>${message}</p>
          <label class="wide">
            Phone number
            <input name="phone" required placeholder="0888 000 000">
          </label>
          <div class="job-actions">
            <button class="button primary" type="submit">Continue</button>
            <button class="button secondary" type="button" data-action="cancel">Cancel</button>
          </div>
        </form>
      `;
      document.body.append(dialog);

      dialog.querySelector(".close-button").addEventListener("click", () => {
        dialog.close();
        resolve(null);
      });

      dialog.querySelector('[data-action="cancel"]').addEventListener("click", () => {
        dialog.close();
        resolve(null);
      });

      dialog.addEventListener("click", (event) => {
        if (event.target === dialog) {
          dialog.close();
          resolve(null);
        }
      });

      dialog.querySelector("form").addEventListener("submit", (event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const phone = String(formData.get("phone") || "").trim();
        dialog.close();
        resolve(phone || null);
      });
    }

    const input = dialog.querySelector("input[name='phone']");
    input.value = "";
    dialog.showModal();
  });
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
    ["Schedule:", job.schedule]
  ].forEach(([label, value]) => {
    const row = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = label;
    row.append(strong, ` ${value}`);
    meta.append(row);
  });

  const phoneRow = document.createElement("span");
  const phoneLabel = document.createElement("strong");
  phoneLabel.textContent = "Phone:";
  const phoneLink = document.createElement("a");
  phoneLink.className = "whatsapp-link";
  phoneLink.href = buildWhatsAppUrl(job.employer_phone) || "#";
  phoneLink.target = "_blank";
  phoneLink.rel = "noreferrer";
  phoneLink.textContent = job.employer_phone;
  phoneLink.setAttribute("aria-label", `Chat on WhatsApp about ${job.title}`);
  phoneRow.append(phoneLabel, " ", phoneLink);
  meta.append(phoneRow);

  const actions = document.createElement("div");
  actions.className = "job-actions";

  const applyLink = document.createElement("a");
  applyLink.className = "button secondary";
  applyLink.href = `/apply.html?job_id=${job.id}`;
  applyLink.textContent = "Apply now";

  const applicantsButton = document.createElement("button");
  applicantsButton.className = "button secondary";
  applicantsButton.type = "button";
  applicantsButton.textContent = "View applicants";
  applicantsButton.addEventListener("click", async () => {
    const employerPhone = await requestAccessPhone("Enter the phone number used to post this job to view applicants.");
    if (!employerPhone) return;

    try {
      const applications = await api(`/api/applications?job_id=${job.id}&employer_phone=${encodeURIComponent(employerPhone)}`);
      applicantPanel.innerHTML = "";
      applicantPanel.hidden = false;

      if (!applications.length) {
        applicantPanel.innerHTML = '<p class="empty">No applications have been submitted for this job yet.</p>';
        return;
      }

      const list = document.createElement("div");
      list.className = "applicant-list";
      applications.forEach((application) => {
        const card = document.createElement("article");
        card.className = "applicant-card";

        const name = document.createElement("h4");
        name.textContent = application.applicant_name;

        const message = document.createElement("p");
        message.textContent = application.message;

        const applicantMeta = document.createElement("div");
        applicantMeta.className = "job-meta";
        [
          ["Phone:", application.phone],
          ["Area:", application.area],
          ["Date:", application.created_at]
        ].forEach(([label, value]) => {
          const row = document.createElement("span");
          const strong = document.createElement("strong");
          strong.textContent = label;
          row.append(strong, ` ${value}`);
          applicantMeta.append(row);
        });

        const contactLink = document.createElement("a");
        contactLink.className = "button secondary";
        contactLink.href = buildWhatsAppUrl(application.phone) || "#";
        contactLink.target = "_blank";
        contactLink.rel = "noreferrer";
        contactLink.textContent = "Contact on WhatsApp";

        card.append(name, message, applicantMeta, contactLink);
        list.append(card);
      });

      applicantPanel.append(list);
    } catch (error) {
      showToast(error.message);
    }
  });

  actions.append(applyLink, applicantsButton);

  const applicantPanel = document.createElement("div");
  applicantPanel.className = "applicant-panel";
  applicantPanel.hidden = true;

  article.append(tag, title, details, meta, actions, applicantPanel);
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
      localStorage.setItem("hasPostedJob", "true");
      setupSharedNavigation();
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

  const employerPhone = await requestAccessPhone("Enter the phone number used to post your job to view its applications.");
  if (!employerPhone) {
    list.innerHTML = '<p class="empty">Enter the phone number used when posting the job to view matching applications.</p>';
    return;
  }

  try {
    const applications = await api(`/api/applications?employer_phone=${encodeURIComponent(employerPhone)}`);
    list.innerHTML = "";

    if (!applications.length) {
      list.innerHTML = '<p class="empty">No matching applications were found for that phone number.</p>';
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

      const contactLink = document.createElement("a");
      contactLink.className = "button secondary";
      contactLink.href = buildWhatsAppUrl(application.phone) || "#";
      contactLink.target = "_blank";
      contactLink.rel = "noreferrer";
      contactLink.textContent = "Contact on WhatsApp";

      card.append(tag, name, message, meta, contactLink);
      list.append(card);
    });
  } catch (error) {
    list.innerHTML = `<p class="empty">${error.message}</p>`;
  }
}

setupSharedNavigation();
if (page === "jobs") setupJobsPage();
if (page === "post") setupPostPage();
if (page === "apply") setupApplyPage();
if (page === "applications") setupApplicationsPage();
