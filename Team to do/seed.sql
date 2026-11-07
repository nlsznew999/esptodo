-- ข้อมูลเริ่มต้นสำหรับ Cloudflare D1 Database

INSERT INTO members (id, name, nickname, role, email, color, avatar) VALUES
('mem-1', 'กานต์ วรเมธ', 'กานต์', 'Project Manager', 'karn.w@team.local', '#3B82F6', 'ก'),
('mem-2', 'พิมพิศา สุขสันต์', 'พิม', 'UI/UX Designer', 'pimpisa.s@team.local', '#8B5CF6', 'พ'),
('mem-3', 'ธนกฤต มั่นคง', 'ตั้ม', 'Frontend Developer', 'tanakrit.m@team.local', '#10B981', 'ต'),
('mem-4', 'วรวิทย์ ยิ่งยง', 'วิทย์', 'Backend Developer', 'worawit.y@team.local', '#F59E0B', 'ว'),
('mem-5', 'ศศิธร สว่างจิตต์', 'ศิ', 'QA Engineer', 'sasithorn.s@team.local', '#F43F5E', 'ศ');

INSERT INTO tasks (id, title, description, member_id, status, priority, start_date, deadline, tag) VALUES
('task-101', 'สรุป Scope และ Requirements ประจำสปรินต์', 'รวบรวมฟีดแบ็กจากลูกค้าเพื่อจัดลำดับความสำคัญของฟีเจอร์ในสปรินต์ถัดไป พร้อมวางแผนตารางงานทีม', 'mem-1', 'in_progress', 'high', '2026-11-04', '2026-11-08', 'Planning'),
('task-102', 'จัดประชุม Sprint Planning ประจำสัปดาห์', 'นัดหมายทีมงานทุกคนเพื่อประเมิน Story Points และมอบหมายงานให้ตรงกับทักษะ', 'mem-1', 'todo', 'medium', '2026-11-07', '2026-11-10', 'Meeting'),
('task-103', 'ส่งรายงานความคืบหน้ารายสัปดาห์ให้ผู้บริหาร', 'สรุปผลการส่งมอบงาน อัตราความสำเร็จ และปัญหาติดขัด (Blockers) ประจำสัปดาห์', 'mem-1', 'done', 'low', '2026-10-31', '2026-11-06', 'Report'),
('task-201', 'ออกแบบ Design System และ Component Library', 'กำหนดสี, Typography, Buttons, Inputs และการ์ดต่างๆ ใน Figma เพื่อให้ทีม Frontend นำไปใช้พัฒนาได้ตรงกัน', 'mem-2', 'in_progress', 'urgent', '2026-11-03', '2026-11-09', 'Design'),
('task-202', 'ทำ Wireframe หน้า Kanban Board สำหรับมือถือ', 'ออกแบบ Layout สำหรับการใช้งานหน้า Kanban บนหน้าจอขนาดเล็ก (Mobile Responsive)', 'mem-2', 'review', 'high', '2026-11-05', '2026-11-07', 'Design'),
('task-203', 'สัมภาษณ์ User Testing ครั้งที่ 2', 'รวบรวมข้อเสนอแนะจากการทดสอบ Prototype ใช้งานระบบสร้างงานและเปลี่ยนสถานะ', 'mem-2', 'todo', 'medium', '2026-11-08', '2026-11-12', 'Research'),
('task-301', 'พัฒนาระบบ Drag and Drop สำหรับ Kanban Board', 'เพิ่มฟังก์ชันการลากและวางการ์ดงานข้ามคอลัมน์ และบันทึกสถานะงานลงในฐานข้อมูลทันที', 'mem-3', 'in_progress', 'urgent', '2026-11-05', '2026-11-08', 'Frontend'),
('task-302', 'แก้บั๊กการแสดงผลสีสถานะ Deadline เกินกำหนด', 'ตรวจสอบ logic การคำนวณวันหมดอายุ และแสดงแท็กสีแดงเมื่อเลยกำหนดส่ง', 'mem-3', 'review', 'high', '2026-11-04', '2026-11-06', 'Bug'),
('task-303', 'ปรับแต่ง Dark Mode และ Animation การสลับหน้า', 'ทำให้การสลับระหว่างภาพรวมทีมและบอร์ดส่วนตัวมีความลื่นไหล และรองรับธีมมืด', 'mem-3', 'todo', 'low', '2026-11-07', '2026-11-11', 'Frontend'),
('task-304', 'สร้างหน้าต่าง Modal เพิ่มและแก้ไขข้อมูลงาน', 'ทำฟอร์มกรอกชื่องาน รายละเอียด ผู้รับผิดชอบ วันที่ และกำหนดส่ง พร้อม validation', 'mem-3', 'done', 'high', '2026-11-02', '2026-11-05', 'Frontend'),
('task-401', 'ออกแบบ Schema ฐานข้อมูลสำหรับ Task และ Member', 'กำหนดโครงสร้างข้อมูลความสัมพันธ์ระหว่าง Task, Member, Status, และ Tags ให้รองรับการขยายตัว', 'mem-4', 'done', 'high', '2026-11-01', '2026-11-04', 'Backend'),
('task-402', 'พัฒนา RESTful API สำหรับการจัดการ Tasks (CRUD)', 'สร้าง Endpoint: GET /api/tasks, POST /api/tasks, PUT /api/tasks/:id, DELETE /api/tasks/:id', 'mem-4', 'in_progress', 'high', '2026-11-05', '2026-11-09', 'Backend'),
('task-403', 'ทำฟังก์ชัน Export / Import ข้อมูล JSON', 'รองรับการดาวน์โหลดไฟล์สำรองข้อมูล และการอัปโหลดไฟล์ JSON กลับคืนสู่ระบบ', 'mem-4', 'todo', 'medium', '2026-11-08', '2026-11-12', 'Backend'),
('task-501', 'เขียน Test Case สำหรับระบบ Drag & Drop', 'ทดสอบการทำงานข้ามเบราว์เซอร์ (Chrome, Edge, Firefox, Safari) และบนหน้าจอสัมผัส', 'mem-5', 'todo', 'medium', '2026-11-07', '2026-11-10', 'Testing'),
('task-502', 'ทดสอบความปลอดภัยและการ Validate ฟอร์ม', 'ตรวจสอบการกรอกข้อมูลพิเศษ อักขระแปลกปลอม และการป้องกัน XSS ในรายละเอียดงาน', 'mem-5', 'in_progress', 'medium', '2026-11-06', '2026-11-09', 'Security');
