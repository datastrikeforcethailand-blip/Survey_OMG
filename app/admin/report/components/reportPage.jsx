"use client";
import React from "react";
import { useEffect, useState } from "react";
import { Loader2, ArrowLeft,X } from "lucide-react";
import { useRouter } from "next/navigation";

export default function ReportPage() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(null);
  const [productList, setProductList] = useState([]);
  const [fetchError, setFetchError] = useState("");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(100);
  const [total, setTotal] = useState(0);
  const [activeTab, setActiveTab] = useState("Performance");
  const [expandedDates, setExpandedDates] = useState([]);
  const [expandedUserIds, setExpandedUserIds] = useState([]);

  const router = useRouter();

  // Filter State
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [selectedUser, setSelectedUser] = useState("");
  const [zone, setZone] = useState("");
  const [selectedProvince, setSelectedProvince] = useState("");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [zoneData, setZoneData] = useState([]);
  const [userOptions, setUserOptions] = useState([]);

  // Photo
  const [imageModal, setImageModal] = useState(null);
  const openImgModal = (src) => setImageModal(src);
  const closeImgModal = () => setImageModal(null);

  useEffect(() => {
    setLoading(true);

    const queryParams = new URLSearchParams({});
    if (startDate) queryParams.append("startDate", startDate);
    if (endDate) queryParams.append("endDate", endDate);
    if (selectedUser) queryParams.append("user_id", selectedUser);
    if (zone) queryParams.append("route", zone);
    if (selectedProvince) queryParams.append("province", selectedProvince);
    if (selectedDistrict) queryParams.append("district", selectedDistrict);

    fetch(`/api/servey/report/get-report?${queryParams.toString()}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success) {
          setReports(data.reports);
          setUserOptions(data.users || []); // ดึง users ไปใส่ dropdown
          setTotal(data.reports.length); // จำนวนวัน
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [startDate, endDate, selectedUser, selectedProvince, selectedDistrict, zone]);

  useEffect(() => {
    fetch("/api/servey/report/get-report-province")
      .then(res => res.json())
      .then(data => setZoneData(data))
      .catch(() => setZoneData([]));
  }, []);

  useEffect(() => {
    setFetchError("");
    fetch("/api/servey/get/product")
      .then((res) => {
        if (!res.ok) throw new Error("โหลดข้อมูลสินค้าไม่สำเร็จ");
        return res.json();
      })
      .then((data) => {
        if (data.success && Array.isArray(data.products)) {
          setProductList(data.products);
        } else if (Array.isArray(data)) {
          setProductList(data);
        } else {
          setProductList([]);
        }
      })
      .catch(() => {
        setFetchError("เกิดข้อผิดพลาดในการโหลดสินค้า");
        setProductList([]);
      });
  }, []);

  const uniqueUsers = [...new Set(reports.map((r) => r.user_id).filter(Boolean))];

  const paginatedStats = reports;

  const totalStores = reports.reduce((sum, r) => sum + r.total, 0);
  const totalApproved = reports.reduce((sum, r) => sum + r.approved, 0);
  const avgTotal = reports.length > 0 ? totalStores / reports.length : 0;
  const avgApproved = totalStores > 0 ? totalApproved / totalStores : 0;


  const REASONS = [
    { value: "no_uht", label: "ไม่มีขาย สินค้านม UHT/FMFR" },
    { value: "scam_fear", label: "กลัวเป็นมิจฉาชีพ/สรรพากร" },
    { value: "closing", label: "ร้านเตรียมจะยกเลิกกิจการ" },
    { value: "owner_absent", label: "ไม่สามารถให้ข้อมูลได้ (เจ้าของร้านไม่อยู่)" },
  ];

  const toThaiDate = (dateStr) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("th-TH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
  };

  const toggleDateExpand = (dateId) => {
    setExpandedDates(prev =>
      prev.includes(dateId) ? prev.filter(id => id !== dateId) : [...prev, dateId]
    );
  };

  const toggleExpand = (userId) => {
    setExpandedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const renderDistrictOptions = () => {
    const provinceObj = zoneData.find(p => p.province === selectedProvince);
    if (!provinceObj) return [];

    return provinceObj.districts
      .filter(d => !zone || d.zone === zone)
      .map((d, idx) => (
        <option key={idx} value={d.name}>{d.name}</option>
      ));
  };
  const getUserDisplay = (userId) => {
    if (!userId) return "-";
    const user = userOptions.find((u) => u.user_id === userId);
    if (!user) return userId; // ถ้าไม่เจอใน list ก็โชว์แค่ user_id ไปก่อน
    return `${user.user_id} (${user.full_name || ""})`;
  };

  return (
    <div className="min-h-screen flex flex-col items-center bg-gray-100 p-6">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-6xl p-6">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-xl font-bold">รายงาน Survey</h1>
          {/* <button
            onClick={() => router.push("/admin")}
            className="flex items-center bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
          >
            <ArrowLeft size={18} className="mr-2" /> กลับหน้าหลัก
          </button> */}
        </div>

        <div className="flex justify-between items-center mb-4">
          <select
            value={limit}
            onChange={(e) => {
              setLimit(Number(e.target.value));
              setPage(1);
            }}
            className="border p-2 rounded-lg"
          >
            {[25, 50, 75, 100].map((n) => (
              <option key={n} value={n}>{n} รายการ / หน้า</option>
            ))}
          </select>

          <div className="space-x-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >◀</button>
            <span>หน้า {page} / {Math.ceil(total / limit)}</span>
            <button
              disabled={page * limit >= total}
              onClick={() => setPage(page + 1)}
              className="px-3 py-1 rounded bg-gray-200 hover:bg-gray-300 disabled:opacity-50"
            >▶</button>
          </div>
        </div>

        {/* Filter Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-gray-50 p-4 rounded-lg mb-4">
          <div>
            <label className="block text-sm mb-1">วันที่เริ่ม</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border rounded-lg p-2 w-full" />
          </div>
          <div>
            <label className="block text-sm mb-1">วันที่สิ้นสุด</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border rounded-lg p-2 w-full" />
          </div>
          <div>
            <label className="block text-sm mb-1">พนักงาน</label>
            <select value={selectedUser} onChange={(e) => setSelectedUser(e.target.value)} className="border rounded-lg p-2 w-full">
              <option value="">-- ทั้งหมด --</option>
              {userOptions.map((u, idx) => (
                <option key={idx} value={u.user_id}>
                   {u.user_id} ({u.full_name})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">จังหวัด</label>
            <select
              value={selectedProvince}
              onChange={(e) => {
                setSelectedProvince(e.target.value);
                setSelectedDistrict("");
              }}
              className="border rounded-lg p-2 w-full"
            >
              <option value="">-- ทั้งหมด --</option>
              {Array.from(new Set(zoneData.map(p => p.province)))
                .filter(Boolean)
                .sort()
                .map((province, index) => (
                  <option key={`${province}-${index}`} value={province}>{province}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">โซน</label>
            <select
              value={zone}
              onChange={(e) => setZone(e.target.value)}
              className="border rounded-lg p-2 w-full"
            >
              <option value="">-- ทั้งหมด --</option>
              {(() => {
                const provinceObj = zoneData.find(p => p.province === selectedProvince);
                const zones = provinceObj ? [...new Set(provinceObj.districts.map(d => d.zone))] : [];
                return zones.map((z, idx) => <option key={idx} value={z}>{z}</option>);
              })()}
            </select>
          </div>

          <div>
            <label className="block text-sm mb-1">อำเภอ</label>
            <select
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
              className="border rounded-lg p-2 w-full"
            >
              <option value="">-- ทั้งหมด --</option>
              {renderDistrictOptions()}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={() => {
                setStartDate("");
                setEndDate("");
                setSelectedUser("");
                setZone("");
                setSelectedProvince("");
                setSelectedDistrict("");
                setPage(1);
              }}
              className="bg-gray-300 hover:bg-gray-400 text-black px-4 py-2 rounded-lg w-full"
            >ล้างตัวกรอง</button>
          </div>
        </div>

        {/* Summary Table */}
        {loading ? (
          <div className="flex justify-center items-center py-10">
            <Loader2 className="animate-spin mr-2" size={24} /> กำลังโหลดข้อมูล...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <div className="mb-4 font-semibold text-sm">
              ค่าเฉลี่ยร้านที่สำรวจ: {avgTotal.toFixed(0)} ร้าน | อนุญาต: {(avgApproved * 100).toFixed(0)}%
            </div>
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-2 border">วันที่</th>
                  <th className="p-2 border">จำนวนร้าน</th>
                  <th className="p-2 border">อนุญาต</th>
                  <th className="p-2 border">ไม่อนุญาต</th>
                  <th className="p-2 border">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStats.map((d) => (
                  <React.Fragment key={d._id}>
                    <tr className="hover:bg-gray-50">
                      <td className="p-2 border">{new Date(d._id).toLocaleDateString("th-TH")}</td>
                      <td className="p-2 border">{d.total}</td>
                      <td className="p-2 border">{d.approved}</td>
                      <td className="p-2 border">{d.notApproved}</td>
                      <td className="p-2 border text-center space-x-1">
                        <button
                          onClick={() => setSelectedDate({ ...d, date: toThaiDate(d._id) })}
                          className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
                        >
                          ดูรายละเอียด
                        </button>
                        <button
                          onClick={() => toggleDateExpand(d._id)}
                          className="bg-gray-300 hover:bg-gray-400 text-black px-2 py-1 rounded"
                        >
                          {expandedDates.includes(d._id) ? "ซ่อนรายพนักงาน" : "ดูรายพนักงาน"}
                        </button>
                      </td>
                    </tr>

                    {expandedDates.includes(d._id) && d.userSummary?.length > 0 && (
                      <tr className="bg-gray-50">
                        <td colSpan={5} className="p-2 border">
                          <table className="w-full border mt-2 text-sm">
                            <thead className="bg-gray-100">
                              <tr>
                                <th className="border p-1">พนักงาน</th>
                                <th className="border p-1">จำนวนร้าน</th>
                                <th className="border p-1">อนุญาต</th>
                                <th className="border p-1">ไม่อนุญาต</th>
                                 <th className="border p-1">จัดการ</th>
                              </tr>
                            </thead>
                            <tbody>
                              {d.userSummary.map((u, idx) => (
                              <tr key={idx}>
                                <td className="border p-1">{getUserDisplay(u.user_id)}</td>
                                <td className="border p-1 text-center">{u.count}</td>
                                <td className="border p-1 text-center">{u.approved}</td>
                                <td className="border p-1 text-center">{u.notApproved}</td>
                                <td className="border p-1 text-center">
                                  <button
                                    className="bg-blue-400 hover:bg-blue-500 text-white px-2 py-1 text-sm rounded"
                                    onClick={() =>
                                      setSelectedDate({
                                        date: toThaiDate(d._id),
                                        items: d.items.filter((i) => i.user_id === u.user_id),
                                      })
                                    }
                                  >
                                    ดูรายละเอียด
                                  </button>
                                </td>
                              </tr>
                            ))}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">ร้านที่บันทึกวันที่ {selectedDate.date}</h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="bg-gray-400 hover:bg-gray-500 text-white px-4 py-2 rounded-lg"
              >
                ปิด
              </button>
            </div>
            <table className="w-full border border-gray-200 text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="border p-2">ลำดับ</th>
                  <th className="border p-2">รหัสร้าน</th>
                  <th className="border p-2">ชื่อร้าน</th>
                  <th className="border p-2">บ้านเลขที่</th>
                  <th className="border p-2">ขออนุญาตสำรวจร้าน</th>
                  <th className="border p-2">ลักษณะร้าน</th>
                  <th className="border p-2">ประเภทร้าน</th>
                  <th className="border p-2">รูปหน้าร้าน</th>
                  <th className="border p-2">รูปตู้แช่</th>
                  <th className="border p-2">รูปชั้นวาง</th>
                  <th className="border p-2">สถานะ FMFR</th>
                  <th className="border p-2">สถานะ OMG</th>
                  <th className="border p-2">ที่มาของสินค้า</th>
                  <th className="border p-2">สาเหตุที่ไม่อนุญาต</th>
                  
                </tr>
              </thead>
              <tbody>
                {selectedDate.items.map((r, i) => (
                  <tr key={r._id} className="hover:bg-gray-50">
                    <td className="border p-2 text-center">{i + 1}</td>
                    <td className="border p-2">{r.surID || "-"}</td>
                    <td className="border p-2">{r.store_info?.store_name || "-"}</td>
                    <td className="border p-2">{r.store_info?.store_number_address || "-"}</td>
                    <td className="border p-2">{r.store_info?.permission || "-"}</td>
                    <td className="border p-2">{r.store_info?.shop_size || "-"}</td>
                    <td className="border p-2">{r.store_info?.special_type || "-"}</td>
                    <td className="border p-2">
                      {r.store_info?.photo_store ? (
                        <img
                          src={r.store_info.photo_store}
                          alt="store"
                          className="h-16 rounded border cursor-pointer hover:shadow-lg"
                          onClick={() => openImgModal(r.store_info.photo_store)}
                        />
                      ) : "-"}</td>
                    <td className="border p-2">
                      {r.store_info?.photo_freezer ? (
                        <img
                          src={r.store_info.photo_freezer}
                          alt="freezer"
                          className="h-16 rounded border cursor-pointer hover:shadow-lg"
                          onClick={() => openImgModal(r.store_info.photo_freezer)}
                        />
                      ) : "-"}</td>
                    <td className="border p-2">
                      {r.store_info?.photo_shelf ? (
                        <img
                          src={r.store_info.photo_shelf}
                          alt="shelf"
                          className="h-16 rounded border cursor-pointer hover:shadow-lg"
                          onClick={() => openImgModal(r.store_info.photo_shelf)}
                        />
                      ) : "-"}
                    </td>
                    <td className="border p-2">{r.statusFMFR || "-"}</td>
                    <td className="border p-2">{r.statusOMG || "-"}</td>
                    <td className="border p-2">{r.market_info?.reason || "-"}</td>
                    <td className="border p-2">
                      {REASONS.find(rsn => rsn.value === r.store_info?.permission_reason)?.label || "-"}
                    </td>

                  </tr>
                ))}
              </tbody>
            </table>
              {imageModal && (
                <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center">
                  <div className="relative max-w-full max-h-full">
                    <button onClick={closeImgModal} className="absolute top-2 right-2 bg-white/80 p-1 rounded-full shadow">
                      <X size={22} />
                    </button>
                    <img
                      src={imageModal}
                      alt="zoom"
                      className="max-h-[80vh] max-w-[90vw] rounded shadow-lg"
                    />
                  </div>
                </div>
              )}
          </div>
        </div>
      )}
    </div>
  );
}
