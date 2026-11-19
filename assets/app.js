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
    const ctx = canvas && canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const pointer = { x: 0, y: 0, targetX: 0, targetY: 0 };
    const colors = [[234, 242, 255], [193, 217, 244], [253, 229, 195], [186, 209, 232]];
    let width = 1, height = 1, frame = 0, lastFrame = 0, elapsed = 0;
    let active = true, seed = 214736, nextMeteor = 10;
    let layers = [], meteors = [], nebula = null;

    function random() {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      return seed / 4294967296;
    }

    function createLayer(count, minRadius, maxRadius, minOpacity, maxOpacity, depth, drift) {
      return Array.from({ length: count }, () => ({
        x: random(), y: random(),
        size: minRadius + random() * (maxRadius - minRadius),
        alpha: minOpacity + random() * (maxOpacity - minOpacity),
        phase: random() * Math.PI * 2,
        speed: .24 + random() * .55,
        vx: (random() - .5) * drift,
        vy: (random() - .5) * drift * .65,
        depth,
        glow: random() < .12,
        color: colors[Math.floor(random() * colors.length)]
      }));
    }

    function buildNebula() {
      nebula = document.createElement("canvas");
      nebula.width = 1280;
      nebula.height = 720;
      const c = nebula.getContext("2d");
      if (!c) return;
      const clouds = [
        { x: 915, y: 270, rx: 485, ry: 178, rot: -.30, color: [54, 104, 151], alpha: .25 },
        { x: 1055, y: 495, rx: 344, ry: 133, rot: -.27, color: [126, 96, 139], alpha: .18 },
        { x: 630, y: 415, rx: 505, ry: 122, rot: -.24, color: [99, 132, 157], alpha: .10 },
        { x: 1100, y: 125, rx: 235, ry: 120, rot: .30, color: [64, 114, 151], alpha: .12 }
      ];
      for (const cloud of clouds) {
        c.save();
        c.translate(cloud.x, cloud.y);
        c.rotate(cloud.rot);
        c.scale(cloud.rx / cloud.ry, 1);
        const r = cloud.ry;
        const gradient = c.createRadialGradient(0, 0, r * .07, 0, 0, r);
        gradient.addColorStop(0, "rgba(" + cloud.color.join(",") + "," + cloud.alpha + ")");
        gradient.addColorStop(.34, "rgba(" + cloud.color.join(",") + "," + cloud.alpha * .48 + ")");
        gradient.addColorStop(.72, "rgba(" + cloud.color.join(",") + "," + cloud.alpha * .11 + ")");
        gradient.addColorStop(1, "rgba(" + cloud.color.join(",") + ",0)");
        c.fillStyle = gradient;
        c.beginPath();
        c.arc(0, 0, r, 0, Math.PI * 2);
        c.fill();
        c.restore();
      }
      // A field of diffuse, irregular gas and dust rather than flat color bands.
      for (let i = 0; i < 2100; i++) {
        const along = random();
        const x = 420 + along * 920 + (random() - .5) * 180;
        const y = 525 - along * 405 + (random() - .5) * (75 + along * 140);
        const radius = .6 + random() * 2.8;
        c.fillStyle = random() > .79
          ? "rgba(229,188,146," + random() * .075 + ")"
          : "rgba(149,184,220," + random() * .07 + ")";
        c.beginPath();
        c.ellipse(x, y, radius * 2.1, radius, -.35, 0, Math.PI * 2);
        c.fill();
      }
    }

    function resize() {
      width = Math.max(1, canvas.getBoundingClientRect().width);
      height = Math.max(1, canvas.getBoundingClientRect().height);
      const ratio = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      const area = width * height;
      const factor = width < 700 ? .70 : 1;
      seed = 214736;
      layers = [
        createLayer(Math.round(Math.min(350, Math.max(130, area / 4400)) * factor), .24, .83, .15, .48, .16, .013),
        createLayer(Math.round(Math.min(215, Math.max(60, area / 8500)) * factor), .52, 1.48, .22, .72, .48, .029),
        createLayer(Math.round(Math.min(82, Math.max(22, area / 23500)) * factor), 1.0, 2.0, .30, .90, 1, .050)
      ];
      buildNebula();
      draw();
    }

    function drawStars() {
      for (const layer of layers) {
        for (const star of layer) {
          const x = ((star.x * width + elapsed * star.vx * 18 + pointer.x * star.depth * 26) % (width + 30) + width + 30) % (width + 30) - 15;
          const y = ((star.y * height + elapsed * star.vy * 14 + pointer.y * star.depth * 19) % (height + 30) + height + 30) % (height + 30) - 15;
          const twinkle = reduceMotion ? .94 : .8 + .2 * Math.sin(elapsed * star.speed + star.phase);
          const alpha = Math.max(.05, star.alpha * twinkle);
          const rgb = star.color.join(",");
          if (star.glow && star.size > 1.1) {
            const radius = star.size * 5.6;
            const halo = ctx.createRadialGradient(x, y, 0, x, y, radius);
            halo.addColorStop(0, "rgba(" + rgb + "," + alpha * .26 + ")");
            halo.addColorStop(1, "rgba(" + rgb + ",0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            ctx.fill();
          }
          ctx.fillStyle = "rgba(" + rgb + "," + alpha + ")";
          ctx.beginPath();
          ctx.arc(x, y, star.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }

    function createMeteor() {
      if (meteors.length) return;
      meteors.push({
        x: width * (.56 + random() * .32),
        y: height * (.12 + random() * .43),
        vx: -5.8 - random() * 2,
        vy: 2.2 + random() * 1.3,
        age: 0, duration: 1.1 + random() * .5, length: 80 + random() * 50
      });
    }

    function drawMeteors(dt) {
      for (let i = meteors.length - 1; i >= 0; i--) {
        const m = meteors[i];
        m.age += dt;
        if (m.age >= m.duration) { meteors.splice(i, 1); continue; }
        const x = m.x + m.vx * m.age * 29;
        const y = m.y + m.vy * m.age * 29;
        const fade = Math.max(0, Math.min(1, m.age * 5, (m.duration - m.age) * 3));
        const norm = Math.hypot(m.vx, m.vy);
        const tailX = x - m.vx / norm * m.length;
        const tailY = y - m.vy / norm * m.length;
        const gradient = ctx.createLinearGradient(tailX, tailY, x, y);
        gradient.addColorStop(0, "rgba(203,226,255,0)");
        gradient.addColorStop(.67, "rgba(193,222,247," + .21 * fade + ")");
        gradient.addColorStop(1, "rgba(253,239,214," + .65 * fade + ")");
        ctx.strokeStyle = gradient;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(tailX, tailY);
        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.fillStyle = "rgba(252,240,221," + .72 * fade + ")";
        ctx.beginPath();
        ctx.arc(x, y, 1.6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    function draw(dt = 0) {
      ctx.clearRect(0, 0, width, height);
      const ease = Math.min(1, dt * 2.8);
      pointer.x += (pointer.targetX - pointer.x) * ease;
      pointer.y += (pointer.targetY - pointer.y) * ease;
      if (nebula) {
        ctx.save();
        ctx.globalAlpha = .92;
        ctx.drawImage(nebula, -55 + pointer.x * 22, -45 + pointer.y * 16, width + 110, height + 90);
        ctx.restore();
      }
      drawStars();
      if (!reduceMotion) drawMeteors(dt);
    }

    function tick(timestamp) {
      if (!active || document.hidden) { frame = 0; return; }
      if (!lastFrame) lastFrame = timestamp;
      const delta = (timestamp - lastFrame) / 1000;
      if (delta >= 1 / 36) {
        const dt = Math.min(delta, .08);
        lastFrame = timestamp;
        elapsed += dt;
        nextMeteor -= dt;
        if (nextMeteor <= 0) {
          createMeteor();
          nextMeteor = 14 + random() * 16;
        }
        draw(dt);
      }
      frame = window.requestAnimationFrame(tick);
    }

    function visibilityChanged() {
      if (document.hidden) {
        window.cancelAnimationFrame(frame);
        frame = 0;
        lastFrame = 0;
      } else if (active && !reduceMotion && !frame) {
        frame = window.requestAnimationFrame(tick);
      }
    }

    window.addEventListener("resize", resize, { passive: true });
    window.addEventListener("pointermove", event => {
      pointer.targetX = event.clientX / Math.max(width, 1) * 2 - 1;
      pointer.targetY = event.clientY / Math.max(height, 1) * 2 - 1;
    }, { passive: true });
    document.addEventListener("visibilitychange", visibilityChanged);
    window.addEventListener("pagehide", () => {
      active = false;
      window.cancelAnimationFrame(frame);
      frame = 0;
    }, { once: true });

    resize();
    if (!reduceMotion) frame = window.requestAnimationFrame(tick);
  }

  initStarfield();
  loadCatalog();
})();
