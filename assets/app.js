(() => {
  "use strict";

  const CATALOG_URL = "https://yixuanqi.github.io/PhotoGallery/projects.json";
  const elements = {
    grid: document.getElementById("project-grid"),
    filters: document.getElementById("category-filters"),
    search: document.getElementById("project-search"),
    results: document.getElementById("results-label"),
    visible: document.getElementById("visible-count"),
    total: document.getElementById("total-count"),
    web: document.getElementById("web-count"),
    categories: document.getElementById("category-count"),
    error: document.getElementById("catalog-error")
  };

  const CATEGORY_LABELS = {
    navigation: "导航体验",
    "creative-3d": "3D 创作",
    desktop: "桌面应用",
    audio: "音频工具",
    research: "研究实验",
    android: "Android",
    game: "互动游戏",
    simulation: "仿真模拟",
    science: "科学探索"
  };

  const KIND_LABELS = {
    "portal-experience": "沉浸式入口",
    "interactive-web": "互动网页",
    "desktop-app": "桌面应用",
    "research-project": "研究项目",
    "android-app": "Android 应用"
  };

  const STATUS_LABELS = {
    idea: "构思中",
    development: "开发中",
    testing: "测试中",
    published: "已发布",
    archived: "已归档"
  };

  let projects = [];
  let activeCategory = "all";
  let searchTerm = "";

  function makeElement(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function safeHttpsUrl(value) {
    try {
      const url = new URL(value);
      return url.protocol === "https:" ? url.href : null;
    } catch {
      return null;
    }
  }

  function categoryName(category) {
    return CATEGORY_LABELS[category] || category.replace(/-/g, " ");
  }

  function createExternalLink(url, className, label, suffix) {
    const href = safeHttpsUrl(url);
    if (!href) return makeElement("span", className, label);
    const link = makeElement("a", className);
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.append(document.createTextNode(label));
    if (suffix) link.append(makeElement("span", "", suffix));
    return link;
  }

  function renderFilters() {
    const categories = [...new Set(projects.map(project => project.category).filter(Boolean))];
    elements.filters.replaceChildren();

    const allButton = makeElement("button", "filter-chip", "全部");
    allButton.type = "button";
    allButton.dataset.category = "all";
    allButton.setAttribute("aria-pressed", String(activeCategory === "all"));
    allButton.append(makeElement("small", "", String(projects.length)));
    elements.filters.append(allButton);

    categories.forEach(category => {
      const count = projects.filter(project => project.category === category).length;
      const button = makeElement("button", "filter-chip", categoryName(category));
      button.type = "button";
      button.dataset.category = category;
      button.setAttribute("aria-pressed", String(activeCategory === category));
      button.append(makeElement("small", "", String(count)));
      elements.filters.append(button);
    });
  }

  function createProjectCard(project, index) {
    const card = makeElement("article", "project-card");
    card.dataset.category = project.category || "";

    const art = makeElement("div", "project-art");
    art.dataset.category = project.category || "";
    art.append(
      makeElement("span", "art-index", "NO. " + String(index + 1).padStart(2, "0")),
      makeElement("span", "art-code", (project.kind || "PROJECT").replace(/-/g, " ").toUpperCase()),
      makeElement("span", "art-orbit"),
      makeElement("span", "art-core"),
      makeElement("span", "art-satellite")
    );

    const body = makeElement("div", "project-card-body");
    const meta = makeElement("div", "project-meta");
    meta.append(makeElement("span", "project-category", categoryName(project.category || "project")));
    const status = makeElement("span", "project-status", STATUS_LABELS[project.status] || project.status || "项目");
    status.dataset.status = project.status || "";
    meta.append(status);

    const title = makeElement("h3", "", project.name || "未命名项目");
    const englishName = makeElement("p", "project-name-en", project.nameEn || KIND_LABELS[project.kind] || "");
    const summary = makeElement("p", "project-summary", project.summary || "暂无项目介绍。");

    const tags = makeElement("div", "project-tags");
    (Array.isArray(project.tags) ? project.tags : []).slice(0, 3).forEach(tag => {
      tags.append(makeElement("span", "project-tag", tag));
    });

    const footer = makeElement("div", "project-card-footer");
    const primary = createExternalLink(project.primaryUrl, "project-primary", project.primaryAction || "查看项目", "↗");
    const repository = createExternalLink(project.repositoryUrl, "project-repo", "源码仓库 ↗");
    footer.append(primary, repository);

    body.append(meta, title);
    if (englishName.textContent) body.append(englishName);
    body.append(summary, tags, footer);
    card.append(art, body);
    return card;
  }

  function updateStats() {
    const total = projects.length;
    const web = projects.filter(project => Boolean(project.sourcePath)).length;
    const categoryCount = new Set(projects.map(project => project.category).filter(Boolean)).size;
    elements.total.textContent = String(total).padStart(2, "0");
    elements.web.textContent = String(web).padStart(2, "0");
    elements.categories.textContent = String(categoryCount).padStart(2, "0");
  }

  function renderProjects() {
    const normalizedQuery = searchTerm.trim().toLocaleLowerCase();
    const visibleProjects = projects.filter(project => {
      const categoryMatches = activeCategory === "all" || project.category === activeCategory;
      if (!categoryMatches) return false;
      if (!normalizedQuery) return true;
      const searchable = [
        project.name,
        project.nameEn,
        project.summary,
        project.category,
        project.kind,
        ...(project.tags || []),
        ...(project.techStack || [])
      ].filter(Boolean).join(" ").toLocaleLowerCase();
      return searchable.includes(normalizedQuery);
    });

    elements.grid.replaceChildren();
    elements.visible.textContent = String(visibleProjects.length).padStart(2, "0");
    elements.results.textContent = "显示 " + visibleProjects.length + " / " + projects.length + " 个项目";

    if (visibleProjects.length === 0) {
      const empty = makeElement("div", "empty-state");
      empty.append(
        makeElement("strong", "", "没有找到匹配的作品"),
        makeElement("span", "", "试试其他关键词，或切换项目分类。")
      );
      elements.grid.append(empty);
      return;
    }

    visibleProjects.forEach((project, index) => {
      elements.grid.append(createProjectCard(project, index));
    });
  }

  async function loadCatalog() {
    try {
      const response = await fetch(CATALOG_URL + "?v=" + Date.now(), { cache: "no-store" });
      if (!response.ok) throw new Error("Project catalog returned " + response.status);
      const catalog = await response.json();
      if (!catalog || !Array.isArray(catalog.projects)) {
        throw new Error("Project catalog has an invalid structure");
      }
      projects = catalog.projects
        .filter(project => project && project.status !== "archived")
        .slice()
        .sort((a, b) => (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER));

      updateStats();
      renderFilters();
      renderProjects();
      elements.error.hidden = true;
      elements.grid.setAttribute("aria-busy", "false");
    } catch (error) {
      console.error("[Creative Universe] Failed to load project catalog:", error);
      elements.grid.replaceChildren();
      elements.grid.setAttribute("aria-busy", "false");
      elements.filters.replaceChildren(makeElement("span", "filter-loading", "项目分类暂不可用"));
      elements.results.textContent = "项目目录连接失败";
      elements.error.hidden = false;
    }
  }

  elements.filters.addEventListener("click", event => {
    const button = event.target.closest("button[data-category]");
    if (!button) return;
    activeCategory = button.dataset.category;
    renderFilters();
    renderProjects();
  });

  elements.search.addEventListener("input", event => {
    searchTerm = event.target.value;
    renderProjects();
  });

  document.addEventListener("keydown", event => {
    if (event.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
      event.preventDefault();
      elements.search.focus();
    }
    if (event.key === "Escape" && document.activeElement === elements.search) {
      elements.search.value = "";
      searchTerm = "";
      renderProjects();
      elements.search.blur();
    }
  });

  function initStarfield() {
    const canvas = document.getElementById("starfield");
    const context = canvas && canvas.getContext("2d");
    if (!context) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    let width = 0;
    let height = 0;
    let stars = [];
    let frame = 0;

    function resize() {
      const ratio = Math.min(window.devicePixelRatio || 1, 1.6);
      width = window.innerWidth;
      height = window.innerHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(190, Math.max(75, Math.round(width * height / 8500)));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        radius: Math.random() * 1.15 + .2,
        alpha: Math.random() * .52 + .16,
        phase: Math.random() * Math.PI * 2,
        drift: Math.random() * .09 + .015
      }));
      if (reduceMotion) draw(0);
    }

    function draw(time) {
      context.clearRect(0, 0, width, height);
      pointer.x += (pointer.tx - pointer.x) * .025;
      pointer.y += (pointer.ty - pointer.y) * .025;
      for (const star of stars) {
        const twinkle = reduceMotion ? 1 : .68 + Math.sin(time * .00045 + star.phase) * .24;
        const x = star.x + pointer.x * star.drift * 13;
        const y = star.y + pointer.y * star.drift * 13;
        context.beginPath();
        context.arc(x, y, star.radius, 0, Math.PI * 2);
        context.fillStyle = "rgba(225, 224, 210," + Math.max(.08, star.alpha * twinkle) + ")";
        context.fill();
      }
    }

    function animate(time) {
      draw(time);
      frame = window.requestAnimationFrame(animate);
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", event => {
      pointer.tx = (event.clientX / Math.max(width, 1) - .5) * 2;
      pointer.ty = (event.clientY / Math.max(height, 1) - .5) * 2;
    }, { passive: true });
    resize();
    if (!reduceMotion) frame = window.requestAnimationFrame(animate);
    window.addEventListener("pagehide", () => window.cancelAnimationFrame(frame), { once: true });
  }

  initStarfield();
  loadCatalog();
})();
