const app = document.getElementById("app");
const toast = document.getElementById("save-toast");
const API_URL = "https://script.google.com/macros/s/AKfycbxaZ8PL7MBFxZdqH6jbdHuly5k9_NtxTkCRGTZ5mKYHE-6H2uy4De4JsUfopdsMrL9c/exec";
// גרסה למניעת cache — מצמיד לכתובת קבצי הנתונים. לעדכון: שנו כאן וגם ב-index.html.
const APP_VERSION = "20260524a";

const state = {
  strings: null,
  schools: [],
  responses: [],
  sections: [],
  apiOnline: false,
  isSaving: false,
  pdfBusy: false,
  justSubmitted: false,
  coordinatorEmail: "",
  authError: false,
  authChecking: false,
  screen: "welcome",
  selectedSchoolId: null,
  selectedSchool: null,
  selectedResponse: null,
  currentSectionIndex: 0,
  fieldStatus: {},
  fieldDrafts: {},
  sectionStatus: {},
  search: ""
};

const jsonFiles = {
  strings: "strings.he.json",
  schools: "schools.json",
  responses: "last_year_responses.json",
  sections: "sections.json"
};

init();

async function init() {
  try {
    const [strings, localSchools, responses, sections] = await Promise.all(
      Object.values(jsonFiles).map((url) => fetch(`${url}?v=${APP_VERSION}`).then((response) => {
        if (!response.ok) throw new Error(`Failed to load ${url}`);
        return response.json();
      }))
    );

    state.strings = strings;
    state.schools = localSchools;
    state.responses = responses;
    state.sections = sections;
    await loadSchoolsFromApi();
    window.addEventListener("beforeunload", (event) => {
      if (!hasPendingEdits()) return;
      event.preventDefault();
      event.returnValue = "";
    });
    render();
  } catch (error) {
    app.innerHTML = `
      <main class="min-h-screen grid place-items-center px-lg">
        <section class="max-w-[620px] bg-surface-container-lowest border border-error-container rounded-xl p-xl soft-shadow">
          <h1 class="font-headline-md text-headline-md text-error mb-sm">לא ניתן לטעון את נתוני שלב 1</h1>
          <p class="font-body-md text-body-md text-on-surface-variant">${escapeHtml(error.message)}</p>
        </section>
      </main>`;
  }
}

async function loadSchoolsFromApi() {
  try {
    const result = await apiGet({ action: "getSchools" });
    if (!result.ok) throw new Error(result.error || "getSchools failed");
    state.schools = result.schools;
    state.apiOnline = true;
  } catch (error) {
    state.apiOnline = false;
    console.warn("Using local schools fallback:", error);
  }
}

function render() {
  const screens = {
    welcome: renderWelcome,
    auth: renderAuth,
    overview: renderOverview,
    submitted: renderSubmitted,
    wizard: renderWizard,
    summary: renderSummary
  };
  app.innerHTML = `${renderHeader()}${screens[state.screen]()}${renderFooter()}`;
  bindEvents();
}

function renderHeader() {
  if (!state.strings) return "";
  const brand = state.strings.branding;
  const hityashvutiLogo = "https://nofars.neocities.org/hityashvuti.png";
  const scienceLogo = "science-technology-logo.jpg";
  const selected = state.selectedSchool ? `
    <div class="hidden md:flex items-center gap-sm rounded-full bg-primary-fixed px-md py-xs text-on-primary-fixed font-caption text-caption">
      <span class="material-symbols-outlined text-[18px]">school</span>
      <span>${escapeHtml(state.selectedSchool.name)} · ${escapeHtml(state.selectedSchool.id)}</span>
    </div>` : "";
  const apiBadge = state.apiOnline ? "" : `
    <div class="flex items-center gap-xs rounded-full px-md py-xs font-caption text-caption bg-error-container text-on-error-container">
      <span class="material-symbols-outlined text-[18px]">cloud_off</span>
      <span>אין חיבור — שמירה לא תיקלט</span>
    </div>`;

  return `
    <header class="sticky top-0 z-30 bg-surface-container-lowest/95 backdrop-blur border-b border-outline-variant/40">
      <div class="max-w-container-max mx-auto px-lg md:px-xl py-md flex items-center justify-between gap-lg">
        <div class="flex items-center gap-md min-w-0">
          <img class="brand-logo" src="${hityashvutiLogo}" alt="לוגו המינהל לחינוך התיישבותי" />
          <img class="brand-logo rounded-full" src="${scienceLogo}" alt="לוגו מדע וטכנולוגיה" />
          <div class="min-w-0">
            <button class="text-right focus-ring" data-action="go-welcome" aria-label="חזרה למסך פתיחה">
              <h1 class="font-title-sm text-title-sm text-primary">${brand.title}</h1>
            </button>
            <a href="${brand.subtitleUrl}" target="_blank" rel="noopener" class="font-caption text-caption text-primary hover:underline">
              ${brand.subtitle}
            </a>
          </div>
        </div>
        <div class="flex items-center gap-md">
          ${apiBadge}
          ${selected}
        </div>
      </div>
    </header>`;
}

function renderFooter() {
  const footer = state.strings.footer;
  const hityashvutiLogo = "https://nofars.neocities.org/hityashvuti.png";
  const scienceLogo = "science-technology-logo.jpg";
  return `
    <footer class="w-full py-xl px-xl border-t border-outline-variant/30 bg-surface-container-lowest mt-auto">
      <div class="max-w-container-max mx-auto flex flex-col sm:flex-row justify-center gap-lg items-center text-on-surface-variant font-caption text-caption">
        <div class="flex items-center gap-md">
          <img class="footer-logo" src="${hityashvutiLogo}" alt="לוגו המינהל לחינוך התיישבותי" />
          <img class="footer-logo rounded-full" src="${scienceLogo}" alt="לוגו מדע וטכנולוגיה" />
        </div>
        <div class="flex flex-wrap justify-center gap-lg items-center">
          <span>${footer.ministry}</span>
          <span class="w-1 h-1 bg-outline-variant rounded-full"></span>
          <span>${footer.ministryFull}</span>
          <span class="w-1 h-1 bg-outline-variant rounded-full"></span>
          <span>${footer.year}</span>
        </div>
      </div>
    </footer>`;
}

function renderConnectionBadge() {
  return `
    <div class="inline-flex items-center gap-xs rounded-full px-md py-xs font-label-bold text-caption ${state.apiOnline ? "bg-on-tertiary-container text-tertiary" : "bg-error-container text-on-error-container"}">
      <span class="material-symbols-outlined text-[18px]">${state.apiOnline ? "cloud_done" : "cloud_off"}</span>
      <span>${state.apiOnline ? "מחובר לגיליון" : "מצב פיתוח מקומי - שמירה לא נשלחת"}</span>
    </div>`;
}

function renderWelcome() {
  const t = state.strings.welcome;
  const filteredSchools = getFilteredSchools().slice(0, 8);
  const isLoading = state.selectedSchoolId && !state.selectedResponse;
  const dataReady = state.selectedSchoolId && state.selectedResponse;
  const disabled = dataReady ? "" : "disabled";
  const buttonClass = dataReady
    ? "bg-primary text-on-primary hover:bg-primary-container"
    : "bg-outline-variant text-surface-container-lowest cursor-not-allowed opacity-70";
  const ctaLabel = isLoading ? "טוען נתונים…" : t.ctaButton;

  return `
    <main class="screen flex-grow flex flex-col items-center justify-center px-lg py-4xl hero-gradient">
      <div class="max-w-container-max w-full flex flex-col items-center text-center gap-xl">
        <div class="inline-flex items-center gap-xs px-md py-xs bg-secondary-fixed text-on-secondary-fixed rounded-full soft-shadow">
          <span class="material-symbols-outlined text-[18px]">timer</span>
          <span class="font-label-bold text-caption">${t.timeBadge}</span>
        </div>

        <div class="space-y-sm max-w-[820px]">
          <h2 class="font-display-lg text-display-lg text-primary">${t.headline}</h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant">${t.subtitle}</p>
          <p class="inline-flex items-center gap-xs mt-md px-md py-sm rounded-lg bg-on-tertiary-container text-tertiary font-label-bold text-label-bold">
            <span class="material-symbols-outlined text-[20px]">verified</span>
            ${t.defaultApprovalNotice}
          </p>
          ${state.apiOnline ? "" : `<div class="flex justify-center mt-md">${renderConnectionBadge()}</div>`}
        </div>

        <div class="relative w-44 h-44 md:w-56 md:h-56 flex items-center justify-center" aria-hidden="true">
          <div class="absolute inset-0 bg-primary-fixed/30 rounded-full blur-3xl"></div>
          <div class="relative z-10 w-full h-full rounded-full bg-surface-container-lowest border border-outline-variant/40 soft-shadow grid place-items-center">
            <span class="material-symbols-outlined text-primary text-[92px]">science</span>
          </div>
        </div>

        <section class="w-full max-w-[560px] bg-surface-container-lowest p-xl rounded-xl soft-shadow border border-outline-variant/30 flex flex-col items-stretch text-right gap-lg">
          <div class="space-y-sm">
            <label class="font-label-bold text-label-bold text-on-surface block px-xs" for="school-search">${t.selectLabel}</label>
            <div class="relative">
              <input class="w-full h-[52px] pr-xl pl-lg bg-surface-container-low border border-outline rounded-lg font-body-md focus-ring"
                id="school-search" placeholder="${t.selectPlaceholder}" type="text" value="${escapeAttr(state.search)}" autocomplete="off" />
              <span class="material-symbols-outlined absolute right-md top-1/2 -translate-y-1/2 text-outline">search</span>
            </div>
            <p class="font-caption text-caption text-on-surface-variant px-xs">${t.selectHelper}</p>
          </div>

          <div class="flex items-center justify-between px-xs">
            <p class="font-caption text-caption text-on-surface-variant">${t.resultsLabel}</p>
            <p class="font-caption text-caption text-on-surface-variant">${state.schools.length} בתי ספר</p>
          </div>

          <div class="flex flex-col gap-xs p-xs bg-surface-container-high/30 rounded-lg max-h-[280px] overflow-auto" role="listbox" aria-label="${t.resultsLabel}">
            ${filteredSchools.length ? filteredSchools.map(renderSchoolOption).join("") : `
              <div class="p-md font-body-md text-body-md text-on-surface-variant">${t.noResults}</div>`}
          </div>

          <button class="w-full h-[52px] ${buttonClass} font-label-bold rounded-lg flex items-center justify-center gap-sm transition-colors focus-ring"
            data-action="start-overview" ${disabled}>
            ${ctaLabel}
            <span class="material-symbols-outlined">${isLoading ? "hourglass_empty" : "arrow_back"}</span>
          </button>
        </section>
      </div>
    </main>`;
}

