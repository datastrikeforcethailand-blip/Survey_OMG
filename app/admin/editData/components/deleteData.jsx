"use client";

import { useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Loader2,
  RefreshCcw,
  Search,
  Trash2,
  Upload,
  X,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";

const BATCH_SIZE = 500;
const PREVIEW_ROW_LIMIT = 20;

function cleanHeader(header) {
  return String(header || "")
    .replace(/^\uFEFF/, "")
    .trim();
}

function normalizeSurID(value) {
  return String(value ?? "").trim();
}

function buildUniqueSurIDs(rows) {
  return [
    ...new Set(
      rows
        .map((row) => normalizeSurID(row?.surID))
        .filter(Boolean)
    ),
  ];
}

function createBatches(items, batchSize) {
  const batches = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export default function DeleteData() {
  const fileInputRef = useRef(null);

  const [fileName, setFileName] = useState("");
  const [columns, setColumns] = useState([]);
  const [rows, setRows] = useState([]);
  const [parseErrors, setParseErrors] = useState([]);

  const [emptyRowCount, setEmptyRowCount] = useState(0);
  const [duplicateCount, setDuplicateCount] = useState(0);

  const [preview, setPreview] = useState(null);
  const [deleteResult, setDeleteResult] = useState(null);

  const [loading, setLoading] = useState(false);

  const [progress, setProgress] = useState({
    current: 0,
    total: 0,
    mode: "",
  });

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState("");

  const [deleteModalStatus, setDeleteModalStatus] =
    useState("confirm");

  const [modalDeleteResult, setModalDeleteResult] =
    useState(null);

  const surIDs = useMemo(
    () => buildUniqueSurIDs(rows),
    [rows]
  );

  function resetData() {
    setFileName("");
    setColumns([]);
    setRows([]);
    setParseErrors([]);
    setEmptyRowCount(0);
    setDuplicateCount(0);
    setPreview(null);
    setDeleteResult(null);

    setProgress({
      current: 0,
      total: 0,
      mode: "",
    });

    setShowDeleteModal(false);
    setConfirmationText("");
    setDeleteModalStatus("confirm");
    setModalDeleteResult(null);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearCurrentFileData() {
    setFileName("");
    setColumns([]);
    setRows([]);
    setParseErrors([]);
    setEmptyRowCount(0);
    setDuplicateCount(0);
    setPreview(null);
    setDeleteResult(null);

    setProgress({
      current: 0,
      total: 0,
      mode: "",
    });

    setShowDeleteModal(false);
    setConfirmationText("");
    setDeleteModalStatus("confirm");
    setModalDeleteResult(null);
  }

  function closeDeleteModal() {
    if (deleteModalStatus === "processing") return;

    setShowDeleteModal(false);
    setConfirmationText("");
    setDeleteModalStatus("confirm");
    setModalDeleteResult(null);
  }

  function openDeleteModal() {
    if (!preview?.foundSurIDs?.length) {
      toast.warning("ไม่พบข้อมูลที่สามารถลบได้");
      return;
    }

    setConfirmationText("");
    setModalDeleteResult(null);
    setDeleteModalStatus("confirm");
    setShowDeleteModal(true);
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
      skipEmptyLines: false,
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
          const uniqueDuplicateHeaders = [
            ...new Set(duplicateHeaders),
          ];

          setParseErrors([
            {
              message: `พบชื่อคอลัมน์ซ้ำ: ${uniqueDuplicateHeaders.join(
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
            const value = row?.[column];

            cleanedRow[column] =
              typeof value === "string"
                ? value.trim()
                : value;
          }

          return cleanedRow;
        });

        const validRows = cleanedRows.filter((row) =>
          normalizeSurID(row?.surID)
        );

        const invalidRows = cleanedRows.filter(
          (row) => !normalizeSurID(row?.surID)
        );

        const allValidSurIDs = validRows.map((row) =>
          normalizeSurID(row.surID)
        );

        const uniqueSurIDs = new Set(allValidSurIDs);

        const duplicates =
          allValidSurIDs.length - uniqueSurIDs.size;

        setColumns(parsedColumns);
        setRows(validRows);
        setEmptyRowCount(invalidRows.length);
        setDuplicateCount(duplicates);
        setParseErrors(result.errors || []);
        setPreview(null);
        setDeleteResult(null);

        toast.success(
          `อ่านไฟล์สำเร็จ พบ ${uniqueSurIDs.size.toLocaleString()} รหัส`
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

  async function previewDelete() {
    if (surIDs.length === 0) {
      toast.warning("ไม่พบ surID ที่สามารถตรวจสอบได้");
      return;
    }

    try {
      setLoading(true);
      setPreview(null);
      setDeleteResult(null);

      const batches = createBatches(surIDs, BATCH_SIZE);

      const foundSurIDs = [];
      const notFoundSurIDs = [];

      setProgress({
        current: 0,
        total: batches.length,
        mode: "preview",
      });

      for (let index = 0; index < batches.length; index += 1) {
        const response = await fetch("/api/delete", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            preview: true,
            surIDs: batches[index],
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

      const uniqueFoundSurIDs = [...new Set(foundSurIDs)];
      const uniqueNotFoundSurIDs = [
        ...new Set(notFoundSurIDs),
      ];

      setPreview({
        requestedCount: surIDs.length,
        foundCount: uniqueFoundSurIDs.length,
        notFoundCount: uniqueNotFoundSurIDs.length,
        foundSurIDs: uniqueFoundSurIDs,
        notFoundSurIDs: uniqueNotFoundSurIDs,
      });

      toast.success(
        `ตรวจสอบเรียบร้อย พบ ${uniqueFoundSurIDs.length.toLocaleString()} รายการ`
      );
    } catch (error) {
      console.error("Preview delete error:", error);

      toast.error(
        error?.message || "ตรวจสอบข้อมูลไม่สำเร็จ"
      );
    } finally {
      setLoading(false);
    }
  }

  async function confirmDeleteData() {
    if (confirmationText.trim() !== "DELETE") {
      toast.warning("กรุณาพิมพ์คำว่า DELETE ให้ถูกต้อง");
      return;
    }

    if (!preview?.foundSurIDs?.length) {
      toast.warning("ไม่พบข้อมูลที่สามารถลบได้");
      return;
    }

    const batches = createBatches(
      preview.foundSurIDs,
      BATCH_SIZE
    );

    let requestedCount = 0;
    let foundCount = 0;
    let deletedCount = 0;
    let notFoundCount = 0;
    let failedCount = 0;

    const failedBatches = [];
    const remainingSurIDs = [];

    try {
      setLoading(true);
      setDeleteResult(null);
      setModalDeleteResult(null);
      setDeleteModalStatus("processing");

      setProgress({
        current: 0,
        total: batches.length,
        mode: "delete",
      });

      for (let index = 0; index < batches.length; index += 1) {
        try {
          const response = await fetch("/api/delete", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              preview: false,
              confirmation: "DELETE",
              surIDs: batches[index],
            }),
          });

          const data = await response.json();

          if (!response.ok) {
            throw new Error(
              data?.message ||
                data?.error ||
                `ลบ Batch ${index + 1} ไม่สำเร็จ`
            );
          }

          requestedCount += Number(
            data.requestedCount || 0
          );

          foundCount += Number(data.foundCount || 0);

          deletedCount += Number(
            data.deletedCount || 0
          );

          notFoundCount += Number(
            data.notFoundCount || 0
          );

          remainingSurIDs.push(
            ...(data.remainingSurIDs || [])
          );
        } catch (error) {
          console.error(
            `Delete batch ${index + 1} failed:`,
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
          mode: "delete",
        });
      }

      const finalResult = {
        requestedCount,
        foundCount,
        deletedCount,
        notFoundCount,
        failedCount,
        failedBatches,
        remainingSurIDs: [...new Set(remainingSurIDs)],
      };

      setDeleteResult(finalResult);
      setModalDeleteResult(finalResult);
      setConfirmationText("");
      setPreview(null);

      if (failedCount > 0) {
        setDeleteModalStatus("error");

        toast.error(
          `ดำเนินการไม่สำเร็จ ${failedCount.toLocaleString()} รายการ`
        );
      } else {
        setDeleteModalStatus("success");

        if (deletedCount > 0) {
          toast.success(
            `ลบข้อมูลสำเร็จ ${deletedCount.toLocaleString()} รายการ`
          );
        } else {
          toast.warning("ไม่มีข้อมูลถูกลบ");
        }
      }
    } catch (error) {
      console.error("Delete data error:", error);

      const errorResult = {
        requestedCount: preview?.foundCount || 0,
        foundCount: 0,
        deletedCount: 0,
        notFoundCount: 0,
        failedCount: preview?.foundCount || 0,
        failedBatches: [],
        remainingSurIDs: [],
        message:
          error?.message ||
          "เกิดข้อผิดพลาดในการลบข้อมูล",
      };

      setModalDeleteResult(errorResult);
      setDeleteResult(errorResult);
      setDeleteModalStatus("error");

      toast.error(errorResult.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-900">
          ลบข้อมูลด้วยไฟล์ CSV
        </h2>

        <p className="mt-1 text-sm text-slate-500">
          อัปโหลดไฟล์ที่มีคอลัมน์ surID
          ระบบจะตรวจสอบข้อมูลก่อนลบจริง
        </p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />

          <div>
            <p className="font-semibold text-amber-900">
              โปรดตรวจสอบไฟล์ให้ถูกต้อง
            </p>

            <p className="mt-1 text-sm text-amber-700">
              ข้อมูลที่ลบจาก MongoDB
              จะไม่สามารถกู้คืนผ่านหน้านี้ได้
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
        <p className="font-semibold text-blue-900">
          รูปแบบไฟล์ CSV
        </p>

        <p className="mt-1 text-sm text-blue-700">
          ไฟล์ต้องมีคอลัมน์{" "}
          <code className="rounded bg-blue-100 px-1.5 py-0.5 font-mono">
            surID
          </code>{" "}
          ระบบจะไม่ใช้คอลัมน์อื่นในการลบ
        </p>

        <pre className="mt-3 overflow-auto rounded-lg bg-white p-3 text-xs text-slate-700">
{`surID
OMG251102-260501001
OMG251102-260501002`}
        </pre>
      </div>

      <label className="block cursor-pointer rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center transition hover:border-red-400 hover:bg-red-50">
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
                {rows.length.toLocaleString()} แถวที่มี surID
                · {columns.length.toLocaleString()} คอลัมน์
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
            พบปัญหาในไฟล์ {parseErrors.length.toLocaleString()} รายการ
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="แถวที่มี surID"
              value={rows.length}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="surID ไม่ซ้ำ"
              value={surIDs.length}
              icon={CheckCircle2}
            />

            <StatCard
              title="รหัสซ้ำ"
              value={duplicateCount}
              icon={AlertTriangle}
            />

            <StatCard
              title="แถวไม่มี surID"
              value={emptyRowCount}
              icon={XCircle}
            />
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50 px-4 py-3">
              <p className="font-semibold text-slate-800">
                ตัวอย่างข้อมูล
              </p>

              <p className="text-sm text-slate-500">
                แสดง{" "}
                {Math.min(rows.length, PREVIEW_ROW_LIMIT)} แถวแรก
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
                    .slice(0, PREVIEW_ROW_LIMIT)
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
                            className="max-w-80 truncate whitespace-nowrap border-b border-r border-slate-200 px-4 py-3 text-slate-700"
                            title={String(
                              row?.[column] ?? ""
                            )}
                          >
                            {String(row?.[column] ?? "")}
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
            onClick={previewDelete}
            disabled={loading || surIDs.length === 0}
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
            mode={progress.mode}
          />
        )}

      {preview && (
        <div className="space-y-5 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div>
            <h3 className="font-bold text-slate-900">
              ผลการตรวจสอบ MongoDB
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              ระบบจะลบเฉพาะ surID ที่พบใน MongoDB เท่านั้น
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="รหัสทั้งหมด"
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
              onClick={openDeleteModal}
              disabled={loading || preview.foundCount === 0}
              className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-6 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 className="h-5 w-5" />

              ลบข้อมูล {preview.foundCount.toLocaleString()} รายการ
            </button>
          </div>
        </div>
      )}

      {deleteResult && !showDeleteModal && (
        <div className="space-y-5 rounded-2xl border border-green-200 bg-green-50 p-5">
          <div>
            <h3 className="font-bold text-green-900">
              ผลการลบข้อมูล
            </h3>

            <p className="mt-1 text-sm text-green-700">
              ตรวจสอบผลการดำเนินการด้านล่าง
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="รายการที่ส่ง"
              value={deleteResult.requestedCount}
              icon={FileSpreadsheet}
            />

            <StatCard
              title="พบข้อมูล"
              value={deleteResult.foundCount}
              icon={CheckCircle2}
            />

            <StatCard
              title="ลบสำเร็จ"
              value={deleteResult.deletedCount}
              icon={Trash2}
            />

            <StatCard
              title="ไม่สำเร็จ"
              value={deleteResult.failedCount}
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

      {showDeleteModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onMouseDown={(event) => {
            if (
              event.target === event.currentTarget &&
              deleteModalStatus !== "processing"
            ) {
              closeDeleteModal();
            }
          }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-200 p-6">
              <div className="flex items-start gap-4">
                <div
                  className={`rounded-full p-3 ${
                    deleteModalStatus === "success"
                      ? "bg-green-100"
                      : deleteModalStatus === "error"
                        ? "bg-red-100"
                        : "bg-red-100"
                  }`}
                >
                  {deleteModalStatus === "success" ? (
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  ) : deleteModalStatus === "processing" ? (
                    <Loader2 className="h-6 w-6 animate-spin text-red-600" />
                  ) : deleteModalStatus === "error" ? (
                    <XCircle className="h-6 w-6 text-red-600" />
                  ) : (
                    <AlertTriangle className="h-6 w-6 text-red-600" />
                  )}
                </div>

                <div>
                  <h3 className="text-xl font-bold text-slate-900">
                    {deleteModalStatus === "confirm" &&
                      "ยืนยันการลบข้อมูล"}

                    {deleteModalStatus === "processing" &&
                      "กำลังลบข้อมูล"}

                    {deleteModalStatus === "success" &&
                      "ลบข้อมูลเรียบร้อยแล้ว"}

                    {deleteModalStatus === "error" &&
                      "ดำเนินการไม่สมบูรณ์"}
                  </h3>

                  <p className="mt-1 text-sm text-slate-500">
                    {deleteModalStatus === "confirm" &&
                      "การดำเนินการนี้ไม่สามารถย้อนกลับได้"}

                    {deleteModalStatus === "processing" &&
                      "กรุณาอย่าปิดหรือรีเฟรชหน้าเว็บ"}

                    {deleteModalStatus === "success" &&
                      "ระบบดำเนินการลบข้อมูลเสร็จแล้ว"}

                    {deleteModalStatus === "error" &&
                      "พบปัญหาบางส่วนระหว่างดำเนินการ"}
                  </p>
                </div>
              </div>

              {deleteModalStatus !== "processing" && (
                <button
                  type="button"
                  onClick={closeDeleteModal}
                  className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                  aria-label="ปิดหน้าต่าง"
                >
                  <X className="h-5 w-5" />
                </button>
              )}
            </div>

            <div className="space-y-5 p-6">
              {deleteModalStatus === "confirm" && (
                <>
                  <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                    <p className="text-sm text-red-700">
                      คุณกำลังจะลบข้อมูลจาก MongoDB
                    </p>

                    <p className="mt-1 text-3xl font-bold text-red-700">
                      {preview?.foundCount?.toLocaleString() || 0}
                    </p>

                    <p className="text-sm text-red-700">
                      รายการ
                    </p>
                  </div>

                  <div>
                    <label
                      htmlFor="delete-confirmation"
                      className="mb-2 block text-sm font-semibold text-slate-700"
                    >
                      พิมพ์คำว่า{" "}
                      <span className="font-mono text-red-600">
                        DELETE
                      </span>{" "}
                      เพื่อยืนยัน
                    </label>

                    <input
                      id="delete-confirmation"
                      type="text"
                      value={confirmationText}
                      onChange={(event) =>
                        setConfirmationText(event.target.value)
                      }
                      onKeyDown={(event) => {
                        if (
                          event.key === "Enter" &&
                          confirmationText.trim() ===
                            "DELETE"
                        ) {
                          confirmDeleteData();
                        }
                      }}
                      autoFocus
                      autoComplete="off"
                      placeholder="DELETE"
                      className="w-full rounded-xl border border-slate-300 px-4 py-3 font-mono outline-none transition focus:border-red-500 focus:ring-4 focus:ring-red-100"
                    />
                  </div>
                </>
              )}

              {deleteModalStatus === "processing" && (
                <div className="py-6 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <Loader2 className="h-8 w-8 animate-spin text-red-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    กำลังลบข้อมูล
                  </h4>

                  <p className="mt-2 text-sm text-slate-500">
                    กรุณารอสักครู่ ระบบกำลังดำเนินการ
                  </p>

                  {progress.total > 0 && (
                    <div className="mt-6 text-left">
                      <ProgressBar
                        current={progress.current}
                        total={progress.total}
                        mode="delete"
                      />
                    </div>
                  )}
                </div>
              )}

              {deleteModalStatus === "success" && (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    ลบข้อมูลเรียบร้อยแล้ว
                  </h4>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl bg-slate-100 p-4">
                      <p className="text-xs text-slate-500">
                        พบข้อมูล
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {Number(
                          modalDeleteResult?.foundCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-xs text-green-700">
                        ลบสำเร็จ
                      </p>

                      <p className="mt-1 text-xl font-bold text-green-700">
                        {Number(
                          modalDeleteResult?.deletedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {deleteModalStatus === "error" && (
                <div className="py-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
                    <XCircle className="h-9 w-9 text-red-600" />
                  </div>

                  <h4 className="mt-5 text-xl font-bold text-slate-900">
                    ดำเนินการไม่สมบูรณ์
                  </h4>

                  <p className="mt-2 text-sm text-red-600">
                    {modalDeleteResult?.message ||
                      `มีรายการไม่สำเร็จ ${Number(
                        modalDeleteResult?.failedCount || 0
                      ).toLocaleString()} รายการ`}
                  </p>

                  <div className="mt-6 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-xs text-green-700">
                        ลบสำเร็จ
                      </p>

                      <p className="mt-1 text-xl font-bold text-green-700">
                        {Number(
                          modalDeleteResult?.deletedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4">
                      <p className="text-xs text-red-700">
                        ไม่สำเร็จ
                      </p>

                      <p className="mt-1 text-xl font-bold text-red-700">
                        {Number(
                          modalDeleteResult?.failedCount || 0
                        ).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex justify-end gap-3 border-t border-slate-200 p-6">
              {deleteModalStatus === "confirm" && (
                <>
                  <button
                    type="button"
                    onClick={closeDeleteModal}
                    className="rounded-xl border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    ยกเลิก
                  </button>

                  <button
                    type="button"
                    onClick={confirmDeleteData}
                    disabled={
                      confirmationText.trim() !== "DELETE"
                    }
                    className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-3 font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Trash2 className="h-5 w-5" />
                    ยืนยันการลบ
                  </button>
                </>
              )}

              {deleteModalStatus === "processing" && (
                <p className="text-sm text-slate-500">
                  กำลังดำเนินการ กรุณารอสักครู่...
                </p>
              )}

              {(deleteModalStatus === "success" ||
                deleteModalStatus === "error") && (
                <button
                  type="button"
                  onClick={closeDeleteModal}
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
    mode === "delete"
      ? "กำลังลบข้อมูล"
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