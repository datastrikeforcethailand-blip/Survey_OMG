"use client";
import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "../../../../components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../../../../components/ui/table";
import { ChevronDown, ChevronRight, X, Star, ClipboardCopy } from "lucide-react";

function getStarByAverage(avg) {
  if (avg >= 25) return 5;
  if (avg >= 23) return 4;
  if (avg >= 20) return 3;
  if (avg >= 15) return 2;
  if (avg >= 1) return 1;
  return 0;
}

const DashboardEmp = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openRow, setOpenRow] = useState({});
  const [openPhoto, setOpenPhoto] = useState({});
  const [imageModal, setImageModal] = useState(null);
  const [copied, setCopied] = useState({});
  const [userRoute, setUserRoute] = useState("-");
  const [routeLoading, setRouteLoading] = useState(false);

  const searchParams = useSearchParams();

  // --- Fetch dashboard summary
  useEffect(() => {
    const user_id = searchParams.get("user_id");
    fetch(`/api/servey/emp/dashboard/summary${user_id ? "?user_id=" + user_id : ""}`)
      .then(async res => {
        if (!res.ok) throw new Error("API error: " + res.status);
        const text = await res.text();
        try {
          return JSON.parse(text);
        } catch {
          return [];
        }
      })
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [searchParams]);

  // --- Fetch user route (สายวิ่ง) robust: เทียบ user_id แบบไม่แคร์คอมม่า/เว้นวรรค
  useEffect(() => {
    const user_id = searchParams.get("user_id");
    if (!user_id) {
      setUserRoute("-");
      return;
    }
    setRouteLoading(true);
    fetch(`/api/servey/get/user?user_id=${user_id}`)
      .then(res => res.json())
      .then(users => {
        let route = "-";
        if (Array.isArray(users) && users.length > 0) {
          const cleanId = (user_id + "").replace(/[^a-zA-Z0-9]/g, "");
          const user = users.find(
            u => ((u.user_id || "") + "").replace(/[^a-zA-Z0-9]/g, "") === cleanId
          );
          if (user && user.route) {
            route = (user.route + "").replace(/,+$/, "").trim();
          }
        }
        setUserRoute(route || "-");
      })
      .catch(() => setUserRoute("-"))
      .finally(() => setRouteLoading(false));
  }, [searchParams]);

  const handleExpand = (zone, dayId) => {
    setOpenRow(prev => ({
      ...prev,
      [zone]: prev[zone] === dayId ? null : dayId
    }));
    setOpenPhoto({});
  };

  const handlePhotoToggle = (storeId) => {
    setOpenPhoto(prev => ({
      ...prev,
      [storeId]: !prev[storeId]
    }));
  };

  const openImgModal = (src) => setImageModal(src);
  const closeImgModal = () => setImageModal(null);

  // --- Summary
  let totalStores = 0;
  let totalDays = 0;
  data.forEach(zone => {
    if (zone.days && Array.isArray(zone.days)) {
      totalDays += zone.days.length;
      zone.days.forEach(day => {
        totalStores += day.totalStores || 0;
      });
    }
  });
  const avgPerDay = totalDays > 0 ? Math.round(totalStores / totalDays) : 0;
  const stars = getStarByAverage(avgPerDay);

  // --- Copy daily summary (ใช้ userRoute เสมอ)
  const handleCopyDaySummary = (zone, day) => {
    const text = [
      `สรุปงานประจำ วันที่ ${day.thaiDate || day.surveyDate}`,
      `สายวิ่ง : "${userRoute}"`,
      `อำเภอ : "${zone._id}"`,
      `รวมร้านที่เข้า  :  ${day.totalStores || 0} ร้าน`,
      ``,
      `สถานะสำรวจ:`,
      `ร้านอนุญาตให้สำรวจ:  ${day.allow || 0} ร้าน`,
      `ร้านไม่อนุญาตให้สำรวจ:  ${day.deny || 0} ร้าน`,
      ``,
      `สถานะสินค้า`,
      `ร้านที่มีขาย FMFR : ${day.fmfr || 0} ร้าน`,
      `(ซื้อจาก ศูนย์ฯ : ${day.marketInfoFMFR || 0} ร้าน)`,
      `(ซื้อจากแหล่งอื่น : ${day.marketInfoOther || 0} ร้าน)`,
      `ร้านที่มีขาย OMEGA : ${day.kids || 0} ร้าน`,
      `ร้านที่เลิกขาย : ${day.stopFMFR || 0} ร้าน`,
      `ร้านที่ไม่เคยขาย : ${day.neverFMFR || 0} ร้าน`,
      ``,
      `ข้อสังเกต`
    ].join("\n");
    navigator.clipboard.writeText(text);
    setCopied(prev => ({
      ...prev,
      [`${zone._id}-${day.surveyDate}`]: true
    }));
    setTimeout(() => {
      setCopied(prev => ({
        ...prev,
        [`${zone._id}-${day.surveyDate}`]: false
      }));
    }, 1500);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[40vh] text-lg">
        กำลังโหลดข้อมูล...
      </div>
    );
  }

  return (
    <Card className="max-w-6xl mx-auto my-8 shadow-lg rounded-2xl">
      <CardContent>
        {/* Performance Summary */}
        <div className="flex flex-col sm:flex-row sm:justify-between items-start sm:items-center border-b pb-2 mb-4 gap-2">
          <div>
            <span className="font-semibold text-lg">Performance Real</span>
            <span className="ml-3 text-slate-600">{totalDays} วัน / {totalStores} ร้าน</span>
            <span className="ml-3 text-sm text-teal-600 bg-teal-100 px-2 py-1 rounded">
              ค่าเฉลี่ย {avgPerDay} ร้าน/วัน
            </span>
            <span className="ml-3 text-base text-amber-600 font-bold">
              สายวิ่ง: {routeLoading ? "กำลังโหลด..." : userRoute}
            </span>
          </div>
          <div className="flex gap-1 items-center">
            {[...Array(5)].map((_, i) =>
              <Star
                key={i}
                size={24}
                className={i < stars ? "text-yellow-400" : "text-gray-300"}
                fill={i < stars ? "#facc15" : "none"}
                strokeWidth={1.5}
              />
            )}
            <span className="ml-2 text-base font-semibold">{stars} ดาว</span>
          </div>
        </div>

        <h2 className="text-2xl font-bold my-4">สรุปข้อมูลสำรวจร้าน (แบ่งตามเขต/วัน)</h2>
        {data.length === 0 && (
          <div className="text-center text-muted-foreground">ไม่พบข้อมูล</div>
        )}

        {/* loop เขต */}
        {data.map((zone) => (
          <div key={zone._id || "no-zone"} className="mb-8">
            <div className="text-lg font-bold bg-slate-200 px-4 py-2 rounded mb-2">
              {zone._id || "ไม่ระบุเขต"}
            </div>
            <div className="overflow-x-auto rounded-xl shadow">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="min-w-[120px]">วันที่</TableHead>
                    <TableHead className="text-center">จำนวนร้าน</TableHead>
                    <TableHead className="text-center">อนุญาต</TableHead>
                    <TableHead className="text-center">ไม่อนุญาต</TableHead>
                    <TableHead className="text-center">FMFR</TableHead>
                    <TableHead className="text-center">Kids</TableHead>
                    <TableHead className="text-center">เลิกขาย</TableHead>
                    <TableHead className="text-center">ไม่เคยขาย</TableHead>
                    <TableHead className="text-center">รายละเอียด</TableHead>
                    <TableHead className="text-center">คัดลอก</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {zone.days.map((day) => (
                    <React.Fragment key={day.surveyDate}>
                      <TableRow>
                        <TableCell>{day.thaiDate || day.surveyDate}</TableCell>
                        <TableCell className="text-center">{day.totalStores}</TableCell>
                        <TableCell className="text-center">{day.allow}</TableCell>
                        <TableCell className="text-center">{day.deny}</TableCell>
                        <TableCell className="text-center">{day.fmfr}</TableCell>
                        <TableCell className="text-center">{day.kids}</TableCell>
                        <TableCell className="text-center">{day.stopFMFR}</TableCell>
                        <TableCell className="text-center">{day.neverFMFR}</TableCell>
                        <TableCell className="text-center">
                          <button
                            className="flex items-center gap-1 text-blue-500 hover:underline text-sm"
                            onClick={() => handleExpand(zone._id, day.surveyDate)}
                          >
                            {openRow[zone._id] === day.surveyDate ? (
                              <>
                                <ChevronDown size={16} />
                                ซ่อนรายละเอียด
                              </>
                            ) : (
                              <>
                                <ChevronRight size={16} />
                                ดูรายละเอียด
                              </>
                            )}
                          </button>
                        </TableCell>
                        <TableCell className="text-center">
                          <button
                            className={
                              copied[`${zone._id}-${day.surveyDate}`]
                                ? "text-green-600 p-1 font-semibold flex items-center gap-1"
                                : "text-teal-600 hover:text-teal-800 p-1 flex items-center gap-1"
                            }
                            title="คัดลอกสรุป"
                            onClick={() => handleCopyDaySummary(zone, day)}
                            disabled={copied[`${zone._id}-${day.surveyDate}`]}
                          >
                            {copied[`${zone._id}-${day.surveyDate}`] ? (
                              <>
                                <ClipboardCopy size={18} className="inline mr-1" />
                                คัดลอกแล้ว
                              </>
                            ) : (
                              <>
                                <ClipboardCopy size={18} className="inline mr-1" />
                                <span className="sr-only">คัดลอก</span>
                              </>
                            )}
                          </button>
                        </TableCell>
                      </TableRow>
                      {openRow[zone._id] === day.surveyDate && (
                        <TableRow>
                          <TableCell colSpan={10} className="bg-gray-50 p-0">
                            <div className="overflow-x-auto p-3">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>เวลา</TableHead>
                                    <TableHead>รหัสสำรวจ</TableHead>
                                    <TableHead>ชื่อร้าน</TableHead>
                                    <TableHead>Permission</TableHead>
                                    <TableHead>FMFR</TableHead>
                                    <TableHead>Kids</TableHead>
                                    <TableHead>รูปภาพ</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {day.stores && day.stores.length > 0 ? (
                                    day.stores.map((store) => {
                                      const photoStore = store.photo_store;
                                      const photoFreezer = store.photo_freezer;
                                      const photoShelf = store.photo_shelf;
                                      const hasPhoto =
                                        (photoStore && photoStore.length > 0) ||
                                        (photoFreezer && photoFreezer.length > 0) ||
                                        (photoShelf && photoShelf.length > 0);
                                      return (
                                        <React.Fragment key={store.surID}>
                                          <TableRow>
                                            <TableCell>{store.onlyTime}</TableCell>
                                            <TableCell>{store.surID}</TableCell>
                                            <TableCell>{store.store_name}</TableCell>
                                            <TableCell>{store.permission}</TableCell>
                                            <TableCell>{store.statusFMFR}</TableCell>
                                            <TableCell>{store.statusOMG}</TableCell>
                                            <TableCell>
                                              {hasPhoto ? (
                                                <button
                                                  onClick={() => handlePhotoToggle(store.surID)}
                                                  className="text-blue-500 hover:underline flex items-center gap-1"
                                                >
                                                  {openPhoto[store.surID] ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                  ดูรูป
                                                </button>
                                              ) : (
                                                <span className="text-gray-300 select-none flex items-center">
                                                  <ChevronRight size={14} /> ไม่มีรูป
                                                </span>
                                              )}
                                            </TableCell>
                                          </TableRow>
                                          {openPhoto[store.surID] && (
                                            <TableRow>
                                              <TableCell colSpan={7}>
                                                <div className="flex flex-wrap gap-6 py-2">
                                                  {/* หน้าร้าน */}
                                                  {photoStore && photoStore.length > 0 && (
                                                    <div>
                                                      <div className="text-xs text-gray-500 mb-1">หน้าร้าน</div>
                                                      {Array.isArray(photoStore)
                                                        ? photoStore.map((src, idx) => (
                                                          <img
                                                            key={idx}
                                                            src={src}
                                                            alt="photo_store"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(src)}
                                                          />
                                                        ))
                                                        : (
                                                          <img
                                                            src={photoStore}
                                                            alt="photo_store"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(photoStore)}
                                                          />
                                                        )}
                                                    </div>
                                                  )}
                                                  {/* ตู้แช่ */}
                                                  {photoFreezer && photoFreezer.length > 0 && (
                                                    <div>
                                                      <div className="text-xs text-gray-500 mb-1">ตู้แช่</div>
                                                      {Array.isArray(photoFreezer)
                                                        ? photoFreezer.map((src, idx) => (
                                                          <img
                                                            key={idx}
                                                            src={src}
                                                            alt="photo_freezer"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(src)}
                                                          />
                                                        ))
                                                        : (
                                                          <img
                                                            src={photoFreezer}
                                                            alt="photo_freezer"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(photoFreezer)}
                                                          />
                                                        )}
                                                    </div>
                                                  )}
                                                  {/* ชั้นวาง */}
                                                  {photoShelf && photoShelf.length > 0 && (
                                                    <div>
                                                      <div className="text-xs text-gray-500 mb-1">ชั้นวาง</div>
                                                      {Array.isArray(photoShelf)
                                                        ? photoShelf.map((src, idx) => (
                                                          <img
                                                            key={idx}
                                                            src={src}
                                                            alt="photo_shelf"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(src)}
                                                          />
                                                        ))
                                                        : (
                                                          <img
                                                            src={photoShelf}
                                                            alt="photo_shelf"
                                                            className="h-24 rounded border mb-2 mr-2 cursor-pointer hover:shadow-lg"
                                                            onClick={() => openImgModal(photoShelf)}
                                                          />
                                                        )}
                                                    </div>
                                                  )}
                                                </div>
                                              </TableCell>
                                            </TableRow>
                                          )}
                                        </React.Fragment>
                                      );
                                    })
                                  ) : (
                                    <TableRow>
                                      <TableCell colSpan={7} className="text-center text-muted-foreground">
                                        ไม่มีข้อมูลร้านในวันดังกล่าว
                                      </TableCell>
                                    </TableRow>
                                  )}
                                </TableBody>
                              </Table>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        ))}

        {/* Modal รูปใหญ่ */}
        {imageModal && (
          <div className="fixed inset-0 bg-black bg-opacity-80 z-50 flex justify-center items-center">
            <div className="relative max-w-full max-h-full">
              <button onClick={closeImgModal} className="absolute top-2 right-2 bg-white/80 p-1 rounded-full shadow">
                <X size={22} />
              </button>
              <img src={imageModal} alt="zoom" className="max-h-[80vh] max-w-[90vw] rounded shadow-lg" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DashboardEmp;