function renderSchoolOption(school) {
  const selected = school.id === state.selectedSchoolId;
  return `
    <button class="flex items-center gap-sm p-md rounded-lg transition-colors text-right focus-ring ${selected ? "bg-primary-fixed text-on-primary-fixed" : "hover:bg-primary-container/10"}"
      data-action="select-school" data-school-id="${escapeAttr(school.id)}" role="option" aria-selected="${selected}">
      <span class="material-symbols-outlined text-outline">school</span>
      <span class="flex-1 min-w-0">
        <span class="block font-body-md text-body-md text-on-surface truncate">${escapeHtml(school.name)}</span>
        <span class="block font-caption text-caption text-on-surface-variant">${escapeHtml(school.id)}</span>
      </span>
    </button>`;
}

function renderAuth() {
  const t = state.strings.auth;
  const school = state.selectedSchool || {};
  const waText = encodeURIComponent(`שלום נופר, אני רכז/ת ב${school.name || ""} (סמל ${school.id || ""}) והאימות לא עבר.`);
  const waUrl = `https://wa.me/972506934423?text=${waText}`;
  return `
    <main class="screen flex-grow flex flex-col items-center justify-center px-lg py-4xl hero-gradient">
      <div class="max-w-[560px] w-full bg-surface-container-lowest p-xl rounded-xl soft-shadow border border-outline-variant/30 text-right space-y-lg">
        <div class="space-y-xs">
          <h2 class="font-display-lg text-display-lg text-primary">${t.title}</h2>
          <p class="font-body-md text-body-md text-on-surface-variant">${t.subtitle}</p>
          <p class="inline-flex items-center gap-xs mt-sm px-md py-xs bg-primary-fixed text-on-primary-fixed rounded-full font-caption text-caption">
            <span class="material-symbols-outlined text-[18px]">school</span>
            ${escapeHtml(school.name || "")} · ${escapeHtml(school.id || "")}
          </p>
        </div>
        <div class="space-y-sm">
          <label class="font-label-bold text-label-bold text-on-surface block px-xs" for="coordinator-email">${t.emailLabel}</label>
          <input class="w-full h-[52px] px-lg bg-surface-container-low border border-outline rounded-lg font-body-md focus-ring" id="coordinator-email" type="email" inputmode="email" placeholder="${t.emailPlaceholder}" value="${escapeAttr(state.coordinatorEmail)}" autocomplete="email" />
        </div>
        ${state.authError ? `
          <div class="rounded-lg bg-error-container text-on-error-container p-lg space-y-md">
            <p class="font-label-bold text-label-bold">${t.failTitle}</p>
            <p class="font-body-md text-body-md">${t.failBody}</p>
            <a href="${waUrl}" target="_blank" rel="noopener" class="w-full min-h-[52px] flex items-center justify-center gap-sm bg-[#25D366] text-white font-label-bold rounded-lg focus-ring">
              <span class="material-symbols-outlined">chat</span>${t.whatsappBtn}
            </a>
          </div>` : ""}
        <div class="flex flex-col sm:flex-row gap-md justify-between">
          <button class="h-[52px] px-xl rounded-lg border border-primary text-primary font-label-bold focus-ring" data-action="go-welcome">${t.backBtn}</button>
          <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold hover:bg-primary-container focus-ring disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-sm" data-action="verify-coordinator" ${state.authChecking ? "disabled" : ""}>
            ${state.authChecking ? `<span class="material-symbols-outlined animate-spin">progress_activity</span> ${t.checking}` : t.verifyBtn}
          </button>
        </div>
      </div>
    </main>`;
}

function renderOverview() {
  const t = state.strings.overview;
  const response = state.selectedResponse;
  const statCards = [
    ["person", "רכז/ת", joinValues([response.coordinator_firstName, response.coordinator_lastName])],
    ["groups", "מספר מורים", formatValue(response.staff_teacher_count)],
    ["biotech", "חדרי מעבדות", formatValue(response.labs_total_count)],
    ["event", "ישיבות צוות", formatValue(response.meetings_held)]
  ];

  return `
    <main class="screen flex-grow px-lg md:px-xl py-2xl">
      <div class="max-w-container-max mx-auto space-y-xl">
        <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
          <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-lg">
            <div>
              <h2 class="font-display-lg text-display-lg text-primary">${t.title}</h2>
              <p class="font-body-lg text-body-lg text-on-surface-variant max-w-[760px]">${t.subtitle}</p>
            </div>
            <button class="h-[44px] px-lg rounded-lg border border-primary text-primary font-label-bold focus-ring" data-action="go-welcome">${t.switchSchool}</button>
          </div>
        </section>

        <section class="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-lg">
          ${statCards.map(([icon, label, value]) => `
            <article class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-lg soft-shadow">
              <span class="material-symbols-outlined text-primary mb-sm">${icon}</span>
              <p class="font-caption text-caption text-on-surface-variant">${label}</p>
              <p class="font-title-sm text-title-sm text-on-surface break-words">${escapeHtml(value)}</p>
            </article>`).join("")}
        </section>

        <section class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          ${state.sections.slice(0, 3).map((section) => renderOverviewSection(section, response)).join("")}
        </section>

        <div class="flex flex-col sm:flex-row gap-md justify-end">
          <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold hover:bg-primary-container focus-ring" data-action="start-wizard">
            ${t.startWizard}
            <span class="material-symbols-outlined align-middle">arrow_back</span>
          </button>
        </div>
      </div>
    </main>`;
}

function formatSubmittedDate(value) {
  if (!value) return "לא ידוע";
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return String(value);
    return d.toLocaleString("he-IL", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" });
  } catch (e) {
    return String(value);
  }
}

function renderSubmitted() {
  const t = state.strings.submitted;
  const submittedAt = formatSubmittedDate(state.selectedResponse?._submittedAt || state.selectedResponse?.submittedAt);

  if (state.justSubmitted) {
    return `
      <main class="screen flex-grow px-lg md:px-xl py-2xl">
        <div class="max-w-[760px] mx-auto space-y-xl">
          <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow text-center">
            <span class="material-symbols-outlined text-tertiary text-[72px] mb-md">check_circle</span>
            <h2 class="font-display-lg text-display-lg text-primary">${t.thanksTitle}</h2>
            <p class="font-body-lg text-body-lg text-on-surface-variant mt-sm">${t.thanksSubtitle}</p>
            <p class="inline-flex items-center gap-xs mt-lg px-md py-sm bg-on-tertiary-container text-tertiary rounded-full font-label-bold text-label-bold">
              <span class="material-symbols-outlined text-[20px]">event_available</span>
              ${t.submittedAt}: ${escapeHtml(submittedAt)}
            </p>
          </section>
          <nav class="flex flex-col items-center gap-md">
            <button class="w-full sm:w-auto min-h-[60px] px-2xl rounded-lg bg-tertiary text-on-tertiary font-label-bold text-body-lg flex items-center justify-center gap-sm soft-shadow focus-ring disabled:opacity-60 disabled:cursor-not-allowed" data-action="download-pdf" ${state.pdfBusy ? "disabled" : ""}>
              ${state.pdfBusy ? `<span class="material-symbols-outlined animate-spin">progress_activity</span> ${escapeHtml(t.pdfPreparing)}` : escapeHtml(t.downloadPdf)}
            </button>
            <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold focus-ring" data-action="go-welcome">${t.thanksHomeBtn}</button>
          </nav>
        </div>
      </main>`;
  }

  return `
    <main class="screen flex-grow px-lg md:px-xl py-2xl">
      <div class="max-w-[760px] mx-auto space-y-xl">
        <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow text-center">
          <span class="material-symbols-outlined text-primary text-[56px] mb-md">assignment_turned_in</span>
          <h2 class="font-display-lg text-display-lg text-primary">${t.title}</h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant mt-sm">${t.subtitle}</p>
          <p class="inline-flex items-center gap-xs mt-lg px-md py-sm bg-on-tertiary-container text-tertiary rounded-full font-label-bold text-label-bold">
            <span class="material-symbols-outlined text-[20px]">event_available</span>
            ${t.submittedAt}: ${escapeHtml(submittedAt)}
          </p>
        </section>
        <nav class="flex flex-col sm:flex-row gap-md justify-center">
          <button class="h-[52px] px-xl rounded-lg border border-primary text-primary font-label-bold focus-ring" data-action="go-summary">${t.viewSummary}</button>
          <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold focus-ring" data-action="open-correction">${t.openForCorrection}</button>
        </nav>
      </div>
    </main>`;
}

