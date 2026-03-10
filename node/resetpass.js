import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Connect MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// Schema ตามโครงสร้างล่าสุด
const UserSchema = new mongoose.Schema({
  user_id: { type: String, required: true, unique: true },
  user_password: { type: String, required: true },   // hash ก่อนเก็บ!
  user_first_name: { type: String, required: true },
  user_last_name: { type: String, required: true },
  user_tel: { type: String },
  role: { type: String, enum: ["admin", "member", "customer"], default: "member" },
}, { timestamps: true });

const User = mongoose.models.User || mongoose.model("User", UserSchema, "user");

async function updatePasswordToHash() {
  const users = await User.find({});
  for (const user of users) {
    // สมมุติความยาว hash bcrypt > 30 ตัวอักษร (plain text มักสั้นกว่า)
    if (user.user_password && user.user_password.length < 30) {
      const hash = await bcrypt.hash(user.user_password, 10);
      user.user_password = hash;
      await user.save();
      console.log(`Hashed: ${user.user_id}`);
    }
  }
  mongoose.disconnect();
  console.log("All user passwords hashed!");
}

updatePasswordToHash();
