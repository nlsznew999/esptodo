// ข้อมูลตัวอย่างเริ่มต้น (Initial Demo Data)
const INITIAL_MEMBERS = [
  {
    id: "mem-1",
    name: "กานต์ วรเมธ",
    nickname: "กานต์",
    role: "Project Manager",
    email: "karn.w@team.local",
    color: "#3B82F6", // Blue
    bgColor: "bg-blue-500",
    avatar: "ก"
  },
  {
    id: "mem-2",
    name: "พิมพิศา สุขสันต์",
    nickname: "พิม",
    role: "UI/UX Designer",
    email: "pimpisa.s@team.local",
    color: "#8B5CF6", // Purple
    bgColor: "bg-purple-500",
    avatar: "พ"
  },
  {
    id: "mem-3",
    name: "ธนกฤต มั่นคง",
    nickname: "ตั้ม",
    role: "Frontend Developer",
    email: "tanakrit.m@team.local",
    color: "#10B981", // Emerald
    bgColor: "bg-emerald-500",
    avatar: "ต"
  },
  {
    id: "mem-4",
    name: "วรวิทย์ ยิ่งยง",
    nickname: "วิทย์",
    role: "Backend Developer",
    email: "worawit.y@team.local",
    color: "#F59E0B", // Amber
    bgColor: "bg-amber-500",
    avatar: "ว"
  },
  {
    id: "mem-5",
    name: "ศศิธร สว่างจิตต์",
    nickname: "ศิ",
    role: "QA Engineer",
    email: "sasithorn.s@team.local",
    color: "#F43F5E", // Rose
    bgColor: "bg-rose-500",
    avatar: "ศ"
  }
];

// ฟังก์ชันสร้างวันที่สัมพันธ์กับปัจจุบัน
function getDateOffset(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}