function renderOverviewSection(section, response) {
  const fields = section.fields.filter((f) => f.type !== "grade-table" && f.type !== "checkbox-group").slice(0, 4);
  return `
    <article class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
      <h3 class="font-title-sm text-title-sm text-primary mb-xs">${section.title}</h3>
      <p class="font-caption text-caption text-on-surface-variant mb-lg">${section.description}</p>
      <dl class="space-y-md">
        ${fields.map((field) => `
          <div>
            <dt class="font-caption text-caption text-on-surface-variant">${field.label}</dt>
            <dd class="font-body-md text-body-md text-on-surface break-words">${escapeHtml(formatValue(response[field.key]))}</dd>
          </div>`).join("")}
      </dl>
    </article>`;
}

function renderWizard() {
  const t = state.strings.wizard;
  const section = state.sections[state.currentSectionIndex];
  const progress = getProgressPercent();

  return `
    <main class="screen flex-grow px-lg md:px-xl py-2xl">
      <div class="max-w-container-max mx-auto space-y-xl">
        <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
          <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-lg">
            <div>
              <p class="font-caption text-caption text-on-surface-variant">${t.section} ${section.id} מתוך ${state.sections.length}</p>
              <h2 class="font-display-lg text-display-lg text-primary">${section.title}</h2>
              <p class="font-body-lg text-body-lg text-on-surface-variant max-w-[760px]">${section.description}</p>
            </div>
            <div class="min-w-[260px]">
              <div class="flex justify-between font-caption text-caption text-on-surface-variant mb-xs">
                <span>${t.complete}</span><span>${progress}%</span>
              </div>
              <div class="h-3 bg-surface-container rounded-full overflow-hidden" aria-hidden="true">
                <div class="h-full bg-primary rounded-full" style="width: ${progress}%"></div>
              </div>
            </div>
          </div>
        </section>

        ${renderUpdateStrip()}

        <div class="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-xl items-start">
          ${renderSectionRail()}
          <section class="space-y-lg">
            <article class="bg-on-tertiary-container border border-dashed border-tertiary-container rounded-xl p-lg">
              <button class="w-full min-h-[52px] text-right flex items-center justify-between gap-md font-label-bold text-tertiary focus-ring"
                data-action="approve-section">
                <span>${t.approveAll}</span>
                <span class="material-symbols-outlined">done_all</span>
              </button>
              <p class="font-caption text-caption text-tertiary mt-xs">${t.approveAllHelp}</p>
            </article>

            ${section.pattern === "C" ? renderToolsMatrix(section) : section.fields.map(renderFieldCard).join("")}

            <p class="font-caption text-caption text-on-surface-variant">${t.sampleNotice}</p>

            <nav class="flex flex-col sm:flex-row gap-md justify-between">
              <button class="h-[52px] px-xl rounded-lg border border-primary text-primary font-label-bold focus-ring" data-action="prev-section" ${state.currentSectionIndex === 0 || state.isSaving ? "disabled" : ""}>${t.previous}</button>
              <div class="flex flex-col sm:flex-row gap-md">
                <button class="h-[52px] px-xl rounded-lg bg-surface-container text-on-surface-variant font-label-bold focus-ring disabled:opacity-60 disabled:cursor-not-allowed" data-action="save-draft" ${state.isSaving ? "disabled" : ""}>${state.isSaving ? "שומר…" : t.saveDraft}</button>
                <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold hover:bg-primary-container focus-ring disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-sm" data-action="next-section" ${state.isSaving ? "disabled" : ""}>
                  ${state.isSaving ? '<span class="material-symbols-outlined">hourglass_empty</span> שומר…' : (state.currentSectionIndex === state.sections.length - 1 ? t.summary : t.next)}
                </button>
              </div>
            </nav>
          </section>
        </div>
      </div>
    </main>`;
}

function renderSectionRail() {
  return `
    <aside class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-md soft-shadow lg:sticky lg:top-[96px]">
      <div class="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-1 gap-xs">
        ${state.sections.map((section, index) => {
          const active = index === state.currentSectionIndex;
          const hasUpdate = sectionHasUpdate(section);
          const statusText = hasUpdate ? "עודכן" : "אושר כברירת מחדל";
          return `
            <button class="min-h-[44px] rounded-lg px-md py-sm text-right focus-ring ${active ? "bg-primary text-on-primary" : "hover:bg-primary-fixed/40"}"
              data-action="go-section" data-section-index="${index}">
              <span class="font-label-bold">${section.id}. ${section.title}</span>
              <span class="block font-caption text-caption ${active ? "text-on-primary" : "text-on-surface-variant"}">${statusText}</span>
            </button>`;
        }).join("")}
      </div>
    </aside>`;
}

function renderFieldCard(field) {
  if (field.type === "grade-table") return renderGradeTable(field);
  if (field.type === "checkbox-group") return renderCheckboxGroup(field);
  const status = state.fieldStatus[field.key] || "idle";
  const value = state.selectedResponse[field.key];
  const displayValue = formatValue(value);
  const isEditing = status === "editing";
  const hasCurrentYearValue = status === "updated" && state.fieldDrafts[field.key] !== undefined;
  const displayedBoxValue = hasCurrentYearValue ? formatValue(state.fieldDrafts[field.key]) : displayValue;
  const displayedBoxLabel = hasCurrentYearValue ? state.strings.verification.currentYearLabel : state.strings.verification.lastYearLabel;
  const displayedBoxClass = hasCurrentYearValue
    ? "bg-[#FFF3E0] border border-[#E65100]"
    : "bg-on-tertiary-container border border-dashed border-tertiary-container";
  const displayedTextClass = hasCurrentYearValue ? "text-[#E65100]" : "text-tertiary";
  const isNew = field.pattern === "D";
  const tag = status === "confirmed"
    ? `<span class="px-md py-xs bg-on-tertiary-container text-tertiary rounded-full font-caption text-caption">${state.strings.verification.confirmedTag}</span>`
    : status === "editing"
      ? `<span class="px-md py-xs bg-[#FFF3E0] text-[#E65100] rounded-full font-caption text-caption">${state.strings.verification.updatedTag}</span>`
      : "";

  return `
    <article class="field-card bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow" data-status="${status}" data-field-key="${escapeAttr(field.key)}">
      <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-md mb-lg">
        <div>
          ${isNew ? `<span class="inline-flex px-md py-xs bg-secondary-container text-on-secondary-container rounded-full font-caption text-caption mb-md">${state.strings.verification.newQuestion}</span>` : ""}
          <h3 class="font-title-sm text-title-sm text-on-surface">${field.label}</h3>
          ${field.help ? `<p class="font-caption text-caption text-on-surface-variant mt-xs max-w-[640px]">${field.help}</p>` : ""}
          ${field.requiredHint ? `<p class="inline-flex items-center gap-xs mt-xs px-md py-xs bg-secondary-fixed text-on-secondary-fixed rounded-full font-caption text-caption"><span class="material-symbols-outlined text-[16px]">info</span>${field.requiredHint}</p>` : ""}
        </div>
        ${tag}
      </div>

      <div class="${displayedBoxClass} rounded-lg p-lg mb-lg">
        <p class="font-caption text-caption ${displayedTextClass} mb-xs">${displayedBoxLabel}</p>
        <p class="font-body-lg text-body-lg ${displayedTextClass} break-words">${escapeHtml(displayedBoxValue)}</p>
      </div>

      ${isEditing ? renderEditControl(field, displayValue) : renderConfirmButtons(field)}
    </article>`;
}

