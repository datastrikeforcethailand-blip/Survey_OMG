import { connectMongoDB } from "@/lib/mongodb";
import Survey from "@/models/survey";

export async function GET(req) {
  try {
    await connectMongoDB();

    const { searchParams } = new URL(req.url);

    const after = searchParams.get("after");        // ISO string
    const limitRaw = searchParams.get("limit");     // optional
    const limit = Math.min(parseInt(limitRaw || "500", 10), 2000); // กันหนักเกิน

    const filter = {};
    if (after) {
      const d = new Date(after);
      if (isNaN(d.getTime())) {
        return Response.json({ error: "Invalid 'after' datetime" }, { status: 400 });
      }
      filter.createdAt = { $gt: d };
    }

    const surveys = await Survey.find(filter)
      .sort({ createdAt: 1 })
      .limit(limit)               // ✅ สำคัญมาก
      .lean();

    const cleaned = surveys.map(({ _id, __v, ...rest }) => rest);

    // ส่ง cursor กลับไปให้เรียกต่อ
    const nextAfter =
      surveys.length > 0 ? surveys[surveys.length - 1].createdAt?.toISOString?.() : null;

    return Response.json(
      { items: cleaned, nextAfter, count: cleaned.length },
      { status: 200 }
    );
  } catch (err) {
    // ✅ ให้มี error body เวลา 500 จะได้เห็นใน GAS
    return Response.json(
      { error: "Server error", message: err?.message || String(err) },
      { status: 500 }
    );
  }
}
