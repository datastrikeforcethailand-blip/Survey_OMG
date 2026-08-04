import { connectMongoDB } from "@/lib/mongodb";
import Survey from "@/models/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_UPDATES_PER_REQUEST = 1000;

const BLOCKED_FIELDS = new Set([
  "_id",
  "__v",
  "surID",
  "createdAt",
  "updatedAt",
]);

function normalizeValue(value) {
  if (typeof value !== "string") {
    return value;
  }

  const trimmed = value.trim();

  if (trimmed === "__EMPTY__") return "";
  if (trimmed === "__NULL__") return null;

  if (trimmed === "true") return true;
  if (trimmed === "false") return false;

  // แปลงข้อความ JSON กลับเป็น Array หรือ Object
  if (
    (trimmed.startsWith("[") && trimmed.endsWith("]")) ||
    (trimmed.startsWith("{") && trimmed.endsWith("}"))
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed;
    }
  }

  // เก็บรหัสที่มีเลข 0 นำหน้าเป็น String
  if (/^0\d+/.test(trimmed)) {
    return trimmed;
  }

  if (/^-?\d+(\.\d+)?$/.test(trimmed)) {
    const numberValue = Number(trimmed);

    if (Number.isFinite(numberValue)) {
      return numberValue;
    }
  }

  return trimmed;
}

function sanitizeUpdateData(data) {
  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return {};
  }

  const cleaned = {};

  for (const [rawKey, rawValue] of Object.entries(data)) {
    const key = String(rawKey ?? "").trim();

    if (!key) continue;
    if (BLOCKED_FIELDS.has(key)) continue;

    // ป้องกัน MongoDB operators จากไฟล์ CSV
    if (key.startsWith("$")) continue;

    // ป้องกัน dotted path ผิดรูปแบบ
    if (key.startsWith(".")) continue;
    if (key.endsWith(".")) continue;
    if (key.includes("..")) continue;

    cleaned[key] = normalizeValue(rawValue);
  }

  return cleaned;
}

function normalizeUpdates(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const updateMap = new Map();

  for (const item of values) {
    const surID = String(item?.surID ?? "").trim();
    const data = sanitizeUpdateData(item?.data);

    if (!surID) continue;
    if (Object.keys(data).length === 0) continue;

    // ถ้า surID ซ้ำ ให้ใช้ข้อมูลแถวล่าสุด
    updateMap.set(surID, {
      surID,
      data,
    });
  }

  return Array.from(updateMap.values());
}

function getValueByPath(object, path) {
  return String(path)
    .split(".")
    .reduce((current, key) => current?.[key], object);
}

