import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema(
  {
    name:  { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone: { type: String, default: "" },
    password: { type: String, required: true, minlength: 6, select: false },
    gender: { type: String, enum: ["MALE", "FEMALE", "OTHER"], required: true },
    role: { type: String, enum: ["RIDER", "DRIVER", "ADMIN"], default: "RIDER" },
    profilePicture: { type: String, default: "" },

    //Privacy
    nameVisibility: { type: String, enum: ["FULL", "FIRST_NAME", "INITIALS"], default: "FULL" },
    isProfileBlurred: { type: Boolean, default: true },

    //Rating
    rating: { type: Number, default: 5.0, min: 1, max: 5 },
    totalRatings: { type: Number, default: 0 },

    //Safety
    trustedContacts: [{ name: String, phone: String, email: String }],

    //Status
    isBlocked: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },

    //Complaints
    complaintsAgainst: [{ type: mongoose.Schema.Types.ObjectId, ref: "Complaint" }],
  },
  { timestamps: true }
);

UserSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

UserSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

UserSchema.methods.getDisplayName = function () {
  if (this.nameVisibility === "FULL") return this.name;
  if (this.nameVisibility === "FIRST_NAME") return this.name.split(" ")[0];
  return this.name.split(" ").map((n) => n[0] + ".").join(" ");
};

export default mongoose.model("User", UserSchema);