const INITIAL_TASKS = [
  // กานต์ (Project Manager)
  {
    id: "task-101",
    title: "สรุป Scope และ Requirements ประจำสปรินต์",
    description: "รวบรวมฟีดแบ็กจากลูกค้าเพื่อจัดลำดับความสำคัญของฟีเจอร์ในสปรินต์ถัดไป พร้อมวางแผนตารางงานทีม",
    memberId: "mem-1",
    status: "in_progress",
    priority: "high",
    startDate: getDateOffset(-3),
    deadline: getDateOffset(1),
    tag: "Planning",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-102",
    title: "จัดประชุม Sprint Planning ประจำสัปดาห์",
    description: "นัดหมายทีมงานทุกคนเพื่อประเมิน Story Points และมอบหมายงานให้ตรงกับทักษะ",
    memberId: "mem-1",
    status: "todo",
    priority: "medium",
    startDate: getDateOffset(0),
    deadline: getDateOffset(3),
    tag: "Meeting",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-103",
    title: "ส่งรายงานความคืบหน้ารายสัปดาห์ให้ผู้บริหาร",
    description: "สรุปผลการส่งมอบงาน อัตราความสำเร็จ และปัญหาติดขัด (Blockers) ประจำสัปดาห์",
    memberId: "mem-1",
    status: "done",
    priority: "low",
    startDate: getDateOffset(-7),
    deadline: getDateOffset(-1),
    tag: "Report",
    createdAt: new Date().toISOString()
  },

  // พิมพิศา (UI/UX Designer)
  {
    id: "task-201",
    title: "ออกแบบ Design System และ Component Library",
    description: "กำหนดสี, Typography, Buttons, Inputs และการ์ดต่างๆ ใน Figma เพื่อให้ทีม Frontend นำไปใช้พัฒนาได้ตรงกัน",
    memberId: "mem-2",
    status: "in_progress",
    priority: "urgent",
    startDate: getDateOffset(-4),
    deadline: getDateOffset(2),
    tag: "Design",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-202",
    title: "ทำ Wireframe หน้า Kanban Board สำหรับมือถือ",
    description: "ออกแบบ Layout สำหรับการใช้งานหน้า Kanban บนหน้าจอขนาดเล็ก (Mobile Responsive)",
    memberId: "mem-2",
    status: "review",
    priority: "high",
    startDate: getDateOffset(-2),
    deadline: getDateOffset(0), // Today!
    tag: "Design",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-203",
    title: "สัมภาษณ์ User Testing ครั้งที่ 2",
    description: "รวบรวมข้อเสนอแนะจากการทดสอบ Prototype ใช้งานระบบสร้างงานและเปลี่ยนสถานะ",
    memberId: "mem-2",
    status: "todo",
    priority: "medium",
    startDate: getDateOffset(1),
    deadline: getDateOffset(5),
    tag: "Research",
    createdAt: new Date().toISOString()
  },

  // ธนกฤต (Frontend Developer)
  {
    id: "task-301",
    title: "พัฒนาระบบ Drag and Drop สำหรับ Kanban Board",
    description: "เพิ่มฟังก์ชันการลากและวางการ์ดงานข้ามคอลัมน์ และบันทึกสถานะงานลงในฐานข้อมูลทันที",
    memberId: "mem-3",
    status: "in_progress",
    priority: "urgent",
    startDate: getDateOffset(-2),
    deadline: getDateOffset(1),
    tag: "Frontend",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-302",
    title: "แก้บั๊กการแสดงผลสีสถานะ Deadline เกินกำหนด",
    description: "ตรวจสอบ logic การคำนวณวันหมดอายุ และแสดงแท็กสีแดงเมื่อเลยกำหนดส่ง",
    memberId: "mem-3",
    status: "review",
    priority: "high",
    startDate: getDateOffset(-3),
    deadline: getDateOffset(-1), // Overdue!
    tag: "Bug",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-303",
    title: "ปรับแต่ง Dark Mode และ Animation การสลับหน้า",
    description: "ทำให้การสลับระหว่างภาพรวมทีมและบอร์ดส่วนตัวมีความลื่นไหล และรองรับธีมมืด",
    memberId: "mem-3",
    status: "todo",
    priority: "low",
    startDate: getDateOffset(0),
    deadline: getDateOffset(4),
    tag: "Frontend",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-304",
    title: "สร้างหน้าต่าง Modal เพิ่มและแก้ไขข้อมูลงาน",
    description: "ทำฟอร์มกรอกชื่องาน รายละเอียด ผู้รับผิดชอบ วันที่ และกำหนดส่ง พร้อม validation",
    memberId: "mem-3",
    status: "done",
    priority: "high",
    startDate: getDateOffset(-5),
    deadline: getDateOffset(-2),
    tag: "Frontend",
    createdAt: new Date().toISOString()
  },

  // วรวิทย์ (Backend Developer)
  {
    id: "task-401",
    title: "ออกแบบ Schema ฐานข้อมูลสำหรับ Task และ Member",
    description: "กำหนดโครงสร้างข้อมูลความสัมพันธ์ระหว่าง Task, Member, Status, และ Tags ให้รองรับการขยายตัว",
    memberId: "mem-4",
    status: "done",
    priority: "high",
    startDate: getDateOffset(-6),
    deadline: getDateOffset(-3),
    tag: "Backend",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-402",
    title: "พัฒนา RESTful API สำหรับการจัดการ Tasks (CRUD)",
    description: "สร้าง Endpoint: GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id, DELETE /api/tasks/:id",
    memberId: "mem-4",
    status: "in_progress",
    priority: "high",
    startDate: getDateOffset(-2),
    deadline: getDateOffset(2),
    tag: "Backend",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-403",
    title: "ทำฟังก์ชัน Export / Import ข้อมูล JSON",
    description: "รองรับการดาวน์โหลดไฟล์สำรองข้อมูล และการอัปโหลดไฟล์ JSON กลับคืนสู่ระบบ",
    memberId: "mem-4",
    status: "todo",
    priority: "medium",
    startDate: getDateOffset(1),
    deadline: getDateOffset(5),
    tag: "Backend",
    createdAt: new Date().toISOString()
  },

  // ศศิธร (QA Engineer)
  {
    id: "task-501",
    title: "เขียน Test Case สำหรับระบบ Drag & Drop",
    description: "ทดสอบการทำงานข้ามเบราว์เซอร์ (Chrome, Edge, Firefox, Safari) และบนหน้าจอสัมผัส",
    memberId: "mem-5",
    status: "todo",
    priority: "medium",
    startDate: getDateOffset(0),
    deadline: getDateOffset(3),
    tag: "Testing",
    createdAt: new Date().toISOString()
  },
  {
    id: "task-502",
    title: "ทดสอบความปลอดภัยและการ Validate ฟอร์ม",
    description: "ตรวจสอบการกรอกข้อมูลพิเศษ อักขระแปลกปลอม และการป้องกัน XSS ในรายละเอียดงาน",
    memberId: "mem-5",
    status: "in_progress",
    priority: "medium",
    startDate: getDateOffset(-1),
    deadline: getDateOffset(2),
    tag: "Security",
    createdAt: new Date().toISOString()
  }
];