function rerenderFieldCard(fieldKey) {
  const section = state.sections[state.currentSectionIndex];
  if (!section) { render(); return; }
  const field = section.fields.find((f) => f.key === fieldKey);
  if (!field) { render(); return; }
  const card = document.querySelector(`.field-card[data-field-key="${CSS.escape(fieldKey)}"]`);
  if (!card) { render(); return; }
  const tmp = document.createElement("div");
  tmp.innerHTML = renderFieldCard(field).trim();
  const newCard = tmp.firstElementChild;
  card.replaceWith(newCard);
  newCard.querySelectorAll("[data-action]").forEach((el) => {
    el.addEventListener("click", handleAction);
  });
  newCard.querySelectorAll("[data-draft-field]").forEach((el) => bindDraftField(el));
}

function renderConfirmButtons(field) {
  return `
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-md">
      <p class="font-caption text-caption text-tertiary inline-flex items-center gap-xs">
        <span class="material-symbols-outlined text-[20px]">check_circle</span>
        מאושר אוטומטית - הנתון נשאר אותו דבר
      </p>
      <button class="h-[44px] px-lg border-2 border-primary text-primary font-label-bold rounded-lg hover:bg-primary-fixed/20 focus-ring whitespace-nowrap" data-action="edit-field" data-field-key="${field.key}">
        ✎ צריך לעדכן
      </button>
    </div>`;
}

function selectOptionsFor(field) {
  if (Array.isArray(field.options)) return field.options.slice();
  if (field.min !== undefined || field.max !== undefined) {
    const min = field.min ?? 0;
    const max = field.max ?? 10;
    const list = [];
    for (let n = min; n <= max; n += 1) list.push(String(n));
    return list;
  }
  return [];
}

function renderEditControl(field, displayValue) {
  const draft = state.fieldDrafts[field.key] ?? (displayValue === state.strings.verification.sourceEmpty ? "" : displayValue);
  let control;
  if (field.type === "yes-no") {
    control = `
      <div class="flex gap-md" role="radiogroup">
        ${["כן", "לא"].map((opt) => {
          const on = draft === opt;
          return `<button type="button" role="radio" aria-checked="${on}" class="min-h-[52px] flex-1 rounded-lg border-2 font-label-bold focus-ring ${on ? "bg-primary text-on-primary border-primary" : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:border-primary"}" data-action="set-draft" data-field-key="${escapeAttr(field.key)}" data-value="${escapeAttr(opt)}">${opt}</button>`;
        }).join("")}
      </div>`;
  } else if (field.type === "select") {
    const opts = selectOptionsFor(field);
    control = `
      <select class="w-full h-[52px] px-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" data-draft-field="${field.key}">
        <option value="" ${draft === "" ? "selected" : ""}>בחרו…</option>
        ${opts.map((opt) => `<option value="${escapeAttr(opt)}" ${String(draft) === String(opt) ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
      </select>`;
  } else if (field.enforceNumber) {
    control = `
      <input class="w-full h-[52px] px-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" type="number" inputmode="numeric" min="0" step="1" value="${escapeAttr(draft)}" data-draft-field="${field.key}" placeholder="הקלידו מספר בלבד — למשל 3, 4, 5" />
      <p class="font-caption text-caption text-on-surface-variant px-xs">יש להזין מספר בלבד (למשל 3, 4, 5).</p>`;
  } else {
    control = field.type === "textarea"
      ? `<textarea class="w-full min-h-[120px] p-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" data-draft-field="${field.key}">${escapeHtml(draft)}</textarea>`
      : `<input class="w-full h-[52px] px-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" type="${field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}" value="${escapeAttr(draft)}" data-draft-field="${field.key}" />`;
  }

  return `
    <div class="space-y-md">
      ${control}
      <div class="flex flex-col sm:flex-row gap-md justify-end">
        <button class="h-[44px] px-lg rounded-lg text-primary underline underline-offset-4 font-label-bold focus-ring" data-action="cancel-edit" data-field-key="${field.key}">${state.strings.verification.cancelBtn}</button>
        <button class="h-[44px] px-lg rounded-lg bg-primary text-on-primary font-label-bold focus-ring" data-action="save-field" data-field-key="${field.key}">${state.strings.verification.saveBtn}</button>
      </div>
    </div>`;
}

function subFieldValue(key) {
  if (Object.prototype.hasOwnProperty.call(state.fieldDrafts, key)) return state.fieldDrafts[key];
  const v = state.selectedResponse ? state.selectedResponse[key] : undefined;
  return v === null || v === undefined ? "" : String(v);
}

function renderGradeCell(key, cellType, options) {
  const value = subFieldValue(key);
  const opts = cellType === "yes-no" ? ["כן", "לא"] : options;
  return `
    <select class="w-full h-[44px] px-sm bg-surface-container-low border border-outline rounded-lg font-body-md focus-ring" data-draft-field="${escapeAttr(key)}" data-autotrack="1">
      <option value="" ${value === "" ? "selected" : ""}>—</option>
      ${opts.map((opt) => `<option value="${escapeAttr(opt)}" ${String(value) === String(opt) ? "selected" : ""}>${escapeHtml(opt)}</option>`).join("")}
    </select>`;
}

