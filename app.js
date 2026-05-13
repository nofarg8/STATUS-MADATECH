const app = document.getElementById("app");
const toast = document.getElementById("save-toast");
const API_URL = "https://script.google.com/macros/s/AKfycbz7HzhsaGWkJXm89bgTr7I4H8260QQJOGSTSIM9rtp08RdJiq9mWpP-fmK4gQBQif8s/exec";

const state = {
  strings: null,
  schools: [],
  responses: [],
  sections: [],
  apiOnline: false,
  isSaving: false,
  justSubmitted: false,
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
      Object.values(jsonFiles).map((url) => fetch(url).then((response) => {
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
          <nav class="flex justify-center">
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
  const fields = section.fields.slice(0, 4);
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

            ${section.pattern === "C" && state.sectionStatus[section.id] !== "expanded" ? renderMatrixCard(section) : section.fields.map(renderFieldCard).join("")}

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
          const hasUpdate = section.fields.some((field) => state.fieldStatus[field.key] === "updated");
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
  const input = newCard.querySelector("[data-draft-field]");
  if (input) {
    input.addEventListener("input", (event) => {
      state.fieldDrafts[input.dataset.draftField] = event.target.value;
    });
  }
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

function renderEditControl(field, displayValue) {
  const draft = state.fieldDrafts[field.key] ?? (displayValue === state.strings.verification.sourceEmpty ? "" : displayValue);
  const control = field.type === "textarea"
    ? `<textarea class="w-full min-h-[120px] p-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" data-draft-field="${field.key}">${escapeHtml(draft)}</textarea>`
    : `<input class="w-full h-[52px] px-lg bg-[#FFF3E0] border border-[#E65100] rounded-lg font-body-md focus-ring" type="${field.type === "email" ? "email" : field.type === "phone" ? "tel" : "text"}" value="${escapeAttr(draft)}" data-draft-field="${field.key}" />`;

  return `
    <div class="space-y-md">
      ${control}
      <div class="flex flex-col sm:flex-row gap-md justify-end">
        <button class="h-[44px] px-lg rounded-lg text-primary underline underline-offset-4 font-label-bold focus-ring" data-action="cancel-edit" data-field-key="${field.key}">${state.strings.verification.cancelBtn}</button>
        <button class="h-[44px] px-lg rounded-lg bg-primary text-on-primary font-label-bold focus-ring" data-action="save-field" data-field-key="${field.key}">${state.strings.verification.saveBtn}</button>
      </div>
    </div>`;
}

function renderMatrixCard(section) {
  const visibleFields = section.fields.filter((field) => {
    const value = state.selectedResponse[field.key];
    return value !== null && value !== "" && value !== "אף אחד";
  });

  return `
    <article class="bg-surface-container-lowest border border-outline-variant/40 rounded-xl p-xl soft-shadow">
      <h3 class="font-title-sm text-title-sm text-on-surface mb-xs">${section.title}</h3>
      <p class="font-caption text-caption text-on-surface-variant mb-lg">מציגים את הפריטים שבהם דווח ערך שאינו "אף אחד".</p>
      <div class="bg-on-tertiary-container border border-dashed border-tertiary-container rounded-lg p-lg mb-lg">
        <div class="flex flex-wrap gap-sm">
          ${visibleFields.map((field) => `
            <span class="px-md py-xs bg-surface-container-lowest border border-tertiary-container rounded-full font-caption text-caption text-tertiary">
              ${escapeHtml(field.label)} - ${escapeHtml(formatValue(state.selectedResponse[field.key]))}
            </span>`).join("")}
        </div>
      </div>
      <div class="space-y-sm">
        <button class="w-full h-[52px] bg-primary text-on-primary font-label-bold rounded-lg focus-ring" data-action="approve-section">${state.strings.verification.matrixSame}</button>
        <button class="w-full min-h-[44px] bg-transparent border border-primary text-primary font-label-bold rounded-lg focus-ring" data-action="matrix-partial">${state.strings.verification.matrixPartial}</button>
        <button class="w-full min-h-[44px] bg-surface-container text-on-surface-variant font-label-bold rounded-lg focus-ring" data-action="matrix-full">${state.strings.verification.matrixFull}</button>
      </div>
    </article>`;
}

function renderSummary() {
  const t = state.strings.summary;
  const totalFields = state.sections.reduce((sum, section) => sum + section.fields.length, 0);
  const updated = getUpdatedFields().length;
  const confirmed = totalFields - updated;
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
                  ${section.fields.some((field) => state.fieldStatus[field.key] === "updated") ? "עודכן" : "אושר כברירת מחדל"}
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

  document.querySelectorAll("[data-draft-field]").forEach((element) => {
    element.addEventListener("input", (event) => {
      state.fieldDrafts[event.target.dataset.draftField] = event.target.value;
    });
  });
}

function handleAction(event) {
  const button = event.currentTarget;
  const action = button.dataset.action;
  const actions = {
    "go-welcome": () => safeNavigate(() => goTo("welcome")),
    "select-school": () => selectSchool(button.dataset.schoolId),
    "start-overview": () => goTo("overview"),
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
    "approve-section": approveSection,
    "save-draft": () => saveDraftForCurrentSection(),
    "matrix-partial": () => markCurrentMatrix("editing"),
    "matrix-full": () => markCurrentMatrix("editing"),
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
  }
  render();
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
  state.fieldStatus[key] = "updated";
  rerenderFieldCard(key);
  showToast(state.strings.saveIndicator.savedNow);
  saveDraftForCurrentSection(false);
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

function markCurrentMatrix(status) {
  const section = state.sections[state.currentSectionIndex];
  state.sectionStatus[section.id] = status === "editing" ? "expanded" : "approved";
  render();
  scrollToTop();
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
  } catch (error) {
    showToast(error.message || "שליחה נכשלה");
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
    section.fields.forEach((field) => fieldsByKey.set(field.key, field));
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
