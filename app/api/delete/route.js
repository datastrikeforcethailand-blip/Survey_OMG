import { connectMongoDB } from "@/lib/mongodb";
import Survey from "@/models/survey";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_IDS_PER_REQUEST = 1000;

/**
 * ทำความสะอาดรายการ surID
 * - แปลงเป็น String
 * - trim ช่องว่าง
 * - ตัดค่าว่าง
 * - ตัดค่าซ้ำ
 */
function normalizeSurIDs(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [
    ...new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean)
    ),
  ];
}

export async function POST(req) {
  try {
    const body = await req.json();

    const surIDs = normalizeSurIDs(body?.surIDs);
    const preview = body?.preview === true;
    const confirmation = body?.confirmation;

    if (surIDs.length === 0) {
      return Response.json(
        {
          success: false,
          message: "ไม่พบรายการ surID",
        },
        { status: 400 }
      );
    }

    if (surIDs.length > MAX_IDS_PER_REQUEST) {
      return Response.json(
        {
          success: false,
          message: `ส่งได้ไม่เกิน ${MAX_IDS_PER_REQUEST.toLocaleString()} รหัสต่อครั้ง`,
          receivedCount: surIDs.length,
        },
        { status: 400 }
      );
    }

    await connectMongoDB();

    const collection = Survey.collection;

    /*
    |--------------------------------------------------------------------------
    | ค้นหา Document ที่มีอยู่จริง
    |--------------------------------------------------------------------------
    */

    const existingDocuments = await collection
      .find(
        {
          surID: {
            $in: surIDs,
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
    | จัดทำ Map ของ surID และ _id
    |--------------------------------------------------------------------------
    */

    const documentMap = new Map();

    for (const document of existingDocuments) {
      const surID = String(document?.surID ?? "").trim();

      if (!surID) continue;

      documentMap.set(surID, {
        _id: document._id,
        surID,
      });
    }

    const foundSurIDs = surIDs.filter((surID) =>
      documentMap.has(surID)
    );

    const notFoundSurIDs = surIDs.filter(
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
          requestedCount: surIDs.length,
          foundCount: foundSurIDs.length,
          notFoundCount: notFoundSurIDs.length,
          foundSurIDs,
          notFoundSurIDs,
        },
        { status: 200 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ตรวจสอบคำยืนยัน
    |--------------------------------------------------------------------------
    */

    if (confirmation !== "DELETE") {
      return Response.json(
        {
          success: false,
          message:
            'การลบจริงต้องส่ง confirmation เป็น "DELETE"',
        },
        { status: 400 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ไม่มี Document ที่ลบได้
    |--------------------------------------------------------------------------
    */

    if (existingDocuments.length === 0) {
      return Response.json(
        {
          success: true,
          mode: "delete",
          requestedCount: surIDs.length,
          foundCount: 0,
          deletedCount: 0,
          notFoundCount: surIDs.length,
          notFoundSurIDs: surIDs,
        },
        { status: 200 }
      );
    }

    /*
    |--------------------------------------------------------------------------
    | ใช้ MongoDB _id จริงในการลบ
    |--------------------------------------------------------------------------
    */

    const mongoIDs = existingDocuments.map(
      (document) => document._id
    );

    const result = await collection.deleteMany({
      _id: {
        $in: mongoIDs,
      },
    });

    /*
    |--------------------------------------------------------------------------
    | ตรวจสอบว่ามีรายการใดยังเหลืออยู่หรือไม่
    |--------------------------------------------------------------------------
    */

    const remainingDocuments = await collection
      .find(
        {
          _id: {
            $in: mongoIDs,
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

    const remainingSurIDs = remainingDocuments
      .map((document) =>
        String(document?.surID ?? "").trim()
      )
      .filter(Boolean);

    console.log("Delete survey result:", {
      requestedCount: surIDs.length,
      foundCount: foundSurIDs.length,
      deletedCount: result.deletedCount,
      notFoundCount: notFoundSurIDs.length,
      remainingCount: remainingSurIDs.length,
    });

    return Response.json(
      {
        success: true,
        mode: "delete",
        requestedCount: surIDs.length,
        foundCount: foundSurIDs.length,
        deletedCount: Number(result.deletedCount || 0),
        notFoundCount: notFoundSurIDs.length,
        notFoundSurIDs,
        remainingCount: remainingSurIDs.length,
        remainingSurIDs,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete survey error:", error);

    return Response.json(
      {
        success: false,
        message:
          error?.message ||
          "เกิดข้อผิดพลาดในการลบข้อมูล",
        stack:
          process.env.NODE_ENV === "development"
            ? error?.stack
            : undefined,
      },
      { status: 500 }
    );
  }
}