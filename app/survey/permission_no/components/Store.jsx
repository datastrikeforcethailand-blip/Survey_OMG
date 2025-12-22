"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, X } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";

const SHOP_SIZE_OPTIONS = [
  { value: "A", label: "A", desc: "ร้าน 1 คูหา หรือร้านของชำ", images: ["/images/shopA/shopA-1.jpg"] }, 
  { value: "B", label: "B", desc: "ร้าน 2 คูหา ขึ้นไป หรือ มินิมาร์ท", images: ["https://img5.pic.in.th/file/secure-sv1/Screenshot-2024-08-26-110315.png"] }, 
  { value: "C", label: "C", desc: "ซุปเปอร์มาร์เก็ต (ขายทั้งปลีกและส่ง)", images: ["https://img5.pic.in.th/file/secure-sv1/Screenshot-2024-08-26-110652.png"] }, 
  { value: "D", label: "D", desc: "ร้านยี่ปั้ว/ค้าส่ง", images: ["/images/shopD/shopD-1.jpg"] }, 
  { value: "E", label: "E", desc: "ร้านขายสินค้าเด็กโดยเฉพาะ", images: ["https://img5.pic.in.th/file/secure-sv1/Screenshot-2024-08-26-110947.png"] }, 
  { value: "F", label: "F", desc: "ร้านขายยา", images: ["/images/shopF/shopF-1.jpg"] }
];

const SPECIAL_TYPE = [
  { value: "ธงฟ้า", label: "ร้านธงฟ้า" },
  { value: "ติดดาว", label: "ร้านติดดาว" },
  { value: "โชคชัย", label: "ร้านโชคชัย" },
  { value: "ถูกดี", label: "ร้านถูกดี" },
];

const REASONS = [
  { value: "no_uht", label: "ไม่มีขาย สินค้านม UHT/FMFR" },
  { value: "scam_fear", label: "กลัวเป็นมิจฉาชีพ/สรรพากร" },
  { value: "closing", label: "ร้านเตรียมจะยกเลิกกิจการ" },
  { value: "owner_absent", label: "ไม่สามารถให้ข้อมูลได้ (เจ้าของร้านไม่อยู่)" },
];

