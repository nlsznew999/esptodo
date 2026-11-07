// Cloudflare Pages Functions API Handler with Cloudflare D1 Database
// จัดการ REST API ทั้งหมดบน Cloudflare Pages และบันทึกลง Cloudflare D1 (Serverless SQLite)

// Helper: ส่ง JSON Response พร้อม CORS
function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    }
  });
}

// Helper: ตรวจสอบและสร้างตารางเริ่มต้นอัตโนมัติ (Auto Migration & Seed)
async function ensureTables(db) {
  try {
    await db.exec(`
      CREATE TABLE IF NOT EXISTS members (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        nickname TEXT NOT NULL,
        role TEXT NOT NULL,
        email TEXT,
        color TEXT DEFAULT '#3B82F6',
        avatar TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT,
        member_id TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'todo',
        priority TEXT NOT NULL DEFAULT 'medium',
        start_date TEXT,
        deadline TEXT,
        tag TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );
    `);

    // ตรวจสอบว่ามีข้อมูลหรือไม่ ถ้ายังไม่มี ให้ใส่ข้อมูลตัวอย่างเริ่มต้น
    const countCheck = await db.prepare("SELECT COUNT(*) as count FROM members").first();
    if (countCheck && countCheck.count === 0) {
      await db.batch([
        db.prepare("INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES ('mem-1', 'กานต์ วรเมธ', 'กานต์', 'Project Manager', 'karn.w@team.local', '#3B82F6', 'ก')"),
        db.prepare("INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES ('mem-2', 'พิมพิศา สุขสันต์', 'พิม', 'UI/UX Designer', 'pimpisa.s@team.local', '#8B5CF6', 'พ')"),
        db.prepare("INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES ('mem-3', 'ธนกฤต มั่นคง', 'ตั้ม', 'Frontend Developer', 'tanakrit.m@team.local', '#10B981', 'ต')"),
        db.prepare("INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES ('mem-4', 'วรวิทย์ ยิ่งยง', 'วิทย์', 'Backend Developer', 'worawit.y@team.local', '#F59E0B', 'ว')"),
        db.prepare("INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES ('mem-5', 'ศศิธร สว่างจิตต์', 'ศิ', 'QA Engineer', 'sasithorn.s@team.local', '#F43F5E', 'ศ')"),

        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-101', 'สรุป Scope และ Requirements ประจำสปรินต์', 'รวบรวมฟีดแบ็กจากลูกค้าเพื่อจัดลำดับความสำคัญของฟีเจอร์ในสปรินต์ถัดไป พร้อมวางแผนตารางงานทีม', 'mem-1', 'in_progress', 'high', '2026-11-04', '2026-11-08', 'Planning')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-102', 'จัดประชุม Sprint Planning ประจำสัปดาห์', 'นัดหมายทีมงานทุกคนเพื่อประเมิน Story Points และมอบหมายงานให้ตรงกับทักษะ', 'mem-1', 'todo', 'medium', '2026-11-07', '2026-11-10', 'Meeting')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-103', 'ส่งรายงานความคืบหน้ารายสัปดาห์ให้ผู้บริหาร', 'สรุปผลการส่งมอบงาน อัตราความสำเร็จ และปัญหาติดขัด (Blockers) ประจำสัปดาห์', 'mem-1', 'done', 'low', '2026-10-31', '2026-11-06', 'Report')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-201', 'ออกแบบ Design System และ Component Library', 'กำหนดสี, Typography, Buttons, Inputs และการ์ดต่างๆ ใน Figma เพื่อให้ทีม Frontend นำไปใช้พัฒนาได้ตรงกัน', 'mem-2', 'in_progress', 'urgent', '2026-11-03', '2026-11-09', 'Design')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-202', 'ทำ Wireframe หน้า Kanban Board สำหรับมือถือ', 'ออกแบบ Layout สำหรับการใช้งานหน้า Kanban บนหน้าจอขนาดเล็ก (Mobile Responsive)', 'mem-2', 'review', 'high', '2026-11-05', '2026-11-07', 'Design')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-301', 'พัฒนาระบบ Drag and Drop สำหรับ Kanban Board', 'เพิ่มฟังก์ชันการลากและวางการ์ดงานข้ามคอลัมน์ และบันทึกสถานะงานลงในฐานข้อมูลทันที', 'mem-3', 'in_progress', 'urgent', '2026-11-05', '2026-11-08', 'Frontend')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-302', 'แก้บั๊กการแสดงผลสีสถานะ Deadline เกินกำหนด', 'ตรวจสอบ logic การคำนวณวันหมดอายุ และแสดงแท็กสีแดงเมื่อเลยกำหนดส่ง', 'mem-3', 'review', 'high', '2026-11-04', '2026-11-06', 'Bug')"),
        db.prepare("INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES ('task-402', 'พัฒนา RESTful API สำหรับการจัดการ Tasks (CRUD)', 'สร้าง Endpoint: GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id, DELETE /api/tasks/:id', 'mem-4', 'in_progress', 'high', '2026-11-05', '2026-11-09', 'Backend')")
      ]);
    }
  } catch (err) {
    console.error("ensureTables error:", err);
  }
}

