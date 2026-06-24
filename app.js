const articlesKey = "field-notes-articles";
const backupKey = "field-notes-articles-backup";
const postsFile = "/posts.json";

const storage = {
  get(key, fallback) {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(saved)) return saved;
      const backup = JSON.parse(localStorage.getItem(backupKey));
      return Array.isArray(backup) ? backup : fallback;
    } catch {
      try {
        const backup = JSON.parse(localStorage.getItem(backupKey));
        return Array.isArray(backup) ? backup : fallback;
      } catch {
        return fallback;
      }
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      localStorage.setItem(backupKey, JSON.stringify(value));
      return true;
    } catch {
      showToast("Storage is full. Download a backup, then use fewer or smaller images.");
      return false;
    }
  }
};

let articles = [];
let activeTag = "All";
let searchTerm = "";
let inlineImagesDraft = {};
const studioEnabled = new URLSearchParams(location.search).get("studio") === "1";

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const imageStorageTarget = 650000;
const compressedImage = file => new Promise((resolve, reject) => {
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    let maxWidth = 1200;
    let quality = 0.82;
    let output = "";

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const scale = Math.min(1, maxWidth / image.width);
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      output = canvas.toDataURL("image/jpeg", quality);
      if (output.length <= imageStorageTarget) break;
      if (quality > 0.58) quality -= 0.12;
      else maxWidth = Math.max(640, Math.round(maxWidth * 0.78));
    }

    URL.revokeObjectURL(url);
    if (output.length > 1200000) {
      reject(new Error("Image is still too large after compression—try a smaller image"));
      return;
    }
    resolve(output);
  };
  image.onerror = () => {
    URL.revokeObjectURL(url);
    reject(new Error("The image could not be read"));
  };
  image.src = url;
});
const readImage = file => new Promise((resolve, reject) => {
  if (!file || !file.size) return resolve("");
  if (!file.type.startsWith("image/")) return reject(new Error("Please choose an image file"));
  if (file.size > 12000000) return reject(new Error("Please choose an image under 12 MB"));
  compressedImage(file).then(resolve).catch(reject);
});
const imageMarker = id => `\n\n[[image:${id}]]\n\n`;

