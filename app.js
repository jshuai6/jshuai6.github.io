const seedArticles = [
  {
    id: "attention-is-a-practice",
    title: "Attention is a practice",
    tags: ["Notes", "Creative Life"],
    summary: "On noticing what we usually pass by, and why the quality of our attention quietly shapes the quality of our work.",
    body: "The world does not suffer from a shortage of interesting things. It suffers from our habit of moving past them too quickly. Attention is less like a spotlight and more like a muscle: neglected, it weakens; used deliberately, it becomes generous.\n\nI started writing one small note each morning—not for an audience, and rarely about anything traditionally important. A decision I kept postponing. A sentence from a book. The geometry of a problem I was trying to solve. The ritual changed almost nothing about my schedule, but it changed the texture of my days.\n\nCreative work begins here, before the making. It begins in the decision to stay with something a few seconds longer than comfort requires. To look again. To let the ordinary become specific.\n\nThe best ideas I know did not arrive dramatically. They emerged from patient looking: a small contradiction, an overlooked need, the peculiar way a stranger folded a newspaper. Attention is how the world tells us what to make next.",
    date: "June 14, 2026",
    readTime: "4 min read"
  },
  {
    id: "the-useful-mess",
    title: "In praise of the useful mess",
    tags: ["Process", "Design"],
    summary: "A tidy desk is lovely. A living process is usually not. Some thoughts on drafts, friction, and keeping the evidence of thinking visible.",
    body: "My favorite stage of any project is the one nobody wants to present. The table is covered in crooked printouts. Half the sentences contradict the other half. There are arrows going nowhere. The work looks uncertain because it is alive.\n\nWe often confuse clarity of presentation with clarity of thought. But thought needs somewhere to be clumsy. It needs permission to make a bad version, then a stranger version, before discovering the true one hiding underneath.\n\nThe useful mess is not chaos for its own sake. It is an external memory. Every scrap records a decision we might otherwise repeat, and every failed arrangement narrows the field. Clean it up too soon and the work can become polished but thin.\n\nI still reset the room when a project ends. But while it is becoming, I leave the evidence out. The mess reminds me that uncertainty is not a failure of the process. It is the process doing its work.",
    date: "May 27, 2026",
    readTime: "5 min read"
  },
  {
    id: "walking-without-arriving",
    title: "Walking without arriving",
    tags: ["Places", "Reflection"],
    summary: "Field notes from an afternoon with no destination, no agenda, and more time than plans.",
    body: "I left the house with no destination, which is a small rebellion in a city that constantly asks where you are going. The fog had thinned but not lifted. Everything at a distance looked politely erased.\n\nWithout a route, the neighborhood rearranged itself. A street I knew became a sequence of colors: oxidized green, construction orange, the improbable blue of a laundromat chair. I followed curiosity instead of signs.\n\nA walk can become too efficient if I let it. Choose the route, reach the place, move on. That afternoon I tried a different rule: pause whenever something asked for a second look. Sometimes the better thought arrived next; often nothing did. Both felt useful.\n\nI returned three hours later with no obvious result. More importantly, I returned with the pleasant sense that the familiar world had been quietly replaced while I wasn’t looking.",
    date: "April 09, 2026",
    readTime: "3 min read"
  }
];

const storage = {
  get(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) || fallback; } catch { return fallback; } },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      showToast("Storage is full—use fewer or smaller images");
      return false;
    }
  }
};

let articles = storage.get("field-notes-articles", seedArticles);
let activeTag = "All";
let searchTerm = "";
let inlineImagesDraft = {};

const $ = (selector, scope = document) => scope.querySelector(selector);
const $$ = (selector, scope = document) => [...scope.querySelectorAll(selector)];
const escapeHTML = (value = "") => String(value).replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const compressedImage = file => new Promise((resolve, reject) => {
  const image = new Image();
  const url = URL.createObjectURL(file);
  image.onload = () => {
    const maxWidth = 1200;
    const scale = Math.min(1, maxWidth / image.width);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    const output = canvas.toDataURL("image/jpeg", 0.82);
    resolve(output.length > 1200000 ? canvas.toDataURL("image/jpeg", 0.68) : output);
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
  if (file.size > 5000000) return reject(new Error("Please choose an image under 5 MB"));
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

function resetArticleForm() {
  const form = $("#article-form");
  form.reset();
  inlineImagesDraft = {};
  delete form.dataset.editingId;
  $("#article-submit").textContent = "Publish article ↗";
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
  $("#article-submit").textContent = "Save article ↗";
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
  if (!article) { location.hash = "#blog"; return; }
  $("#article-reading").innerHTML = `
    <a class="back-link" href="#blog">← Back to journal</a>
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

function route() {
  const hash = location.hash.replace("#", "") || "blog";
  if (hash.startsWith("article/")) return showArticle(hash.split("/")[1]);
  const view = ["blog", "about"].includes(hash) ? hash : "blog";
  showView(view);
  document.title = view === "blog" ? "Personal Journal" : view[0].toUpperCase() + view.slice(1);
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

document.addEventListener("click", event => {
  const tag = event.target.closest("[data-tag]");
  if (tag) { activeTag = tag.dataset.tag; renderArticles(); }
  const card = event.target.closest("[data-article-id]");
  if (card) location.hash = `#article/${card.dataset.articleId}`;
  if (event.target.closest('[data-action="open-studio"]')) { renderManagement(); $("#studio-dialog").showModal(); }
  if (event.target.closest('[data-action="close-studio"]')) $("#studio-dialog").close();
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
    if (!storage.set("field-notes-articles", nextArticles)) return;
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
    showToast("No image selected");
    return;
  }
  try {
    const image = await readImage(file);
    insertInlineImage(image, file?.name?.replace(/\.[^.]+$/, "") || "Article image");
    showToast("Image inserted");
  } catch (error) {
    showToast(error.message);
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
    const image = file ? await readImage(file) : pastedImage;
    insertInlineImage(image);
    showToast("Pasted image inserted");
  } catch (error) {
    showToast(error.message);
  }
});

$("#article-body").addEventListener("input", updateInlineImageStatus);

$("#cancel-edit").addEventListener("click", resetArticleForm);

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
  if (!storage.set("field-notes-articles", nextArticles)) return;
  articles = nextArticles;
  resetArticleForm();
  renderArticles();
  renderManagement();
  showToast(existingArticle ? "Article updated" : "Article published");
  if (location.hash === `#article/${article.id}`) showArticle(article.id);
});

window.addEventListener("hashchange", route);
renderArticles(); renderManagement(); route();
