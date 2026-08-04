"use client";

import { useState } from "react";
import { Database, FilePenLine, Trash2, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import DeleteData from "./components/deleteData";
import UpdateData from "./components/updateData";

export default function EditDataPage() {
  const [activeTab, setActiveTab] = useState("delete");
  const router = useRouter();

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-slate-900 p-3 text-white">
              <Database className="h-6 w-6" />
            </div>

            <div>
              <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                จัดการข้อมูล Survey
              </h1>

              <p className="mt-1 text-sm text-slate-500">
                ลบและอัปเดตข้อมูล MongoDB โดยอ้างอิงรหัส surID
              </p>
            </div>

            {/* กลับเมนูหลัก */}
            <button
              onClick={() => router.push("/admin")}
              className="ml-95 flex-shrink-0 flex items-center bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200 rounded-lg px-4 py-2 font-medium transition shadow-sm focus-visible:ring focus-visible:ring-blue-200"
            >
              <ArrowLeft size={18} className="mr-2" />
              กลับเมนูหลัก
            </button>
          </div>
        </header>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex border-b border-slate-200 bg-slate-50 p-2">
            <button
              type="button"
              onClick={() => setActiveTab("delete")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                activeTab === "delete"
                  ? "bg-white text-red-600 shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              <Trash2 className="h-4 w-4" />
              ลบข้อมูล
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("update")}
              className={`flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition ${
                activeTab === "update"
                  ? "bg-white text-blue-600 shadow-sm"
                  : "text-slate-500 hover:bg-white hover:text-slate-800"
              }`}
            >
              <FilePenLine className="h-4 w-4" />
              อัปเดตด้วย CSV
            </button>
          </div>

          <div className="p-5 sm:p-7">
            {activeTab === "delete" && <DeleteData />}
            {activeTab === "update" && <UpdateData />}
          </div>
        </div>
      </div>
    </main>
  );
}