function imageId() {
  return `img-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function insertTextAtCursor(textarea, text) {
  const start = textarea.selectionStart ?? textarea.value.length;
  const end = textarea.selectionEnd ?? textarea.value.length;
  textarea.value = `${textarea.value.slice(0, start)}${text}${textarea.value.slice(end)}`;
  const cursor = start + text.length;
  textarea.focus();
  textarea.setSelectionRange(cursor, cursor);
  textarea.dispatchEvent(new Event("input", { bubbles: true }));
}

function inlineImageCount(body = $("#article-body")?.value || "") {
  return (body.match(/\[\[image:[^\]]+\]\]/g) || []).length;
}

function updateInlineImageStatus() {
  const status = $("#inline-image-status");
  if (!status) return;
  const count = inlineImageCount();
  status.textContent = count ? `${count} inline image${count === 1 ? "" : "s"} inserted.` : "No inline images inserted yet.";
}

function pruneInlineImages(body, images) {
  const used = new Set([...body.matchAll(/\[\[image:([^\]]+)\]\]/g)].map(match => match[1]));
  return Object.fromEntries(Object.entries(images).filter(([id]) => used.has(id)));
}

function insertInlineImage(src, alt = "Article image") {
  const id = imageId();
  inlineImagesDraft[id] = { src, alt };
  insertTextAtCursor($("#article-body"), imageMarker(id));
  updateInlineImageStatus();
}

function imageFigure(src, alt = "Article image") {
  const safeImage = src?.startsWith("data:image/") || src?.startsWith("https://") || src?.startsWith("http://");
  return safeImage ? `<figure class="inline-article-image"><img src="${escapeHTML(src)}" alt="${escapeHTML(alt || "Article image")}" /></figure>` : "";
}

function renderArticleBody(body, inlineImages = {}) {
  const imagePattern = /\[\[image:([^\]]+)\]\]|!\[([^\]]*)\]\((data:image\/[^)\s]+|https?:\/\/[^)\s]+)\)|(data:image\/[a-zA-Z0-9.+-]+;base64,[A-Za-z0-9+/=]+)|<img[^>]+src=["']([^"']+)["'][^>]*>/g;
  const pieces = [];
  let cursor = 0;
  let match;
  while ((match = imagePattern.exec(body)) !== null) {
    if (match.index > cursor) pieces.push({ type: "text", value: body.slice(cursor, match.index) });
    if (match[1]) {
      pieces.push({ type: "image", alt: inlineImages[match[1]]?.alt || "Article image", src: inlineImages[match[1]]?.src });
    } else {
      pieces.push({ type: "image", alt: match[2] || "Article image", src: match[3] || match[4] || match[5] });
    }
    cursor = match.index + match[0].length;
  }
  if (cursor < body.length) pieces.push({ type: "text", value: body.slice(cursor) });

  return pieces.map(piece => {
    if (piece.type === "image") {
      return imageFigure(piece.src, piece.alt);
    }
    return piece.value.split(/\n\s*\n/).map(paragraph => paragraph.trim()).filter(Boolean).map(paragraph => `<p>${escapeHTML(paragraph)}</p>`).join("");
  }).join("");
}

function openStudio() {
  if (!studioEnabled) return;
  renderManagement();
  $("#studio-dialog").showModal();
}

function setupStudioAccess() {
  if (!studioEnabled) return;
  $$("[data-action='open-studio']").forEach(button => button.hidden = false);
  if (location.hash === "#studio") openStudio();
}

function resetArticleForm() {
  const form = $("#article-form");
  form.reset();
  inlineImagesDraft = {};
  delete form.dataset.editingId;
  $("#article-submit").textContent = "Save article";
  $("#cancel-edit").hidden = true;
  updateInlineImageStatus();
}

function startEditingArticle(id) {
  const article = articles.find(item => item.id === id);
  if (!article) return;
  const form = $("#article-form");
  form.dataset.editingId = article.id;
  form.elements.title.value = article.title;
  form.elements.tags.value = article.tags.join(", ");
  form.elements.readTime.value = article.readTime;
  form.elements.summary.value = article.summary;
  form.elements.body.value = article.body;
  form.elements.image.value = "";
  inlineImagesDraft = { ...(article.inlineImages || {}) };
  $("#article-submit").textContent = "Update article";
  $("#cancel-edit").hidden = false;
  updateInlineImageStatus();
  form.scrollIntoView({ behavior: "smooth", block: "start" });
  form.elements.title.focus();
}

function renderTags() {
  const tags = ["All", ...new Set(articles.flatMap(article => article.tags))];
  if (!tags.includes(activeTag)) activeTag = "All";
  $("#tag-filters").innerHTML = tags.map(tag => `<button class="tag-filter ${tag === activeTag ? "active" : ""}" data-tag="${escapeHTML(tag)}" type="button">${escapeHTML(tag)}</button>`).join("");
}

function renderArticles() {
  renderTags();
  const filtered = articles.filter(article => {
    const tagMatch = activeTag === "All" || article.tags.includes(activeTag);
    const haystack = `${article.title} ${article.summary} ${article.tags.join(" ")}`.toLowerCase();
    return tagMatch && haystack.includes(searchTerm.toLowerCase());
  });
  $("#article-grid").innerHTML = filtered.map((article, index) => `
    <article class="article-card" tabindex="0" data-article-id="${escapeHTML(article.id)}">
      ${article.image ? `<img class="article-card-image" src="${escapeHTML(article.image)}" alt="${escapeHTML(article.title)}" loading="lazy" />` : ""}
      <div class="article-number"><span>0${index + 1}</span><span>${escapeHTML(article.readTime)}</span></div>
      <h2>${escapeHTML(article.title)}</h2>
      <p>${escapeHTML(article.summary)}</p>
      <div>${article.tags.map(tag => `<span class="tag">#${escapeHTML(tag)}</span>`).join("")}</div>
      <span class="arrow" aria-hidden="true">↗</span>
    </article>`).join("");
  $("#article-empty").hidden = filtered.length > 0;
}

function renderManagement() {
  $("#manage-articles").innerHTML = `<p class="eyebrow">Published · ${articles.length}</p>` + articles.map(article => `
    <div class="manage-item">
      <div><strong>${escapeHTML(article.title)}</strong><small>${article.tags.map(escapeHTML).join(" · ")}</small></div>
      <div class="manage-actions">
        <button class="edit-button" data-edit-article="${escapeHTML(article.id)}" type="button">Edit</button>
        <button class="delete-button" data-delete-article="${escapeHTML(article.id)}" type="button">Delete</button>
      </div>
    </div>`).join("");
}

function showArticle(id) {
  const article = articles.find(item => item.id === id);
  if (!article) { navigateTo("/home"); return; }
  $("#article-reading").innerHTML = `
    <a class="back-link" href="/home">← Back to journal</a>
    <p class="eyebrow">${article.tags.map(tag => `#${escapeHTML(tag)}`).join(" &nbsp; ")}</p>
    <h1>${escapeHTML(article.title)}</h1>
    <div class="reading-meta"><span>${escapeHTML(article.date)}</span><span>${escapeHTML(article.readTime)}</span></div>
    ${article.image ? `<img class="article-hero-image" src="${escapeHTML(article.image)}" alt="${escapeHTML(article.title)}" />` : ""}
    <div class="article-body">${renderArticleBody(article.body, article.inlineImages || {})}</div>`;
  showView("article");
  document.title = article.title;
}

function showView(view) {
  $$("[data-view]").forEach(section => section.hidden = section.dataset.view !== view);
  $$("[data-route]").forEach(link => link.classList.toggle("active", link.dataset.route === view || (view === "article" && link.dataset.route === "blog")));
  $(".main-nav").classList.remove("open");
  $(".menu-button").setAttribute("aria-expanded", "false");
  window.scrollTo(0, 0);
}

function currentRoute() {
  const hashRoute = location.hash.replace("#", "");
  if (hashRoute === "blog") return { path: "/home", replace: true };
  if (hashRoute === "about") return { path: "/about", replace: true };
  if (hashRoute.startsWith("article/")) return { path: `/${hashRoute}`, replace: true };

  const path = location.pathname.replace(/\/$/, "") || "/";
  if (location.pathname !== "/" && location.pathname.endsWith("/")) return { path, replace: true };
  if (path === "/" || path === "/home" || path === "/blog") return { view: "blog", path: path === "/blog" ? "/blog" : "/home" };
  if (path === "/about") return { view: "about", path: "/about" };
  if (path.startsWith("/article/")) return { articleId: path.split("/")[2], path };
  return { view: "blog", path: "/home", replace: true };
}

function route() {
  const routeState = currentRoute();
  if (routeState.replace) {
    history.replaceState(null, "", routeState.path);
    if (!routeState.view && !routeState.articleId) return route();
  }
  if (routeState.articleId) return showArticle(routeState.articleId);
  const view = routeState.view || "blog";
  showView(view);
  document.title = view === "about" ? "About Kevin" : "Kevin's Blog";
}

function navigateTo(path) {
  history.pushState(null, "", path);
  route();
}

function slugify(value) {
  const base = value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return `${base || "note"}-${Date.now().toString(36)}`;
}

function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => toast.classList.remove("show"), 2400);
}

function showStudioNotice(message) {
  const notice = $("#studio-notice");
  if (!notice) return showToast(message);
  notice.textContent = message;
  notice.classList.add("show");
}

function backupFilename() {
  return postsFile;
}

function downloadArticleBackup() {
  const payload = {
    exportedAt: new Date().toISOString(),
    articles
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = backupFilename();
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(link.href);
  showStudioNotice("posts.json downloaded. Commit it to GitHub to publish permanently.");
}

function normalizeImportedArticles(payload) {
  const imported = Array.isArray(payload) ? payload : payload?.articles;
  if (!Array.isArray(imported)) return [];
  return imported.filter(article =>
    article && typeof article.id === "string" && typeof article.title === "string" && typeof article.body === "string"
  ).map(article => ({
    id: article.id,
    title: article.title,
    tags: Array.isArray(article.tags) ? article.tags : [],
    summary: article.summary || "",
    body: article.body,
    image: article.image || "",
    inlineImages: article.inlineImages || {},
    date: article.date || "",
    readTime: article.readTime || ""
  }));
}

function importArticleBackup(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const imported = normalizeImportedArticles(JSON.parse(reader.result));
      if (!imported.length) throw new Error("No articles found in that backup file.");
      if (!storage.set(articlesKey, imported)) return;
      articles = imported;
      resetArticleForm();
      renderArticles();
      renderManagement();
      showStudioNotice(`Imported ${imported.length} article${imported.length === 1 ? "" : "s"}.`);
    } catch (error) {
      showStudioNotice(error.message || "That backup file could not be imported.");
    }
  };
  reader.readAsText(file);
}

async function fetchPublishedArticles() {
  try {
    const response = await fetch(`${postsFile}?v=${Date.now()}`, { cache: "no-store" });
    if (!response.ok) return [];
    return normalizeImportedArticles(await response.json());
  } catch {
    return [];
  }
}

async function initializeArticles() {
  const publishedArticles = await fetchPublishedArticles();
  const studioArticles = studioEnabled ? storage.get(articlesKey, null) : null;
  articles = studioEnabled && Array.isArray(studioArticles) && studioArticles.length ? studioArticles : publishedArticles;
  if (studioEnabled && !Array.isArray(studioArticles) && publishedArticles.length) storage.set(articlesKey, publishedArticles);
  renderArticles();
  renderManagement();
  setupStudioAccess();
  route();
}

document.addEventListener("click", event => {
  const tag = event.target.closest("[data-tag]");
  if (tag) { activeTag = tag.dataset.tag; renderArticles(); }
  const card = event.target.closest("[data-article-id]");
  if (card) navigateTo(`/article/${card.dataset.articleId}`);
  const routeLink = event.target.closest("[data-route], .back-link");
  if (routeLink) {
    event.preventDefault();
    navigateTo(routeLink.getAttribute("href"));
  }
  if (event.target.closest('[data-action="open-studio"]')) openStudio();
  if (event.target.closest('[data-action="close-studio"]')) $("#studio-dialog").close();
  if (event.target.closest('[data-action="back-to-top"]')) window.scrollTo({ top: 0, behavior: "smooth" });
  if (event.target.closest('[data-action="clear-filters"]')) { activeTag = "All"; searchTerm = ""; $("#article-search").value = ""; renderArticles(); }
  const tab = event.target.closest("[data-studio-tab]");
  if (tab) {
    $$("[data-studio-tab]").forEach(button => button.classList.toggle("active", button === tab));
    $$("[data-studio-panel]").forEach(panel => panel.hidden = panel.dataset.studioPanel !== tab.dataset.studioTab);
  }
  const deleteArticle = event.target.closest("[data-delete-article]");
  if (deleteArticle) {
    const nextArticles = articles.filter(article => article.id !== deleteArticle.dataset.deleteArticle);
    if ($("#article-form").dataset.editingId === deleteArticle.dataset.deleteArticle) resetArticleForm();
    if (!storage.set(articlesKey, nextArticles)) return;
    articles = nextArticles; renderArticles(); renderManagement(); showToast("Article deleted");
  }
  const editArticle = event.target.closest("[data-edit-article]");
  if (editArticle) startEditingArticle(editArticle.dataset.editArticle);
});

document.addEventListener("keydown", event => {
  if ((event.key === "Enter" || event.key === " ") && event.target.matches("[data-article-id]")) { event.preventDefault(); event.target.click(); }
});

$("#article-search").addEventListener("input", event => { searchTerm = event.target.value; renderArticles(); });
$(".menu-button").addEventListener("click", event => {
  const open = $(".main-nav").classList.toggle("open"); event.currentTarget.setAttribute("aria-expanded", String(open));
});

$("#insert-inline-image").addEventListener("click", () => $("#inline-image-input").click());

$("#inline-image-input").addEventListener("change", async event => {
  const file = event.currentTarget.files[0];
  if (!file) {
    showStudioNotice("No image selected.");
    return;
  }
  try {
    showStudioNotice("Compressing image...");
    const image = await readImage(file);
    insertInlineImage(image, file?.name?.replace(/\.[^.]+$/, "") || "Article image");
    showStudioNotice("Image inserted. Look for the [[image:...]] marker in the article text.");
  } catch (error) {
    showStudioNotice(error.message);
  } finally {
    event.currentTarget.value = "";
  }
});

$("#article-body").addEventListener("paste", async event => {
  const clipboard = event.clipboardData;
  const file = [...(clipboard?.files || []), ...[...(clipboard?.items || [])].map(item => item.getAsFile()).filter(Boolean)].find(item => item.type.startsWith("image/"));
  const htmlImage = clipboard?.getData("text/html")?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1];
  const textImage = clipboard?.getData("text/plain")?.trim();
  const pastedImage = htmlImage || (/^(data:image\/|https?:\/\/)/.test(textImage || "") ? textImage : "");
  if (!file && !pastedImage) return;
  event.preventDefault();
  try {
    showStudioNotice("Compressing pasted image...");
    const image = file ? await readImage(file) : pastedImage;
    insertInlineImage(image);
    showStudioNotice("Pasted image inserted. Look for the [[image:...]] marker in the article text.");
  } catch (error) {
    showStudioNotice(error.message);
  }
});

$("#article-body").addEventListener("input", updateInlineImageStatus);

$("#cancel-edit").addEventListener("click", resetArticleForm);
$("#download-backup").addEventListener("click", downloadArticleBackup);
$("#import-backup").addEventListener("click", () => $("#backup-input").click());
$("#backup-input").addEventListener("change", event => {
  importArticleBackup(event.currentTarget.files[0]);
  event.currentTarget.value = "";
});

$("#article-form").addEventListener("submit", async event => {
  event.preventDefault();
  const form = event.currentTarget;
  const data = new FormData(event.currentTarget);
  const editingId = form.dataset.editingId;
  const existingArticle = articles.find(article => article.id === editingId);
  let image = "";
  try {
    image = await readImage(data.get("image"));
  } catch (error) {
    showToast(error.message);
    return;
  }
  const article = {
    id: existingArticle?.id || slugify(data.get("title")), title: data.get("title").trim(),
    tags: data.get("tags").split(",").map(tag => tag.trim()).filter(Boolean),
    summary: data.get("summary").trim(), body: data.get("body").trim(), image: image || existingArticle?.image || "",
    inlineImages: pruneInlineImages(data.get("body").trim(), inlineImagesDraft),
    date: existingArticle?.date || new Intl.DateTimeFormat("en-US", { month: "long", day: "2-digit", year: "numeric" }).format(new Date()),
    readTime: data.get("readTime").trim() || `${Math.max(1, Math.ceil(data.get("body").trim().split(/\s+/).length / 220))} min read`
  };
  const nextArticles = existingArticle ? articles.map(item => item.id === editingId ? article : item) : [article, ...articles];
  if (!storage.set(articlesKey, nextArticles)) return;
  articles = nextArticles;
  resetArticleForm();
  renderArticles();
  renderManagement();
  showStudioNotice(`${existingArticle ? "Article updated" : "Article saved"}. Download posts.json and commit it to publish permanently.`);
  if (location.pathname === `/article/${article.id}`) showArticle(article.id);
});

window.addEventListener("popstate", route);
$("#copyright-year").textContent = new Date().getFullYear();
initializeArticles();
