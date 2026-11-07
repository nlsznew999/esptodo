# ☁️ คู่มือการนำ TeamTask ขึ้น Cloudflare Pages + เชื่อมต่อ Cloudflare D1 Database

ระบบนี้ถูกปรับแต่งให้เป็น **Serverless Fullstack** ที่ทำงานบน Cloudflare 100%:
* 🌐 **Hosting**: Cloudflare Pages (โหลดเร็วระดับ Edge ทั่วโลก)
* ⚡ **Backend API**: Cloudflare Pages Functions (`functions/api/[[route]].js`)
* 🗄️ **Database**: Cloudflare D1 Database (Serverless SQLite ของ Cloudflare ฟรี 5 ล้าน Read / วัน)

---

## 🌟 วิธีทำผ่านหน้าเว็บ Cloudflare Dashboard (ง่ายที่สุด ไม่ต้องลงโปรแกรมใดๆ)

### ขั้นตอนที่ 1: สร้าง Cloudflare D1 Database
1. เข้าสู่ระบบที่ [dash.cloudflare.com](https://dash.cloudflare.com)
2. เมนูด้านซ้าย เลือก **Storage & Databases** ➔ **D1 SQL Database**
3. กดปุ่ม **"Create database"**
4. ตั้งชื่อฐานข้อมูลว่า:
   ```text
   team-todo-db
   ```
5. กด **Create**
*(ระบบจะสร้างฐานข้อมูล D1 ให้เรียบร้อย และมีฟังก์ชัน Auto-Migration ช่วยสร้างตารางให้อัตโนมัติทันทีที่ระบบเชื่อมต่อสำเร็จ)*

---

### ขั้นตอนที่ 2: นำโค้ดขึ้น Cloudflare Pages
คุณสามารถเลือกนำขึ้นได้ 2 ช่องทาง:

#### ช่องทาง A: เชื่อมผ่าน GitHub (แนะนำที่สุด อัปเดตโค้ดอัตโนมัติ)
1. นำไฟล์ทั้งหมดในโฟลเดอร์นี้ขึ้นไปไว้บน **GitHub Repository** ของคุณ
2. ที่หน้า Cloudflare Dashboard ไปที่เมนูด้านซ้าย **Compute (Workers & Pages)**
3. กดปุ่ม **Create** ➔ เลือกแท็บ **Pages** ➔ เลือก **"Connect to Git"**
4. เลือก Repository ที่คุณเพิ่งสร้าง
5. ตั้งค่าการ Build:
   * **Project name**: `team-task-kanban` (หรือชื่อตามต้องการ)
   * **Framework preset**: `None`
   * **Build command**: *(เว้นว่างไว้)*
   * **Build output directory**: `.` *(จุดหนึ่งตัว)*
6. กดปุ่ม **"Save and Deploy"**

#### ช่องทาง B: อัปโหลดโฟลเดอร์โดยตรง (Direct Upload)
1. ที่หน้า Cloudflare Dashboard ➔ **Compute (Workers & Pages)**
2. กดปุ่ม **Create** ➔ เลือกแท็บ **Pages** ➔ เลือก **"Upload assets"**
3. ลากโฟลเดอร์โปรเจกต์นี้ทั้งหมดขึ้นไป แล้วกด **Deploy**

---

### ขั้นตอนที่ 3: ผูก D1 Database เข้ากับ Cloudflare Pages (สำคัญมาก ⭐)
เพื่อให้หน้าเว็บสามารถอ่านและบันทึกข้อมูลลงฐานข้อมูล D1 ได้:

1. เข้าไปที่หน้าโปรเจกต์ Pages ที่คุณเพิ่งสร้างใน Cloudflare Dashboard
2. คลิกแท็บ **Settings** ➔ เมนูด้านซ้ายเลือก **Functions**
3. เลื่อนลงมาที่หัวข้อ **D1 database bindings**
4. กดปุ่ม **"Add binding"**
5. ตั้งค่าดังนี้:
   * **Variable name**: พิมพ์คำว่า `DB` *(ตัวพิมพ์ใหญ่)*
   * **D1 database**: เลือกฐานข้อมูล `team-todo-db` ที่สร้างไว้ในขั้นตอนที่ 1
6. กดปุ่ม **Save**
7. ไปที่แท็บ **Deployments** ➔ คลิกเมนูจุดสามจุด `...` ที่การ Deploy ล่าสุด ➔ เลือก **"Retry deployment"** (เพื่อให้การผูก Database มีผล)

---

## 🎉 สำเร็จเรียบร้อย!

เมื่อเปิดหน้าเว็บผ่าน URL ของ Cloudflare (เช่น `https://team-task-kanban.pages.dev`):
1. ระบบจะเชื่อมต่อกับ Cloudflare D1 อัตโนมัติ
2. ระบบจะสร้างตารางและใส่ข้อมูลเริ่มต้นให้ทันที
3. สัญลักษณ์มุมซ้ายบนจะแสดงสถานะ:
   ```text
   🟢 Online (Server ซิงค์กับทีม)
   ```
4. สามารถส่งลิงก์นี้ให้ทุกคนในทีมเข้ามาเพิ่มงาน แก้ไขงาน และเลื่อน Kanban Board ร่วมกันได้แบบ Real-time ทั่วโลกตลอด 24 ชั่วโมง โดยไม่มีค่าใช้จ่าย!

---

## 🛠️ ทางเลือกเพิ่มเติม: ทำผ่าน Wrangler CLI (สำหรับ Developer)

หากคุณติดตั้ง Node.js และ Wrangler ไว้ในเครื่อง สามารถใช้คำสั่งเหล่านี้ได้โดยตรง:

```bash
# 1. ล็อกอิน Cloudflare
npx wrangler login

# 2. สร้าง D1 Database
npx wrangler d1 create team-todo-db

# 3. รัน Schema และ Seed ข้อมูล
npx wrangler d1 execute team-todo-db --file=./schema.sql
npx wrangler d1 execute team-todo-db --file=./seed.sql

# 4. Deploy ขึ้น Cloudflare Pages
npx wrangler pages deploy . --project-name=team-task-kanban
```
