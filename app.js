/* World Cup schedule viewer — vanilla JS, no build step.
 * Reads window.TOURNAMENT_DATA (set by data/<slug>.js). */
(function () {
  'use strict';

  var data = window.TOURNAMENT_DATA;

  var STORAGE_KEY = 'wc-schedule-settings';
  var WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  var els = {
    name: document.getElementById('tournament-name'),
    meta: document.getElementById('tournament-meta'),
    tz: document.getElementById('timezone-select'),
    hourToggle: document.getElementById('hour-format-toggle'),
    extToggle: document.getElementById('extended-day-toggle'),
    upcomingToggle: document.getElementById('upcoming-only-toggle'),
    upcomingControl: document.getElementById('upcoming-only-control'),
    viewButtons: Array.prototype.slice.call(document.querySelectorAll('.seg[data-view]')),
    themeToggle: document.getElementById('theme-toggle'),
    listView: document.getElementById('list-view'),
    calendarView: document.getElementById('calendar-view'),
    empty: document.getElementById('empty-state'),
  };

  // ---- Settings (persisted) ------------------------------------------------
  var browserTz = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  var settings = loadSettings();

  var prefersLight =
    window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;

  function defaultView() {
    if (window.matchMedia && window.matchMedia('(max-width: 640px)').matches) {
      return 'list';
    }
    return 'calendar';
  }

  function loadSettings() {
    var defaults = {
      view: defaultView(),
      timezone: browserTz,
      hour24: true,
      extendedDay: false,
      upcomingOnly: true,
      theme: prefersLight ? 'light' : 'dark',
    };
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
      return Object.assign(defaults, saved);
    } catch (e) {
      return defaults;
    }
  }

  function saveSettings() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      /* ignore quota / privacy-mode errors */
    }
  }

  // ---- Time helpers --------------------------------------------------------
  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function partsCache() {
    // Cache one formatter per timezone for performance.
    var cache = {};
    return function (tz) {
      if (!cache[tz]) {
        cache[tz] = new Intl.DateTimeFormat('en-US', {
          timeZone: tz,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        });
      }
      return cache[tz];
    };
  }
  var getFormatter = partsCache();

  function localParts(utcIso, tz) {
    var parts = getFormatter(tz).formatToParts(new Date(utcIso));
    var out = {};
    for (var i = 0; i < parts.length; i += 1) {
      if (parts[i].type !== 'literal') out[parts[i].type] = parseInt(parts[i].value, 10);
    }
    return out;
  }

  // Returns the day-bucket + display hour for a match, applying the
  // extended-day rule (00:00–03:59 -> previous day, hour + 24).
  function breakdown(utcIso) {
    var p = localParts(utcIso, settings.timezone);
    var year = p.year;
    var month = p.month;
    var day = p.day;
    var displayHour = p.hour;
    var wrapped = false;

    if (settings.extendedDay && p.hour < 4) {
      var d = new Date(Date.UTC(year, month - 1, day));
      d.setUTCDate(d.getUTCDate() - 1);
      year = d.getUTCFullYear();
      month = d.getUTCMonth() + 1;
      day = d.getUTCDate();
      displayHour = p.hour + 24;
      wrapped = true;
    }

    return {
      dayKey: year + '-' + pad(month) + '-' + pad(day),
      year: year,
      month: month,
      day: day,
      hour: p.hour,
      minute: p.minute,
      displayHour: displayHour,
      wrapped: wrapped,
    };
  }

  function formatTime(bd) {
    var m = pad(bd.minute);
    if (bd.wrapped) {
      // Hours 24:00–27:59 — always shown in extended 24h notation.
      return bd.displayHour + ':' + m;
    }
    if (settings.hour24) {
      return pad(bd.displayHour) + ':' + m;
    }
    var h = bd.displayHour % 12;
    if (h === 0) h = 12;
    return h + ':' + m + ' ' + (bd.displayHour < 12 ? 'AM' : 'PM');
  }

  function formatDayHeading(dayKey) {
    var p = dayKey.split('-');
    var dt = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2], 12));
    return new Intl.DateTimeFormat('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(dt);
  }

  function todayKey() {
    var p = localParts(new Date().toISOString(), settings.timezone);
    return p.year + '-' + pad(p.month) + '-' + pad(p.day);
  }

  function teamName(name) {
    return name || 'TBD';
  }

  function matchTag(match) {
    return match.group || match.round || '';
  }

  // ---- Data shaping --------------------------------------------------------
  // Matches to display, honouring the "upcoming only" filter (hides matches
  // that have already kicked off). Applies to both list and calendar views.
  function visibleMatches() {
    if (!settings.upcomingOnly) return data.matches;
    var now = Date.now();
    return data.matches.filter(function (m) {
      return new Date(m.kickoffUtc).getTime() >= now;
    });
  }

  // Group matches by day bucket; returns ordered array of { dayKey, matches }.
  function groupByDay(matches) {
    var buckets = {};
    matches.forEach(function (match) {
      var bd = breakdown(match.kickoffUtc);
      if (!buckets[bd.dayKey]) buckets[bd.dayKey] = [];
      buckets[bd.dayKey].push({ match: match, bd: bd });
    });

    return Object.keys(buckets)
      .sort()
      .map(function (key) {
        var items = buckets[key].sort(function (a, b) {
          return (
            a.match.kickoffUtc.localeCompare(b.match.kickoffUtc) ||
            a.match.id - b.match.id
          );
        });
        return { dayKey: key, items: items };
      });
  }

  // ---- Rendering: list -----------------------------------------------------
  function renderList() {
    var groups = groupByDay(visibleMatches());
    els.empty.hidden = groups.length > 0;

    var frag = document.createDocumentFragment();
    var today = todayKey();

    groups.forEach(function (group) {
      var section = document.createElement('div');
      section.className = 'day-group';

      var heading = document.createElement('h2');
      heading.className = 'day-heading';
      if (group.dayKey === today) heading.style.color = 'var(--today)';
      heading.innerHTML =
        '<span>' +
        escapeHtml(formatDayHeading(group.dayKey)) +
        '</span><span class="count">' +
        group.items.length +
        (group.items.length === 1 ? ' match' : ' matches') +
        '</span>';
      section.appendChild(heading);

      group.items.forEach(function (item) {
        section.appendChild(renderRow(item.match, item.bd));
      });

      frag.appendChild(section);
    });

    els.listView.innerHTML = '';
    els.listView.appendChild(frag);
  }

  function renderRow(match, bd) {
    var row = document.createElement('div');
    row.className = 'match-row';

    var time = document.createElement('div');
    time.className = 'match-time';
    time.innerHTML =
      escapeHtml(formatTime(bd)) +
      (bd.wrapped ? '<span class="next-day">prev. day</span>' : '');

    var teams = document.createElement('div');
    teams.className = 'match-teams';
    teams.innerHTML =
      '<strong>' +
      escapeHtml(teamName(match.home)) +
      '</strong><span class="vs">v</span><strong>' +
      escapeHtml(teamName(match.away)) +
      '</strong>';

    var meta = document.createElement('div');
    meta.className = 'match-meta';
    var tag = matchTag(match);
    meta.innerHTML =
      (match.venue ? escapeHtml(match.venue) + '<br>' : '') +
      (tag ? '<span class="chip">' + escapeHtml(tag) + '</span>' : '');

    row.appendChild(time);
    row.appendChild(teams);
    row.appendChild(meta);
    return row;
  }

  // ---- Rendering: calendar -------------------------------------------------
  function renderCalendar() {
    var groups = groupByDay(visibleMatches());
    var byDay = {};
    groups.forEach(function (g) {
      byDay[g.dayKey] = g.items;
    });

    var keys = Object.keys(byDay).sort();
    els.calendarView.innerHTML = '';
    els.empty.hidden = keys.length > 0;
    if (keys.length === 0) return;

    var first = keys[0].split('-');
    var last = keys[keys.length - 1].split('-');
    var startYear = +first[0];
    var startMonth = +first[1];
    var endYear = +last[0];
    var endMonth = +last[1];
    var today = todayKey();

    var frag = document.createDocumentFragment();
    var y = startYear;
    var m = startMonth;
    while (y < endYear || (y === endYear && m <= endMonth)) {
      frag.appendChild(renderMonth(y, m, byDay, today));
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
    els.calendarView.appendChild(frag);
  }

  function renderMonth(year, month, byDay, today) {
    var wrap = document.createElement('div');
    wrap.className = 'month';
    wrap.id = 'month-' + year + '-' + pad(month);

    var title = document.createElement('h2');
    title.className = 'month-title';
    title.textContent = new Intl.DateTimeFormat('en-US', {
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    }).format(new Date(Date.UTC(year, month - 1, 1)));
    wrap.appendChild(title);

    var weekRow = document.createElement('div');
    weekRow.className = 'weekday-row';
    WEEKDAYS.forEach(function (w) {
      var c = document.createElement('div');
      c.className = 'weekday';
      c.textContent = w;
      weekRow.appendChild(c);
    });
    wrap.appendChild(weekRow);

    var grid = document.createElement('div');
    grid.className = 'month-grid';

    var firstWeekday = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
    var daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    for (var i = 0; i < firstWeekday; i += 1) {
      var blank = document.createElement('div');
      blank.className = 'day-cell empty-cell';
      grid.appendChild(blank);
    }

    for (var day = 1; day <= daysInMonth; day += 1) {
      var key = year + '-' + pad(month) + '-' + pad(day);
      var items = byDay[key] || [];
      grid.appendChild(renderDayCell(day, key, items, today));
    }

    wrap.appendChild(grid);
    return wrap;
  }

  function renderDayCell(day, key, items, today) {
    var cell = document.createElement('div');
    cell.className = 'day-cell';
    if (items.length) cell.className += ' has-matches';
    if (key === today) cell.className += ' is-today';

    var num = document.createElement('div');
    num.className = 'day-num';
    num.textContent = day;
    cell.appendChild(num);

    items.forEach(function (item) {
      var box = document.createElement('div');
      box.className = 'cal-match';
      box.title =
        teamName(item.match.home) +
        ' v ' +
        teamName(item.match.away) +
        (item.match.venue ? ' — ' + item.match.venue : '');
      box.innerHTML =
        '<span class="cal-time">' +
        escapeHtml(formatTime(item.bd)) +
        '</span><span class="cal-teams">' +
        escapeHtml(teamName(item.match.home)) +
        ' v ' +
        escapeHtml(teamName(item.match.away)) +
        '</span>';
      cell.appendChild(box);
    });

    return cell;
  }

  // ---- Render dispatch -----------------------------------------------------
  function render() {
    var hasMatches = data && data.matches && data.matches.length > 0;

    var isList = settings.view === 'list';
    els.listView.hidden = !isList;
    els.calendarView.hidden = isList;

    if (!hasMatches) {
      els.empty.hidden = false;
      els.listView.innerHTML = '';
      els.calendarView.innerHTML = '';
      return;
    }

    if (isList) {
      renderCalendarEmptyReset();
      renderList();
    } else {
      els.empty.hidden = true;
      renderCalendar();
    }
  }

  function renderCalendarEmptyReset() {
    els.calendarView.innerHTML = '';
  }

  // Scroll the calendar so the current month is in view by default.
  function focusCurrentMonth() {
    var monthKey = 'month-' + todayKey().slice(0, 7);
    var el = document.getElementById(monthKey);
    if (!el) {
      // Current month outside the schedule range: fall back to the first month.
      el = els.calendarView.querySelector('.month');
    }
    if (el && typeof el.scrollIntoView === 'function') {
      el.scrollIntoView({ block: 'start' });
    }
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ---- Controls ------------------------------------------------------------
  function populateTimezones() {
    var zones;
    try {
      zones = typeof Intl.supportedValuesOf === 'function'
        ? Intl.supportedValuesOf('timeZone')
        : null;
    } catch (e) {
      zones = null;
    }
    if (!zones || !zones.length) {
      zones = [
        'UTC',
        'America/Los_Angeles',
        'America/New_York',
        'America/Mexico_City',
        'America/Sao_Paulo',
        'Europe/London',
        'Europe/Paris',
        'Africa/Johannesburg',
        'Asia/Dubai',
        'Asia/Kolkata',
        'Asia/Tokyo',
        'Australia/Sydney',
      ];
    }
    if (zones.indexOf(settings.timezone) === -1) zones = [settings.timezone].concat(zones);

    var frag = document.createDocumentFragment();
    zones.forEach(function (z) {
      var opt = document.createElement('option');
      opt.value = z;
      opt.textContent = z.replace(/_/g, ' ');
      frag.appendChild(opt);
    });
    els.tz.appendChild(frag);
    els.tz.value = settings.timezone;
  }

  function applyTheme() {
    var light = settings.theme === 'light';
    if (light) document.documentElement.setAttribute('data-theme', 'light');
    else document.documentElement.removeAttribute('data-theme');
    els.themeToggle.setAttribute('aria-pressed', light ? 'true' : 'false');
    var label = els.themeToggle.querySelector('.theme-label');
    if (label) label.textContent = light ? 'Light' : 'Dark';
  }

  function syncControls() {
    els.hourToggle.checked = settings.hour24;
    els.extToggle.checked = settings.extendedDay;
    els.upcomingToggle.checked = settings.upcomingOnly;
    applyTheme();
    els.viewButtons.forEach(function (btn) {
      var pressed = btn.getAttribute('data-view') === settings.view;
      btn.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
  }

  function wireEvents() {
    els.tz.addEventListener('change', function () {
      settings.timezone = els.tz.value;
      saveSettings();
      render();
    });

    els.hourToggle.addEventListener('change', function () {
      settings.hour24 = els.hourToggle.checked;
      saveSettings();
      render();
    });

    els.extToggle.addEventListener('change', function () {
      settings.extendedDay = els.extToggle.checked;
      saveSettings();
      render();
    });

    els.upcomingToggle.addEventListener('change', function () {
      settings.upcomingOnly = els.upcomingToggle.checked;
      saveSettings();
      render();
    });

    els.viewButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        settings.view = btn.getAttribute('data-view');
        saveSettings();
        syncControls();
        render();
        if (settings.view === 'calendar') focusCurrentMonth();
      });
    });

    els.themeToggle.addEventListener('click', function () {
      settings.theme = settings.theme === 'light' ? 'dark' : 'light';
      saveSettings();
      applyTheme();
    });
  }

  // ---- Init ----------------------------------------------------------------
  function init() {
    if (!data) {
      els.name.textContent = 'No data loaded';
      els.meta.textContent = 'Run: node scripts/fetch-schedule.mjs';
      return;
    }

    els.name.textContent = data.name || 'Schedule';
    var count = (data.matches && data.matches.length) || 0;
    els.meta.textContent =
      count + ' matches · times shown in your selected timezone';

    populateTimezones();
    syncControls();
    wireEvents();
    render();
    if (settings.view === 'calendar') focusCurrentMonth();
  }

  init();
})();
