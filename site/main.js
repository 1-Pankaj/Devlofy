/**
 * Devlofy · landing page behaviour.
 *
 * Every piece here is an enhancement. The page reads without JavaScript, and
 * every control is a real button, link, input or detail/summary. The one piece
 * of logic that must never drift is the quick-add demo: it is a port of
 * `src/lib/parse-task.ts`, so the page cannot promise grammar the app does not
 * ship.
 */

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const hoverFine = window.matchMedia('(hover: hover) and (pointer: fine)');
  const desktop = window.matchMedia('(min-width: 901px)');
  const root = document.documentElement;

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

  /* ---------- quick-add grammar (port of src/lib/parse-task.ts) ---------- */

  const DEFAULT_PRIORITY = 1;
  const PRIORITY_LABEL = { 2: 'high', 1: 'normal', 0: 'someday' };
  const PRIORITY_FROM_TYPED = { 1: 0, 2: 1, 3: 2 };
  const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  const PROJECTS = [
    { id: 'northwind-portal', name: 'Northwind Portal' },
    { id: 'devlofy', name: 'Devlofy' },
    { id: 'starlight-dash', name: 'Starlight Dash' },
    { id: 'portfolio-2', name: 'Portfolio 2.0' },
  ];

  function parseEstimate(raw) {
    const hours = /^(\d+(?:\.\d+)?)h$/i.exec(raw);
    if (hours) return Math.max(5, Math.round(Number(hours[1]) * 60));
    const minutes = /^(\d+)m$/i.exec(raw);
    if (minutes) return Math.max(5, Number(minutes[1]));
    return null;
  }

  /** 09:00 local on the given calendar day: tasks are day-scoped, not timed. */
  function dueOn(now, addDays) {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate() + addDays, 9, 0, 0, 0);
  }

  function relativeLabel(days) {
    return days <= 0 ? 'today' : days === 1 ? 'tomorrow' : `in ${days}d`;
  }

  function parseDue(raw, now) {
    const lower = raw.toLowerCase();
    if (lower === 'today' || lower === 'tod') return { date: dueOn(now, 0), label: 'today' };
    if (lower === 'tomorrow' || lower === 'tmr') return { date: dueOn(now, 1), label: 'tomorrow' };

    const relative = /^\+(\d{1,2})d?$/.exec(lower);
    if (relative) {
      const days = Number(relative[1]);
      return { date: dueOn(now, days), label: relativeLabel(days) };
    }

    if (lower.length >= 3) {
      const index = WEEKDAYS.findIndex((day) => day.toLowerCase() === lower.slice(0, 3));
      if (index !== -1) {
        const days = (index - now.getDay() + 7) % 7;
        return { date: dueOn(now, days), label: WEEKDAYS[index] };
      }
    }
    return null;
  }

  function parseTaskInput(input, projects, now = new Date()) {
    let priority = DEFAULT_PRIORITY;
    let estMinutes = null;
    let projectId = null;
    let dueAt = null;
    let unknownProject = null;
    const tokens = [];
    const kept = [];

    for (const word of input.split(/\s+/)) {
      if (!word) continue;
      const lower = word.toLowerCase();

      if (/^!\d?$/.test(word)) {
        const typed = word.length === 1 ? 3 : Number(word.slice(1));
        priority = PRIORITY_FROM_TYPED[Math.min(3, Math.max(1, typed))];
        tokens.push({ kind: 'priority', label: PRIORITY_LABEL[priority], tone: 'ember' });
        continue;
      }

      if (lower.startsWith('#') && word.length > 1) {
        const needle = lower.slice(1);
        const match =
          projects.find((p) => p.name.toLowerCase() === needle) ??
          projects.find((p) => p.name.toLowerCase().startsWith(needle)) ??
          projects.find((p) => p.name.toLowerCase().includes(needle));
        if (match) {
          projectId = match.id;
          tokens.push({ kind: 'project', label: match.name, tone: 'accent' });
        } else {
          // No match: keep the word so nothing typed is silently lost.
          unknownProject = word.slice(1);
          kept.push(word);
        }
        continue;
      }

      const due = parseDue(word, now);
      if (due) {
        dueAt = due.date.toISOString();
        tokens.push({ kind: 'due', label: due.label, tone: 'neutral' });
        continue;
      }

      const estimate = parseEstimate(word);
      if (estimate !== null) {
        estMinutes = estimate;
        tokens.push({
          kind: 'estimate',
          label: estimate >= 60 ? `${Math.round((estimate / 60) * 10) / 10}h` : `${estimate}m`,
          tone: 'neutral',
        });
        continue;
      }

      kept.push(word);
    }

    return {
      title: kept.join(' ').trim(),
      priority,
      estMinutes,
      projectId,
      dueAt,
      tokens,
      unknownProject,
    };
  }

  /* ---------- quick-add demo --------------------------------------------- */

  function formatDue(iso) {
    const date = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${WEEKDAYS[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}, ${pad(
      date.getHours(),
    )}:${pad(date.getMinutes())}`;
  }

  function wireDemo() {
    const demo = $('[data-demo]');
    if (!demo) return;

    const input = $('#quick-add', demo);
    if (!input) return;

    const chipHost = $('#demo-chips', demo);
    const note = $('#demo-note', demo);
    const titleEl = $('#demo-title', demo);
    const fieldsEl = $('#demo-fields', demo);

    const render = () => {
      const parsed = parseTaskInput(input.value, PROJECTS);
      const project = PROJECTS.find((p) => p.id === parsed.projectId);

      chipHost.replaceChildren();
      if (parsed.tokens.length === 0 && !parsed.unknownProject) {
        const none = document.createElement('span');
        none.className = 'none';
        none.textContent = 'No shorthand yet. The whole line becomes the title.';
        chipHost.append(none);
      } else {
        for (const token of parsed.tokens) {
          const chip = document.createElement('span');
          chip.className = `chip${token.tone === 'neutral' ? '' : ` chip--${token.tone}`}`;
          chip.textContent = token.label;
          chipHost.append(chip);
        }
      }

      const isEmpty = parsed.title === '';
      titleEl.textContent = isEmpty ? 'Nothing yet' : parsed.title;
      titleEl.classList.toggle('is-empty', isEmpty);

      const fields = [
        ['priority', PRIORITY_LABEL[parsed.priority]],
        ['estimate', parsed.estMinutes === null ? null : `${parsed.estMinutes} min`],
        ['due', parsed.dueAt === null ? null : formatDue(parsed.dueAt)],
        ['project', project ? project.name : null],
      ];

      const cells = fields.map(([label, value]) => {
        const cell = document.createElement('div');
        const term = document.createElement('dt');
        const detail = document.createElement('dd');

        term.textContent = label;
        detail.textContent = value ?? 'none';
        detail.classList.toggle('is-none', value === null);
        cell.append(term, detail);
        return cell;
      });

      fieldsEl.replaceChildren(...cells);

      if (parsed.unknownProject) {
        note.hidden = false;
        note.textContent = `#${parsed.unknownProject} matched no project, so it stays in the title. Nothing you typed disappears.`;
      } else {
        note.hidden = true;
        note.textContent = '';
      }
    };

    input.addEventListener('input', render);

    for (const button of $$('[data-example]', demo)) {
      button.addEventListener('click', () => {
        input.value = button.dataset.example;
        input.focus({ preventScroll: true });
        render();
      });
    }

    render();
  }

  /* ---------- header, scrollspy ------------------------------------------- */

  function wireHeader() {
    const header = $('[data-header]');
    if (!header) return;

    const links = $$('[data-nav]');
    const targets = links
      .map((link) => {
        const id = link.getAttribute('href').slice(1);
        const section = document.getElementById(id);
        return section ? { link, section } : null;
      })
      .filter(Boolean);

    let queued = false;

    const sync = () => {
      queued = false;
      header.classList.toggle('is-scrolled', window.scrollY > 8);

      if (targets.length === 0) return;
      const probe = window.scrollY + window.innerHeight * 0.34;
      let current = null;
      for (const target of targets) {
        if (target.section.offsetTop <= probe) current = target.link;
      }
      for (const target of targets) {
        if (target.link === current) target.link.setAttribute('aria-current', 'true');
        else target.link.removeAttribute('aria-current');
      }
    };

    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    sync();
  }

  /* ---------- mobile menu -------------------------------------------------- */

  function wireMenu() {
    const menu = $('[data-menu]');
    const open = $('[data-menu-open]');
    if (!menu || !open) return;

    let previousOverflow = '';

    const show = () => {
      previousOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      open.setAttribute('aria-expanded', 'true');
      if (typeof menu.showModal === 'function') menu.showModal();
      else menu.setAttribute('open', '');
    };

    const hide = () => {
      if (typeof menu.close === 'function' && menu.open) menu.close();
      else menu.removeAttribute('open');
      document.body.style.overflow = previousOverflow;
      open.setAttribute('aria-expanded', 'false');
      open.focus({ preventScroll: true });
    };

    open.addEventListener('click', show);

    for (const closer of $$('[data-menu-close]', menu)) {
      closer.addEventListener('click', hide);
    }

    menu.addEventListener('click', (event) => {
      if (event.target === menu) hide();
    });

    menu.addEventListener('cancel', () => {
      document.body.style.overflow = previousOverflow;
      open.setAttribute('aria-expanded', 'false');
    });

    menu.addEventListener('close', () => {
      document.body.style.overflow = previousOverflow;
      open.setAttribute('aria-expanded', 'false');
    });
  }

  /* ---------- reveals ------------------------------------------------------ */

  function wireReveals() {
    const items = $$('[data-reveal]');
    if (items.length === 0) return;

    if (reducedMotion.matches || !('IntersectionObserver' in window)) return;

    // Only hide content once the observer that reveals it is ready.
    root.classList.add('reveal');

    const revealAll = () => {
      for (const item of items) item.classList.add('is-in');
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add('is-in');
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    );

    items.forEach((item) => observer.observe(item));

    // If anything goes wrong, never leave the page blank.
    window.setTimeout(revealAll, 3000);
  }

  /* ---------- stacking cards ---------------------------------------------- */

  function wireStack() {
    const stack = $('[data-stack]');
    if (!stack) return;

    const items = $$('.stack__item', stack);
    if (items.length < 2) return;

    let queued = false;

    const sync = () => {
      queued = false;
      const active = desktop.matches && !reducedMotion.matches;

      if (!active) {
        for (const item of items) item.style.removeProperty('--cover');
        return;
      }

      for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const next = items[index + 1];
        if (!next) {
          item.style.setProperty('--cover', '0');
          continue;
        }
        const top = parseFloat(window.getComputedStyle(item).top) || 84;
        const height = item.getBoundingClientRect().height || 1;
        const nextTop = next.getBoundingClientRect().top;
        const cover = clamp(1 - (nextTop - top) / (height * 0.92), 0, 1);
        item.style.setProperty('--cover', cover.toFixed(3));
      }
    };

    const request = () => {
      if (queued) return;
      queued = true;
      requestAnimationFrame(sync);
    };

    window.addEventListener('scroll', request, { passive: true });
    window.addEventListener('resize', request, { passive: true });
    if (desktop.addEventListener) desktop.addEventListener('change', request);
    sync();
  }

  /* ---------- hero parallax ------------------------------------------------ */

  function wireParallax() {
    const stage = $('[data-parallax]');
    if (!stage) return;
    if (!hoverFine.matches || reducedMotion.matches) return;

    let frame = 0;
    let px = 0;
    let py = 0;

    const apply = () => {
      frame = 0;
      stage.style.setProperty('--px', px.toFixed(3));
      stage.style.setProperty('--py', py.toFixed(3));
    };

    const schedule = () => {
      if (frame) return;
      frame = requestAnimationFrame(apply);
    };

    stage.addEventListener('pointermove', (event) => {
      const rect = stage.getBoundingClientRect();
      px = clamp(((event.clientX - rect.left) / rect.width - 0.5) * 2, -1, 1);
      py = clamp(((event.clientY - rect.top) / rect.height - 0.5) * 2, -1, 1);
      schedule();
    });

    stage.addEventListener('pointerleave', () => {
      px = 0;
      py = 0;
      schedule();
    });
  }

  /* ---------- spotlight cards ---------------------------------------------- */

  function wireSpotlight() {
    if (!hoverFine.matches) return;

    for (const card of $$('[data-spotlight]')) {
      let frame = 0;
      let x = 0;
      let y = 0;

      const apply = () => {
        frame = 0;
        card.style.setProperty('--mx', `${x}px`);
        card.style.setProperty('--my', `${y}px`);
      };

      card.addEventListener('pointermove', (event) => {
        const rect = card.getBoundingClientRect();
        x = event.clientX - rect.left;
        y = event.clientY - rect.top;
        if (frame) return;
        frame = requestAnimationFrame(apply);
      });

      card.addEventListener('pointerleave', () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        card.style.removeProperty('--mx');
        card.style.removeProperty('--my');
      });
    }
  }

  /* ---------- ticker ------------------------------------------------------- */

  function wireTicker() {
    const ticker = $('.ticker');
    const track = $('[data-ticker]');
    if (!ticker || !track || reducedMotion.matches) return;

    for (const child of Array.from(track.children)) {
      track.append(child.cloneNode(true));
    }
    ticker.classList.add('is-live');
  }

  /* ---------- copy --------------------------------------------------------- */

  function wireCopy() {
    for (const button of $$('[data-copy-target]')) {
      const target = $(button.dataset.copyTarget);
      const label = $('span', button);
      if (!target || !label) continue;

      const original = label.textContent;

      button.addEventListener('click', async () => {
        const text = target.textContent.replace(/\n+$/, '');
        let copied = false;

        try {
          await navigator.clipboard.writeText(text);
          copied = true;
        } catch {
          // The Clipboard API needs a secure context; local previews may not have one.
          const area = document.createElement('textarea');
          area.value = text;
          area.setAttribute('readonly', '');
          area.style.position = 'fixed';
          area.style.opacity = '0';
          document.body.append(area);
          area.select();
          try {
            copied = document.execCommand('copy');
          } finally {
            area.remove();
          }
        }

        button.dataset.copied = copied ? 'true' : 'false';
        label.textContent = copied ? 'Copied' : 'Select it';

        window.setTimeout(() => {
          delete button.dataset.copied;
          label.textContent = original;
        }, 2000);
      });
    }
  }

  /* ---------- FAQ: one answer at a time ------------------------------------ */

  function wireFaq() {
    const items = $$('.faq__item');
    if (items.length < 2) return;

    for (const item of items) {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        for (const other of items) {
          if (other !== item && other.open) other.open = false;
        }
      });
    }
  }

  /* ---------- garden: fireflies -------------------------------------------- */

  function seedRandom(seed) {
    let state = seed >>> 0;
    return () => {
      state = (state + 0x6d2b79f5) >>> 0;
      let t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function wireGarden() {
    const section = $('.garden');
    const canvas = $('[data-fireflies]');
    if (!section || !canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rand = seedRandom(20261026);
    const stars = Array.from({ length: 64 }, () => ({
      x: rand(),
      y: rand(),
      r: 0.35 + rand() * 0.8,
      a: 0.12 + rand() * 0.42,
      warm: rand() > 0.42,
    }));

    const flies = Array.from({ length: 26 }, () => ({
      x: 0.08 + rand() * 0.84,
      y: 0.16 + rand() * 0.68,
      r: 0.7 + rand() * 1.1,
      ax: 0.008 + rand() * 0.028,
      ay: 0.006 + rand() * 0.022,
      speed: 0.12 + rand() * 0.32,
      phase: rand() * Math.PI * 2,
      flicker: 0.5 + rand() * 1.3,
      warm: rand() > 0.28,
    }));

    let width = 0;
    let height = 0;
    let dpr = 1;
    let frame = 0;
    let running = false;
    let started = 0;

    const resize = () => {
      const rect = section.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      width = Math.max(1, Math.round(rect.width));
      height = Math.max(1, Math.round(rect.height));
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const dot = (x, y, radius, alpha, warm) => {
      ctx.beginPath();
      ctx.fillStyle = warm
        ? `rgba(255, 231, 176, ${alpha})`
        : `rgba(201, 184, 255, ${alpha})`;
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fill();
    };

    const draw = (time) => {
      ctx.clearRect(0, 0, width, height);

      for (const star of stars) {
        dot(star.x * width, star.y * height, star.r, star.a * 0.5, star.warm);
      }

      for (const fly of flies) {
        const t = time * fly.speed + fly.phase;
        const x = (fly.x + Math.sin(t) * fly.ax) * width;
        const y = (fly.y + Math.cos(t * 0.82) * fly.ay) * height;
        const flicker = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * fly.flicker + fly.phase * 2));
        dot(x, y, fly.r * 4, 0.09 * flicker, fly.warm);
        dot(x, y, fly.r * 1.6, 0.3 * flicker, fly.warm);
        dot(x, y, fly.r * 0.65, 0.8 * flicker, fly.warm);
      }
    };

    const tick = (now) => {
      if (!running) return;
      if (!started) started = now;
      draw((now - started) / 1000);
      frame = requestAnimationFrame(tick);
    };

    const start = () => {
      if (reducedMotion.matches) {
        draw(0);
        return;
      }
      if (running) return;
      running = true;
      frame = requestAnimationFrame(tick);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(frame);
    };

    resize();

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) start();
            else stop();
          }
        },
        { threshold: 0 },
      );
      observer.observe(section);
    } else {
      start();
    }

    if ('ResizeObserver' in window) {
      const observer = new ResizeObserver(() => {
        resize();
        if (!running) draw(0);
      });
      observer.observe(section);
    } else {
      window.addEventListener(
        'resize',
        () => {
          resize();
          if (!running) draw(0);
        },
        { passive: true },
      );
    }
  }

  /* ---------- checks matrix ------------------------------------------------ */

  function wireChecks() {
    const host = $('[data-checks-grid]');
    if (!host) return;

    const groups = [
      { count: 80, className: '' },
      { count: 122, className: 'dot--engine' },
      { count: 190, className: 'dot--notes' },
      { count: 90, className: 'dot--sentinel' },
    ];

    const fragment = document.createDocumentFragment();
    for (const group of groups) {
      for (let index = 0; index < group.count; index += 1) {
        const dot = document.createElement('i');
        if (group.className) dot.className = group.className;
        fragment.append(dot);
      }
    }
    host.append(fragment);
  }

  /* ---------- growth bars -------------------------------------------------- */

  function wireGrowth() {
    const growth = $('[data-growth]');
    if (!growth) return;

    if (reducedMotion.matches || !('IntersectionObserver' in window)) {
      growth.classList.add('is-in');
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          growth.classList.add('is-in');
          observer.disconnect();
        }
      },
      { threshold: 0.35 },
    );

    observer.observe(growth);
  }

  /* ---------- boot --------------------------------------------------------- */

  function init() {
    wireDemo();
    wireHeader();
    wireMenu();
    wireReveals();
    wireStack();
    wireParallax();
    wireSpotlight();
    wireTicker();
    wireCopy();
    wireFaq();
    wireGarden();
    wireChecks();
    wireGrowth();
  }

  try {
    init();
  } catch (error) {
    // An enhancement must never take the page down with it.
    root.classList.remove('reveal');
    console.error(error);
  }
})();
