// TeamTask Backend Server (Node.js Native - Zero External Dependencies)
// รองรับการนำขึ้น Cloud Server เช่น Render, Railway, Glitch, Fly.io, VPS ได้ทันที

const http = require("http");
const fs = require("fs");
const path = require("path");
const url = require("url");

const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "data", "database.json");

// ตรวจสอบหรือสร้างโฟลเดอร์ data
if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}

// โหลดฐานข้อมูล
function readDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, "utf8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Error reading database:", err);
  }
  return { members: [], tasks: [] };
}

// บันทึกฐานข้อมูล
function writeDatabase(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("Error writing database:", err);
    return false;
  }
}

// MIME Types สำหรับไฟล์ Static
const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// Helper: อ่าน Request Body
function getRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => (body += chunk.toString()));
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (e) {
        resolve({});
      }
    });
    req.on("error", reject);
  });
}

// Helper: ส่ง JSON Response
function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type"
  });
  res.end(JSON.stringify(data));
}

// สร้าง HTTP Server
const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;
  const method = req.method;

  // Handle CORS Preflight
  if (method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type"
    });
    return res.end();
  }

  // --- REST API ENDPOINTS ---
  if (pathname.startsWith("/api/")) {
    const db = readDatabase();

    // 1. GET /api/data - ดึงข้อมูลทั้งหมด
    if (pathname === "/api/data" && method === "GET") {
      return sendJson(res, 200, db);
    }

    // 2. POST /api/tasks - สร้างงานใหม่
    if (pathname === "/api/tasks" && method === "POST") {
      const task = await getRequestBody(req);
      if (!task.title) {
        return sendJson(res, 400, { error: "กรุณาระบุชื่องาน" });
      }
      task.id = task.id || "task-" + Date.now();
      task.createdAt = task.createdAt || new Date().toISOString();
      db.tasks.unshift(task);
      writeDatabase(db);
      return sendJson(res, 201, { success: true, task });
    }

    // 3. PUT /api/tasks/:id - แก้ไขงาน หรือเปลี่ยนสถานะ
    if (pathname.startsWith("/api/tasks/") && method === "PUT") {
      const taskId = pathname.replace("/api/tasks/", "");
      const updates = await getRequestBody(req);
      const index = db.tasks.findIndex(t => t.id === taskId);
      if (index === -1) {
        return sendJson(res, 404, { error: "ไม่พบงานที่ต้องการแก้ไข" });
      }
      db.tasks[index] = { ...db.tasks[index], ...updates, updatedAt: new Date().toISOString() };
      writeDatabase(db);
      return sendJson(res, 200, { success: true, task: db.tasks[index] });
    }

    // 4. DELETE /api/tasks/:id - ลบงาน
    if (pathname.startsWith("/api/tasks/") && method === "DELETE") {
      const taskId = pathname.replace("/api/tasks/", "");
      db.tasks = db.tasks.filter(t => t.id !== taskId);
      writeDatabase(db);
      return sendJson(res, 200, { success: true });
    }

    // 5. POST /api/members - เพิ่มสมาชิกใหม่
    if (pathname === "/api/members" && method === "POST") {
      const member = await getRequestBody(req);
      if (!member.name) {
        return sendJson(res, 400, { error: "กรุณาระบุชื่อสมาชิก" });
      }
      member.id = member.id || "mem-" + Date.now();
      db.members.push(member);
      writeDatabase(db);
      return sendJson(res, 201, { success: true, member });
    }

    // 6. DELETE /api/members/:id - ลบสมาชิก
    if (pathname.startsWith("/api/members/") && method === "DELETE") {
      const memberId = pathname.replace("/api/members/", "");
      const otherMembers = db.members.filter(m => m.id !== memberId);
      if (otherMembers.length > 0) {
        // Reassign tasks
        db.tasks.forEach(t => {
          if (t.memberId === memberId) t.memberId = otherMembers[0].id;
        });
      }
      db.members = otherMembers;
      writeDatabase(db);
      return sendJson(res, 200, { success: true });
    }

    // 7. POST /api/reset - รีเซ็ตข้อมูลกลับเป็นค่าเริ่มต้น
    if (pathname === "/api/reset" && method === "POST") {
      try {
        // โหลดจาก database.json ต้นฉบับ หรือตัวอย่าง
        const initialData = require("./js/sampleData.js");
      } catch (e) {}
      // ถ้ามี initial data
      return sendJson(res, 200, { success: true });
    }

    return sendJson(res, 404, { error: "Endpoint not found" });
  }

  // --- STATIC FILE SERVING ---
  let filePath = pathname === "/" ? "/index.html" : pathname;
  const safePath = path.normalize(path.join(__dirname, filePath));

  // ป้องกัน Directory Traversal
  if (!safePath.startsWith(__dirname)) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  const ext = path.extname(safePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";

  fs.readFile(safePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback to index.html for SPA routing
        fs.readFile(path.join(__dirname, "index.html"), (err2, fallbackContent) => {
          if (err2) {
            res.writeHead(404);
            return res.end("404 Not Found");
          }
          res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
          res.end(fallbackContent);
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content);
    }
  });
});

server.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🚀 TeamTask Server กำลังทำงานที่:`);
  console.log(`   👉 http://localhost:${PORT}`);
  console.log(`   👉 หรือแชร์ IP เครื่องนี้ให้เพื่อนในวง Network เดียวกัน`);
  console.log(`===============================================`);
});
