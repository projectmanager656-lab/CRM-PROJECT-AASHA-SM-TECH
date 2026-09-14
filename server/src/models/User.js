import bcryptjs from 'bcryptjs';
import mongoose from 'mongoose';

const standardDepartmentNames = ['HR', 'Finance', 'Business Development', 'Digital Marketing', 'Video Editor', 'Tech'];

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
    department: {
      type: String,
      trim: true,
      default: '',
      validate: {
        validator: async function (value) {
          if (!value) return true;
          if (standardDepartmentNames.includes(value)) return true;
          try {
            const dept = await mongoose.model('Department').findOne({
              name: { $regex: `^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
              status: 'Active',
            });
            return !!dept;
          } catch (e) {
            return true;
          }
        },
        message: (props) => `${props.value} is not a recognized official or active department in Department Master`,
      },
    },
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
    employmentStatus: {
      type: String,
      enum: ['Active', 'Probation', 'On Leave', 'Notice Period', 'Inactive', 'Exited', 'Terminated'],
      default: 'Active',
    },
    accessStatus: {
      type: String,
      enum: ['Active', 'Restricted', 'Revoked'],
      default: 'Active',
    },
    restrictedModules: {
      type: [String],
      default: [],
    },
    customPermissions: {
      type: Map,
      of: Object,
      default: {},
    },
    lastAccessChange: {
      action: { type: String, default: '' },
      date: { type: Date, default: null },
      performedByName: { type: String, default: '' },
    },
    exitDate: {
      type: Date,
      default: null,
    },
    terminationReason: {
      type: String,
      default: '',
    },
    terminationDate: {
      type: Date,
      default: null,
    },
    terminationComments: {
      type: String,
      default: '',
    },
    lastLogin: {
      type: Date,
      default: null
    },

    // ── Structured HR Information ──
    personalInfo: {
      profilePhoto: { type: String, default: '' },
      fullName: { type: String, default: '' },
      email: { type: String, default: '' },
      phoneNumber: { type: String, default: '' },
      dateOfBirth: { type: String, default: '' },
      gender: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    jobDetails: {
      employeeId: { type: String, default: '' },
      department: { type: String, default: '' },
      designation: { type: String, default: '' },
      joiningDate: { type: String, default: '' },
      employmentType: { type: String, default: 'Full Time' },
      reportingManager: { type: String, default: '' },
      workLocation: { type: String, default: '' },
      probationEndDate: { type: String, default: '' },
      confirmationDate: { type: String, default: '' },
      noticePeriodDays: { type: Number, default: 30 },
    },
    bankDetails: {
      accountHolderName: { type: String, default: '' },
      bankName: { type: String, default: '' },
      accountNumber: { type: String, default: '' },
      ifscCode: { type: String, default: '' },
      branchName: { type: String, default: '' },
    },
    salaryDetails: {
      basicSalary: { type: Number, default: 0, min: 0 },
      allowances: { type: Number, default: 0, min: 0 },
      bonus: { type: Number, default: 0, min: 0 },
      deductions: { type: Number, default: 0, min: 0 },
      currency: { type: String, default: 'INR' },
      effectiveDate: { type: Date, default: null },
    },

    // ── Employee Lifecycle History ──
    lifecycleHistory: [
      {
        changeType: {
          type: String,
          enum: [
            'Joining',
            'Transfer',
            'Promotion',
            'Designation Change',
            'Status Change',
            'Manager Change',
            'Location Change',
            'Other',
          ],
          default: 'Other',
        },
        action: { type: String, required: true, trim: true },
        previousDepartment: { type: String, default: '' },
        newDepartment: { type: String, default: '' },
        previousDesignation: { type: String, default: '' },
        newDesignation: { type: String, default: '' },
        previousManager: { type: String, default: '' },
        newManager: { type: String, default: '' },
        previousStatus: { type: String, default: '' },
        newStatus: { type: String, default: '' },
        previousLocation: { type: String, default: '' },
        newLocation: { type: String, default: '' },
        effectiveDate: { type: Date, default: Date.now },
        reason: { type: String, default: '' },
        remarks: { type: String, default: '' },
        performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
        performedByName: { type: String, default: 'HR Manager' },
        createdAt: { type: Date, default: Date.now },
      },
    ],

    // ── Password-reset OTP fields (new – do not touch existing records) ──
    passwordResetOtpHash: { type: String, default: null, select: false },
    passwordResetOtpExpires: { type: Date, default: null },
    passwordResetOtpSentAt: { type: Date, default: null }, // resend cooldown
    passwordResetAttempts: { type: Number, default: 0 },
    passwordResetTokenHash: { type: String, default: null, select: false },
    passwordResetTokenExpires: { type: Date, default: null },
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
