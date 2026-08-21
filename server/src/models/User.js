import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please provide a valid email address'
      ]
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false, // Don't return password in queries by default
    },
    firstName: {
      type: String,
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
    },
    phone: { type: String, trim: true, default: '' },
    designation: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, enum: ['', 'HR', 'Sales', 'Business Development', 'Finance', 'Tech', 'Non-Tech'], default: '' },
    location: { type: String, trim: true, default: '' },
    emergencyContact: { type: String, trim: true, default: '' },
    role: {
      type: String,
      enum: ['employee'],
      default: 'employee'
    },
    rbacRoleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Role',
      default: null,
      index: true,
    },
    rbacRoleKey: {
      type: String,
      default: '',
      lowercase: true,
      trim: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastLogin: {
      type: Date,
      default: null
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
  // Only hash if password is new or modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcryptjs.genSalt(10);
    this.password = await bcryptjs.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (enteredPassword) {
  return await bcryptjs.compare(enteredPassword, this.password);
};

// Method to get user data without password
userSchema.methods.toJSON = function () {
  const user = this.toObject();
  delete user.password;
  return user;
};

export const User = mongoose.models.User || mongoose.model('User', userSchema, 'users');
export default User;
