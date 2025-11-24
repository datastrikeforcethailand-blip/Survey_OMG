"use client";
import { useState, useEffect } from "react";
import { Pencil, X } from "lucide-react";

export default function EditUser({ onClose }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [routes, setRoutes] = useState([]);

  const [selectedUser, setSelectedUser] = useState(null);

  // โหลดรายชื่อผู้ใช้
  const fetchUsers = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/servey/editUser/get-user");
      const data = await res.json();
      if (data.success) {
        setUsers(data.users);
      }
    } catch (err) {
      console.error("Error fetching users:", err);
    } finally {
      setLoading(false);
    }
  };

  // โหลด route เมื่อเปิดฟอร์มแก้ไข
  useEffect(() => {
    if (selectedUser?.role === "member") {
      fetch("/api/servey/get/routes")
        .then((res) => res.json())
        .then((data) => {
          if (data.success) setRoutes(data.routes);
        })
        .catch((err) => console.error(err));
    }
  }, [selectedUser?.role]);

  useEffect(() => {
    fetchUsers();
  }, []);

  // แก้ไขผู้ใช้
  const handleUpdate = async () => {
    if (!selectedUser) return;

    const { user_id, user_first_name, user_last_name, role, route } =
      selectedUser;

    if (!user_id || !user_first_name || !user_last_name) {
      alert("กรุณากรอกข้อมูลให้ครบ");
      return;
    }
    if (role === "member" && !route) {
      alert("กรุณาเลือกโซนสำหรับ Member");
      return;
    }

    setIsUpdating(true);
    try {
      const res = await fetch("/api/servey/editUser/update-user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedUser),
      });

      const result = await res.json();
      if (!result.success) {
        alert(result.message);
      } else {
        alert("✅ อัปเดตข้อมูลสำเร็จ");
        setSelectedUser(null); // ปิด popup
        fetchUsers();          // โหลดรายชื่อใหม่
      }
    } catch (error) {
      console.error("Update error:", error);
      alert("เกิดข้อผิดพลาด");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto">
      {/* ปุ่มปิดหน้าแก้ไขผู้ใช้ (ตัวใหญ่) */}
      <button
        onClick={onClose}
        className="mb-4 bg-gray-400 text-white px-4 py-2 rounded hover:bg-gray-500"
      >
        ปิด
      </button>

      {/* ตารางผู้ใช้ */}
      <div className="border border-gray-300 rounded-xl overflow-hidden w-full">
        <div className="max-h-[60vh] overflow-y-auto w-full max-w-full">
          {loading ? (
            <p className="text-center py-4">กำลังโหลด...</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
                <tr>
                  <th className="p-2 border">Username</th>
                  <th className="p-2 border">ชื่อ-นามสกุล</th>
                  <th className="p-2 border">Role</th>
                  <th className="p-2 border">Route</th>
                  <th className="p-2 border">Action</th>
                </tr>
              </thead>
              <tbody>
                {users.length > 0 ? (
                  users.map((u) => (
                    <tr key={u._id} className="hover:bg-gray-50">
                      <td className="p-2 border">{u.user_id}</td>
                      <td className="p-2 border">
                        {u.user_first_name} {u.user_last_name}
                      </td>
                      <td className="p-2 border">{u.role}</td>
                      <td className="p-2 border">{u.route || "-"}</td>
                      <td className="p-2 border">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => setSelectedUser(u)}
                            className="bg-yellow-500 hover:bg-yellow-600 text-white px-3 py-1 rounded-lg text-sm flex items-center gap-1"
                          >
                            <Pencil size={16} /> แก้ไข
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center p-3 text-gray-500">
                      ไม่มีข้อมูลผู้ใช้
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ================== POPUP แก้ไขผู้ใช้ ================== */}
      {selectedUser && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
          onClick={() => setSelectedUser(null)} // คลิกพื้นดำเพื่อปิด
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-5 relative"
            onClick={(e) => e.stopPropagation()} // กัน event ทะลุไปปิด popup
          >
            {/* header popup */}
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg font-bold">แก้ไขผู้ใช้</h3>
              <button
                onClick={() => setSelectedUser(null)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* ฟอร์ม */}
            <div className="space-y-2">
              <input
                type="text"
                name="user_id"
                placeholder="Username"
                className="w-full border rounded-lg p-2"
                value={selectedUser.user_id}
                disabled
              />
              <input
                type="text"
                name="user_first_name"
                placeholder="ชื่อ"
                className="w-full border rounded-lg p-2"
                value={selectedUser.user_first_name}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    user_first_name: e.target.value,
                  })
                }
              />
              <input
                type="text"
                name="user_last_name"
                placeholder="นามสกุล"
                className="w-full border rounded-lg p-2"
                value={selectedUser.user_last_name}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    user_last_name: e.target.value,
                  })
                }
              />
              <input
                type="text"
                name="user_tel"
                placeholder="เบอร์โทร"
                className="w-full border rounded-lg p-2"
                value={selectedUser.user_tel}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    user_tel: e.target.value,
                  })
                }
              />
              <select
                className="w-full border rounded-lg p-2"
                value={selectedUser.role}
                onChange={(e) =>
                  setSelectedUser({
                    ...selectedUser,
                    role: e.target.value,
                  })
                }
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>

              {selectedUser.role === "member" && (
                <select
                  className="w-full border rounded-lg p-2"
                  value={selectedUser.route || ""}
                  onChange={(e) =>
                    setSelectedUser({
                      ...selectedUser,
                      route: e.target.value,
                    })
                  }
                >
                  <option value="">-- เลือก Route --</option>
                  {routes.map((r, i) => (
                    <option key={i} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* ปุ่มด้านล่าง */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={() => setSelectedUser(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg hover:bg-gray-50"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleUpdate}
                className={`flex-1 text-white py-2 rounded-lg ${
                  isUpdating
                    ? "bg-yellow-300"
                    : "bg-yellow-500 hover:bg-yellow-600"
                }`}
                disabled={isUpdating}
              >
                {isUpdating ? "กำลังอัปเดต..." : "อัปเดตข้อมูล"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
