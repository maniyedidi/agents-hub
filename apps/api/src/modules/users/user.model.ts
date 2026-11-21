import mongoose, { Schema } from "mongoose";

const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ["admin", "user"], default: "user" },
    active: { type: Boolean, default: true }
  },
  { timestamps: true, versionKey: false }
);

// Never leak the hash in API responses.
UserSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    return ret;
  }
});

export const UserModel = mongoose.model("User", UserSchema);