function renderGradeTable(field) {
  const options = field.cellType === "yes-no" ? ["כן", "לא"] : selectOptionsFor(field);
  const grades = [["g7", "ז'"], ["g8", "ח'"], ["g9", "ט'"]];
  return `
    <article class="field-card bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow" data-field-key="${escapeAttr(field.key)}">
      <span class="inline-flex px-md py-xs bg-secondary-container text-on-secondary-container rounded-full font-caption text-caption mb-md">${state.strings.verification.newQuestion}</span>
      <h3 class="font-title-sm text-title-sm text-on-surface">${field.label}</h3>
      ${field.help ? `<p class="font-caption text-caption text-on-surface-variant mt-xs mb-md max-w-[640px]">${field.help}</p>` : '<div class="mb-md"></div>'}
      <div class="overflow-x-auto">
        <table class="w-full border-collapse">
          <thead>
            <tr>
              <th class="text-right font-caption text-caption text-on-surface-variant p-sm"></th>
              ${grades.map(([, label]) => `<th class="font-label-bold text-label-bold text-primary p-sm w-[28%]">שכבה ${label}</th>`).join("")}
            </tr>
          </thead>
          <tbody>
            ${field.rows.map((row) => `
              <tr class="border-t border-outline-variant/30">
                <td class="font-body-md text-body-md text-on-surface p-sm">${escapeHtml(row.label)}</td>
                ${grades.map(([g]) => `<td class="p-sm">${renderGradeCell(row.keys[g], field.cellType, options)}</td>`).join("")}
              </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </article>`;
}

function renderCheckboxGroup(field) {
  return `
    <article class="field-card bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow" data-field-key="${escapeAttr(field.key)}">
      <span class="inline-flex px-md py-xs bg-secondary-container text-on-secondary-container rounded-full font-caption text-caption mb-md">${state.strings.verification.newQuestion}</span>
      <h3 class="font-title-sm text-title-sm text-on-surface mb-md">${field.label}</h3>
      <div class="flex flex-col gap-sm">
        ${field.options.map((opt) => {
          const checked = subFieldValue(opt.key) === "כן";
          const detail = opt.detailKey ? subFieldValue(opt.detailKey) : "";
          return `
            <label class="flex items-center gap-sm min-h-[44px] px-md rounded-lg border border-outline-variant/50 cursor-pointer hover:border-primary">
              <input type="checkbox" class="w-5 h-5 accent-[#005c9b]" data-checkbox-key="${escapeAttr(opt.key)}" ${checked ? "checked" : ""} />
              <span class="font-body-md text-body-md text-on-surface">${escapeHtml(opt.label)}</span>
            </label>
            ${opt.detailKey ? `<input class="w-full h-[48px] px-lg bg-surface-container-low border border-outline rounded-lg font-body-md focus-ring ${checked ? "" : "hidden"}" data-draft-field="${escapeAttr(opt.detailKey)}" data-autotrack="1" placeholder="${escapeAttr(opt.detailLabel || "פירוט")}" value="${escapeAttr(detail)}" />` : ""}`;
        }).join("")}
      </div>
    </article>`;
}

const TOOL_OPTION_DEFS = [
  { value: "לא משתמשים", stringKey: "toolNone" },
  { value: "קצת", stringKey: "toolLittle" },
  { value: "בינוני", stringKey: "toolMedium" },
  { value: "הרבה", stringKey: "toolLot" }
];

const TOOL_LAST_YEAR_MAP = {
  "חלק קטן": "קצת",
  "רובם": "בינוני",
  "כולם": "הרבה"
};

function mapLastYearTool(value) {
  if (value === null || value === undefined || value === "") return null;
  return TOOL_LAST_YEAR_MAP[String(value).trim()] || null;
}

function getToolSelection(key) {
  const lastMapped = mapLastYearTool(state.selectedResponse ? state.selectedResponse[key] : null);
  const effectiveLast = lastMapped || "לא משתמשים";
  const hasDraft = Object.prototype.hasOwnProperty.call(state.fieldDrafts, key);
  const selected = hasDraft ? state.fieldDrafts[key] : lastMapped;
  const changed = state.fieldStatus[key] === "updated";
  return { selected, lastMapped, effectiveLast, changed };
}

function renderToolsMatrix(section) {
  const v = state.strings.verification;
  const tools = section.fields.filter((field) => field.key !== "tools_other_detail");
  const detailField = section.fields.find((field) => field.key === "tools_other_detail");

  const rows = tools.map((field) => {
    const { selected, changed } = getToolSelection(field.key);
    const buttons = TOOL_OPTION_DEFS.map((opt) => {
      const isOn = selected === opt.value;
      const cls = isOn
        ? "bg-primary text-on-primary border-primary"
        : "bg-surface-container-lowest text-on-surface-variant border-outline-variant/60 hover:border-primary";
      return `
        <button type="button" role="radio" aria-checked="${isOn}"
          class="tool-opt min-h-[44px] flex-1 min-w-[78px] px-sm rounded-lg border-2 font-label-bold text-caption transition-colors focus-ring ${cls}"
          data-action="tool-select" data-field-key="${escapeAttr(field.key)}" data-value="${escapeAttr(opt.value)}">
          ${escapeHtml(v[opt.stringKey])}
        </button>`;
    }).join("");
    return `
      <div class="tool-row flex flex-col sm:flex-row sm:items-center gap-sm py-md border-b border-outline-variant/30 last:border-b-0" data-tool-row="${escapeAttr(field.key)}">
        <div class="sm:w-[40%] flex items-center gap-sm">
          <span class="font-body-md text-body-md text-on-surface">${escapeHtml(field.label)}</span>
          ${changed ? `<span class="px-sm py-[2px] bg-[#FFF3E0] text-[#E65100] rounded-full font-caption text-caption whitespace-nowrap">${escapeHtml(v.toolChanged)}</span>` : ""}
        </div>
        <div class="sm:flex-1 flex flex-wrap gap-xs" role="radiogroup" aria-label="${escapeAttr(field.label)}">
          ${buttons}
        </div>
      </div>`;
  }).join("");

  return `
    <article id="tools-matrix" class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
      <h3 class="font-title-sm text-title-sm text-on-surface mb-xs">${section.title}</h3>
      <p class="font-caption text-caption text-on-surface-variant mb-lg">${v.toolsIntro}</p>
      <div class="flex flex-col">
        ${rows}
      </div>
      ${detailField ? `<div class="mt-xl">${renderFieldCard(detailField)}</div>` : ""}
    </article>`;
}

function rerenderToolsMatrix() {
  const section = state.sections[state.currentSectionIndex];
  if (!section || section.pattern !== "C") { render(); return; }
  const existing = document.getElementById("tools-matrix");
  if (!existing) { render(); return; }
  const tmp = document.createElement("div");
  tmp.innerHTML = renderToolsMatrix(section).trim();
  const fresh = tmp.firstElementChild;
  existing.replaceWith(fresh);
  fresh.querySelectorAll("[data-action]").forEach((el) => el.addEventListener("click", handleAction));
  fresh.querySelectorAll("[data-draft-field]").forEach((el) => bindDraftField(el));
}

// לפני שליחה סופית: כלי דיגיטלי שלא מולא (אין לו ערך מהשנה הקודמת ולא נבחר) — נרשם "לא משתמשים".
function applyToolsDefault() {
  const section = state.sections.find((s) => s.pattern === "C");
  if (!section) return;
  section.fields.forEach((field) => {
    if (field.key === "tools_other_detail" || field.key === "tools_other_flag") return;
    const hasDraft = Object.prototype.hasOwnProperty.call(state.fieldDrafts, field.key);
    if (hasDraft) return;
    if (mapLastYearTool(state.selectedResponse ? state.selectedResponse[field.key] : null) === null) {
      state.fieldDrafts[field.key] = "לא משתמשים";
      state.fieldStatus[field.key] = "updated";
    }
  });
}

function selectTool(key, value) {
  const { effectiveLast } = getToolSelection(key);
  state.fieldDrafts[key] = value;
  state.fieldStatus[key] = value === effectiveLast ? "confirmed" : "updated";
  rerenderToolsMatrix();
  saveDraftForCurrentSection(false);
}

function renderSummary() {
  const t = state.strings.summary;
  const totalFields = countTotalFields();
  const updated = getUpdatedFields().length;
  const confirmed = Math.max(0, totalFields - updated);
  const doneSections = state.sections.length;

  return `
    <main class="screen flex-grow px-lg md:px-xl py-2xl">
      <div class="max-w-container-max mx-auto space-y-xl">
        <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
          <h2 class="font-display-lg text-display-lg text-primary">${t.title}</h2>
          <p class="font-body-lg text-body-lg text-on-surface-variant max-w-[780px]">${t.subtitle}</p>
        </section>

        ${renderUpdateStrip()}

        <section class="grid grid-cols-1 md:grid-cols-3 gap-lg">
          ${renderSummaryStat("check_circle", t.confirmedFields, confirmed)}
          ${renderSummaryStat("edit_square", t.updatedFields, updated)}
          ${renderSummaryStat("view_list", t.sectionsDone, `${doneSections}/${state.sections.length}`)}
        </section>

        ${renderChangedFields()}

        <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
          <h3 class="font-title-sm text-title-sm text-primary mb-lg">סקציות</h3>
          <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
            ${state.sections.map((section) => `
              <div class="flex items-center justify-between gap-md rounded-lg border border-outline-variant/50 p-md">
                <span class="font-body-md text-body-md">${section.id}. ${section.title}</span>
                <span class="font-caption text-caption px-md py-xs rounded-full ${state.sectionStatus[section.id] ? "bg-on-tertiary-container text-tertiary" : "bg-surface-container text-on-surface-variant"}">
                  ${sectionHasUpdate(section) ? "עודכן" : "אושר כברירת מחדל"}
                </span>
              </div>`).join("")}
          </div>
        </section>

        <nav class="flex flex-col sm:flex-row justify-end gap-md">
          <button class="h-[52px] px-xl rounded-lg border border-primary text-primary font-label-bold focus-ring" data-action="start-wizard">${t.backToWizard}</button>
          <button class="h-[52px] px-xl rounded-lg bg-primary text-on-primary font-label-bold focus-ring" data-action="submit-static">${t.submitted}</button>
        </nav>
      </div>
    </main>`;
}

function renderSummaryStat(icon, label, value) {
  return `
    <article class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
      <span class="material-symbols-outlined text-primary mb-sm">${icon}</span>
      <p class="font-caption text-caption text-on-surface-variant">${label}</p>
      <p class="font-display-lg text-display-lg text-on-surface">${value}</p>
    </article>`;
}

function renderUpdateStrip() {
  const updatedCount = getUpdatedFields().length;
  const label = state.strings.wizard.updateStrip.replace("{count}", updatedCount);

  return `
    <aside class="bg-primary-fixed border border-primary-fixed-dim/60 text-on-primary-fixed rounded-xl px-lg py-md flex items-center gap-sm font-label-bold text-label-bold">
      <span class="material-symbols-outlined text-[22px]">fact_check</span>
      <span>${label}</span>
    </aside>`;
}

function renderChangedFields() {
  const t = state.strings.summary;
  const changed = getUpdatedFields();

  return `
    <section class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
      <h3 class="font-title-sm text-title-sm text-primary mb-lg">${t.changedFieldsTitle}</h3>
      ${changed.length ? `
        <div class="grid grid-cols-1 gap-md">
          ${changed.map(({ field, previousValue, newValue }) => `
            <article class="rounded-lg border border-[#E65100]/40 bg-[#FFF3E0] p-lg">
              <h4 class="font-label-bold text-label-bold text-on-surface mb-md">${field.label}</h4>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
                <div>
                  <p class="font-caption text-caption text-on-surface-variant">${t.previousValue}</p>
                  <p class="font-body-md text-body-md text-on-surface break-words">${escapeHtml(previousValue)}</p>
                </div>
                <div>
                  <p class="font-caption text-caption text-[#E65100]">${t.newValue}</p>
                  <p class="font-body-md text-body-md text-[#E65100] break-words">${escapeHtml(newValue)}</p>
                </div>
              </div>
            </article>`).join("")}
        </div>` : `
        <p class="font-body-md text-body-md text-on-surface-variant">${t.noChanges}</p>`}
    </section>`;
}

function bindEvents() {
  document.querySelectorAll("[data-action]").forEach((element) => {
    element.addEventListener("click", handleAction);
  });

  const search = document.getElementById("school-search");
  if (search) {
    search.addEventListener("input", (event) => {
      state.search = event.target.value;
      render();
      const nextSearch = document.getElementById("school-search");
      nextSearch.focus();
      nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
    });
  }

  const emailInput = document.getElementById("coordinator-email");
  if (emailInput) {
    emailInput.addEventListener("input", (event) => {
      state.coordinatorEmail = event.target.value;
    });
    emailInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") { event.preventDefault(); verifyCoordinatorEmail(); }
    });
  }

  document.querySelectorAll("[data-draft-field]").forEach((element) => {
    bindDraftField(element);
  });

  document.querySelectorAll("[data-checkbox-key]").forEach((element) => {
    element.addEventListener("change", (event) => {
      const key = event.target.dataset.checkboxKey;
      state.fieldDrafts[key] = event.target.checked ? "כן" : "לא";
      state.fieldStatus[key] = "updated";
      const detail = event.target.closest("label")?.nextElementSibling;
      if (detail && detail.matches("[data-draft-field]")) detail.classList.toggle("hidden", !event.target.checked);
      saveDraftForCurrentSection(false);
    });
  });
}

function bindDraftField(element) {
  const handler = (event) => {
    const key = event.target.dataset.draftField;
    state.fieldDrafts[key] = event.target.value;
    if (event.target.dataset.autotrack) {
      if (String(event.target.value) === "") delete state.fieldStatus[key];
      else state.fieldStatus[key] = "updated";
      saveDraftForCurrentSection(false);
    }
  };
  element.addEventListener("input", handler);
  if (element.tagName === "SELECT") element.addEventListener("change", handler);
}

function handleAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const actions = {
    "go-welcome": () => safeNavigate(() => goTo("welcome")),
    "select-school": () => selectSchool(button.dataset.schoolId),
    "start-overview": () => startCoordinatorFlow(),
    "verify-coordinator": () => verifyCoordinatorEmail(),
    "start-wizard": () => safeNavigate(() => goTo("wizard")),
    "go-summary": () => safeNavigate(() => goTo("summary")),
    "open-correction": () => {
      openCorrection();
    },
    "go-section": () => {
      safeNavigate(() => {
        state.currentSectionIndex = Number(button.dataset.sectionIndex);
        goTo("wizard");
      });
    },
    "prev-section": () => {
      safeNavigate(() => {
        state.currentSectionIndex = Math.max(0, state.currentSectionIndex - 1);
        render();
        scrollToTop();
      });
    },
    "next-section": nextSection,
    "confirm-field": () => setFieldStatus(button.dataset.fieldKey, "confirmed"),
    "edit-field": () => setFieldStatus(button.dataset.fieldKey, "editing"),
    "cancel-edit": () => setFieldStatus(button.dataset.fieldKey, "idle"),
    "save-field": () => saveFieldUpdate(button.dataset.fieldKey),
    "set-draft": () => { state.fieldDrafts[button.dataset.fieldKey] = button.dataset.value; rerenderFieldCard(button.dataset.fieldKey); },
    "approve-section": approveSection,
    "save-draft": () => saveDraftForCurrentSection(),
    "tool-select": () => selectTool(button.dataset.fieldKey, button.dataset.value),
    "download-pdf": () => downloadSummaryPdf(),
    "submit-static": () => submitFinal()
  };

  if (actions[action]) actions[action]();
}

function goTo(screen) {
  state.screen = screen;
  if (screen !== "submitted") state.justSubmitted = false;
  if (screen === "welcome") {
    state.selectedSchoolId = null;
    state.selectedSchool = null;
    state.selectedResponse = null;
    state.search = "";
    state.coordinatorEmail = "";
    state.authError = false;
  }
  render();
}

function startCoordinatorFlow() {
  if (!state.apiOnline) { goTo("overview"); return; }
  state.authError = false;
  state.authChecking = false;
  goTo("auth");
}

async function verifyCoordinatorEmail() {
  if (state.authChecking) return;
  const email = (state.coordinatorEmail || "").trim();
  if (!email) { state.authError = true; render(); return; }
  if (!state.apiOnline) { goTo("overview"); return; }

  state.authChecking = true;
  state.authError = false;
  render();
  try {
    const result = await apiGet({ action: "verifyCoordinator", schoolId: state.selectedSchoolId, email });
    state.authChecking = false;
    if (result && result.verified) {
      state.authError = false;
      goTo("overview");
    } else {
      state.authError = true;
      render();
    }
  } catch (error) {
    state.authChecking = false;
    state.authError = true;
    render();
  }
}

function flashPendingEditField() {
  const editingKey = Object.keys(state.fieldStatus).find((k) => state.fieldStatus[k] === "editing");
  if (!editingKey) return;
  const card = document.querySelector(`.field-card[data-field-key="${CSS.escape(editingKey)}"]`);
  if (!card) return;
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  card.classList.remove("flash-warn");
  void card.offsetWidth;
  card.classList.add("flash-warn");
  window.setTimeout(() => card.classList.remove("flash-warn"), 1600);
}

function safeNavigate(callback) {
  if (hasPendingEdits()) {
    flashPendingEditField();
    showToast(state.strings.wizard.pendingWarning);
    return;
  }

  callback();
}

async function selectSchool(id) {
  state.selectedSchoolId = id;
  state.selectedSchool = state.schools.find((school) => school.id === id);
  state.fieldStatus = {};
  state.fieldDrafts = {};
  state.sectionStatus = {};
  state.currentSectionIndex = 0;
  state.selectedResponse = null;
  render();

  try {
    if (state.apiOnline) {
      const result = await apiGet({ action: "getSchool", schoolId: id });
      if (!result.ok) throw new Error(result.error || "getSchool failed");
      hydrateSelectedSchoolFromApi(result.school);
    } else {
      hydrateSelectedSchoolFromLocal(id);
    }
  } catch (error) {
    console.warn("Using local school fallback:", error);
    hydrateSelectedSchoolFromLocal(id);
  }

  render();
}

function setFieldStatus(key, status) {
  state.fieldStatus[key] = status;
  rerenderFieldCard(key);
  showToast(state.strings.saveIndicator.savedNow);
}

async function saveFieldUpdate(key) {
  const section = state.sections[state.currentSectionIndex];
  const field = section && section.fields.find((f) => f.key === key);
  if (field && field.enforceNumber) {
    const v = String(state.fieldDrafts[key] == null ? "" : state.fieldDrafts[key]).trim();
    if (!/^\d+(\.\d+)?$/.test(v)) {
      showToast("יש להזין מספר בלבד (למשל 3, 4, 5)");
      flashCard(key);
      return;
    }
  }
  state.fieldStatus[key] = "updated";
  rerenderFieldCard(key);
  showToast(state.strings.saveIndicator.savedNow);
  saveDraftForCurrentSection(false);
}

function flashCard(key) {
  const card = document.querySelector(`.field-card[data-field-key="${CSS.escape(key)}"]`);
  if (!card) return;
  card.classList.remove("flash-warn");
  void card.offsetWidth;
  card.classList.add("flash-warn");
  window.setTimeout(() => card.classList.remove("flash-warn"), 1600);
}

function approveSection() {
  const section = state.sections[state.currentSectionIndex];
  section.fields.forEach((field) => {
    state.fieldStatus[field.key] = "confirmed";
  });
  state.sectionStatus[section.id] = "approved";
  saveDraftForCurrentSection(false).finally(() => {
    showToast(state.strings.wizard.allApproved);
    nextSection();
  });
}

async function nextSection(shouldRender = true) {
  if (state.isSaving) return;

  if (hasPendingEdits()) {
    flashPendingEditField();
    showToast(state.strings.wizard.pendingWarning);
    return;
  }

  const section = state.sections[state.currentSectionIndex];
  if (!state.sectionStatus[section.id]) {
    state.sectionStatus[section.id] = getSectionCompletion(section) > 0 ? "complete" : "default_confirmed";
  }

  state.isSaving = true;
  render();

  await saveDraftForCurrentSection(false);

  state.isSaving = false;
  if (state.currentSectionIndex < state.sections.length - 1) {
    state.currentSectionIndex += 1;
    if (shouldRender !== false) render();
  } else {
    state.screen = "summary";
    render();
  }
  scrollToTop();
  showToast(state.strings.saveIndicator.savedStatic);
}

function scrollToTop() {
  window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  requestAnimationFrame(() => {
    window.scrollTo(0, 0);
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

function getFilteredSchools() {
  const query = state.search.trim().toLowerCase();
  if (!query) return state.schools;
  return state.schools.filter((school) =>
    school.name.toLowerCase().includes(query) || school.id.toLowerCase().includes(query)
  );
}

function hydrateSelectedSchoolFromApi(school) {
  const base = school.lastYear || {};
  const draft = school.draft || null;
  state.selectedSchool = {
    id: school.id,
    name: school.name || base.school_name || state.selectedSchool?.name || school.id
  };
  state.selectedResponse = { ...base, ...(draft || {}) };
  state.selectedResponse.status = school.status;
  state.selectedResponse.submittedAt = school.submittedAt;
  state.selectedResponse.lastSaved = school.lastSaved;
  state.selectedResponse.lastSection = school.lastSection;
  state.selectedResponse.revision = school.revision;

  if (draft) hydrateDraftState(base, draft, school.updatedFields || []);
  if (school.status === "submitted") state.screen = "submitted";
}

function hydrateSelectedSchoolFromLocal(id) {
  const response = state.responses.find((item) => item.school_id === id);
  state.selectedResponse = response;
  if (!state.selectedSchool && response) {
    state.selectedSchool = { id, name: response.school_name };
  }
  if (response && (response._status === "submitted" || response.status === "submitted")) {
    state.screen = "submitted";
  }
}

function hydrateDraftState(base, draft, updatedFields) {
  const keys = updatedFields.length ? updatedFields : Object.keys(draft).filter((key) => {
    return draft[key] !== null && draft[key] !== undefined && String(draft[key]) !== String(base[key] ?? "");
  });

  keys.forEach((key) => {
    state.fieldStatus[key] = "updated";
    state.fieldDrafts[key] = draft[key];
  });
}

async function saveDraftForCurrentSection(showSavedToast = true) {
  if (!state.selectedSchoolId) return;
  if (!state.apiOnline) {
    if (showSavedToast) showToast(state.strings.saveIndicator.savedStatic);
    return;
  }

  state.isSaving = true;
  document.body.classList.add("is-saving");
  try {
    const result = await apiPost({
      action: "saveDraft",
      schoolId: state.selectedSchoolId,
      sectionId: state.sections[state.currentSectionIndex]?.id || "",
      data: getUpdatedDataPayload(),
      updatedFields: getUpdatedFields().map((item) => item.field.key)
    });
    if (!result.ok) throw new Error(result.error || "שמירת טיוטה נכשלה");
    if (state.selectedResponse) {
      state.selectedResponse.status = result.status;
      state.selectedResponse.lastSaved = result.savedAt;
      state.selectedResponse.revision = result.revision;
    }
    if (showSavedToast) showToast(state.strings.saveIndicator.savedNow);
  } catch (error) {
    state.apiOnline = false;
    showToast(error.message || "שמירה נכשלה");
  } finally {
    state.isSaving = false;
    document.body.classList.remove("is-saving");
  }
}

async function submitFinal() {
  if (hasPendingEdits()) {
    showToast(state.strings.wizard.pendingWarning);
    return;
  }
  if (!state.apiOnline) {
    showToast(state.strings.summary.notYet);
    return;
  }

  applyToolsDefault();

  try {
    const result = await apiPost({
      action: "submitFinal",
      schoolId: state.selectedSchoolId,
      sectionId: "summary",
      data: getUpdatedDataPayload(),
      updatedFields: getUpdatedFields().map((item) => item.field.key)
    });
    if (!result.ok) throw new Error(result.error || "שליחה נכשלה");
    if (state.selectedResponse) {
      state.selectedResponse.status = "submitted";
      state.selectedResponse.submittedAt = result.submittedAt;
      state.selectedResponse.lastSaved = result.savedAt;
    }
    state.justSubmitted = true;
    state.screen = "submitted";
    render();
    scrollToTop();
    autoSavePdfToDrive();
  } catch (error) {
    showToast(error.message || "שליחה נכשלה");
  }
}

function sectionHasUpdate(section) {
  return section.fields.some((field) => {
    if (state.fieldStatus[field.key] === "updated") return true;
    if (field.type === "grade-table") {
      return (field.rows || []).some((row) => ["g7", "g8", "g9"].some((g) => row.keys && state.fieldStatus[row.keys[g]] === "updated"));
    }
    if (field.type === "checkbox-group") {
      return (field.options || []).some((opt) => state.fieldStatus[opt.key] === "updated" || (opt.detailKey && state.fieldStatus[opt.detailKey] === "updated"));
    }
    return false;
  });
}

function countTotalFields() {
  let total = 0;
  state.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (field.type === "grade-table" && Array.isArray(field.rows)) total += field.rows.length * 3;
      else if (field.type === "checkbox-group" && Array.isArray(field.options)) total += field.options.length;
      else total += 1;
    });
  });
  return total;
}

function getSummaryStats() {
  const totalFields = countTotalFields();
  const updated = getUpdatedFields().length;
  return { totalFields, updated, confirmed: Math.max(0, totalFields - updated), sections: state.sections.length };
}

function sanitizeFilename(name) {
  return String(name).replace(/["]/g, "״").replace(/[\/\\:*?<>|]/g, "-").replace(/\s+/g, " ").trim();
}

function getPdfFileName() {
  const school = state.selectedSchool || {};
  const name = school.name || state.selectedResponse?.school_name || "";
  const id = school.id || state.selectedResponse?.school_id || state.selectedSchoolId || "";
  return sanitizeFilename(`סטטוס מוט תשפ"ז - ${name} - ${id}`) + ".pdf";
}

