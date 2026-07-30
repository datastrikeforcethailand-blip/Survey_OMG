"use client";
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Camera, X } from "lucide-react";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  SelectGroup,
} from "@/components/ui/select";
import { useSearchParams } from "next/navigation";

// ----- CONST -----
const foremostBlue = "#0094E5";
const SHOP_SIZE_OPTIONS = [
  { value: "A", label: "A", desc: "ร้าน 1 คูหา หรือร้านของชำ", images: ["/images/shopA/shopA-1.jpg"] }, 
  { value: "B", label: "B", desc: "ร้าน 2 คูหา ขึ้นไป หรือ มินิมาร์ท", images: ["/images/shopB/shopB-1.jpg"] }, 
  { value: "C", label: "C", desc: "ซุปเปอร์มาร์เก็ต (ขายทั้งปลีกและส่ง)", images: ["/images/shopC/shopC-1.jpg"] }, 
  { value: "D", label: "D", desc: "ร้านยี่ปั้ว/ค้าส่ง", images: ["/images/shopD/shopD-1.jpg"] }, 
  { value: "E", label: "E", desc: "ร้านขายสินค้าเด็กโดยเฉพาะ", images: ["/images/shopE/shopE-1.jpg"] }, 
  { value: "F", label: "F", desc: "ร้านขายยา", images: ["/images/shopF/shopF-1.jpg"] }
];
const SPECIAL_TYPE = [
  { value: "ธงฟ้า", label: "ร้านธงฟ้า" },
  { value: "ติดดาว", label: "ร้านติดดาว" },
  { value: "โชคชัย", label: "ร้านโชคชัย" },
  { value: "ถูกดี", label: "ร้านถูกดี" },
];

// ----- PROVINCE DROPDOWN -----
function ProvinceDropdown({ storeInfo, setStoreInfo, userId }) {
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [subdistricts, setSubdistricts] = useState([]);
  const [postcode, setPostcode] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userRoute, setUserRoute] = useState("");

  useEffect(() => {
    if (!userId) return;
    fetch(`/api/servey/get/user?user_id=${userId}`)
      .then((res) => res.json())
      .then((users) => {
        const found = Array.isArray(users)
          ? users.find((u) => u.user_id === userId)
          : users;
        if (found?.route) setUserRoute(String(found.route).replace(",", ""));
      });
  }, [userId]);

  useEffect(() => {
    setLoading(true);
    fetch("/api/servey/get/provice")
      .then(async (res) => {
        if (!res.ok) throw new Error("API not found: " + res.status);
        const text = await res.text();
        let data;
        try { data = JSON.parse(text); }
        catch { throw new Error("API response is not JSON"); }
        if (Array.isArray(data) && data[0]?.sub_district) {
          let filtered = data;
          if (userRoute) filtered = data.filter((p) => (p.Route || p.route) === userRoute);
          const provincesObj = {};
          filtered.forEach(({ province, district, sub_district, postcode }) => {
            if (!province || !district || !sub_district) return;
            if (!provincesObj[province]) provincesObj[province] = {};
            if (!provincesObj[province][district]) provincesObj[province][district] = [];
            provincesObj[province][district].push({ subdistrict: sub_district, postcode });
          });
          const provincesList = Object.entries(provincesObj).map(([province, districtsObj]) => ({
            province,
            districts: Object.entries(districtsObj).map(([district, subdistricts]) => ({
              district,
              subdistricts,
            })),
          }));
          return provincesList;
        }
        if (Array.isArray(data)) return data;
        throw new Error("API format invalid");
      })
      .then(setProvinces)
      .catch(err => {
        setError("API province error: " + err.message);
        setProvinces([]);
      })
      .finally(() => setLoading(false));
  }, [userRoute]);

  useEffect(() => {
    const foundProvince = provinces.find(p => p.province === storeInfo.store_province);
    setDistricts(foundProvince?.districts || []);
    if (!storeInfo.store_district) { setSubdistricts([]); setPostcode(""); return; }
    const foundDistrict = foundProvince?.districts?.find(d => d.district === storeInfo.store_district);
    setSubdistricts(foundDistrict?.subdistricts || []);
    if (!storeInfo.store_subdistrict) { setPostcode(""); return; }
    const foundSub = foundDistrict?.subdistricts?.find(s => s.subdistrict === storeInfo.store_subdistrict);
    setPostcode(foundSub?.postcode || "");
  }, [provinces, storeInfo]);

  const handleChange = useCallback((field, value) => {
    if (field === "province") {
      setDistricts([]); setSubdistricts([]); setPostcode("");
      setStoreInfo(prev => ({ ...prev, store_province: value, store_district: "", store_subdistrict: "", store_postcode: "" }));
    } else if (field === "district") {
      setSubdistricts([]); setPostcode("");
      setStoreInfo(prev => ({ ...prev, store_district: value, store_subdistrict: "", store_postcode: "" }));
    } else if (field === "subdistrict") {
      const foundSub = subdistricts.find(s => s.subdistrict === value);
      setPostcode(foundSub?.postcode || "");
      setStoreInfo(prev => ({ ...prev, store_subdistrict: value, store_postcode: foundSub?.postcode || "" }));
    }
  }, [setStoreInfo, subdistricts]);

  if (loading) return <div className="py-8 text-center text-lg text-[#888]">กำลังโหลดจังหวัด...</div>;

  return (
    <div className="grid gap-3">
      {error && <div className="text-sm text-red-500 bg-red-100 rounded px-2 py-1 mb-2">{error}</div>}
      <FormSelectShadcn
        label="จังหวัด"
        value={storeInfo.store_province || ""}
        onChange={v => handleChange("province", v)}
        options={provinces.map(p => ({ value: p.province, label: p.province }))}
        required
      />
      <FormSelectShadcn
        label="อำเภอ"
        value={storeInfo.store_district || ""}
        onChange={v => handleChange("district", v)}
        options={districts.map(d => ({ value: d.district, label: d.district }))}
        required
        disabled={!storeInfo.store_province}
      />
      <FormSelectShadcn
        label="ตำบล"
        value={storeInfo.store_subdistrict || ""}
        onChange={v => handleChange("subdistrict", v)}
        options={subdistricts.map(s => ({ value: s.subdistrict, label: s.subdistrict }))}
        required
        disabled={!storeInfo.store_district}
      />
      <div>
        <label className="block text-base font-semibold mb-1 text-[#1a355e]">รหัสไปรษณีย์</label>
        <input
          className="w-full rounded-xl border border-[#dde8f5] px-3 py-2 text-[16px] bg-[#f7fbff] font-medium"
          value={postcode}
          readOnly
          required
        />
      </div>
    </div>
  );
}