export async function POST(req) {
  try {
    const body = await req.json();

    const updates = normalizeUpdates(body?.updates);
    const preview = body?.preview === true;
    const confirmation = body?.confirmation;

    if (updates.length === 0) {
      return Response.json(
        {
          success: false,
          message: "ไม่พบรายการที่สามารถอัปเดตได้",
        },
        { status: 400 }
      );
    }

    if (updates.length > MAX_UPDATES_PER_REQUEST) {
      return Response.json(
        {
          success: false,
          message: `ส่งได้ไม่เกิน ${MAX_UPDATES_PER_REQUEST} รายการต่อครั้ง`,
          receivedCount: updates.length,
        },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const collection = Survey.collection;
    const requestedSurIDs = updates.map((item) => item.surID);

    /*
    |--------------------------------------------------------------------------
    | ค้นหา Document จริงก่อนทั้ง Preview และ Update
    |--------------------------------------------------------------------------
    */

    const existingDocuments = await collection
      .find(
        {
          surID: {
            $in: requestedSurIDs,
          },
        },
        {
          projection: {
            _id: 1,
            surID: 1,
          },
        }
      )
      .toArray();

    /*
    |--------------------------------------------------------------------------
    | สร้าง Map: surID -> MongoDB _id
    |--------------------------------------------------------------------------
    */

    const documentMap = new Map();

    for (const document of existingDocuments) {
      const key = String(document?.surID ?? "").trim();

      if (!key) continue;

      documentMap.set(key, {
        _id: document._id,
        surID: key,
      });
    }

    const foundSurIDs = requestedSurIDs.filter((surID) =>
      documentMap.has(surID)
    );

    const notFoundSurIDs = requestedSurIDs.filter(
      (surID) => !documentMap.has(surID)
    );

    /*
    |--------------------------------------------------------------------------
    | Preview
    |--------------------------------------------------------------------------
    */

    if (preview) {
      return Response.json(
        {
          success: true,
          mode: "preview",
          requestedCount: updates.length,
          foundCount: foundSurIDs.length,
          notFoundCount: notFoundSurIDs.length,
          foundSurIDs,
          notFoundSurIDs,
          debugSample: updates.slice(0, 3),
        },
        { status: 200 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ตรวจคำยืนยัน
    |--------------------------------------------------------------------------
    */

    if (confirmation !== "UPDATE") {
      return Response.json(
        {
          success: false,
          message:
            'การอัปเดตจริงต้องส่ง confirmation เป็น "UPDATE"',
        },
        { status: 400 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | เลือกเฉพาะรายการที่พบจริง
    |--------------------------------------------------------------------------
    */

    const validUpdates = updates.filter((item) =>
      documentMap.has(item.surID)
    );

    if (validUpdates.length === 0) {
      return Response.json(
        {
          success: false,
          mode: "update",
          message: "ไม่พบ surID ที่สามารถอัปเดตได้",
          requestedCount: updates.length,
          matchedCount: 0,
          modifiedCount: 0,
          notFoundCount: updates.length,
          notFoundSurIDs: requestedSurIDs,
        },
        { status: 404 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | เก็บข้อมูลก่อนอัปเดตไว้ตรวจสอบ
    |--------------------------------------------------------------------------
    */

    const firstUpdate = validUpdates[0];
    const firstDocumentInfo = documentMap.get(
      firstUpdate.surID
    );

    const beforeDocument = await collection.findOne({
      _id: firstDocumentInfo._id,
    });

    /*
    |--------------------------------------------------------------------------
    | สร้าง Bulk Operations
    |
    | ใช้ _id จริงของ MongoDB เป็น Filter
    |--------------------------------------------------------------------------
    */

    const now = new Date();

    const operations = validUpdates.map((item) => {
      const documentInfo = documentMap.get(item.surID);

      return {
        updateOne: {
          filter: {
            _id: documentInfo._id,
          },
          update: {
            $set: {
              ...item.data,
              updatedAt: now,
            },
          },
          upsert: false,
        },
      };
    });

    console.log("Update operation sample:", {
      requestedSurID: firstUpdate.surID,
      mongoID: String(firstDocumentInfo._id),
      updateData: firstUpdate.data,
    });

    /*
    |--------------------------------------------------------------------------
    | ใช้ Native MongoDB Collection
    |--------------------------------------------------------------------------
    */

    const result = await collection.bulkWrite(operations, {
      ordered: false,
    });

    /*
    |--------------------------------------------------------------------------
    | อ่านข้อมูลหลังอัปเดตเพื่อยืนยัน
    |--------------------------------------------------------------------------
    */

    const afterDocument = await collection.findOne({
      _id: firstDocumentInfo._id,
    });

    const verification = {};

    for (const path of Object.keys(firstUpdate.data)) {
      verification[path] = {
        sent: firstUpdate.data[path],
        before: getValueByPath(beforeDocument, path),
        after: getValueByPath(afterDocument, path),
      };
    }

    console.log("Bulk update result:", {
      requestedCount: updates.length,
      validUpdateCount: validUpdates.length,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    });

    return Response.json(
      {
        success: true,
        mode: "update",
        requestedCount: updates.length,
        validUpdateCount: validUpdates.length,
        matchedCount: result.matchedCount,
        modifiedCount: result.modifiedCount,
        notFoundCount: notFoundSurIDs.length,
        notFoundSurIDs,

        debug: {
          firstSurID: firstUpdate.surID,
          firstMongoID: String(firstDocumentInfo._id),
          verification,
        },
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("CSV update error:", error);

    return Response.json(
      {
        success: false,
        message: error?.message || "Server error",
        stack:
          process.env.NODE_ENV === "development"
            ? error?.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}