function pdfGradeLabel(g) {
  return g === "g7" ? "ז'" : g === "g8" ? "ח'" : "ט'";
}

function pdfDetailRow(label, value, changed) {
  const val = escapeHtml(formatValue(value));
  const tag = changed ? '<span style="color:#E65100;font-weight:700;"> ✎ עודכן</span>' : "";
  return `<tr>
    <td style="padding:5px 10px;border-bottom:1px solid #eef0f3;width:55%;color:#414750;">${escapeHtml(label)}${tag}</td>
    <td style="padding:5px 10px;border-bottom:1px solid #eef0f3;font-weight:600;color:${changed ? "#E65100" : "#191c1e"};">${val}</td>
  </tr>`;
}

function buildPdfDetailHtml() {
  const changed = getUpdatedFields();
  const changesHtml = changed.length ? `
    <div style="font-size:18px;font-weight:700;color:#E65100;margin:26px 0 10px;">שדות שעודכנו (${changed.length})</div>
    <table style="width:100%;border-collapse:collapse;font-size:14px;border:1px solid #f0c9a8;">
      <tr style="background:#FFF3E0;">
        <th style="text-align:right;padding:7px 10px;border-bottom:1px solid #f0c9a8;">שדה</th>
        <th style="text-align:right;padding:7px 10px;border-bottom:1px solid #f0c9a8;width:28%;">ערך קודם</th>
        <th style="text-align:right;padding:7px 10px;border-bottom:1px solid #f0c9a8;width:28%;">ערך חדש</th>
      </tr>
      ${changed.map((c) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #f6e0cd;">${escapeHtml(c.field.label)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f6e0cd;color:#717781;">${escapeHtml(c.previousValue)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #f6e0cd;color:#E65100;font-weight:700;">${escapeHtml(c.newValue)}</td>
      </tr>`).join("")}
    </table>` : '<div style="margin:26px 0 10px;font-size:15px;color:#14671f;">לא בוצעו עדכונים — כל הנתונים אושרו כפי שהיו בשנה הקודמת.</div>';

  const detailHtml = state.sections.map((section) => {
    const rows = [];
    section.fields.forEach((field) => {
      if (field.type === "grade-table") {
        (field.rows || []).forEach((row) => {
          ["g7", "g8", "g9"].forEach((g) => {
            const key = row.keys && row.keys[g];
            if (!key) return;
            rows.push(pdfDetailRow(`${field.label} · ${row.label} (${pdfGradeLabel(g)})`, subFieldValue(key), state.fieldStatus[key] === "updated"));
          });
        });
      } else if (field.type === "checkbox-group") {
        (field.options || []).forEach((opt) => {
          rows.push(pdfDetailRow(`${field.label} · ${opt.label}`, subFieldValue(opt.key) || "—", state.fieldStatus[opt.key] === "updated"));
          if (opt.detailKey && subFieldValue(opt.detailKey)) {
            rows.push(pdfDetailRow(`${field.label} · ${opt.detailLabel || opt.label}`, subFieldValue(opt.detailKey), state.fieldStatus[opt.detailKey] === "updated"));
          }
        });
      } else {
        const upd = state.fieldStatus[field.key] === "updated";
        const v = upd ? state.fieldDrafts[field.key] : (state.selectedResponse ? state.selectedResponse[field.key] : null);
        rows.push(pdfDetailRow(field.label, v, upd));
      }
    });
    return `
      <div style="font-size:15px;font-weight:700;color:#005c9b;margin:18px 0 6px;">${section.id}. ${escapeHtml(section.title)}</div>
      <table style="width:100%;border-collapse:collapse;font-size:13.5px;border:1px solid #e0e3e6;">
        ${rows.join("")}
      </table>`;
  }).join("");

  return changesHtml + '<div style="font-size:18px;font-weight:700;color:#005c9b;margin:28px 0 8px;">פירוט מלא לפי חלקים</div>' + detailHtml;
}

function buildPdfSummaryElement() {
  const t = state.strings.submitted;
  const stats = getSummaryStats();
  const school = state.selectedSchool || {};
  const name = school.name || state.selectedResponse?.school_name || "";
  const id = school.id || state.selectedResponse?.school_id || state.selectedSchoolId || "";
  const submittedAt = formatSubmittedDate(state.selectedResponse?._submittedAt || state.selectedResponse?.submittedAt);

  const wrap = document.createElement("div");
  wrap.setAttribute("dir", "rtl");
  wrap.style.cssText = "font-family:'Assistant',sans-serif;width:760px;padding:36px;background:#ffffff;color:#191c1e;box-sizing:border-box;";
  wrap.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;border-bottom:3px solid #005c9b;padding-bottom:18px;margin-bottom:24px;">
      <img src="science-technology-logo.jpg" style="height:64px;width:64px;border-radius:50%;object-fit:cover;" />
      <div>
        <div style="font-size:24px;font-weight:700;color:#005c9b;">${escapeHtml(t.pdfDocTitle)}</div>
        <div style="font-size:15px;color:#414750;">המינהל לחינוך התיישבותי פנימייתי ועליית הנוער</div>
      </div>
    </div>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:16px;">
      <tr><td style="padding:5px 0;color:#414750;width:140px;">${escapeHtml(t.pdfSchool)}</td><td style="padding:5px 0;font-weight:700;">${escapeHtml(name)}</td></tr>
      <tr><td style="padding:5px 0;color:#414750;">${escapeHtml(t.pdfSymbol)}</td><td style="padding:5px 0;font-weight:700;">${escapeHtml(id)}</td></tr>
      <tr><td style="padding:5px 0;color:#414750;">${escapeHtml(t.pdfSubmittedAt)}</td><td style="padding:5px 0;font-weight:700;">${escapeHtml(submittedAt)}</td></tr>
    </table>
    <div style="font-size:18px;font-weight:700;color:#005c9b;margin-bottom:12px;">${escapeHtml(t.pdfStatsTitle)}</div>
    <div style="display:flex;gap:14px;margin-bottom:28px;">
      <div style="flex:1;border:1px solid #c1c7d2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:700;color:#14671f;">${stats.confirmed}</div>
        <div style="font-size:14px;color:#414750;">${escapeHtml(t.pdfConfirmedFields)}</div>
      </div>
      <div style="flex:1;border:1px solid #c1c7d2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:700;color:#E65100;">${stats.updated}</div>
        <div style="font-size:14px;color:#414750;">${escapeHtml(t.pdfUpdatedFields)}</div>
      </div>
      <div style="flex:1;border:1px solid #c1c7d2;border-radius:10px;padding:16px;text-align:center;">
        <div style="font-size:30px;font-weight:700;color:#005c9b;">${stats.sections}</div>
        <div style="font-size:14px;color:#414750;">${escapeHtml(state.strings.summary.sectionsDone)}</div>
      </div>
    </div>
    ${buildPdfDetailHtml()}`;
  return wrap;
}