// Main Handler สำหรับทุก Method ใน Cloudflare Pages
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;
  const method = request.method;

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type"
      }
    });
  }

  // ตรวจสอบว่ามีการเชื่อมโยง D1 Database ใน Cloudflare หรือไม่
  if (!env.DB) {
    return jsonResponse({
      error: "Cloudflare D1 Database binding 'DB' is missing. กรุณาเชื่อมโยง D1 ใน Cloudflare Pages Settings -> Functions -> D1 database bindings โดยตั้งชื่อ Variable name ว่า 'DB'"
    }, 500);
  }

  const db = env.DB;
  await ensureTables(db);

  try {
    // 1. GET /api/data - ดึงข้อมูลสมาชิกและงานทั้งหมด
    if (pathname === "/api/data" && method === "GET") {
      const membersQuery = await db.prepare("SELECT * FROM members ORDER BY created_at ASC").all();
      const tasksQuery = await db.prepare("SELECT * FROM tasks ORDER BY created_at DESC").all();

      const tasks = (tasksQuery.results || []).map(t => ({
        id: t.id,
        title: t.title,
        description: t.description || "",
        memberId: t.member_id,
        status: t.status,
        priority: t.priority,
        startDate: t.start_date,
        deadline: t.deadline,
        tag: t.tag || "",
        createdAt: t.created_at,
        updatedAt: t.updated_at
      }));

      return jsonResponse({
        members: membersQuery.results || [],
        tasks: tasks
      });
    }

    // 2. POST /api/tasks - เพิ่มงานใหม่
    if (pathname === "/api/tasks" && method === "POST") {
      const task = await request.json();
      if (!task.title) {
        return jsonResponse({ error: "กรุณาระบุชื่องาน" }, 400);
      }

      const id = task.id || "task-" + Date.now();
      const now = new Date().toISOString();

      await db.prepare(`
        INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        task.title,
        task.description || "",
        task.memberId,
        task.status || "todo",
        task.priority || "medium",
        task.startDate || now.split("T")[0],
        task.deadline || "",
        task.tag || "",
        now,
        now
      ).run();

      return jsonResponse({ success: true, task: { ...task, id, createdAt: now } }, 201);
    }

    // 3. PUT /api/tasks/:id - แก้ไขงาน หรือเปลี่ยนสถานะ
    if (pathname.startsWith("/api/tasks/") && method === "PUT") {
      const taskId = pathname.replace("/api/tasks/", "");
      const updates = await request.json();

      // ดึงงานเดิมมาตรวจสอบ
      const existing = await db.prepare("SELECT * FROM tasks WHERE id = ?").bind(taskId).first();
      if (!existing) {
        return jsonResponse({ error: "ไม่พบงานที่ต้องการแก้ไข" }, 404);
      }

      const title = updates.title !== undefined ? updates.title : existing.title;
      const description = updates.description !== undefined ? updates.description : existing.description;
      const memberId = updates.memberId !== undefined ? updates.memberId : existing.member_id;
      const status = updates.status !== undefined ? updates.status : existing.status;
      const priority = updates.priority !== undefined ? updates.priority : existing.priority;
      const startDate = updates.startDate !== undefined ? updates.startDate : existing.start_date;
      const deadline = updates.deadline !== undefined ? updates.deadline : existing.deadline;
      const tag = updates.tag !== undefined ? updates.tag : existing.tag;
      const now = new Date().toISOString();

      await db.prepare(`
        UPDATE tasks SET 
          title = ?, description = ?, member_id = ?, status = ?, priority = ?,
          start_date = ?, deadline = ?, tag = ?, updated_at = ?
        WHERE id = ?
      `).bind(title, description, memberId, status, priority, startDate, deadline, tag, now, taskId).run();

      return jsonResponse({ success: true, taskId });
    }

    // 4. DELETE /api/tasks/:id - ลบงาน
    if (pathname.startsWith("/api/tasks/") && method === "DELETE") {
      const taskId = pathname.replace("/api/tasks/", "");
      await db.prepare("DELETE FROM tasks WHERE id = ?").bind(taskId).run();
      return jsonResponse({ success: true });
    }

    // 5. POST /api/members - เพิ่มสมาชิกใหม่
    if (pathname === "/api/members" && method === "POST") {
      const member = await request.json();
      if (!member.name) {
        return jsonResponse({ error: "กรุณาระบุชื่อสมาชิก" }, 400);
      }

      const id = member.id || "mem-" + Date.now();
      const nickname = member.nickname || member.name.slice(0, 4);
      const avatar = member.avatar || nickname[0];
      const now = new Date().toISOString();

      await db.prepare(`
        INSERT INTO members (id, name, nickname, role, email, color, avatar, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        id,
        member.name,
        nickname,
        member.role || "สมาชิก",
        member.email || "",
        member.color || "#3B82F6",
        avatar,
        now
      ).run();

      return jsonResponse({ success: true, member: { ...member, id, nickname, avatar } }, 201);
    }

    // 6. DELETE /api/members/:id - ลบสมาชิก (และโอนงานให้สมาชิกคนแรก)
    if (pathname.startsWith("/api/members/") && method === "DELETE") {
      const memberId = pathname.replace("/api/members/", "");
      
      // หาสมาชิกคนอื่นเพื่อโอนงาน
      const otherMember = await db.prepare("SELECT id FROM members WHERE id != ? LIMIT 1").bind(memberId).first();
      if (otherMember) {
        await db.prepare("UPDATE tasks SET member_id = ? WHERE member_id = ?").bind(otherMember.id, memberId).run();
      }

      await db.prepare("DELETE FROM members WHERE id = ?").bind(memberId).run();
      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Endpoint not found" }, 404);
  } catch (err) {
    console.error("Cloudflare Worker Error:", err);
    return jsonResponse({ error: err.message || "Internal server error" }, 500);
  }
}
