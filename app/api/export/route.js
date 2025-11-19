import { connectMongoDB } from "@/lib/mongodb";
import Survey from "@/models/survey";

export async function GET(req) {
  await connectMongoDB();

  // *** ดึง query จาก URL แบบ App Router ***
  const { searchParams } = new URL(req.url);
  const after = searchParams.get("after"); // string หรือ null

  let filter = {};

  if (after) {
    filter.createdAt = { $gt: new Date(after) };
  }

  const surveys = await Survey.find(filter)
    .sort({ createdAt: 1 })
    .lean();

  const cleaned = surveys.map(({ _id, __v, ...rest }) => rest);

  return Response.json(cleaned, { status: 200 });
}