function waitForImages(root) {
  const images = Array.prototype.slice.call(root.querySelectorAll("img"));
  return Promise.all(images.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise((resolve) => {
      const done = () => resolve();
      img.addEventListener("load", done, { once: true });
      img.addEventListener("error", done, { once: true });
      window.setTimeout(done, 4000);
    });
  }));
}

async function renderPdfWorker() {
  if (typeof window.html2pdf === "undefined") throw new Error("html2pdf לא נטען");
  const innerHtml = buildPdfSummaryElement().outerHTML;
  const baseHref = window.location.href;

  // רינדור בתוך iframe נקי לחלוטין — בלי ה-CSS של העמוד (Tailwind/CDN),
  // שהוא הסיבה ש-html2canvas צילם דף ריק.
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText = "position:fixed;left:0;top:0;width:820px;height:1400px;border:0;background:#ffffff;z-index:2147483647;";
  document.body.appendChild(iframe);
  const cleanup = () => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); };

  try {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(
      '<!DOCTYPE html><html dir="rtl" lang="he"><head><meta charset="utf-8">' +
      '<base href="' + baseHref + '">' +
      '<link href="https://fonts.googleapis.com/css2?family=Assistant:wght@200..800&display=swap" rel="stylesheet">' +
      '<style>html,body{margin:0;padding:0;background:#fff;}</style></head><body>' +
      innerHtml + '</body></html>'
    );
    doc.close();

    await new Promise((res) => {
      if (doc.readyState === "complete") return res();
      iframe.addEventListener("load", res, { once: true });
      window.setTimeout(res, 3000);
    });
    if (doc.fonts && doc.fonts.ready) {
      try { await doc.fonts.ready; } catch (e) {}
    }
    await waitForImages(doc.body);
    await new Promise((r) => window.setTimeout(r, 150));

    const target = doc.body.firstElementChild;
    // התאמת גובה ה-iframe לכל התוכן (ה-PDF כעת ארוך/רב-עמודי) כדי ש-html2canvas יצלם הכל.
    try { iframe.style.height = Math.max(1400, doc.body.scrollHeight + 40) + "px"; } catch (e) {}
    const worker = window.html2pdf().set({
      margin: [10, 10, 10, 10],
      filename: getPdfFileName(),
      image: { type: "jpeg", quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false },
      jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
    }).from(target);
    return { worker, cleanup };
  } catch (error) {
    cleanup();
    throw error;
  }
}

