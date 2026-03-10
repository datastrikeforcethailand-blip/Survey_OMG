// api/servey/login
import { NextResponse } from "next/server";
import { connectMongoDB } from "../../../../lib/mongodb";
import User from "../../../../models/user";
import bcrypt from "bcryptjs";

export async function POST(req) {
  try {
    console.log("LOGIN API START");

    await connectMongoDB();
    console.log("Mongo connected");

    const body = await req.json();
    console.log("BODY:", body);

    const { user_id, user_password } = body || {};

    if (!user_id || !user_password) {
      return NextResponse.json(
        { success: false, message: "กรุณากรอก user_id และ user_password" },
        { status: 400 }
      );
    }

    const user = await User.findOne({ user_id });
    console.log("FOUND USER:", user ? user.user_id : "not found");

    if (!user) {
      return NextResponse.json(
        { success: false, message: "ไม่พบผู้ใช้" },
        { status: 404 }
      );
    }

    console.log("HASH IN DB:", user.user_password);

    const isMatch = await bcrypt.compare(user_password, user.user_password);
    console.log("COMPARE RESULT:", isMatch);

    if (!isMatch) {
      return NextResponse.json(
        { success: false, message: "รหัสผ่านไม่ถูกต้อง" },
        { status: 401 }
      );
    }

    return NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("LOGIN API ERROR:", error);
    return NextResponse.json(
      {
        success: false,
        message: "เกิดข้อผิดพลาด",
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