export default function StepStoreNoPermission({ data = {}, onSave }) {
  const searchParams = useSearchParams();
  const userIdFromQuery = searchParams.get("user_id");

  const [storeInfo, setStoreInfo] = useState({
    ...data,
    user_id: userIdFromQuery || data.user_id || "",
    permission: "ไม่อนุญาต",
    permission_reason: "",
    shop_size: "",
    special_type: [],
    store_freezer: data.store_freezer || "",
    store_shelf: data.store_shelf || "",
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const [userRoute, setUserRoute] = useState("");
  const fileInputRef = useRef();

  // --- สินค้า ---
  const [products, setProducts] = useState([]);
  const [productData, setProductData] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");

  // ดึงข้อมูลสินค้า
  useEffect(() => {
    setLoading(true);
    setFetchError("");
    fetch("/api/servey/get/product")
      .then((res) => {
        if (!res.ok) throw new Error("โหลดข้อมูลสินค้าไม่สำเร็จ");
        return res.json();
      })
      .then((data) => {
        const allowIds = ["PRO-25004", "PRO-25007", "PRO-25008"];
        const filtered = (Array.isArray(data) ? data : []).filter(
          (p) => allowIds.includes(p.fmProID)
        );
        setProducts(filtered);
        const initialStatus = {};
        filtered.forEach((p) => {
          initialStatus[p.fmProID] = {
            status: "ไม่พบ",
            priceBox: "",
            pricePack: "",
            priceCarton: "",
          };
        });
        setProductData(initialStatus);
      })
      .catch(() => {
        setFetchError("เกิดข้อผิดพลาดในการโหลดสินค้า");
        setProducts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  // Toggle สถานะ "มีขาย"/"ไม่พบ"
  const toggleStatus = (productId) => {
    setProductData((prev) => {
      const currentStatus = prev[productId]?.status;
      if (currentStatus === "มีขาย") {
        return {
          ...prev,
          [productId]: {
            ...prev[productId],
            status: "ไม่พบ",
            priceBox: "",
            pricePack: "",
            priceCarton: "",
          },
        };
      }
      return {
        ...prev,
        [productId]: {
          ...prev[productId],
          status: "มีขาย",
        },
      };
    });
  };

  // ใส่ราคาสินค้า (เฉพาะ FMFR ที่มีขาย)
  const handlePriceChange = (productId, key, value) => {
    setProductData((prev) => ({
      ...prev,
      [productId]: {
        ...prev[productId],
        [key]: value !== "" ? Number(value) : "",
      },
    }));
  };

  // โหลด user เอา route มา filter จังหวัด
  useEffect(() => {
    if (!userIdFromQuery) return;
    fetch(`/api/servey/get/user?user_id=${userIdFromQuery}`)
      .then((res) => res.json())
      .then((user) => {
        const found = Array.isArray(user)
          ? user.find((u) => u.user_id === userIdFromQuery)
          : user;
        if (found?.route) setUserRoute(String(found.route).replace(",", ""));
      });
  }, [userIdFromQuery]);

  useEffect(() => {
    setStoreInfo((prev) => ({
      ...prev,
      ...data,
      user_id: userIdFromQuery || data.user_id || "",
      permission: "ไม่อนุญาต",
    }));
  }, [JSON.stringify(data), userIdFromQuery]);

  // อัพโหลดรูป
  const handleImage = useCallback((e) => {
    const file = e.target.files[0];
    setPhotoError("");
    if (!file) return;
    if (!["image/jpeg", "image/jpg"].includes(file.type)) {
      setPhotoError("ไฟล์ต้องเป็น JPEG เท่านั้น");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setPhotoError("ขนาดไฟล์รูปต้องไม่เกิน 10MB");
      return;
    }
    setStoreInfo((prev) => ({ ...prev, photo_store: file }));
    setTimeout(() => handleDetectLocation(), 200);
  }, []);

  const handleRemoveImage = useCallback(() => {
    setStoreInfo((prev) => ({ ...prev, photo_store: null }));
    setTimeout(() => fileInputRef.current?.click(), 150);
  }, []);

  // ดึง GPS
  const handleDetectLocation = useCallback(() => {
    setGeoError("");
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoLoading(false);
      setGeoError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStoreInfo((prev) => ({ ...prev, lat: latitude, lng: longitude }));
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=th`
          );
          const data = await res.json();
          setStoreInfo((prev) => ({
            ...prev,
            location_address: data.display_name || ""
          }));
        } catch {
          setGeoError("ดึงที่อยู่ไม่สำเร็จ ลองใหม่อีกครั้ง");
        }
        setGeoLoading(false);
      },
      () => {
        setGeoLoading(false);
        setGeoError("ไม่สามารถเข้าถึงตำแหน่งได้ กรุณาอนุญาตหรือเปิด GPS แล้วลองใหม่");
      },
      { enableHighAccuracy: true }
    );
  }, []);

  useEffect(() => {
    if (!storeInfo.lat || !storeInfo.lng) handleDetectLocation();
  }, []);

  // ประเภทร้านพิเศษ
  const handleSpecialType = (e) => {
    const { value, checked } = e.target;
    let selected = storeInfo.special_type || [];
    selected = checked ? [...selected, value] : selected.filter((item) => item !== value);
    setStoreInfo((prev) => ({ ...prev, special_type: selected }));
  };

  const handleSelectFreezer = (opt) => {
    setStoreInfo((prev) => ({ ...prev, store_freezer: opt }));
  };
  const handleSelectShelf = (opt) => {
    setStoreInfo((prev) => ({ ...prev, store_shelf: opt }));
  };


  const isSaveDisabled =
    geoLoading ||
    !storeInfo.store_name ||
    !storeInfo.store_province ||
    !storeInfo.store_district ||
    !storeInfo.store_subdistrict ||
    !storeInfo.photo_store ||
    !storeInfo.permission_reason ||
    !storeInfo.store_freezer ||
    !storeInfo.store_shelf;

  // ------- สำคัญ!!  map products แบบไม่แนบ _id, แนบ product_id/fmProID -------
  const handleSave = () => {
    if (!isSaveDisabled && typeof onSave === "function") {
      const cleanData = {
        ...storeInfo,
        location: {
          lat: storeInfo.lat || null,
          lng: storeInfo.lng || null,
          address: storeInfo.location_address || "",
        },
        products: Object.entries(productData).map(([fmProID, detail]) => {
          const { _id, ...rest } = detail;
          return {
            product_id: fmProID,   // ถ้า backend อยากได้ชื่อ fmProID ก็เปลี่ยนเป็น fmProID: fmProID
            ...rest,
          };
        }),
      };
      delete cleanData.lat;
      delete cleanData.lng;
      delete cleanData.location_address;
      onSave(cleanData);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5fafd]">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSave();
        }}
        className="w-full max-w-md bg-white shadow-xl rounded-3xl px-5 py-8 flex flex-col gap-5"
      >
        <div className="text-center mb-3">
          <h2 className="font-extrabold text-2xl text-[#0094E5]">ข้อมูลร้านค้า (ไม่อนุญาต)</h2>
        </div>

        <FormUpload
          label={storeInfo.photo_store ? "รูปร้านค้า" : "ถ่ายรูปร้านค้า"}
          value={storeInfo.photo_store}
          onChange={handleImage}
          onRemove={handleRemoveImage}
          inputRef={fileInputRef}
          error={photoError}
        />
        {storeInfo.photo_store && (
          <>
            <div className="flex gap-2">
              <FormInput
                label="Latitude"
                type="number"
                value={storeInfo.lat}
                readOnly
              />
              <FormInput
                label="Longitude"
                type="number"
                value={storeInfo.lng}
                readOnly
              />
            </div>
            {geoLoading && <div className="text-blue-500 text-sm animate-pulse">กำลังดึงตำแหน่ง...</div>}
            {geoError && <div className="text-xs text-red-500 mt-2">{geoError}</div>}
          </>
        )}

        <FormInput
          label="ชื่อร้าน *"
          value={storeInfo.store_name || ""}
          onChange={(v) => setStoreInfo({ ...storeInfo, store_name: v })}
          required
        />
        <FormInput
          label="บ้านเลขที่"
          value={storeInfo.store_number_address || ""}
          onChange={(v) => setStoreInfo({ ...storeInfo, store_number_address: v })}
        />
        <FormInput
          label="หมู่ที่"
          value={storeInfo.store_number_moo || ""}
          onChange={(v) => setStoreInfo({ ...storeInfo, store_number_moo: v })}
        />
        <ProvinceDropdown storeInfo={storeInfo} setStoreInfo={setStoreInfo} userRoute={userRoute} />

        <ShopSizeSelect value={storeInfo.shop_size} onChange={(v) => setStoreInfo({ ...storeInfo, shop_size: v })} />

        {/* ประเภทร้าน */}
        <div>
          <div className="text-base font-semibold mb-1 text-[#0094E5]">ประเภทร้านค้า</div>
          <div className="flex flex-row gap-2 flex-wrap">
            {SPECIAL_TYPE.map((opt) => {
              const checked = storeInfo.special_type?.includes(opt.value) || false;
              return (
                <label
                  key={opt.value}
                  className={`px-4 py-1.5 rounded-xl border cursor-pointer ${
                    checked
                      ? "bg-[#FF9100]/10 border-[#FF9100] text-[#FF9100]"
                      : "bg-white border-gray-200 text-[#444]"
                  }`}
                >
                  <input
                    type="checkbox"
                    value={opt.value}
                    checked={checked}
                    onChange={handleSpecialType}
                    className="hidden"
                  />
                  {opt.label}
                </label>
              );
            })}
          </div>
        </div>

        {/* FREEZER */}
        <div className="mb-3">
          <div className="text-base font-semibold mb-1 text-[#0094E5]">
            พบตู้แช่สำหรับนมหรือไม่ <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-row gap-2">
            {["พบ", "ไม่พบ"].map((opt) => (
              <label
                key={opt}
                tabIndex={0}
                className={`
                  flex items-center px-3 py-1.5 rounded-lg border font-medium text-sm cursor-pointer select-none transition-all
                  outline-none focus:ring-2 focus:ring-[#FF9100]/40
                  ${storeInfo.store_freezer === opt
                    ? "bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100] shadow"
                    : "bg-white border-gray-200 text-[#1a355e] hover:border-[#FF9100]/50 hover:bg-[#fff4e6]"}
                `}
                style={{ minWidth: 56, boxShadow: storeInfo.store_freezer === opt ? "0 2px 6px #ffe6c180" : "none" }}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleSelectFreezer(opt); }}
                onClick={() => handleSelectFreezer(opt)}
              >
                <input
                  type="radio"
                  name="store_freezer"
                  value={opt}
                  checked={storeInfo.store_freezer === opt}
                  onChange={() => handleSelectFreezer(opt)}
                  className="hidden"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>

        {/* SHELF */}
        <div className="mb-3">
          <div className="text-base font-semibold mb-1 text-[#0094E5]">
            พบชั้นวางนม UHT หรือไม่ <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-row gap-2">
            {["พบ", "ไม่พบ"].map((opt) => (
              <label
                key={opt}
                tabIndex={0}
                aria-label={opt}
                className={`
                  flex items-center justify-center px-4 py-2 rounded-xl border font-medium text-sm cursor-pointer select-none transition-all
                  outline-none focus:ring-2 focus:ring-[#FF9100]/30
                  ${storeInfo.store_shelf === opt
                    ? "bg-[#FF9100]/15 border-[#FF9100] text-[#FF9100]"
                    : "bg-white border-gray-200 text-[#21295c] hover:border-[#FF9100]/60 hover:bg-[#fff4e6]"}
                `}
                style={{ minWidth: 64, fontWeight: storeInfo.store_shelf === opt ? 700 : 500 }}
                onKeyDown={(e) => { if (e.key === " " || e.key === "Enter") handleSelectShelf(opt); }}
                onClick={() => handleSelectShelf(opt)}
              >
                <input
                  type="radio"
                  name="store_shelf"
                  value={opt}
                  checked={storeInfo.store_shelf === opt}
                  onChange={() => handleSelectShelf(opt)}
                  className="hidden"
                />
                {opt}
              </label>
            ))}
          </div>
        </div>
        
        {/* ------- Section: รายการสินค้า ------- */}
        <h2 className="text-2xl font-bold mb-6">รายการสินค้า</h2>
        {loading && (
          <div className="text-center text-blue-500 py-10 animate-pulse">
            กำลังโหลดสินค้า...
          </div>
        )}
        {fetchError && (
          <div className="text-center text-red-500 mb-4">{fetchError}</div>
        )}
        {!loading && !products.length && !fetchError && (
          <div className="text-center text-gray-400 py-8">ไม่พบรายการสินค้า</div>
        )}

        <div className="space-y-5 mb-6">
          {products.map((prod) => {
            const status = productData[prod.fmProID]?.status || "ไม่พบ";
            const isAvailable = status === "มีขาย";
            return (
              <Card
                key={prod.fmProID}
                onClick={() => toggleStatus(prod.fmProID)}
                className={`rounded-2xl shadow-md border transition hover:shadow-lg cursor-pointer
                  ${isAvailable
                    ? "border-green-500 bg-green-50"
                    : "border-gray-100 bg-white"}`}
              >
                <CardContent className="flex gap-4 p-4 items-center">
                  <div className="flex-shrink-0 relative w-18 rounded-xl overflow-hidden border bg-gray-50">
                    <img
                      src={prod.fmProImg || "/no-image.png"}
                      alt={prod.fmProName}
                      width={72}
                      height={72}
                      className="object-cover rounded-xl"
                      onError={(e) => { e.currentTarget.src = "/no-image.png"; }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-base truncate">
                      {prod.fmProName}
                    </div>
                    <div className="text-xs text-gray-500 mb-1">
                      รหัส: {prod.fmProID}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">
                      {prod.fmCategory}
                    </div>
                    {/* Price inputs: Only FMFR & มีขาย */}
                    {prod.Owner === "FMFR" && isAvailable && (
                      <div className="grid grid-cols-3 gap-2 mt-2">
                        {[
                          { key: "priceBox", placeholder: "ราคากล่อง" },
                          { key: "pricePack", placeholder: "ราคาแพ็ค" },
                          { key: "priceCarton", placeholder: "ราคาลัง" },
                        ].map(({ key, placeholder }) => (
                          <input
                            key={key}
                            type="number"
                            min="0"
                            className="border rounded-lg p-2 text-xs focus:ring-2 focus:ring-primary/30"
                            placeholder={placeholder}
                            value={productData[prod.fmProID]?.[key] ?? ""}
                            onChange={(e) =>
                              handlePriceChange(prod.fmProID, key, e.target.value)
                            }
                            onClick={e => e.stopPropagation()}
                            onFocus={e => e.stopPropagation()}
                          />
                        ))}
                      </div>
                    )}
                    <div className="mt-2 text-xs font-semibold">
                      {isAvailable ? (
                        <span className="text-green-600">สถานะ: มีขาย</span>
                      ) : (
                        <span className="text-gray-400">สถานะ: ไม่พบ</span>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* เหตุผล */}
        <div>
          <div className="font-semibold mb-1">เหตุผลที่ไม่อนุญาต *</div>
          <div className="flex flex-col gap-2">
            {REASONS.map((opt) => (
              <label
                key={opt.value}
                className={`px-4 py-2 rounded-lg border cursor-pointer ${
                  storeInfo.permission_reason === opt.value
                    ? "bg-[#FF9100]/15 border-[#FF9100] text-[#FF9100]"
                    : "bg-white border-gray-200 text-[#21295c]"
                }`}
              >
                <input
                  type="radio"
                  name="permission_reason"
                  value={opt.value}
                  checked={storeInfo.permission_reason === opt.value}
                  onChange={() => setStoreInfo({ ...storeInfo, permission_reason: opt.value })}
                  className="hidden"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {/* ปุ่มบันทึก */}
        <button
          type="submit"
          disabled={isSaveDisabled}
          className={`w-full py-3 rounded-xl font-bold text-lg mt-2 ${
            isSaveDisabled ? "bg-gray-200 text-gray-400" : "bg-[#0094E5] text-white"
          }`}
        >
          บันทึก
        </button>
      </form>
    </div>
  );
}

/* ========== Components ========== */
function FormInput({ label, value, onChange, type = "text", required, readOnly }) {
  return (
    <div>
      <label className="block text-base mb-1 font-semibold text-[#1a355e]">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={(e) => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-[#dde8f5] px-3 py-2 text-[16px] bg-[#f7fbff] font-medium"
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}

function FormUpload({ label, value, onChange, onRemove, inputRef, error }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-base font-semibold mb-2">{label}</div>
      {!value && (
        <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dde8f5] bg-[#f7fbff] cursor-pointer hover:bg-[#f0f7fd] transition relative">
          <Camera color="#FF9100" size={64} />
          <input
            type="file"
            accept="image/jpeg"
            capture="environment"
            onChange={onChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            ref={inputRef}
          />
        </label>
      )}
      {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
      {value && (
        <div className="relative w-80 max-w-[95vw] h-80 max-h-[60vw] mb-2">
          <img
            src={typeof value === "string" ? value : URL.createObjectURL(value)}
            alt={label}
            className="w-full h-full object-cover rounded-2xl shadow-md border"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบรูป"
            className="absolute top-2 right-2 bg-white rounded-full p-2 border border-red-300"
          >
            <X color="#f43f5e" size={24} />
          </button>
        </div>
      )}
    </div>
  );
}

function ProvinceDropdown({ storeInfo, setStoreInfo, userRoute }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch("/api/servey/get/provice")
      .then((res) => res.json())
      .then((data) => {
        const filtered = userRoute ? data.filter((p) => (p.Route || p.route) === userRoute) : data;
        const provincesObj = {};
        filtered.forEach(({ province, district, sub_district, postcode }) => {
          if (!provincesObj[province]) provincesObj[province] = {};
          if (!provincesObj[province][district]) provincesObj[province][district] = [];
          provincesObj[province][district].push({ subdistrict: sub_district, postcode });
        });
        const provincesList = Object.entries(provincesObj).map(([province, districtsObj]) => ({
          province,
          districts: Object.entries(districtsObj).map(([district, subs]) => ({ district, subdistricts: subs })),
        }));
        setProvinces(provincesList);
      })
      .finally(() => setLoading(false));
  }, [userRoute]);

  useEffect(() => {
    const foundProvince = provinces.find((p) => p.province === storeInfo.store_province);
    setDistricts(foundProvince?.districts || []);
    if (!storeInfo.store_district) return;
    const foundDistrict = foundProvince?.districts?.find((d) => d.district === storeInfo.store_district);
    setSubdistricts(foundDistrict?.subdistricts || []);
    if (!storeInfo.store_subdistrict) return;
    const foundSub = foundDistrict?.subdistricts?.find((s) => s.subdistrict === storeInfo.store_subdistrict);
    setPostcode(foundSub?.postcode || "");
  }, [provinces, storeInfo]);

  if (loading) return <div className="text-gray-500">กำลังโหลดจังหวัด...</div>;

  return (
    <div className="grid gap-3">
      <FormSelectShadcn
        label="จังหวัด"
        value={storeInfo.store_province || ""}
        onChange={(v) =>
          setStoreInfo((prev) => ({
            ...prev,
            store_province: v,
            store_district: "",
            store_subdistrict: "",
          }))
        }
        options={provinces.map((p) => ({ value: p.province, label: p.province }))}
      />
      <FormSelectShadcn
        label="อำเภอ"
        value={storeInfo.store_district || ""}
        onChange={(v) =>
          setStoreInfo((prev) => ({ ...prev, store_district: v, store_subdistrict: "" }))
        }
        options={districts.map((d) => ({ value: d.district, label: d.district }))}
        disabled={!storeInfo.store_province}
      />
      <FormSelectShadcn
        label="ตำบล"
        value={storeInfo.store_subdistrict || ""}
        onChange={(v) =>
          setStoreInfo((prev) => ({
            ...prev,
            store_subdistrict: v,
            store_postcode: postcode,
          }))
        }
        options={subdistricts.map((s) => ({ value: s.subdistrict, label: s.subdistrict }))}
        disabled={!storeInfo.store_district}
      />
      <FormInput label="รหัสไปรษณีย์" value={postcode} readOnly />
    </div>
  );
}

function FormSelectShadcn({ label, value, onChange, options = [], disabled }) {
  return (
    <div>
      <label className="block text-base font-semibold mb-1">{label}</label>
      <select
        className="w-full border rounded-xl px-3 py-2"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
      >
        <option value="">เลือก...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

function ShopSizeSelect({ value, onChange }) {
  const selected = SHOP_SIZE_OPTIONS.find((opt) => opt.value === value);
  return (
    <div>
      <div className="text-base font-bold mb-2 text-[#0094E5]">ลักษณะร้านค้าที่ท่านพบเจอ</div>
      <div className="flex gap-2 flex-wrap mb-2">
        {SHOP_SIZE_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`border rounded-lg px-4 py-2 font-semibold text-lg transition ${
              value === opt.value
                ? "border-[#0094E5] bg-[#e5f4fa] text-[#0094E5]"
                : "border-[#cfe5f8] bg-white text-[#1a355e]"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-1 mb-2">
          <div className="text-[#0094E5] font-medium mb-1">คุณเลือก: {selected.desc}</div>
          {!!selected.images?.length && (
            <div className="md:grid-cols-3 gap-2">
              {selected.images.map((img, idx) => (
                <img
                  key={idx}
                  src={img}
                  alt={`ตัวอย่างร้าน${selected.label}-${idx + 1}`}
                  className="rounded-lg border shadow-sm object-cover w-full aspect-[4/3]"
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