async function downloadSummaryPdf() {
  if (state.pdfBusy) return;
  state.pdfBusy = true;
  render();
  try {
    const { worker, cleanup } = await renderPdfWorker();
    await worker.save();
    cleanup();
  } catch (error) {
    console.error("PDF generation failed:", error);
    showToast(error.message || "יצירת ה-PDF נכשלה");
  } finally {
    state.pdfBusy = false;
    render();
  }
}

async function autoSavePdfToDrive() {
  if (!state.apiOnline) return;
  try {
    const { worker, cleanup } = await renderPdfWorker();
    const dataUri = await worker.outputPdf("datauristring");
    cleanup();
    const base64 = String(dataUri).split(",")[1] || "";
    if (!base64) return;
    const school = state.selectedSchool || {};
    await apiPost({
      action: "savePdfSummary",
      schoolId: state.selectedSchoolId,
      schoolName: school.name || state.selectedResponse?.school_name || "",
      pdfBase64: base64
    });
  } catch (error) {
    console.warn("autoSavePdfToDrive failed (non-blocking):", error);
  }
}

async function openCorrection() {
  if (state.apiOnline) {
    try {
      const result = await apiPost({ action: "openCorrection", schoolId: state.selectedSchoolId });
      if (!result.ok) throw new Error(result.error || "פתיחה לתיקון נכשלה");
      if (state.selectedResponse) {
        state.selectedResponse.status = "in_progress";
        state.selectedResponse.lastSaved = result.savedAt;
      }
    } catch (error) {
      showToast(error.message || "פתיחה לתיקון נכשלה");
      return;
    }
  }

  state.sectionStatus = {};
  safeNavigate(() => goTo("wizard"));
}

function getUpdatedDataPayload() {
  const data = {};
  Object.keys(state.fieldStatus).forEach((key) => {
    if (state.fieldStatus[key] === "updated") {
      data[key] = state.fieldDrafts[key] ?? "";
    }
  });
  return data;
}

async function apiGet(params) {
  const url = new URL(API_URL);
  Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
  const response = await fetch(url.toString(), { method: "GET" });
  return response.json();
}

async function apiPost(payload) {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(payload)
  });
  return response.json();
}

function getUpdatedFields() {
  const fieldsByKey = new Map();
  state.sections.forEach((section) => {
    section.fields.forEach((field) => {
      fieldsByKey.set(field.key, field);
      if (field.type === "grade-table" && Array.isArray(field.rows)) {
        field.rows.forEach((row) => {
          ["g7", "g8", "g9"].forEach((g) => {
            if (row.keys && row.keys[g]) {
              const label = `${field.label} · ${row.label} (${g === "g7" ? "ז'" : g === "g8" ? "ח'" : "ט'"})`;
              fieldsByKey.set(row.keys[g], { key: row.keys[g], label });
            }
          });
        });
      }
      if (field.type === "checkbox-group" && Array.isArray(field.options)) {
        field.options.forEach((opt) => {
          fieldsByKey.set(opt.key, { key: opt.key, label: `${field.label} · ${opt.label}` });
          if (opt.detailKey) fieldsByKey.set(opt.detailKey, { key: opt.detailKey, label: `${field.label} · ${opt.detailLabel || opt.label}` });
        });
      }
    });
  });

  return Object.entries(state.fieldStatus)
    .filter(([, status]) => status === "updated")
    .map(([key]) => {
      const field = fieldsByKey.get(key) || { key, label: key };
      return {
        field,
        previousValue: formatValue(state.selectedResponse?.[key]),
        newValue: formatValue(state.fieldDrafts[key])
      };
    });
}

function hasPendingEdits() {
  return Object.values(state.fieldStatus).some((status) => status === "editing");
}

function getProgressPercent() {
  const visitedSections = Math.max(Object.keys(state.sectionStatus).length, state.currentSectionIndex);
  return Math.min(100, Math.round((visitedSections / state.sections.length) * 100));
}

function getSectionCompletion(section) {
  return section.fields.filter((field) => state.fieldStatus[field.key]).length;
}

function formatValue(value) {
  if (value === null || value === undefined || value === "") {
    return state.strings.verification.sourceEmpty;
  }
  return String(value);
}

function joinValues(values) {
  const clean = values.filter((value) => value !== null && value !== undefined && value !== "");
  return clean.length ? clean.join(" ") : state.strings.verification.sourceEmpty;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("is-visible");
  window.clearTimeout(showToast.timeout);
  showToast.timeout = window.setTimeout(() => {
    toast.classList.remove("is-visible");
  }, 1800);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}
