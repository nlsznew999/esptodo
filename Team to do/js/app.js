// ระบบจัดการ To-Do List สำหรับทีม (Team Task & Kanban Management System)
// รองรับทั้งโหมด Offline (LocalStorage) และโหมด Online (Server REST API ซิงค์ข้อมูลกับคนในทีม)

(function () {
  "use strict";

  // --- 1. STATE & STORAGE ---
  const STORAGE_KEYS = {
    MEMBERS: "team_todo_members_v1",
    TASKS: "team_todo_tasks_v1",
    DARK_MODE: "team_todo_dark_v1",
    ACTIVE_MEMBER: "team_todo_active_member_v1"
  };

  const STATUS_CONFIG = {
    todo: {
      id: "todo",
      label: "รอดำเนินการ (To Do)",
      shortLabel: "รอดำเนินการ",
      icon: "📋",
      color: "slate",
      columnClass: "column-status-todo"
    },
    in_progress: {
      id: "in_progress",
      label: "กำลังดำเนินการ (In Progress)",
      shortLabel: "กำลังทำ",
      icon: "⏳",
      color: "blue",
      columnClass: "column-status-in_progress"
    },
    review: {
      id: "review",
      label: "รอตรวจสอบ (Under Review)",
      shortLabel: "รอตรวจ",
      icon: "🔍",
      color: "amber",
      columnClass: "column-status-review"
    },
    done: {
      id: "done",
      label: "เสร็จสิ้น (Done)",
      shortLabel: "เสร็จสิ้น",
      icon: "✅",
      color: "emerald",
      columnClass: "column-status-done"
    }
  };

  const PRIORITY_CONFIG = {
    low: { label: "ต่ำ", badgeClass: "badge-priority-low" },
    medium: { label: "ปานกลาง", badgeClass: "badge-priority-medium" },
    high: { label: "สูง", badgeClass: "badge-priority-high" },
    urgent: { label: "ด่วนมาก ⚡", badgeClass: "badge-priority-urgent" }
  };

  // Application State
  const state = {
    members: [],
    tasks: [],
    activeView: "overview", // 'overview' | 'kanban' | 'deadlines'
    currentMemberId: null,
    searchQuery: "",
    filterPriority: "all",
    filterTag: "all",
    filterMember: "all",
    darkMode: false,
    draggedTaskId: null,
    isServerOnline: false, // บ่งบอกว่าเชื่อมต่อกับเซิร์ฟเวอร์กลางสำเร็จหรือไม่
    lastSyncTime: null
  };

  let pollingTimer = null;

  // --- 2. INITIALIZATION ---
  async function init() {
    setupTheme();
    setupEventListeners();

    // ตรวจสอบว่ามี Server REST API หรือไม่
    await checkServerConnectionAndLoadData();

    renderApp();

    // เริ่ม Polling เช็คข้อมูลใหม่จาก Server ทุก 5 วินาที เพื่อให้เห็นงานที่คนอื่นเพิ่ม
    startAutoSync();
  }

  // เช็คและโหลดข้อมูลจาก Server หรือ LocalStorage
  async function checkServerConnectionAndLoadData() {
    try {
      const response = await fetch("/api/data", { method: "GET", headers: { "Accept": "application/json" } });
      if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data.members) && Array.isArray(data.tasks)) {
          state.members = data.members;
          state.tasks = data.tasks;
          state.isServerOnline = true;
          state.lastSyncTime = new Date();
          updateSyncStatusBadge();
          // บันทึกลง LocalStorage เป็นสำรอง
          saveLocalCache();
          setupActiveMember();
          return;
        }
      }
    } catch (e) {
      // ไม่สามารถเชื่อมต่อกับ Server API -> ใช้ LocalStorage
    }

    state.isServerOnline = false;
    loadFromLocalStorage();
    setupActiveMember();
    updateSyncStatusBadge();
  }

  function setupActiveMember() {
    const storedActiveMember = localStorage.getItem(STORAGE_KEYS.ACTIVE_MEMBER);
    if (storedActiveMember && state.members.some(m => m.id === storedActiveMember)) {
      state.currentMemberId = storedActiveMember;
    } else {
      state.currentMemberId = state.members.length > 0 ? state.members[0].id : null;
    }
  }

  function loadFromLocalStorage() {
    try {
      const storedMembers = localStorage.getItem(STORAGE_KEYS.MEMBERS);
      const storedTasks = localStorage.getItem(STORAGE_KEYS.TASKS);

      if (storedMembers) {
        state.members = JSON.parse(storedMembers);
      } else if (typeof INITIAL_MEMBERS !== "undefined") {
        state.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
        localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(state.members));
      }

      if (storedTasks) {
        state.tasks = JSON.parse(storedTasks);
      } else if (typeof INITIAL_TASKS !== "undefined") {
        state.tasks = JSON.parse(JSON.stringify(INITIAL_TASKS));
        localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
      }
    } catch (err) {
      console.error("Error loading local data:", err);
      state.members = typeof INITIAL_MEMBERS !== "undefined" ? INITIAL_MEMBERS : [];
      state.tasks = typeof INITIAL_TASKS !== "undefined" ? INITIAL_TASKS : [];
    }
  }

  function saveLocalCache() {
    localStorage.setItem(STORAGE_KEYS.MEMBERS, JSON.stringify(state.members));
    localStorage.setItem(STORAGE_KEYS.TASKS, JSON.stringify(state.tasks));
  }

  function saveActiveMember(id) {
    state.currentMemberId = id;
    localStorage.setItem(STORAGE_KEYS.ACTIVE_MEMBER, id);
  }

  // --- 3. AUTO-SYNC & SERVER API CALLS ---
  function startAutoSync() {
    if (pollingTimer) clearInterval(pollingTimer);
    pollingTimer = setInterval(async () => {
      // อย่า sync ทับถ้าผู้ใช้กำลังเปิด modal เพิ่มงานอยู่
      const modalContainer = document.getElementById("modal-container");
      if (modalContainer && modalContainer.children.length > 0) return;

      try {
        const response = await fetch("/api/data");
        if (response.ok) {
          const data = await response.json();
          if (Array.isArray(data.members) && Array.isArray(data.tasks)) {
            const hasChanged = JSON.stringify(data.tasks) !== JSON.stringify(state.tasks) ||
                               JSON.stringify(data.members) !== JSON.stringify(state.members);
            state.members = data.members;
            state.tasks = data.tasks;
            state.isServerOnline = true;
            state.lastSyncTime = new Date();
            updateSyncStatusBadge();
            saveLocalCache();

            if (hasChanged) {
              renderApp();
            }
          }
        }
      } catch (err) {
        // Offline
        if (state.isServerOnline) {
          state.isServerOnline = false;
          updateSyncStatusBadge();
        }
      }
    }, 4000);
  }

  function updateSyncStatusBadge() {
    const badge = document.getElementById("server-status-badge");
    if (!badge) return;

    if (state.isServerOnline) {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-950/80 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800" title="เชื่อมต่อกับ Server เรียลไทม์: เมื่อเพื่อนร่วมทีมเพิ่มงาน คุณจะเห็นทันที">
          <span class="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
          <span>Online (Server ซิงค์กับทีม)</span>
        </span>
      `;
    } else {
      badge.innerHTML = `
        <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-50 dark:bg-amber-950/80 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800" title="โหมด LocalStorage: ข้อมูลบันทึกในเบราว์เซอร์เครื่องนี้">
          <span class="w-2 h-2 rounded-full bg-amber-400"></span>
          <span>Offline (บันทึกในเครื่อง)</span>
        </span>
      `;
    }
  }

  // --- 4. THEME TOGGLE ---
  function setupTheme() {
    state.darkMode = localStorage.getItem(STORAGE_KEYS.DARK_MODE) === "true";
    if (state.darkMode) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
    updateThemeIcon();
  }

  function toggleTheme() {
    state.darkMode = !state.darkMode;
    localStorage.setItem(STORAGE_KEYS.DARK_MODE, state.darkMode ? "true" : "false");
    setupTheme();
    showToast(state.darkMode ? "เปิดใช้งาน Dark Mode เรียบร้อย" : "เปิดใช้งาน Light Mode เรียบร้อย", "info");
  }

  function updateThemeIcon() {
    const iconContainer = document.getElementById("theme-toggle-btn");
    if (iconContainer) {
      iconContainer.innerHTML = state.darkMode
        ? `<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>`
        : `<svg class="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"></path></svg>`;
    }
  }

  // --- 5. DATE & TIME HELPERS ---
  function formatThaiDate(dateStr) {
    if (!dateStr) return "-";
    try {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        const year = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const day = parseInt(parts[2], 10);
        const thaiMonths = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
        return `${day} ${thaiMonths[month]} ${year + 543}`;
      }
      return dateStr;
    } catch {
      return dateStr;
    }
  }

  function getDeadlineAnalysis(deadlineStr, status) {
    if (!deadlineStr) return { text: "ไม่มีกำหนด", badgeClass: "badge-deadline-upcoming", isOverdue: false };
    
    if (status === "done") {
      return { text: `เสร็จสิ้น (${formatThaiDate(deadlineStr)})`, badgeClass: "badge-deadline-done", isOverdue: false };
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const parts = deadlineStr.split("-");
    const target = new Date(parts[0], parts[1] - 1, parts[2]);
    target.setHours(0, 0, 0, 0);

    const diffTime = target - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      return {
        text: `เลยกำหนด ${overdueDays} วัน (${formatThaiDate(deadlineStr)})`,
        badgeClass: "badge-deadline-overdue",
        isOverdue: true,
        diffDays
      };
    } else if (diffDays === 0) {
      return {
        text: `ครบกำหนดวันนี้!`,
        badgeClass: "badge-deadline-today",
        isOverdue: false,
        diffDays: 0
      };
    } else if (diffDays === 1) {
      return {
        text: `ส่งพรุ่งนี้ (${formatThaiDate(deadlineStr)})`,
        badgeClass: "badge-deadline-today",
        isOverdue: false,
        diffDays: 1
      };
    } else {
      return {
        text: `เหลืออีก ${diffDays} วัน (${formatThaiDate(deadlineStr)})`,
        badgeClass: "badge-deadline-upcoming",
        isOverdue: false,
        diffDays
      };
    }
  }

  // --- 6. DATA QUERIES & COMPUTATIONS ---
  function getMemberById(id) {
    return state.members.find(m => m.id === id) || {
      id: "unknown",
      name: "ไม่ระบุ",
      nickname: "?",
      role: "ทั่วไป",
      color: "#94A3B8",
      avatar: "?"
    };
  }

  function getFilteredTasks(tasksToFilter = state.tasks) {
    return tasksToFilter.filter(task => {
      if (state.searchQuery.trim() !== "") {
        const query = state.searchQuery.toLowerCase();
        const titleMatch = task.title.toLowerCase().includes(query);
        const descMatch = (task.description || "").toLowerCase().includes(query);
        const tagMatch = (task.tag || "").toLowerCase().includes(query);
        const member = getMemberById(task.memberId);
        const memberMatch = member.name.toLowerCase().includes(query) || member.nickname.toLowerCase().includes(query);
        if (!titleMatch && !descMatch && !tagMatch && !memberMatch) {
          return false;
        }
      }

      if (state.filterPriority !== "all" && task.priority !== state.filterPriority) {
        return false;
      }

      if (state.filterTag !== "all" && task.tag !== state.filterTag) {
        return false;
      }

      if (state.filterMember !== "all" && task.memberId !== state.filterMember) {
        return false;
      }

      return true;
    });
  }

  function getTeamStats() {
    const total = state.tasks.length;
    const todo = state.tasks.filter(t => t.status === "todo").length;
    const inProgress = state.tasks.filter(t => t.status === "in_progress").length;
    const review = state.tasks.filter(t => t.status === "review").length;
    const done = state.tasks.filter(t => t.status === "done").length;

    const overdue = state.tasks.filter(t => {
      if (t.status === "done" || !t.deadline) return false;
      const analysis = getDeadlineAnalysis(t.deadline, t.status);
      return analysis.isOverdue;
    }).length;

    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, todo, inProgress, review, done, overdue, completionRate };
  }

  function getMemberStats(memberId) {
    const memberTasks = state.tasks.filter(t => t.memberId === memberId);
    const total = memberTasks.length;
    const todo = memberTasks.filter(t => t.status === "todo").length;
    const inProgress = memberTasks.filter(t => t.status === "in_progress").length;
    const review = memberTasks.filter(t => t.status === "review").length;
    const done = memberTasks.filter(t => t.status === "done").length;

    const overdue = memberTasks.filter(t => {
      if (t.status === "done" || !t.deadline) return false;
      return getDeadlineAnalysis(t.deadline, t.status).isOverdue;
    }).length;

    const rate = total > 0 ? Math.round((done / total) * 100) : 0;

    return { total, todo, inProgress, review, done, overdue, rate };
  }

  // --- 7. RENDER LOGIC ---
  function renderApp() {
    renderHeader();
    renderViewButtons();
    updateSyncStatusBadge();

    const mainContainer = document.getElementById("main-view-container");
    if (!mainContainer) return;

    if (state.activeView === "overview") {
      renderOverview(mainContainer);
    } else if (state.activeView === "kanban") {
      renderKanban(mainContainer);
    } else if (state.activeView === "deadlines") {
      renderDeadlinesView(mainContainer);
    }
  }

  function renderHeader() {
    const avatarBar = document.getElementById("member-avatars-bar");
    if (avatarBar) {
      avatarBar.innerHTML = state.members
        .map(m => {
          const isActive = state.activeView === "kanban" && m.id === state.currentMemberId;
          const stats = getMemberStats(m.id);
          return `
            <button 
              type="button" 
              onclick="window.app.switchToMemberKanban('${m.id}')"
              class="relative group flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-medium transition-all ${
                isActive
                  ? "bg-indigo-50 border-indigo-500 text-indigo-700 dark:bg-indigo-950/60 dark:border-indigo-400 dark:text-indigo-300 shadow-sm"
                  : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600"
              }"
              title="ดูคัมบังบอร์ดของ ${m.name}"
            >
              <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow-xs" style="background-color: ${m.color}">
                ${m.avatar}
              </span>
              <span class="hidden md:inline">${m.nickname}</span>
              <span class="text-[10px] px-1.5 py-0.2 rounded-full ${stats.overdue > 0 ? "bg-red-100 text-red-600 font-bold dark:bg-red-950/80 dark:text-red-300" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400"}">
                ${stats.total}
              </span>
            </button>
          `;
        })
        .join("");
    }
  }

  function renderViewButtons() {
    const btnOverview = document.getElementById("tab-overview-btn");
    const btnKanban = document.getElementById("tab-kanban-btn");
    const btnDeadlines = document.getElementById("tab-deadlines-btn");

    const activeClasses = ["bg-indigo-600", "text-white", "shadow-sm"];

    [btnOverview, btnKanban, btnDeadlines].forEach(btn => {
      if (btn) btn.classList.remove(...activeClasses);
    });

    if (state.activeView === "overview" && btnOverview) {
      btnOverview.classList.add(...activeClasses);
    } else if (state.activeView === "kanban" && btnKanban) {
      btnKanban.classList.add(...activeClasses);
    } else if (state.activeView === "deadlines" && btnDeadlines) {
      btnDeadlines.classList.add(...activeClasses);
    }
  }

  // --- 8. OVERVIEW VIEW ---
  function renderOverview(container) {
    const stats = getTeamStats();
    const filteredTasks = getFilteredTasks();

    container.innerHTML = `
      <div class="space-y-8 animate-fadeIn">
        <!-- Top Stats Row -->
        <div class="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
          <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>งานทั้งหมดในทีม</span>
              <span class="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">📊</span>
            </div>
            <div class="text-2xl font-bold text-slate-800 dark:text-white">${stats.total} <span class="text-xs font-normal text-slate-400">งาน</span></div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">จากสมาชิก ${state.members.length} คน</div>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>กำลังทำ (In Progress)</span>
              <span class="p-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400">⏳</span>
            </div>
            <div class="text-2xl font-bold text-blue-600 dark:text-blue-400">${stats.inProgress} <span class="text-xs font-normal text-slate-400">งาน</span></div>
            <div class="mt-2 text-xs text-slate-500 dark:text-slate-400">และรอตรวจ ${stats.review} งาน</div>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs ${stats.overdue > 0 ? "border-red-300 dark:border-red-900/60 bg-red-50/20" : ""}">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>เลยกำหนดส่ง (Overdue)</span>
              <span class="p-1.5 rounded-lg bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400">⚠️</span>
            </div>
            <div class="text-2xl font-bold ${stats.overdue > 0 ? "text-red-600 dark:text-red-400 animate-pulse" : "text-slate-700 dark:text-slate-300"}">
              ${stats.overdue} <span class="text-xs font-normal text-slate-400">งาน</span>
            </div>
            <div class="mt-2 text-xs ${stats.overdue > 0 ? "text-red-500 font-medium" : "text-slate-400"}">
              ${stats.overdue > 0 ? "ต้องเร่งติดตามด่วน" : "ไม่มีงานค้างกำหนด"}
            </div>
          </div>

          <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 shadow-xs col-span-2 lg:col-span-2">
            <div class="flex items-center justify-between text-slate-500 dark:text-slate-400 text-xs font-medium mb-1">
              <span>ความคืบหน้ารวม (Completed)</span>
              <span class="text-emerald-600 dark:text-emerald-400 font-bold">${stats.completionRate}%</span>
            </div>
            <div class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              ${stats.done} <span class="text-xs font-normal text-slate-400">/ ${stats.total} งานเสร็จสิ้น</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
              <div class="bg-emerald-500 h-full rounded-full progress-bar-fill" style="width: ${stats.completionRate}%"></div>
            </div>
          </div>
        </div>

        <!-- Section 1: Member Workload Cards -->
        <div>
          <div class="flex items-center justify-between mb-4">
            <div>
              <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>👥 สมาชิกในทีมและภาระงาน</span>
                <span class="text-xs px-2 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 font-normal">
                  คลิกที่การ์ดเพื่อเปิดคัมบังบอร์ดของคนนั้น
                </span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">ทุกคนสามารถเพิ่มและจัดการงานของสมาชิกแต่ละคนได้</p>
            </div>
            <button onclick="window.app.openMemberModal()" class="px-3 py-1.5 rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 text-xs font-medium hover:bg-indigo-100 transition flex items-center gap-1.5">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>จัดการสมาชิก</span>
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            ${state.members
              .map(member => {
                const mStats = getMemberStats(member.id);
                return `
                  <div class="bg-white dark:bg-slate-800 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 dark:hover:border-indigo-500 shadow-xs hover:shadow-md transition-all flex flex-col justify-between group">
                    <div>
                      <div class="flex items-start justify-between gap-2 mb-3">
                        <div class="flex items-center gap-3">
                          <div class="w-10 h-10 rounded-2xl flex items-center justify-center text-white font-bold text-base shadow-sm shrink-0" style="background-color: ${member.color}">
                            ${member.avatar}
                          </div>
                          <div class="min-w-0">
                            <h3 class="text-sm font-bold text-slate-800 dark:text-white truncate">${member.name}</h3>
                            <p class="text-xs text-slate-500 dark:text-slate-400 truncate">${member.role}</p>
                          </div>
                        </div>
                        ${
                          mStats.overdue > 0
                            ? `<span class="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-900/60 text-red-600 dark:text-red-300 text-[10px] font-bold shrink-0 animate-pulse" title="เลยกำหนดส่ง ${mStats.overdue} งาน">
                                ⚠️ ${mStats.overdue}
                              </span>`
                            : ""
                        }
                      </div>

                      <div class="grid grid-cols-4 gap-1 text-center py-2 border-y border-slate-100 dark:border-slate-700/60 text-[11px] mb-3">
                        <div class="bg-slate-50 dark:bg-slate-900/50 p-1 rounded-lg">
                          <div class="text-slate-400 text-[10px]">รอทำ</div>
                          <div class="font-bold text-slate-700 dark:text-slate-300">${mStats.todo}</div>
                        </div>
                        <div class="bg-blue-50 dark:bg-blue-950/40 p-1 rounded-lg">
                          <div class="text-blue-500 text-[10px]">ทำอยู่</div>
                          <div class="font-bold text-blue-600 dark:text-blue-400">${mStats.inProgress}</div>
                        </div>
                        <div class="bg-amber-50 dark:bg-amber-950/40 p-1 rounded-lg">
                          <div class="text-amber-500 text-[10px]">รอตรวจ</div>
                          <div class="font-bold text-amber-600 dark:text-amber-400">${mStats.review}</div>
                        </div>
                        <div class="bg-emerald-50 dark:bg-emerald-950/40 p-1 rounded-lg">
                          <div class="text-emerald-500 text-[10px]">เสร็จ</div>
                          <div class="font-bold text-emerald-600 dark:text-emerald-400">${mStats.done}</div>
                        </div>
                      </div>

                      <div class="mb-4">
                        <div class="flex justify-between text-[11px] text-slate-500 dark:text-slate-400 mb-1">
                          <span>ความสำเร็จ</span>
                          <span class="font-semibold text-slate-700 dark:text-slate-300">${mStats.rate}%</span>
                        </div>
                        <div class="w-full bg-slate-100 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                          <div class="bg-indigo-600 h-full rounded-full" style="width: ${mStats.rate}%"></div>
                        </div>
                      </div>
                    </div>

                    <button 
                      onclick="window.app.switchToMemberKanban('${member.id}')"
                      class="w-full py-2 px-3 rounded-xl bg-slate-100 dark:bg-slate-700 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-600 text-slate-700 dark:text-slate-200 text-xs font-medium transition flex items-center justify-center gap-1.5"
                    >
                      <span>เปิด Kanban ของ ${member.nickname}</span>
                      <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg>
                    </button>
                  </div>
                `;
              })
              .join("")}
          </div>
        </div>

        <!-- Section 2: Master Team Tasks Table -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
          <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-5">
            <div>
              <h2 class="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
                <span>📋 รายการงานทั้งหมดของทีม (Master Task List)</span>
                <span class="text-xs px-2.5 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-semibold">
                  ${filteredTasks.length} งาน
                </span>
              </h2>
              <p class="text-xs text-slate-500 dark:text-slate-400">ค้นหา กรอง และจัดการสถานะงานของทุกคนได้โดยตรง</p>
            </div>

            <!-- Controls -->
            <div class="flex flex-wrap items-center gap-2">
              <select 
                onchange="window.app.setFilterMember(this.value)" 
                class="text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-indigo-500"
              >
                <option value="all" ${state.filterMember === "all" ? "selected" : ""}>👥 สมาชิกทุกคน</option>
                ${state.members.map(m => `<option value="${m.id}" ${state.filterMember === m.id ? "selected" : ""}>${m.name}</option>`).join("")}
              </select>

              <select 
                onchange="window.app.setFilterPriority(this.value)" 
                class="text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl px-3 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-indigo-500"
              >
                <option value="all" ${state.filterPriority === "all" ? "selected" : ""}>🎯 ทุกระดับความสำคัญ</option>
                <option value="urgent" ${state.filterPriority === "urgent" ? "selected" : ""}>ด่วนมาก ⚡</option>
                <option value="high" ${state.filterPriority === "high" ? "selected" : ""}>สูง</option>
                <option value="medium" ${state.filterPriority === "medium" ? "selected" : ""}>ปานกลาง</option>
                <option value="low" ${state.filterPriority === "low" ? "selected" : ""}>ต่ำ</option>
              </select>

              <button 
                onclick="window.app.openTaskModal()" 
                class="px-3.5 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition flex items-center gap-1.5"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                <span>สร้างงานใหม่</span>
              </button>
            </div>
          </div>

          <!-- Table -->
          <div class="overflow-x-auto">
            <table class="w-full text-left text-xs border-collapse">
              <thead>
                <tr class="border-b border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">
                  <th class="py-3 px-3">ชื่องาน & รายละเอียด</th>
                  <th class="py-3 px-3">ผู้รับผิดชอบ</th>
                  <th class="py-3 px-3">สถานะ (Status)</th>
                  <th class="py-3 px-3">ความสำคัญ</th>
                  <th class="py-3 px-3">วันที่เริ่ม</th>
                  <th class="py-3 px-3">Deadline (กำหนดส่ง)</th>
                  <th class="py-3 px-3 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-slate-100 dark:divide-slate-700/60 text-slate-700 dark:text-slate-300">
                ${
                  filteredTasks.length === 0
                    ? `
                      <tr>
                        <td colspan="7" class="py-8 text-center text-slate-400 dark:text-slate-500">
                          ไม่พบงานที่ตรงกับเงื่อนไขการค้นหา
                        </td>
                      </tr>
                    `
                    : filteredTasks
                        .map(task => {
                          const member = getMemberById(task.memberId);
                          const deadlineInfo = getDeadlineAnalysis(task.deadline, task.status);
                          const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
                          return `
                            <tr class="hover:bg-slate-50/80 dark:hover:bg-slate-700/40 transition-colors">
                              <td class="py-3 px-3 max-w-xs md:max-w-md">
                                <div class="font-bold text-slate-800 dark:text-white flex items-center gap-1.5">
                                  <span>${escapeHtml(task.title)}</span>
                                  ${
                                    task.tag
                                      ? `<span class="px-1.5 py-0.5 rounded text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 font-normal">${escapeHtml(task.tag)}</span>`
                                      : ""
                                  }
                                </div>
                                <div class="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-0.5">
                                  ${escapeHtml(task.description || "ไม่มีรายละเอียด")}
                                </div>
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap">
                                <button 
                                  onclick="window.app.switchToMemberKanban('${member.id}')"
                                  class="flex items-center gap-2 hover:opacity-80 transition group"
                                  title="คลิกเพื่อดูบอร์ดของ ${member.name}"
                                >
                                  <span class="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-bold shadow-xs" style="background-color: ${member.color}">
                                    ${member.avatar}
                                  </span>
                                  <div class="text-left">
                                    <div class="font-medium text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400">${member.name}</div>
                                    <div class="text-[10px] text-slate-400">${member.role}</div>
                                  </div>
                                </button>
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap">
                                <select 
                                  onchange="window.app.updateTaskStatus('${task.id}', this.value)"
                                  class="text-xs bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1 font-medium ${
                                    task.status === "done"
                                      ? "text-emerald-700 dark:text-emerald-300"
                                      : task.status === "in_progress"
                                      ? "text-blue-700 dark:text-blue-300"
                                      : task.status === "review"
                                      ? "text-amber-700 dark:text-amber-300"
                                      : "text-slate-700 dark:text-slate-300"
                                  }"
                                >
                                  <option value="todo" ${task.status === "todo" ? "selected" : ""}>📋 รอดำเนินการ</option>
                                  <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>⏳ กำลังดำเนินการ</option>
                                  <option value="review" ${task.status === "review" ? "selected" : ""}>🔍 รอตรวจสอบ</option>
                                  <option value="done" ${task.status === "done" ? "selected" : ""}>✅ เสร็จสิ้น</option>
                                </select>
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap">
                                <span class="px-2 py-0.5 rounded-full text-[11px] font-medium ${priorityInfo.badgeClass}">
                                  ${priorityInfo.label}
                                </span>
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap text-slate-500 dark:text-slate-400">
                                ${formatThaiDate(task.startDate)}
                              </td>
                              <td class="py-3 px-3 whitespace-nowrap">
                                <span class="px-2 py-1 rounded-md text-[11px] ${deadlineInfo.badgeClass}">
                                  ${deadlineInfo.text}
                                </span>
                              </td>
                              <td class="py-3 px-3 text-right whitespace-nowrap">
                                <button 
                                  onclick="window.app.openTaskModal('${task.id}')"
                                  class="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                  title="แก้ไขงาน"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
                                </button>
                                <button 
                                  onclick="window.app.deleteTaskConfirm('${task.id}')"
                                  class="p-1.5 rounded-lg text-slate-500 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition"
                                  title="ลบงาน"
                                >
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>
                              </td>
                            </tr>
                          `;
                        })
                        .join("")
                }
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // --- 9. PERSONAL KANBAN VIEW ---
  function renderKanban(container) {
    const activeMember = getMemberById(state.currentMemberId);
    const memberTasks = state.tasks.filter(t => t.memberId === state.currentMemberId);
    const memberStats = getMemberStats(state.currentMemberId);
    const filteredMemberTasks = getFilteredTasks(memberTasks);

    const tasksByStatus = {
      todo: filteredMemberTasks.filter(t => t.status === "todo"),
      in_progress: filteredMemberTasks.filter(t => t.status === "in_progress"),
      review: filteredMemberTasks.filter(t => t.status === "review"),
      done: filteredMemberTasks.filter(t => t.status === "done")
    };

    container.innerHTML = `
      <div class="space-y-6 animate-fadeIn">
        <!-- Personal Board Header -->
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-4">
            <div class="w-14 h-14 rounded-2xl flex items-center justify-center text-white text-2xl font-bold shadow-md shrink-0" style="background-color: ${activeMember.color}">
              ${activeMember.avatar}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h1 class="text-xl font-bold text-slate-800 dark:text-white">คัมบังบอร์ด: ${activeMember.name}</h1>
                <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
                  ${activeMember.role}
                </span>
              </div>
              <p class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                <span>จัดการงานส่วนตัวแบบ Kanban Board ลากและวางเพื่อเปลี่ยนสถานะได้อิสระ</span>
                <span>•</span>
                <span>${activeMember.email || ""}</span>
              </p>
            </div>
          </div>

          <!-- Quick Switch & Add -->
          <div class="flex items-center gap-3">
            <div class="flex items-center gap-2 bg-slate-50 dark:bg-slate-700/60 p-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs">
              <span class="text-slate-400">สลับคน:</span>
              <select 
                onchange="window.app.switchToMemberKanban(this.value)"
                class="bg-transparent font-medium text-slate-800 dark:text-slate-200 focus:outline-none cursor-pointer"
              >
                ${state.members
                  .map(
                    m =>
                      `<option value="${m.id}" ${m.id === state.currentMemberId ? "selected" : ""}>
                        ${m.name} (${m.nickname})
                      </option>`
                  )
                  .join("")}
              </select>
            </div>

            <button 
              onclick="window.app.openTaskModal(null, '${activeMember.id}')"
              class="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs transition flex items-center gap-2"
            >
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
              <span>+ เพิ่มงานให้ ${activeMember.nickname}</span>
            </button>
          </div>
        </div>

        <!-- Personal Stats Bar -->
        <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span class="text-xs text-slate-500 dark:text-slate-400">งานทั้งหมด</span>
            <span class="text-base font-bold text-slate-800 dark:text-white">${memberStats.total}</span>
          </div>
          <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span class="text-xs text-blue-500">กำลังทำ & รอตรวจ</span>
            <span class="text-base font-bold text-blue-600">${memberStats.inProgress + memberStats.review}</span>
          </div>
          <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between ${memberStats.overdue > 0 ? "border-red-300 dark:border-red-800 bg-red-50/20" : ""}">
            <span class="text-xs ${memberStats.overdue > 0 ? "text-red-500 font-bold" : "text-slate-500"}">เลยกำหนดส่ง</span>
            <span class="text-base font-bold ${memberStats.overdue > 0 ? "text-red-600" : "text-slate-800 dark:text-white"}">${memberStats.overdue}</span>
          </div>
          <div class="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <span class="text-xs text-emerald-500">เสร็จสิ้นแล้ว</span>
            <span class="text-base font-bold text-emerald-600">${memberStats.done} (${memberStats.rate}%)</span>
          </div>
        </div>

        <!-- 4 Columns Kanban Board -->
        <div class="kanban-board-container">
          ${Object.values(STATUS_CONFIG)
            .map(col => {
              const tasks = tasksByStatus[col.id] || [];
              return `
                <div 
                  class="kanban-column ${col.columnClass}"
                  data-status="${col.id}"
                  ondragover="window.app.handleDragOver(event)"
                  ondragleave="window.app.handleDragLeave(event)"
                  ondrop="window.app.handleDrop(event, '${col.id}')"
                >
                  <div class="p-3.5 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/60">
                    <div class="flex items-center gap-2">
                      <span class="text-base">${col.icon}</span>
                      <h3 class="font-bold text-sm text-slate-800 dark:text-white">${col.shortLabel}</h3>
                      <span class="px-2 py-0.5 rounded-full text-xs font-semibold bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 shadow-xs border border-slate-200 dark:border-slate-700">
                        ${tasks.length}
                      </span>
                    </div>

                    <button 
                      onclick="window.app.openTaskModal(null, '${activeMember.id}', '${col.id}')"
                      class="w-6 h-6 rounded-lg flex items-center justify-center text-slate-400 hover:text-indigo-600 hover:bg-white dark:hover:bg-slate-800 transition"
                      title="เพิ่มงานในช่องนี้"
                    >
                      <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path></svg>
                    </button>
                  </div>

                  <div class="kanban-tasks-list" data-status="${col.id}">
                    ${
                      tasks.length === 0
                        ? `
                          <div class="h-32 flex flex-col items-center justify-center text-center p-4 border border-dashed border-slate-300 dark:border-slate-700 rounded-xl text-slate-400 dark:text-slate-500 text-xs">
                            <span class="text-lg opacity-40 mb-1">📭</span>
                            <span>ไม่มีงานในสถานะนี้</span>
                            <button onclick="window.app.openTaskModal(null, '${activeMember.id}', '${col.id}')" class="mt-2 text-indigo-600 dark:text-indigo-400 font-medium hover:underline text-[11px]">
                              + เพิ่มงาน
                            </button>
                          </div>
                        `
                        : tasks.map(task => renderTaskCard(task)).join("")
                    }
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function renderTaskCard(task) {
    const deadlineInfo = getDeadlineAnalysis(task.deadline, task.status);
    const priorityInfo = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;

    return `
      <div 
        class="task-card"
        id="task-${task.id}"
        draggable="true"
        ondragstart="window.app.handleDragStart(event, '${task.id}')"
        ondragend="window.app.handleDragEnd(event)"
      >
        <div class="flex items-center justify-between gap-1 mb-2">
          <div class="flex items-center gap-1.5 flex-wrap">
            ${
              task.tag
                ? `<span class="px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">#${escapeHtml(task.tag)}</span>`
                : ""
            }
          </div>
          <span class="px-2 py-0.5 rounded-full text-[10px] font-semibold ${priorityInfo.badgeClass}">
            ${priorityInfo.label}
          </span>
        </div>

        <h4 
          class="font-bold text-sm text-slate-800 dark:text-white leading-snug mb-1 hover:text-indigo-600 dark:hover:text-indigo-400 cursor-pointer"
          onclick="window.app.openTaskModal('${task.id}')"
        >
          ${escapeHtml(task.title)}
        </h4>

        ${
          task.description
            ? `<p class="text-xs text-slate-500 dark:text-slate-400 line-clamp-2 mb-3 cursor-pointer" onclick="window.app.openTaskModal('${task.id}')">
                ${escapeHtml(task.description)}
              </p>`
            : '<div class="mb-2"></div>'
        }

        <div class="pt-2 border-t border-slate-100 dark:border-slate-800/80 space-y-1.5">
          <div class="flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400">
            <span class="flex items-center gap-1" title="วันที่เริ่มงาน">
              <span>📅</span> ${formatThaiDate(task.startDate)}
            </span>
            <span class="px-2 py-0.5 rounded-md text-[10px] ${deadlineInfo.badgeClass}" title="กำหนดส่ง">
              ⏰ ${deadlineInfo.text}
            </span>
          </div>

          <div class="flex items-center justify-between pt-1">
            <select 
              onchange="window.app.updateTaskStatus('${task.id}', this.value)"
              class="text-[10px] bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 text-slate-600 dark:text-slate-400"
              title="เปลี่ยนสถานะด่วน"
            >
              <option value="todo" ${task.status === "todo" ? "selected" : ""}>📋 รอทำ</option>
              <option value="in_progress" ${task.status === "in_progress" ? "selected" : ""}>⏳ ทำอยู่</option>
              <option value="review" ${task.status === "review" ? "selected" : ""}>🔍 รอตรวจ</option>
              <option value="done" ${task.status === "done" ? "selected" : ""}>✅ เสร็จ</option>
            </select>

            <div class="flex items-center gap-1">
              <button 
                onclick="window.app.openTaskModal('${task.id}')"
                class="p-1 rounded text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                title="แก้ไขข้อมูลงาน"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"></path></svg>
              </button>
              <button 
                onclick="window.app.deleteTaskConfirm('${task.id}')"
                class="p-1 rounded text-slate-400 hover:text-red-600 transition"
                title="ลบงาน"
              >
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // --- 10. DEADLINES VIEW ---
  function renderDeadlinesView(container) {
    const tasksWithDeadline = state.tasks
      .filter(t => t.deadline)
      .sort((a, b) => new Date(a.deadline) - new Date(b.deadline));

    const overdueTasks = tasksWithDeadline.filter(t => t.status !== "done" && getDeadlineAnalysis(t.deadline, t.status).isOverdue);
    const todayTasks = tasksWithDeadline.filter(t => {
      const a = getDeadlineAnalysis(t.deadline, t.status);
      return t.status !== "done" && a.diffDays === 0;
    });
    const upcomingTasks = tasksWithDeadline.filter(t => {
      const a = getDeadlineAnalysis(t.deadline, t.status);
      return t.status !== "done" && a.diffDays > 0;
    });
    const doneTasks = tasksWithDeadline.filter(t => t.status === "done");

    container.innerHTML = `
      <div class="space-y-6 animate-fadeIn">
        <div class="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 shadow-xs">
          <h2 class="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <span>📅 ปฏิทินและกำหนดส่งงาน (Deadlines Tracker)</span>
          </h2>
          <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
            ติดตามงานที่ใกล้ถึงกำหนดส่งและงานที่เลยกำหนดในทีม เพื่อไม่ให้พลาดทุก Deadline สำคัญ
          </p>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="space-y-4">
            <h3 class="font-bold text-sm text-red-600 dark:text-red-400 flex items-center gap-2">
              <span>⚠️ เลยกำหนดส่งแล้ว (${overdueTasks.length})</span>
            </h3>
            <div class="space-y-3">
              ${
                overdueTasks.length === 0
                  ? `<div class="p-4 bg-emerald-50 dark:bg-emerald-950/40 rounded-xl border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 text-center">
                      ยอดเยี่ยม! ไม่มีงานที่เลยกำหนดส่งในทีม
                    </div>`
                  : overdueTasks.map(t => renderDeadlineCard(t, "border-red-400")).join("")
              }
            </div>

            <div class="pt-4 flex items-center justify-between">
              <h3 class="font-bold text-sm text-amber-600 dark:text-amber-400 flex items-center gap-2">
                <span>🔥 ต้องส่งวันนี้ (${todayTasks.length})</span>
              </h3>
            </div>
            <div class="space-y-3">
              ${
                todayTasks.length === 0
                  ? `<div class="p-4 bg-slate-100 dark:bg-slate-800/80 rounded-xl text-xs text-slate-400 text-center">ไม่มีงานที่ต้องส่งในวันนี้</div>`
                  : todayTasks.map(t => renderDeadlineCard(t, "border-amber-400")).join("")
              }
            </div>
          </div>

          <div class="space-y-4 md:col-span-2">
            <h3 class="font-bold text-sm text-slate-800 dark:text-white flex items-center gap-2">
              <span>⏳ กำหนดส่งที่จะมาถึงเร็วๆ นี้ (${upcomingTasks.length})</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              ${
                upcomingTasks.length === 0
                  ? `<div class="col-span-2 p-6 bg-slate-50 dark:bg-slate-800/40 rounded-xl text-center text-slate-400 text-xs">ไม่มีงานที่กำลังจะถึงกำหนด</div>`
                  : upcomingTasks.map(t => renderDeadlineCard(t, "border-slate-200 dark:border-slate-700")).join("")
              }
            </div>

            <h3 class="font-bold text-sm text-emerald-600 dark:text-emerald-400 pt-6 flex items-center gap-2">
              <span>✅ งานที่เสร็จสิ้นแล้ว (${doneTasks.length})</span>
            </h3>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 opacity-70 hover:opacity-100 transition">
              ${doneTasks.slice(0, 4).map(t => renderDeadlineCard(t, "border-emerald-200 dark:border-emerald-900/40")).join("")}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function renderDeadlineCard(task, borderHighlight) {
    const member = getMemberById(task.memberId);
    const deadlineInfo = getDeadlineAnalysis(task.deadline, task.status);
    return `
      <div class="bg-white dark:bg-slate-800 rounded-xl p-3.5 border ${borderHighlight} shadow-xs hover:shadow-md transition">
        <div class="flex items-start justify-between gap-2 mb-2">
          <h4 class="font-bold text-xs text-slate-800 dark:text-white line-clamp-1 cursor-pointer hover:text-indigo-600" onclick="window.app.openTaskModal('${task.id}')">
            ${escapeHtml(task.title)}
          </h4>
          <span class="px-2 py-0.5 rounded text-[10px] font-semibold ${deadlineInfo.badgeClass} shrink-0">
            ${deadlineInfo.text}
          </span>
        </div>
        <div class="flex items-center justify-between text-xs pt-2 border-t border-slate-100 dark:border-slate-700/60">
          <div class="flex items-center gap-1.5">
            <span class="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold" style="background-color: ${member.color}">
              ${member.avatar}
            </span>
            <span class="text-slate-600 dark:text-slate-300 font-medium">${member.name}</span>
          </div>
          <span class="text-[11px] text-slate-400">${STATUS_CONFIG[task.status]?.label || task.status}</span>
        </div>
      </div>
    `;
  }

  // --- 11. DRAG & DROP ENGINE ---
  function handleDragStart(e, taskId) {
    state.draggedTaskId = taskId;
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", taskId);

    const card = document.getElementById(`task-${taskId}`);
    if (card) {
      setTimeout(() => card.classList.add("dragging"), 0);
    }
  }

  function handleDragEnd(e) {
    state.draggedTaskId = null;
    document.querySelectorAll(".task-card").forEach(c => c.classList.remove("dragging"));
    document.querySelectorAll(".kanban-column").forEach(c => c.classList.remove("drag-over"));
  }

  function handleDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const column = e.currentTarget;
    if (column && !column.classList.contains("drag-over")) {
      column.classList.add("drag-over");
    }
  }

  function handleDragLeave(e) {
    const column = e.currentTarget;
    if (column && e.relatedTarget && !column.contains(e.relatedTarget)) {
      column.classList.remove("drag-over");
    }
  }

  async function handleDrop(e, newStatus) {
    e.preventDefault();
    const column = e.currentTarget;
    if (column) column.classList.remove("drag-over");

    const taskId = e.dataTransfer.getData("text/plain") || state.draggedTaskId;
    if (!taskId) return;

    await updateTaskStatus(taskId, newStatus);
  }

  // --- 12. TASK CRUD OPERATIONS (LOCAL + API) ---
  function openTaskModal(taskId = null, defaultMemberId = null, defaultStatus = "todo") {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    const isEdit = !!taskId;
    const task = isEdit ? state.tasks.find(t => t.id === taskId) : null;
    const todayStr = new Date().toISOString().split("T")[0];

    const currentTitle = task ? task.title : "";
    const currentDesc = task ? task.description : "";
    const currentMember = task ? task.memberId : (defaultMemberId || state.currentMemberId || state.members[0]?.id);
    const currentStatus = task ? task.status : defaultStatus;
    const currentPriority = task ? task.priority : "medium";
    const currentStartDate = task ? task.startDate : todayStr;
    const currentDeadline = task ? (task.deadline || "") : "";
    const currentTag = task ? (task.tag || "") : "";

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onclick="if(event.target === this) window.app.closeModal()">
        <div class="modal-content bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>${isEdit ? "✏️ แก้ไขข้อมูลงาน" : "➕ สร้างงานใหม่สำหรับทีม"}</span>
            </h3>
            <button onclick="window.app.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">✕</button>
          </div>

          <form id="task-modal-form" onsubmit="window.app.saveTaskForm(event, '${taskId || ""}')" class="p-5 space-y-4">
            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                ชื่องาน <span class="text-red-500">*</span>
              </label>
              <input 
                type="text" 
                id="task-title-input" 
                required 
                placeholder="เช่น ออกแบบหน้าเว็บสำหรับระบบสั่งซื้อ..." 
                value="${escapeHtml(currentTitle)}"
                class="w-full text-sm px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
              />
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  ผู้รับผิดชอบ <span class="text-red-500">*</span>
                </label>
                <select 
                  id="task-member-input" 
                  required
                  class="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                >
                  ${state.members
                    .map(m => `<option value="${m.id}" ${m.id === currentMember ? "selected" : ""}>👤 ${m.name} (${m.role})</option>`)
                    .join("")}
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  สถานะ (Status) <span class="text-red-500">*</span>
                </label>
                <select 
                  id="task-status-input" 
                  required
                  class="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                >
                  <option value="todo" ${currentStatus === "todo" ? "selected" : ""}>📋 รอดำเนินการ (To Do)</option>
                  <option value="in_progress" ${currentStatus === "in_progress" ? "selected" : ""}>⏳ กำลังดำเนินการ (In Progress)</option>
                  <option value="review" ${currentStatus === "review" ? "selected" : ""}>🔍 รอตรวจสอบ (Review)</option>
                  <option value="done" ${currentStatus === "done" ? "selected" : ""}>✅ เสร็จสิ้น (Done)</option>
                </select>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">ระดับความสำคัญ</label>
                <select 
                  id="task-priority-input" 
                  class="w-full text-xs px-3 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                >
                  <option value="low" ${currentPriority === "low" ? "selected" : ""}>ต่ำ (Low)</option>
                  <option value="medium" ${currentPriority === "medium" ? "selected" : ""}>ปานกลาง (Medium)</option>
                  <option value="high" ${currentPriority === "high" ? "selected" : ""}>สูง (High)</option>
                  <option value="urgent" ${currentPriority === "urgent" ? "selected" : ""}>ด่วนมาก (Urgent ⚡)</option>
                </select>
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">หมวดหมู่ / แท็ก (Tag)</label>
                <input 
                  type="text" 
                  id="task-tag-input" 
                  placeholder="เช่น Frontend, Design, Bug, API" 
                  value="${escapeHtml(currentTag)}"
                  class="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">วันที่เริ่มงาน</label>
                <input 
                  type="date" 
                  id="task-start-input" 
                  value="${currentStartDate}"
                  class="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                />
              </div>

              <div>
                <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Deadline (กำหนดส่ง) <span class="text-red-500">*</span></label>
                <input 
                  type="date" 
                  id="task-deadline-input" 
                  required
                  value="${currentDeadline}"
                  class="w-full text-xs px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
                />
              </div>
            </div>

            <div>
              <label class="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">รายละเอียดงาน (Description)</label>
              <textarea 
                id="task-desc-input" 
                rows="4" 
                placeholder="ระบุรายละเอียดเพิ่มเติม, ขอบเขตงาน, หรือ Checklist..."
                class="w-full text-xs px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-white focus:outline-indigo-500"
              >${escapeHtml(currentDesc)}</textarea>
            </div>

            <div class="pt-4 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div>
                ${
                  isEdit
                    ? `<button type="button" onclick="window.app.deleteTaskConfirm('${taskId}')" class="text-red-600 hover:text-red-700 text-xs font-medium px-2 py-1">ลบงานนี้</button>`
                    : ""
                }
              </div>
              <div class="flex items-center gap-2">
                <button type="button" onclick="window.app.closeModal()" class="px-4 py-2 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700">ยกเลิก</button>
                <button type="submit" class="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium shadow-xs">${isEdit ? "บันทึกการแก้ไข" : "สร้างงาน"}</button>
              </div>
            </div>
          </form>
        </div>
      </div>
    `;

    setTimeout(() => {
      const input = document.getElementById("task-title-input");
      if (input) input.focus();
    }, 100);
  }

  async function saveTaskForm(e, taskId) {
    e.preventDefault();

    const title = document.getElementById("task-title-input").value.trim();
    const memberId = document.getElementById("task-member-input").value;
    const status = document.getElementById("task-status-input").value;
    const priority = document.getElementById("task-priority-input").value;
    const tag = document.getElementById("task-tag-input").value.trim();
    const startDate = document.getElementById("task-start-input").value;
    const deadline = document.getElementById("task-deadline-input").value;
    const description = document.getElementById("task-desc-input").value.trim();

    if (!title) {
      alert("กรุณากรอกชื่องาน");
      return;
    }

    if (taskId) {
      // Edit
      const taskData = { title, memberId, status, priority, tag, startDate, deadline, description };
      if (state.isServerOnline) {
        try {
          await fetch(`/api/tasks/${taskId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(taskData)
          });
        } catch (err) {
          console.error("API error:", err);
        }
      }

      const task = state.tasks.find(t => t.id === taskId);
      if (task) {
        Object.assign(task, taskData, { updatedAt: new Date().toISOString() });
      }
      showToast("บันทึกการแก้ไขงานสำเร็จ", "success");
    } else {
      // Create
      const newTask = {
        id: "task-" + Date.now(),
        title,
        memberId,
        status,
        priority,
        tag,
        startDate,
        deadline,
        description,
        createdAt: new Date().toISOString()
      };

      if (state.isServerOnline) {
        try {
          const res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(newTask)
          });
          if (res.ok) {
            const data = await res.json();
            if (data.task) newTask.id = data.task.id;
          }
        } catch (err) {
          console.error("API error:", err);
        }
      }

      state.tasks.unshift(newTask);
      showToast("สร้างงานใหม่เรียบร้อยแล้ว", "success");
    }

    saveLocalCache();
    closeModal();
    renderApp();
  }

  async function updateTaskStatus(taskId, newStatus) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.status = newStatus;
    saveLocalCache();
    renderApp();
    showToast(`เปลี่ยนสถานะเป็น "${STATUS_CONFIG[newStatus].shortLabel}" เรียบร้อย`, "success");

    if (state.isServerOnline) {
      try {
        await fetch(`/api/tasks/${taskId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: newStatus })
        });
      } catch (err) {
        console.error("API update error:", err);
      }
    }
  }

  async function deleteTaskConfirm(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    if (confirm(`คุณต้องการลบงาน "${task.title}" หรือไม่?`)) {
      state.tasks = state.tasks.filter(t => t.id !== taskId);
      saveLocalCache();
      closeModal();
      renderApp();
      showToast("ลบงานเรียบร้อยแล้ว", "info");

      if (state.isServerOnline) {
        try {
          await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
        } catch (err) {
          console.error("API delete error:", err);
        }
      }
    }
  }

  // --- 13. MEMBER MANAGEMENT ---
  function openMemberModal() {
    const modalContainer = document.getElementById("modal-container");
    if (!modalContainer) return;

    modalContainer.innerHTML = `
      <div class="fixed inset-0 z-50 flex items-center justify-center p-4 modal-overlay" onclick="if(event.target === this) window.app.closeModal()">
        <div class="modal-content bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 w-full max-w-xl max-h-[90vh] overflow-y-auto">
          <div class="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h3 class="text-base font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <span>👥 จัดการสมาชิกในทีม (Team Members)</span>
            </h3>
            <button onclick="window.app.closeModal()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg">✕</button>
          </div>

          <div class="p-5 space-y-6">
            <div class="bg-slate-50 dark:bg-slate-900/60 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
              <h4 class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-1.5">
                <span>➕ เพิ่มสมาชิกใหม่ในทีม</span>
              </h4>
              <form onsubmit="window.app.addNewMember(event)" class="space-y-3">
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">ชื่อ-นามสกุล *</label>
                    <input type="text" id="new-member-name" required placeholder="เช่น สมชาย ใจดี" class="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">ชื่อเล่น *</label>
                    <input type="text" id="new-member-nickname" required placeholder="เช่น บอย" class="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
                  </div>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">ตำแหน่ง (Role) *</label>
                    <input type="text" id="new-member-role" required placeholder="เช่น Frontend Developer" class="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">อีเมล</label>
                    <input type="email" id="new-member-email" placeholder="boy@team.com" class="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-800 dark:text-white" />
                  </div>
                  <div>
                    <label class="block text-[11px] text-slate-500 dark:text-slate-400 mb-1">สีประจำตัว</label>
                    <input type="color" id="new-member-color" value="#6366F1" class="w-full h-8 rounded-lg cursor-pointer bg-transparent" />
                  </div>
                </div>

                <div class="text-right">
                  <button type="submit" class="px-4 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-medium">เพิ่มสมาชิก</button>
                </div>
              </form>
            </div>

            <div>
              <h4 class="text-xs font-bold text-slate-700 dark:text-slate-200 mb-3">รายชื่อสมาชิกปัจจุบัน (${state.members.length} คน)</h4>
              <div class="divide-y divide-slate-100 dark:divide-slate-700/60 max-h-60 overflow-y-auto">
                ${state.members
                  .map(m => {
                    const tasksCount = state.tasks.filter(t => t.memberId === m.id).length;
                    return `
                      <div class="py-2.5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                          <span class="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-xs" style="background-color: ${m.color}">
                            ${m.avatar}
                          </span>
                          <div>
                            <div class="text-xs font-bold text-slate-800 dark:text-white">${m.name} (${m.nickname})</div>
                            <div class="text-[10px] text-slate-400">${m.role} • มี ${tasksCount} งาน</div>
                          </div>
                        </div>
                        <div class="flex items-center gap-2">
                          ${
                            state.members.length > 1
                              ? `<button onclick="window.app.deleteMemberConfirm('${m.id}')" class="text-red-500 hover:text-red-700 text-xs p-1" title="ลบสมาชิก">
                                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                                </button>`
                              : ""
                          }
                        </div>
                      </div>
                    `;
                  })
                  .join("")}
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  async function addNewMember(e) {
    e.preventDefault();
    const name = document.getElementById("new-member-name").value.trim();
    const nickname = document.getElementById("new-member-nickname").value.trim();
    const role = document.getElementById("new-member-role").value.trim();
    const email = document.getElementById("new-member-email").value.trim();
    const color = document.getElementById("new-member-color").value;

    if (!name || !role) {
      alert("กรุณากรอกชื่อและตำแหน่ง");
      return;
    }

    const newMember = {
      id: "mem-" + Date.now(),
      name,
      nickname: nickname || name.slice(0, 4),
      role,
      email: email || `${nickname.toLowerCase()}@team.local`,
      color,
      avatar: nickname ? nickname[0] : name[0]
    };

    if (state.isServerOnline) {
      try {
        await fetch("/api/members", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(newMember)
        });
      } catch (err) {
        console.error("API member add error:", err);
      }
    }

    state.members.push(newMember);
    saveLocalCache();
    showToast(`เพิ่มสมาชิก "${name}" เรียบร้อยแล้ว`, "success");
    openMemberModal();
    renderApp();
  }

  async function deleteMemberConfirm(memberId) {
    const member = getMemberById(memberId);
    const assignedTasks = state.tasks.filter(t => t.memberId === memberId);

    let message = `คุณต้องการลบสมาชิก "${member.name}" ใช่หรือไม่?`;
    if (assignedTasks.length > 0) {
      message += `\n\nคำเตือน: สมาชิกคนนี้มีงานที่รับผิดชอบอยู่ ${assignedTasks.length} งาน หากลบ งานเหล่านี้จะถูกโอนไปให้หัวหน้าทีม`;
    }

    if (confirm(message)) {
      const otherMembers = state.members.filter(m => m.id !== memberId);
      if (otherMembers.length > 0) {
        state.tasks.forEach(t => {
          if (t.memberId === memberId) t.memberId = otherMembers[0].id;
        });
      }

      state.members = otherMembers;
      saveLocalCache();

      if (state.currentMemberId === memberId) {
        state.currentMemberId = state.members[0]?.id;
      }

      if (state.isServerOnline) {
        try {
          await fetch(`/api/members/${memberId}`, { method: "DELETE" });
        } catch (err) {
          console.error("API member delete error:", err);
        }
      }

      showToast(`ลบสมาชิก "${member.name}" เรียบร้อย`, "info");
      openMemberModal();
      renderApp();
    }
  }

  function closeModal() {
    const modalContainer = document.getElementById("modal-container");
    if (modalContainer) modalContainer.innerHTML = "";
  }

  // --- 14. DATA EXPORT / IMPORT / RESET ---
  function exportData() {
    const data = {
      version: "1.0",
      exportDate: new Date().toISOString(),
      members: state.members,
      tasks: state.tasks
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = `team-todo-backup-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showToast("ส่งออกข้อมูล JSON สำเร็จ", "success");
  }

  function triggerImport() {
    const input = document.getElementById("import-file-input");
    if (input) input.click();
  }

  function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
      try {
        const json = JSON.parse(e.target.result);
        if (Array.isArray(json.members) && Array.isArray(json.tasks)) {
          state.members = json.members;
          state.tasks = json.tasks;
          saveLocalCache();

          // Sync to server if online
          if (state.isServerOnline) {
            for (const m of state.members) {
              await fetch("/api/members", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(m) }).catch(() => {});
            }
            for (const t of state.tasks) {
              await fetch("/api/tasks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(t) }).catch(() => {});
            }
          }

          renderApp();
          showToast("นำเข้าข้อมูลสำเร็จแล้ว!", "success");
        } else {
          alert("รูปแบบไฟล์ไม่ถูกต้อง กรุณาใช้ไฟล์ JSON ที่ส่งออกจากระบบนี้");
        }
      } catch (err) {
        alert("ไม่สามารถอ่านไฟล์ JSON ได้: " + err.message);
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  function resetToDemo() {
    if (confirm("คุณต้องการรีเซ็ตข้อมูลทั้งหมดกลับเป็นข้อมูลตัวอย่างเริ่มต้นใช่หรือไม่?")) {
      if (typeof INITIAL_MEMBERS !== "undefined" && typeof INITIAL_TASKS !== "undefined") {
        state.members = JSON.parse(JSON.stringify(INITIAL_MEMBERS));
        state.tasks = JSON.parse(JSON.stringify(INITIAL_TASKS));
        saveLocalCache();
        state.currentMemberId = state.members[0].id;
        renderApp();
        showToast("รีเซ็ตเป็นข้อมูลตัวอย่างเรียบร้อย", "info");
      }
    }
  }

  // --- 15. TOAST NOTIFICATIONS ---
  function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      document.body.appendChild(container);
    }

    const toast = document.createElement("div");
    toast.className = `toast px-4 py-3 rounded-xl shadow-lg border text-xs font-semibold flex items-center gap-2 max-w-sm ${
      type === "success"
        ? "bg-emerald-50 dark:bg-emerald-950 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200"
        : type === "warning"
        ? "bg-amber-50 dark:bg-amber-950 border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-200"
        : "bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-800 text-indigo-800 dark:text-indigo-200"
    }`;

    const icon = type === "success" ? "✅" : type === "warning" ? "⚠️" : "ℹ️";
    toast.innerHTML = `<span>${icon}</span><span>${escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(10px)";
      setTimeout(() => toast.remove(), 250);
    }, 3000);
  }

  function escapeHtml(str) {
    if (!str) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // --- 16. NAVIGATION ---
  function setView(viewName) {
    state.activeView = viewName;
    renderApp();
  }

  function switchToMemberKanban(memberId) {
    saveActiveMember(memberId);
    state.activeView = "kanban";
    renderApp();
  }

  function setFilterMember(memberId) {
    state.filterMember = memberId;
    renderApp();
  }

  function setFilterPriority(priority) {
    state.filterPriority = priority;
    renderApp();
  }

  function handleSearchInput(value) {
    state.searchQuery = value;
    renderApp();
  }

  function setupEventListeners() {
    window.addEventListener("keydown", e => {
      if (e.key === "Escape") closeModal();
    });
  }

  window.app = {
    init,
    toggleTheme,
    setView,
    switchToMemberKanban,
    setFilterMember,
    setFilterPriority,
    handleSearchInput,
    openTaskModal,
    saveTaskForm,
    updateTaskStatus,
    deleteTaskConfirm,
    openMemberModal,
    addNewMember,
    deleteMemberConfirm,
    closeModal,
    exportData,
    triggerImport,
    handleImportFile,
    resetToDemo,
    handleDragStart,
    handleDragEnd,
    handleDragOver,
    handleDragLeave,
    handleDrop
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
