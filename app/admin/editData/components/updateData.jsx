"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const BATCH_SIZE = 500;
const PREVIEW_LIMIT = 20;

const BLOCKED_COLUMNS = new Set([
  "_id",
  "__v",
  "createdAt",
  "updatedAt",
]);

function cleanHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeCellValue(value) {
  if (value === "__EMPTY__") return "";
  if (value === "__NULL__") return null;

  return value;
}

function buildUpdates(rows, columns) {
  const updateMap = new Map();

  for (const row of rows) {
    const surID = String(row?.surID ?? "").trim();

    if (!surID) continue;

    const data = {};

    for (const column of columns) {
      if (column === "surID") continue;
      if (BLOCKED_COLUMNS.has(column)) continue;

      const rawValue = row[column];

      if (rawValue === "" || rawValue === undefined) {
        continue;
      }

      data[column] = normalizeCellValue(rawValue);
    }

    if (Object.keys(data).length === 0) {
      continue;
    }

    updateMap.set(surID, {
      surID,
      data,
    });
  }

  return Array.from(updateMap.values());
}

function createBatches(items, batchSize) {
  const batches = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export default function UpdateData() {
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const [preview, setPreview] = useState(null);
  const [updateResult, setUpdateResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    mode: "",
  });

  const [showUpdateModal, setShowUpdateModal] =
    useState(false);

  const [confirmationText, setConfirmationText] =
    useState("");

  const [updateModalStatus, setUpdateModalStatus] =
    useState("confirm");

  const [modalUpdateResult, setModalUpdateResult] =
    useState(null);

  const updates = useMemo(
    () => buildUpdates(rows, columns),
    [rows, columns]
  );

  function resetData() {
    setFileName("");
    setColumns([]);
    setRows([]);
    setParseErrors([]);
    setPreview(null);
    setUpdateResult(null);

    setProgress({
      current: 0,
      total: 0,
      mode: "",
    });

    setShowUpdateModal(false);
    setConfirmationText("");
    setUpdateModalStatus("confirm");
    setModalUpdateResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearCurrentFileData() {
    setFileName("");
    setColumns([]);
    setRows([]);
    setParseErrors([]);
    setPreview(null);
    setUpdateResult(null);

    setProgress({
      current: 0,
      total: 0,
      mode: "",
    });

    setShowUpdateModal(false);
    setConfirmationText("");
    setUpdateModalStatus("confirm");
    setModalUpdateResult(null);
  }

  function closeUpdateModal() {
    if (updateModalStatus === "processing") return;

    setShowUpdateModal(false);
    setConfirmationText("");
    setUpdateModalStatus("confirm");
    setModalUpdateResult(null);
  }

  function openUpdateModal() {
    if (!preview?.foundSurIDs?.length) {
      toast.warning("ไม่พบข้อมูลที่สามารถอัปเดตได้");
      return;
    }

    setConfirmationText("");
    setModalUpdateResult(null);
    setUpdateModalStatus("confirm");
    setShowUpdateModal(true);
  }

  function handleFileChange(event) {
    const file = event.target.files?.[0];

    clearCurrentFileData();

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".csv")) {
      toast.error("กรุณาเลือกไฟล์ CSV");
      event.target.value = "";
      return;
    }

    setFileName(file.name);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: "greedy",
      transformHeader: cleanHeader,

      complete: (result) => {
        const parsedColumns = (result.meta.fields || [])
          .map(cleanHeader)
          .filter(Boolean);

        if (!parsedColumns.includes("surID")) {
          setParseErrors([
            {
              message: "ไม่พบคอลัมน์ surID ในไฟล์ CSV",
            },
          ]);

          toast.error("ไฟล์ CSV ต้องมีคอลัมน์ surID");
          return;
        }

        const duplicateHeaders = parsedColumns.filter(
          (column, index) =>
            parsedColumns.indexOf(column) !== index
        );

        if (duplicateHeaders.length > 0) {
          const duplicates = [
            ...new Set(duplicateHeaders),
          ];

          setParseErrors([
            {
              message: `พบชื่อคอลัมน์ซ้ำ: ${duplicates.join(
                ", "
              )}`,
            },
          ]);

          toast.error("พบชื่อคอลัมน์ซ้ำในไฟล์ CSV");
          return;
        }

        const cleanedRows = (result.data || []).map((row) => {
          const cleanedRow = {};

          for (const column of parsedColumns) {
            const value = row[column];

            cleanedRow[column] =
              typeof value === "string"
                ? value.trim()
                : value;
          }

          return cleanedRow;
        });

        const validRows = cleanedRows.filter(
          (row) =>
            String(row?.surID ?? "").trim() !== ""
        );

        setColumns(parsedColumns);
        setRows(validRows);
        setParseErrors(result.errors || []);
        setPreview(null);
        setUpdateResult(null);

        toast.success(
          `อ่านไฟล์สำเร็จ ${validRows.length.toLocaleString()} แถว`
        );
      },

      error: (error) => {
        console.error("CSV parse error:", error);

        setParseErrors([
          {
            message:
              error?.message || "อ่านไฟล์ CSV ไม่สำเร็จ",
          },
        ]);

        toast.error("อ่านไฟล์ CSV ไม่สำเร็จ");
      },
    });
  }

  async function previewUpdate() {
    if (updates.length === 0) {
      toast.warning("ไม่พบข้อมูลที่สามารถอัปเดตได้");
      return;
    }

    try {
      setLoading(true);
      setPreview(null);
      setUpdateResult(null);

      const batches = createBatches(updates, BATCH_SIZE);

      const foundSurIDs = [];
      const notFoundSurIDs = [];

      setProgress({
        current: 0,
        total: batches.length,
        mode: "preview",
      });

      for (let index = 0; index < batches.length; index += 1) {
        const response = await fetch("/api/updateData", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preview: true,
            updates: batches[index],
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data?.message ||
              data?.error ||
              `ตรวจสอบ Batch ${index + 1} ไม่สำเร็จ`
          );
        }

        foundSurIDs.push(...(data.foundSurIDs || []));
        notFoundSurIDs.push(
          ...(data.notFoundSurIDs || [])
        );

        setProgress({
          current: index + 1,
          total: batches.length,
          mode: "preview",
        });
      }

      const uniqueFound = [...new Set(foundSurIDs)];
      const uniqueNotFound = [
        ...new Set(notFoundSurIDs),
      ];

      setPreview({
        requestedCount: updates.length,
        foundCount: uniqueFound.length,
        notFoundCount: uniqueNotFound.length,
        foundSurIDs: uniqueFound,
        notFoundSurIDs: uniqueNotFound,
      });

      toast.success("ตรวจสอบข้อมูลเรียบร้อย");
    } catch (error) {
      console.error("Preview update error:", error);

      toast.error(
        error?.message || "ตรวจสอบข้อมูลไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmUpdateData() {
    if (confirmationText.trim() !== "UPDATE") {
      toast.warning("กรุณาพิมพ์คำว่า UPDATE ให้ถูกต้อง");
      return;
    }

    if (!preview?.foundSurIDs?.length) {
      toast.warning("ไม่พบข้อมูลที่สามารถอัปเดตได้");
      return;
    }

    const foundSet = new Set(preview.foundSurIDs);

    const validUpdates = updates.filter((item) =>
      foundSet.has(item.surID)
    );

    const batches = createBatches(
      validUpdates,
      BATCH_SIZE
    );

    let requestedCount = 0;
    let matchedCount = 0;
    let modifiedCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;

    const failedBatches = [];

    try {
      setLoading(true);
      setUpdateResult(null);
      setModalUpdateResult(null);
      setUpdateModalStatus("processing");

      setProgress({
        current: 0,
        total: batches.length,
        mode: "update",
      });

      for (let index = 0; index < batches.length; index += 1) {
        try {
          const response = await fetch("/api/updateData", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              confirmation: "UPDATE",
              updates: batches[index],
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data?.message ||
                data?.error ||
                `อัปเดต Batch ${index + 1} ไม่สำเร็จ`
            );
          }

          requestedCount += Number(
            data.requestedCount || 0
          );

          matchedCount += Number(
            data.matchedCount || 0
          );

          modifiedCount += Number(
            data.modifiedCount || 0
          );

          notFoundCount += Number(
            data.notFoundCount || 0
          );
        } catch (error) {
          console.error(
            `Update batch ${index + 1} failed:`,
            error
          );

          failedCount += batches[index].length;

          failedBatches.push({
            batch: index + 1,
            count: batches[index].length,
            message: error?.message || "Unknown error",
          });
        }

        setProgress({
          current: index + 1,
          total: batches.length,
          mode: "update",
        });
      }

      const finalResult = {
        requestedCount,
        matchedCount,
        modifiedCount,
        notFoundCount,
        failedCount,
        failedBatches,
      };

      setUpdateResult(finalResult);
      setModalUpdateResult(finalResult);
      setConfirmationText("");
      setPreview(null);

      if (failedCount > 0) {
        setUpdateModalStatus("error");

        toast.error(
          `ดำเนินการไม่สำเร็จ ${failedCount.toLocaleString()} รายการ`
        );
      } else {
        setUpdateModalStatus("success");

        if (matchedCount === 0) {
          toast.warning(
            "ไม่พบ surID ที่ตรงกับข้อมูลใน MongoDB"
          );
        } else if (modifiedCount === 0) {
          toast.warning(
            `พบ ${matchedCount.toLocaleString()} รายการ แต่ไม่มีข้อมูลเปลี่ยนแปลง`
          );
        } else {
          toast.success(
            `อัปเดตสำเร็จ ${modifiedCount.toLocaleString()} จาก ${matchedCount.toLocaleString()} รายการ`
          );
        }
      }
    } catch (error) {
      console.error("Update error:", error);

      const errorResult = {
        requestedCount: validUpdates.length,
        matchedCount: 0,
        modifiedCount: 0,
        notFoundCount: 0,
        failedCount: validUpdates.length,
        failedBatches: [],
        message:
          error?.message ||
          "เกิดข้อผิดพลาดในการอัปเดตข้อมูล",
      };

      setUpdateResult(errorResult);
      setModalUpdateResult(errorResult);
      setUpdateModalStatus("error");

      toast.error(errorResult.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          อัปเดตข้อมูลด้วย CSV
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          ระบบจะจับคู่ข้อมูลด้วย surID
          และอัปเดตเฉพาะคอลัมน์ที่มีค่า
        </p>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" />

          <div className="text-sm text-blue-800">
            <p className="font-semibold">
              รูปแบบไฟล์ CSV
            </p>

            <p className="mt-1">
              ต้องมีคอลัมน์{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5">
                surID
              </code>{" "}
              และใช้ชื่อ Field เช่น{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5">
                store_info.store_name
              </code>
            </p>

            <p className="mt-1">
              ช่องว่างจะไม่แก้ข้อมูลเดิม
              หากต้องการล้างค่าให้ใส่{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5">
                __EMPTY__
              </code>
            </p>

            <p className="mt-1">
              หากต้องการเปลี่ยนค่าเป็น null ให้ใส่{" "}
              <code className="rounded bg-blue-100 px-1.5 py-0.5">
                __NULL__
              </code>
            </p>
          </div>
        </div>
      </div>

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-blue-500 hover:bg-blue-50">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={handleFileChange}
          disabled={loading}
          className="hidden"
        />

        <Upload className="mx-auto h-10 w-10 text-slate-400" />

        <p className="mt-3 font-semibold text-slate-800">
          คลิกเพื่อเลือกไฟล์ CSV
        </p>

        <p className="mt-1 text-sm text-slate-500">
          รองรับไฟล์นามสกุล .csv
        </p>
      </label>

      {fileName && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <div className="flex min-w-0 items-center gap-3">
            <FileSpreadsheet className="h-8 w-8 shrink-0 text-green-600" />

            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-800">
                {fileName}
              </p>

              <p className="text-sm text-slate-500">
                {rows.length.toLocaleString()} แถว ·{" "}
                {columns.length.toLocaleString()} คอลัมน์
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={resetData}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
          >
            <RefreshCcw className="h-4 w-4" />
            เลือกไฟล์ใหม่
          </button>
        </div>
      )}

      {parseErrors.length > 0 && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p className="font-semibold">
            พบปัญหาในไฟล์{" "}
            {parseErrors.length.toLocaleString()} รายการ
          </p>

          <ul className="mt-2 space-y-1">
            {parseErrors.slice(0, 10).map((error, index) => (
              <li
                key={`${error.code || "error"}-${index}`}
              >
                แถว{" "}
                {error.row != null ? error.row + 2 : "-"}:{" "}
                {error.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      {rows.length > 0 && (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="แถวในไฟล์"
              value={rows.length}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="รายการพร้อมอัปเดต"
              value={updates.length}
              icon={CheckCircle2}
            />

            <StatCard
              title="จำนวนคอลัมน์"
              value={columns.length}
              icon={FileSpreadsheet}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-800">
                ตัวอย่างข้อมูล
              </p>

              <p className="text-sm text-slate-500">
                แสดง {Math.min(rows.length, PREVIEW_LIMIT)} แถวแรก
              </p>
            </div>

            <div className="max-h-[420px] overflow-auto">
              <table className="min-w-max text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100">
                  <tr>
                    <th className="border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-700">
                      #
                    </th>

                    {columns.map((column) => (
                      <th
                        key={column}
                        className="whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 text-left font-semibold text-slate-700"
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {rows
                    .slice(0, PREVIEW_LIMIT)
                    .map((row, rowIndex) => (
                      <tr
                        key={`${row.surID || "row"}-${rowIndex}`}
                        className="odd:bg-white even:bg-slate-50"
                      >
                        <td className="border-b border-r border-slate-200 px-4 py-3 text-slate-500">
                          {rowIndex + 1}
                        </td>

                        {columns.map((column) => (
                          <td
                            key={column}
                            className="max-w-72 truncate whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 text-slate-700"
                            title={String(
                              row[column] ?? ""
                            )}
                          >
                            {String(row[column] ?? "")}
                          </td>
                        ))}
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>

          <button
            type="button"
            onClick={previewUpdate}
            disabled={loading || updates.length === 0}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading && progress.mode === "preview" ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Search className="h-5 w-5" />
            )}

            ตรวจสอบ surID
          </button>
        </>
      )}

      {loading &&
        progress.total > 0 &&
        progress.mode === "preview" && (
          <ProgressBar
            current={progress.current}
            total={progress.total}
            mode="preview"
          />
        )}

      {preview && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="รายการทั้งหมด"
              value={preview.requestedCount}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="พบใน MongoDB"
              value={preview.foundCount}
              icon={CheckCircle2}
            />

            <StatCard
              title="ไม่พบข้อมูล"
              value={preview.notFoundCount}
              icon={XCircle}
            />
          </div>

          {preview.notFoundCount > 0 && (
            <details className="rounded-xl border border-slate-200 bg-white">
              <summary className="cursor-pointer select-none px-4 py-3 font-semibold text-slate-700">
                ดู surID ที่ไม่พบ (
                {preview.notFoundCount.toLocaleString()})
              </summary>

              <pre className="max-h-64 overflow-auto border-t border-slate-200 p-4 text-xs text-slate-700">
                {preview.notFoundSurIDs.join("\n")}
              </pre>
            </details>
          )}

          <div className="flex justify-end">
            <button
              type="button"
              onClick={openUpdateModal}
              disabled={loading || preview.foundCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <FileSpreadsheet className="h-5 w-5" />

              อัปเดตข้อมูล{" "}
              {preview.foundCount.toLocaleString()} รายการ
            </button>
          </div>
        </div>
      )}

      {updateResult && !showUpdateModal && (
        <div className="space-y-5 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div>
            <h3 className="font-bold text-green-900">
              ผลการอัปเดต
            </h3>

            <p className="mt-1 text-sm text-green-700">
              ตรวจสอบผลการดำเนินการด้านล่าง
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="รายการที่ส่ง"
              value={updateResult.requestedCount}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="พบข้อมูล"
              value={updateResult.matchedCount}
              icon={CheckCircle2}
            />

            <StatCard
              title="แก้ไขจริง"
              value={updateResult.modifiedCount}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="ไม่สำเร็จ"
              value={updateResult.failedCount}
              icon={XCircle}
            />
          </div>

          <button
            type="button"
            onClick={resetData}
            className="inline-flex items-center gap-2 rounded-xl border border-green-300 bg-white px-5 py-3 font-semibold text-green-800 transition hover:bg-green-100"
          >
            <RefreshCcw className="h-5 w-5" />
            เริ่มรายการใหม่
          </button>
        </div>
      )}

      {showUpdateModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              updateModalStatus !== "processing"
            ) {
              closeUpdateModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-full p-3 ${
                    updateModalStatus === "success"
                      ? "bg-green-100"
                      : updateModalStatus === "error"
                        ? "bg-red-100"
                        : "bg-blue-100"
                  }`}
                >
                  {updateModalStatus === "success" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : updateModalStatus === "processing" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
                  ) : updateModalStatus === "error" ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <FileSpreadsheet className="h-6 w-6 text-blue-600" />
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {updateModalStatus === "confirm" &&
                      "ยืนยันการอัปเดตข้อมูล"}

                    {updateModalStatus === "processing" &&
                      "กำลังอัปเดตข้อมูล"}

                    {updateModalStatus === "success" &&
                      "อัปเดตข้อมูลเรียบร้อยแล้ว"}

                    {updateModalStatus === "error" &&
                      "ดำเนินการไม่สมบูรณ์"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {updateModalStatus === "confirm" &&
                      "ระบบจะอัปเดตเฉพาะ surID ที่พบ"}

                    {updateModalStatus === "processing" &&
                      "กรุณาอย่าปิดหรือรีเฟรชหน้าเว็บ"}

                    {updateModalStatus === "success" &&
                      "ระบบดำเนินการอัปเดตเสร็จแล้ว"}

                    {updateModalStatus === "error" &&
                      "พบปัญหาบางส่วนระหว่างดำเนินการ"}
                  </p>
                </div>
              </div>

              {updateModalStatus !== "processing" && (
                <button
                  type="button"
                  onClick={closeUpdateModal}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="space-y-5 p-6">
              {updateModalStatus === "confirm" && (
                <>
                  <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
                    <p className="text-sm text-blue-700">
                      คุณกำลังจะอัปเดตข้อมูล
                    </p>

                    <p className="mt-1 text-3xl font-bold text-blue-700">
                      {preview?.foundCount?.toLocaleString() || 0}
                    </p>

                    <p className="text-sm text-blue-700">
                      รายการ
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="update-confirmation"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      พิมพ์คำว่า{" "}
                      <span className="font-mono text-blue-600">
                        UPDATE
                      </span>{" "}
                      เพื่อยืนยัน
                    </label>

                    <input
                      id="update-confirmation"
                      type="text"
                      value={confirmationText}
                      onChange={(event) =>
                        setConfirmationText(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          confirmationText.trim() ===
                            "UPDATE"
                        ) {
                          confirmUpdateData();
                        }
                      }}
                      autoFocus
                      autoComplete="off"
                      placeholder="UPDATE"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
                    />
                  </div>
                </>
              )}

              {updateModalStatus === "processing" && (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    กำลังอัปเดตข้อมูล
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    กรุณารอสักครู่ ระบบกำลังดำเนินการ
                  </p>

                  {progress.total > 0 && (
                    <div className="mt-6 text-left">
                      <ProgressBar
                        current={progress.current}
                        total={progress.total}
                        mode="update"
                      />
                    </div>
                  )}
                </div>
              )}

              {updateModalStatus === "success" && (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    อัปเดตข้อมูลเรียบร้อยแล้ว
                  </h4>

                  {Number(
                    modalUpdateResult?.modifiedCount || 0
                  ) === 0 && (
                    <p className="mt-2 text-sm text-amber-600">
                      พบข้อมูล แต่ค่าที่ส่งมาอาจเหมือนข้อมูลเดิม
                    </p>
                  )}

                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl bg-slate-100 p-4">
                      <p className="text-xs text-slate-500">
                        พบข้อมูล
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {Number(
                          modalUpdateResult?.matchedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-xs text-green-700">
                        แก้ไขจริง
                      </p>

                      <p className="mt-1 text-xl font-bold text-green-700">
                        {Number(
                          modalUpdateResult?.modifiedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {updateModalStatus === "error" && (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="h-9 w-9 text-red-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    ดำเนินการไม่สมบูรณ์
                  </h4>

                  <p className="mt-2 text-sm text-red-600">
                    {modalUpdateResult?.message ||
                      `มีรายการไม่สำเร็จ ${Number(
                        modalUpdateResult?.failedCount || 0
                      ).toLocaleString()} รายการ`}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-xs text-green-700">
                        แก้ไขสำเร็จ
                      </p>

                      <p className="mt-1 text-xl font-bold text-green-700">
                        {Number(
                          modalUpdateResult?.modifiedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4">
                      <p className="text-xs text-red-700">
                        ไม่สำเร็จ
                      </p>

                      <p className="mt-1 text-xl font-bold text-red-700">
                        {Number(
                          modalUpdateResult?.failedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
              {updateModalStatus === "confirm" && (
                <>
                  <button
                    type="button"
                    onClick={closeUpdateModal}
                    className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>

                  <button
                    type="button"
                    onClick={confirmUpdateData}
                    disabled={
                      confirmationText.trim() !== "UPDATE"
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <FileSpreadsheet className="h-5 w-5" />
                    ยืนยันการอัปเดต
                  </button>
                </>
              )}

              {updateModalStatus === "processing" && (
                <p className="text-sm text-slate-500">
                  กำลังดำเนินการ กรุณารอสักครู่...
                </p>
              )}

              {(updateModalStatus === "success" ||
                updateModalStatus === "error") && (
                <button
                  type="button"
                  onClick={closeUpdateModal}
                  className="rounded-xl bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-800"
                >
                  ปิด
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function StatCard({ title, value, icon: Icon }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{title}</p>
        <Icon className="h-5 w-5 text-slate-400" />
      </div>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {Number(value || 0).toLocaleString()}
      </p>
    </div>
  );
}

function ProgressBar({ current, total, mode }) {
  const percentage =
    total > 0 ? Math.round((current / total) * 100) : 0;

  const label =
    mode === "update"
      ? "กำลังอัปเดตข้อมูล"
      : "กำลังตรวจสอบข้อมูล";

  return (
    <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
      <div className="mb-2 flex justify-between gap-4 text-sm text-blue-800">
        <span>
          {label} Batch {current} / {total}
        </span>

        <span>{percentage}%</span>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-blue-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{
            width: `${percentage}%`,
          }}
        />
      </div>
    </div>
  );
}