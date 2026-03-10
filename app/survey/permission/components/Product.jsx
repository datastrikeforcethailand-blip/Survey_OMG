"use client";
import { useState, useEffect } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function Step2Products({ onBack, onNext }) {
  const [products, setProducts] = useState([]);
  const [productData, setProductData] = useState({});
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // State for global dropdowns
  const [statusFMFRGlobal, setStatusFMFRGlobal] = useState("");
  const [statusOMGGlobal, setStatusOMGGlobal] = useState("");

  // ตัวเลือกทั้งหมด
  const statusOptions = [
    { value: "", label: "เลือกสถานะ" },
    { value: "สินค้าหมด", label: "สินค้าหมด" },
    { value: "ไม่เคยขาย", label: "ไม่เคยขาย" },
    { value: "เลิกขาย", label: "เลิกขาย" },
  ];

  // Filter FMFR options ตาม OMG ที่เลือก
  const getFMFROptions = (omgStatus) => {
    if (omgStatus === "สินค้าหมด") {
      return statusOptions.filter(opt => opt.value === "" || opt.value === "สินค้าหมด");
    }
    if (omgStatus === "ไม่เคยขาย") {
      return statusOptions.filter(opt => ["", "สินค้าหมด", "ไม่เคยขาย", "เลิกขาย"].includes(opt.value));
    }
    if (omgStatus === "เลิกขาย") {
      return statusOptions.filter(opt => ["", "สินค้าหมด", "เลิกขาย"].includes(opt.value));
    }
    return statusOptions;
  };

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
        setProducts(Array.isArray(data) ? data : []);
        const initialStatus = {};
        (Array.isArray(data) ? data : []).forEach((p) => {
          initialStatus[p.fmProID] = {
            status: "ไม่มีขาย",
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

  // Toggle สถานะ มีขาย/ไม่มีขาย + reset ราคาถ้าเป็น "ไม่มีขาย"
  const toggleStatus = (productId) => {
    setProductData((prev) => {
      const currentStatus = prev[productId]?.status;
      if (currentStatus === "มีขาย") {
        // กลับเป็น "ไม่มีขาย" => ล้างราคา
        return {
          ...prev,
          [productId]: {
            ...prev[productId],
            status: "ไม่มีขาย",
            priceBox: "",
            pricePack: "",
            priceCarton: "",
          },
        };
      }
      // เปลี่ยนเป็น "มีขาย" ราคารอบก่อนจะยังอยู่ (ถ้าเคยกรอก)
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

  // เช็คเงื่อนไข auto set
  const isAnyFMFRAvailable = products.some(
    (prod) => prod.Owner === "FMFR" && productData[prod.fmProID]?.status === "มีขาย"
  );
  const isAnyFMFRKidsAvailable = products.some(
    (prod) =>
      prod.Owner === "FMFR" &&
      prod.fmCategory === "Kids" &&
      productData[prod.fmProID]?.status === "มีขาย"
  );

  // set ค่าอัตโนมัติเมื่อเข้าเงื่อนไข (ถ้าซ่อน dropdown)
  useEffect(() => {
    if (isAnyFMFRAvailable) setStatusFMFRGlobal("มีขาย");
    else setStatusFMFRGlobal("");
  }, [isAnyFMFRAvailable]);

  useEffect(() => {
    if (isAnyFMFRKidsAvailable) setStatusOMGGlobal("มีขาย");
    else setStatusOMGGlobal("");
  }, [isAnyFMFRKidsAvailable]);

  // ถ้า FMFR dropdown เหลือแค่บาง option แต่ค่าที่เลือกไว้ก่อนหน้าไม่ตรง option ให้ reset อัตโนมัติ
  useEffect(() => {
    const availableFMFROptions = getFMFROptions(statusOMGGlobal).map(o => o.value);
    if (!availableFMFROptions.includes(statusFMFRGlobal)) {
      setStatusFMFRGlobal("");
    }
  }, [statusOMGGlobal]);

  // Submit handler
  const handleNext = () => {
    if (submitting) return;
    setSubmitting(true);

    // Force set "มีขาย" ถ้าตรงเงื่อนไข
    const fmfrGlobal = isAnyFMFRAvailable ? "มีขาย" : statusFMFRGlobal;
    const omgGlobal = isAnyFMFRKidsAvailable ? "มีขาย" : statusOMGGlobal;

    const result = products.map((p) => ({
      product_id: p.fmProID,
      status: productData[p.fmProID]?.status || "ไม่มีขาย",
      priceBox: productData[p.fmProID]?.priceBox || "",
      pricePack: productData[p.fmProID]?.pricePack || "",
      priceCarton: productData[p.fmProID]?.priceCarton || "",
    }));

    // ส่งค่าไป Wizard แบบแปลง key ให้ตรง schema
    onNext({
      products: result,
      statusFMFRGlobal: fmfrGlobal,
      statusOMGGlobal: omgGlobal,
    });

    setTimeout(() => setSubmitting(false), 1000);
  };

  return (
    <div className="max-w-lg mx-auto py-8">
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
          const status = productData[prod.fmProID]?.status || "ไม่มีขาย";
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
                  <Image
                    src={prod.fmProImg || "/no-image.png"}
                    alt={prod.fmProName}
                    width={72}
                    height={72}
                    className="object-cover"
                    onError={(e) => {
                      e.currentTarget.src = "/no-image.png";
                    }}
                    unoptimized
                    priority={false}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-base truncate">
                    {prod.fmProName}
                  </div>
                  <div className="font-semibold text-base truncate">
                    ขนาด: {prod.fmProSize}
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
                      <span className="text-gray-400">สถานะ: ไม่มีขาย</span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* OMG Dropdown (ซ่อนถ้า FMFR + Kids ถูกเลือกมีขาย) */}
      {!isAnyFMFRKidsAvailable && (
        <div>
          <label htmlFor="statusOMGGlobal" className="text-sm font-semibold mb-1 block">
            สถานะสินค้า OMG
          </label>
          <select
            id="statusOMGGlobal"
            className="border rounded-xl p-3 text-base w-full focus:ring-2 focus:ring-primary/30"
            value={statusOMGGlobal}
            onChange={e => setStatusOMGGlobal(e.target.value)}
          >
            {statusOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* --- Global Status Dropdown (ด้านล่าง) --- */}
      <div className="grid grid-cols-1 gap-4 mb-6">
        {/* FMFR Dropdown */}
        {!isAnyFMFRAvailable && (
          <div>
            <label htmlFor="statusFMFRGlobal" className="text-sm font-semibold mb-1 block">
              สถานะสินค้า FMFR
            </label>
            <select
              id="statusFMFRGlobal"
              className="border rounded-xl p-3 text-base w-full focus:ring-2 focus:ring-primary/30"
              value={statusFMFRGlobal}
              onChange={e => setStatusFMFRGlobal(e.target.value)}
            >
              {getFMFROptions(statusOMGGlobal).map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* --- Button --- */}
      <div className="flex justify-between gap-4 mt-8">
        <Button
          variant="outline"
          className="flex-1 py-3 rounded-2xl font-semibold border-gray-300 hover:border-primary hover:bg-primary/10 transition"
          type="button"
          onClick={onBack}
          disabled={loading || submitting}
        >
          ย้อนกลับ
        </Button>
        <Button
          className="flex-1 py-3 rounded-2xl font-semibold bg-primary text-white shadow-lg hover:bg-primary/90 transition"
          type="button"
          onClick={handleNext}
          disabled={loading || submitting}
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="10" fill="none" stroke="white" strokeWidth="4" opacity="0.2"/>
                <path d="M12 2a10 10 0 0 1 10 10" fill="none" stroke="white" strokeWidth="4"/>
              </svg>
              กำลังส่ง...
            </span>
          ) : (
            "ถัดไป"
          )}
        </Button>
      </div>
    </div>
  );
}
