"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Users, FileBarChart2, PieChart, LogOut, FilePen } from "lucide-react";

const foremostBlue = "#0094E5";
const foremostGreen = "#2ECC71";
const foremostPurple = "#9B59B6";
const foremostDarkBlue = "#2596be";
const logoutRed = "#D32F2F";
const darkText = "#222";

export default function AdminPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f6f8fa] px-4">
      <div className="w-full max-w-[480px] bg-white shadow-2xl rounded-[32px] p-8 flex flex-col items-center gap-6">
        
        {/* โลโก้ (สามารถใส่โลโก้จริงได้) */}
        <img
          src="https://www.foremostthailand.com/wp-content/uploads/2022/03/footer-icon_foremost-e1648914092691.png"
          alt="Foremost Logo"
          className="w-20 h-20 object-contain rounded-full shadow-md mt-1"
          draggable={false}
        />

        {/* ชื่อหัวข้อ */}
        <h1 className="text-lg font-bold text-center tracking-wide" style={{ color: darkText }}>
          หน้าหลัก Admin
        </h1>

        {/* ปุ่มเมนู */}
        <div className="flex flex-col gap-3 w-full">
          <Link
            href="/admin/manage-user"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-semibold text-white shadow-md hover:scale-[1.03] active:scale-100 transition-all duration-150"
            style={{
              backgroundColor: foremostBlue,
              border: `2px solid ${foremostBlue}`,
              letterSpacing: "0.5px",
            }}
          >
            <Users size={22} />
            จัดการผู้ใช้
          </Link>

          <Link
            href="/admin/report"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-semibold text-white shadow-md hover:scale-[1.03] active:scale-100 transition-all duration-150"
            style={{
              backgroundColor: foremostGreen,
              border: `2px solid ${foremostGreen}`,
              letterSpacing: "0.5px",
            }}
          >
            <FileBarChart2 size={22} />
            รายงาน
          </Link>

          <Link
            href="/admin/summary"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-semibold text-white shadow-md hover:scale-[1.03] active:scale-100 transition-all duration-150"
            style={{
              backgroundColor: foremostPurple,
              border: `2px solid ${foremostPurple}`,
              letterSpacing: "0.5px",
            }}
          >
            <PieChart size={22} />
            สรุป
          </Link>

          <Link
            href="/admin/editData"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-semibold text-white shadow-md hover:scale-[1.03] active:scale-100 transition-all duration-150"
            style={{
              backgroundColor: foremostDarkBlue,
              border: `2px solid ${foremostDarkBlue}`,
              letterSpacing: "0.5px",
            }}
          >
            <FilePen size={22} />
            จัดการข้อมูล
          </Link>
        </div>

        {/* ปุ่มออกจากระบบ */}
        <div className="w-full mt-3">
          <Link
            href="/"
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-base font-semibold text-white text-center shadow-md bg-[#D32F2F] hover:scale-[1.03] hover:bg-[#ba2424] active:scale-[0.98] focus-visible:ring-2 focus-visible:ring-[#D32F2F] focus:outline-none transition-all duration-150"
            style={{
              border: `2px solid ${logoutRed}`,
              letterSpacing: "0.5px",
            }}
            onClick={() => {
              localStorage.removeItem("user"); // ✅ Clear session
            }}
          >
            <LogOut size={20} />
            ออกจากระบบ
          </Link>
        </div>
      </div>
    </div>
  );
}