// ----- FORM SELECT -----
function FormSelectShadcn({ label, value, onChange, options = [], required, disabled, placeholder = "เลือก..." }) {
  const filteredOptions = options.filter(opt => opt.value && opt.value !== "");
  return (
    <div className="mb-4">
      <label className={`block text-base mb-1 font-bold tracking-wide ${disabled ? "text-gray-300" : "text-[#21295c]"}`}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <Select value={value || undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger className={`
          w-full rounded-2xl border-2 px-4 py-2 bg-white text-[17px] font-semibold shadow-sm text-[#21295c]
          focus:border-[#0094E5] focus:ring-2 focus:ring-[#0094E5]/30
          ${disabled ? "border-gray-200 bg-gray-50 text-gray-400 cursor-not-allowed" : "border-[#e5e9f2] hover:border-[#0094E5]"}
        `} style={{ minHeight: 48, boxShadow: "0 2px 10px 0 #eaf1fb" }}>
          <SelectValue placeholder={<span className="text-gray-400">{placeholder}</span>} />
          <svg width={20} height={20} viewBox="0 0 20 20" fill="none" className="ml-auto absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-[#8ab6d6]">
            <path d="M6 8L10 12L14 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </SelectTrigger>
        <SelectContent className="z-[9999] rounded-2xl shadow-2xl bg-white py-2 px-1 border border-[#e0ecf7]">
          <SelectGroup>
            {filteredOptions.length === 0 ? (
              <SelectItem value="__none__" disabled>
                <span className="text-gray-400">ไม่มีข้อมูล</span>
              </SelectItem>
            ) : (
              filteredOptions.map((opt) => (
                <SelectItem
                  key={opt.value}
                  value={opt.value}
                  className={`
                    px-4 py-2 my-1 rounded-lg text-[16px] font-medium text-[#193252]
                    transition cursor-pointer hover:bg-[#f0f7ff] hover:text-[#0094E5]
                    data-[state=checked]:bg-[#e5f6fd] data-[state=checked]:text-[#0094E5]
                  `}
                >{opt.label}</SelectItem>
              ))
            )}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  );
}

// ----- FORM INPUT -----
function FormInput({ label, value, onChange, type = "text", required, readOnly }) {
  return (
    <div>
      <label className="block text-base mb-1 font-semibold text-[#1a355e]">{label}</label>
      <input
        type={type}
        value={value || ""}
        onChange={e => onChange?.(e.target.value)}
        className="w-full rounded-xl border border-[#dde8f5] px-3 py-2 text-[16px] focus:ring-2 text-[#193252] focus:ring-[#0094E5]/30 outline-none bg-[#f7fbff] font-medium"
        required={required}
        readOnly={readOnly}
      />
    </div>
  );
}

// ----- FORM UPLOAD -----
function FormUpload({ label, value, onChange, onRemove, inputRef, error }) {
  return (
    <div className="flex flex-col items-center w-full">
      <div className="text-base font-semibold mb-2 text-[#1a355e]">{label}</div>
      {!value && (
        <label className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#dde8f5] bg-[#f7fbff] cursor-pointer hover:bg-[#f0f7fd] transition relative">
          <Camera color="#FF9100" size={64} />
          <input
            type="file"
            accept="image/jpeg"
            capture="environment"
            onChange={onChange}
            className="absolute inset-0 opacity-0 cursor-pointer"
            tabIndex={-1}
            ref={inputRef}
            style={{ width: "100%", height: "100%" }}
          />
        </label>
      )}
      {error && <div className="text-xs text-red-500 mt-2">{error}</div>}
      {value && (
        <div className="relative w-80 max-w-[95vw] h-80 max-h-[60vw] sm:max-h-[350px] mb-2">
          <img
            src={typeof value === "string" ? value : URL.createObjectURL(value)}
            alt={label}
            className="w-full h-full object-cover rounded-2xl shadow-md border"
          />
          <button
            type="button"
            onClick={onRemove}
            aria-label="ลบรูป"
            className="absolute top-2 right-2 bg-white rounded-full p-2 border border-red-300 shadow hover:bg-red-100 transition z-10"
          >
            <X color="#f43f5e" size={28} />
          </button>
        </div>
      )}
    </div>
  );
}

// ----- SHOP SIZE -----
function ShopSizeSelect({ value, onChange }) {
  const selected = SHOP_SIZE_OPTIONS.find(opt => opt.value === value);
  return (
    <div className="mb-4">
      <div className="text-base font-bold mb-2 text-[#0094E5]">ลักษณะร้านค้าที่ท่านพบเจอ</div>
      <div className="flex gap-2 flex-wrap mb-2">
        {SHOP_SIZE_OPTIONS.map(opt => (
          <button
            type="button"
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`border rounded-lg px-4 py-2 font-semibold text-lg transition
              ${value === opt.value ? "border-[#0094E5] bg-[#e5f4fa] text-[#0094E5] shadow" : "border-[#cfe5f8] bg-white text-[#1a355e] hover:bg-[#f7fbff]"}`}
            style={{ minWidth: 48 }}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {selected && (
        <div className="mt-1 mb-2">
          <div className="text-[#0094E5] font-medium mb-1">
            คุณเลือก: {selected.desc}
          </div>
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

// ----- MAIN COMPONENT -----
export default function Step1StoreInfo({ data = {}, onNext }) {
  const searchParams = useSearchParams();
  const userIdFromQuery = searchParams.get("user_id");

  const [storeInfo, setStoreInfo] = useState({
    ...data,
    user_id: userIdFromQuery || data.user_id || "",
    permission: "อนุญาต",
  });

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState("");
  const [photoError, setPhotoError] = useState("");
  const fileInputRefs = {
    photo_store: useRef(),
    photo_freezer: useRef(),
    photo_shelf: useRef(),
  };

  useEffect(() => {
    setStoreInfo(prev => ({
      ...prev,
      ...data,
      user_id: userIdFromQuery || data.user_id || "",
      permission: "อนุญาต",
    }));
  }, [JSON.stringify(data), userIdFromQuery]);

  // const handleImage = useCallback((e, field) => {
  //   const file = e.target.files[0];
  //   setPhotoError("");
  //   if (!file) return;
  //   if (!["image/jpeg", "image/jpg"].includes(file.type)) {
  //     setPhotoError("ไฟล์ต้องเป็น JPEG เท่านั้น");
  //     return;
  //   }
  //   if (file.size > 5 * 1024 * 1024) {
  //     setPhotoError("ขนาดไฟล์รูปต้องไม่เกิน 5MB");
  //     return;
  //   }
  //   setStoreInfo(prev => ({ ...prev, [field]: file }));
  //   if (field === "photo_store") setTimeout(() => handleDetectLocation(), 200);
  // }, []);

  const handleImage = useCallback((e, field) => {
  const file = e.target.files[0];
  setPhotoError("");
  if (!file) return;

  // ไม่ตรวจประเภทและขนาดไฟล์อีกต่อไป
  setStoreInfo(prev => ({ ...prev, [field]: file }));

  if (field === "photo_store") {
    setTimeout(() => handleDetectLocation(), 200);
  }
}, []);


  const handleRemoveImage = useCallback((field) => {
    setStoreInfo(prev => ({ ...prev, [field]: null }));
    setTimeout(() => fileInputRefs[field]?.current?.click(), 150);
  }, []);

  const handleDetectLocation = useCallback(() => {
    setGeoError(""); setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoLoading(false); setGeoError("อุปกรณ์นี้ไม่รองรับการระบุตำแหน่ง"); return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStoreInfo(prev => ({ ...prev, lat: latitude, lng: longitude }));
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=th`);
          const data = await res.json();
          setStoreInfo(prev => ({ ...prev, location_address: data.display_name || "" }));
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

  const handleSpecialType = (e) => {
    const { value, checked } = e.target;
    let selected = storeInfo.special_type || [];
    selected = checked ? [...selected, value] : selected.filter(item => item !== value);
    setStoreInfo(prev => ({ ...prev, special_type: selected }));
  };

  const isNextDisabled =
  geoLoading ||
  !storeInfo.store_name ||
  !storeInfo.store_province ||
  !storeInfo.store_district ||
  !storeInfo.store_subdistrict ||
  !storeInfo.photo_store ||
  !storeInfo.lat ||
  !storeInfo.lng ||
  !storeInfo.shop_size ||
  !storeInfo.store_freezer ||
  (storeInfo.store_freezer === "มี" && !storeInfo.photo_freezer) ||
  !storeInfo.store_shelf ||
  (storeInfo.store_shelf === "มี" && !storeInfo.photo_shelf) ||
  // เพิ่มบรรทัดนี้!
  (storeInfo.store_freezer === "ไม่มี" && storeInfo.store_shelf === "ไม่มี");


  const handleSelectFreezer = (opt) => {
    setStoreInfo(prev => ({
      ...prev,
      store_freezer: opt,
      photo_freezer: opt === "มี" ? prev.photo_freezer : null,
    }));
  };
  const handleSelectShelf = (opt) => {
    setStoreInfo(prev => ({
      ...prev,
      store_shelf: opt,
      photo_shelf: opt === "มี" ? prev.photo_shelf : null,
    }));
  };

  const handleNext = () => {
    if (!isNextDisabled && typeof onNext === "function") {
      const cleanStoreInfo = {
        ...storeInfo,
        location: {
          lat: storeInfo.lat,
          lng: storeInfo.lng,
          address: storeInfo.location_address || "",
        },
        special_type: Array.isArray(storeInfo.special_type) ? storeInfo.special_type : [],
      };
      delete cleanStoreInfo.lat;
      delete cleanStoreInfo.lng;
      delete cleanStoreInfo.location_address;

      onNext(cleanStoreInfo);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f5fafd]">
      <form
        onSubmit={e => { e.preventDefault(); handleNext(); }}
        className="w-full max-w-md bg-white shadow-xl rounded-3xl px-5 py-8 flex flex-col gap-5"
      >
        <div className="text-center mb-3">
          <img
            src="https://www.foremostthailand.com/wp-content/uploads/2022/03/footer-icon_foremost-e1648914092691.png"
            className="w-16 h-16 mx-auto mb-2 rounded-full border-4 border-[#f0f6ff] shadow"
            alt="Foremost"
          />
          <h2 className="font-extrabold text-2xl text-[#0094E5]">ข้อมูลร้านค้า</h2>
        </div>

        <FormUpload
          label={storeInfo.photo_store ? "รูปร้านค้า" : "ถ่ายรูปร้านค้า"}
          value={storeInfo.photo_store}
          onChange={e => handleImage(e, "photo_store")}
          onRemove={() => handleRemoveImage("photo_store")}
          inputRef={fileInputRefs.photo_store}
          error={photoError}
        />

        {storeInfo.photo_store && (
          <>
            {/* ช่องนี้ถูกซ่อน (แต่ค่าถูกเก็บ auto) */}
            {/* <FormInput
              label="ที่ตั้งร้าน/รายละเอียดสถานที่"
              value={storeInfo.location_address}
              onChange={v => setStoreInfo({ ...storeInfo, location_address: v })}
              readOnly
            /> */}
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
          onChange={v => setStoreInfo({ ...storeInfo, store_name: v })}
          required
        />
        <FormInput
          label="บ้านเลขที่"
          value={storeInfo.store_number_address || ""}
          onChange={v => setStoreInfo({ ...storeInfo, store_number_address: v })}
        />
        <FormInput
          label="หมู่ที่"
          value={storeInfo.store_number_moo || ""}
          onChange={v => setStoreInfo({ ...storeInfo, store_number_moo: v })}
        />

        <ProvinceDropdown
          storeInfo={storeInfo}
          setStoreInfo={setStoreInfo}
          userId={userIdFromQuery}
        />

        <ShopSizeSelect value={storeInfo.shop_size} onChange={v => setStoreInfo({ ...storeInfo, shop_size: v })} />

        <div>
          <div className="text-base font-semibold mb-1 text-[#0094E5]">ประเภทร้านค้า</div>
          <div className="flex flex-row gap-2 overflow-x-auto no-scrollbar py-1">
            {SPECIAL_TYPE.map(opt => {
              const checked = storeInfo.special_type?.includes(opt.value) || false;
              return (
                <label
                  key={opt.value}
                  className={`
                    flex items-center px-4 py-1.5 rounded-xl border cursor-pointer select-none text-sm font-medium transition
                    ${checked ? "bg-[#FF9100]/10 border-[#FF9100] text-[#FF9100] shadow-sm" : "bg-white border-gray-200 text-[#444] hover:border-[#FF9100]"}
                  `}
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
            มีตู้แช่หรือไม่ <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-row gap-2">
            {["มี", "ไม่มี"].map(opt => (
              <label
                key={opt}
                tabIndex={0}
                className={`
                  flex items-center px-3 py-1.5 rounded-lg border font-medium text-sm cursor-pointer select-none transition-all
                  outline-none focus:ring-2 focus:ring-[#FF9100]/40
                  ${storeInfo.store_freezer === opt
                    ? "bg-[#FF9100]/20 border-[#FF9100] text-[#FF9100] shadow"
                    : "bg-white border-gray-200 text-[#1a355e] hover:border-[#FF9100]/50 hover:bg-[#fff4e6]"
                  }
                `}
                style={{ minWidth: 56, boxShadow: storeInfo.store_freezer === opt ? "0 2px 6px #ffe6c180" : "none" }}
                onKeyDown={e => { if (e.key === " " || e.key === "Enter") handleSelectFreezer(opt); }}
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
        {storeInfo.store_freezer === "มี" && (
          <FormUpload
            label={storeInfo.photo_freezer ? "รูปตู้แช่" : "ถ่ายรูปตู้แช่"}
            value={storeInfo.photo_freezer}
            onChange={e => handleImage(e, "photo_freezer")}
            onRemove={() => handleRemoveImage("photo_freezer")}
            inputRef={fileInputRefs.photo_freezer}
            error={photoError}
          />
        )}

        {/* SHELF */}
        <div className="mb-3">
          <div className="text-base font-semibold mb-1 text-[#0094E5]">
            มีชั้นวางนม UHT หรือไม่ <span className="text-red-500">*</span>
          </div>
          <div className="flex flex-row gap-2">
            {["มี", "มี แต่วางสินค้ากลุ่มอื่น", "ไม่มี"].map(opt => (
              <label
                key={opt}
                tabIndex={0}
                aria-label={opt}
                className={`
                  flex items-center justify-center px-4 py-2 rounded-xl border font-medium text-sm cursor-pointer select-none transition-all
                  outline-none focus:ring-2 focus:ring-[#FF9100]/30
                  ${storeInfo.store_shelf === opt
                    ? "bg-[#FF9100]/15 border-[#FF9100] text-[#FF9100]"
                    : "bg-white border-gray-200 text-[#21295c] hover:border-[#FF9100]/60 hover:bg-[#fff4e6]"
                  }
                `}
                style={{ minWidth: 64, fontWeight: storeInfo.store_shelf === opt ? 700 : 500 }}
                onKeyDown={e => { if (e.key === " " || e.key === "Enter") handleSelectShelf(opt); }}
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
        {storeInfo.store_shelf === "มี" && (
          <FormUpload
            label={storeInfo.photo_shelf ? "รูปชั้นวาง" : "ถ่ายรูปชั้นวาง"}
            value={storeInfo.photo_shelf}
            onChange={e => handleImage(e, "photo_shelf")}
            onRemove={() => handleRemoveImage("photo_shelf")}
            inputRef={fileInputRefs.photo_shelf}
            error={photoError}
          />
        )}

        <button
          type="submit"
          disabled={isNextDisabled}
          className={`w-full py-3 rounded-xl font-bold text-lg shadow-lg mt-2 ${isNextDisabled ? "bg-gray-200 text-gray-400 cursor-not-allowed" : ""}`}
          style={isNextDisabled ? {} : { background: foremostBlue, color: "#fff", letterSpacing: "1px" }}
        >
          ถัดไป
        </button>
      </form>
    </div>
  );
}
