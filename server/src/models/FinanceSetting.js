import mongoose from 'mongoose';

const financeSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: 'finance_config',
      unique: true,
      immutable: true,
    },
    approvalThreshold: {
      type: Number,
      default: 50000,
      min: 0,
    },
    fiscalYearStartMonth: {
      type: Number,
      default: 4, // April
      min: 1,
      max: 12,
    },
    defaultPaymentTerms: {
      type: Number,
      default: 30, // 30 days
      min: 0,
    },
    defaultTaxRate: {
      type: Number,
      default: 18, // 18% GST
      min: 0,
    },
    currency: {
      type: String,
      default: 'INR',
      trim: true,
    },
    autoRecoveryReminders: {
      type: Boolean,
      default: true,
    },
    overdueGraceDays: {
      type: Number,
      default: 3,
      min: 0,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const FinanceSetting =
  mongoose.models.FinanceSetting ||
  mongoose.model('FinanceSetting', financeSettingSchema, 'financesettings');

export default FinanceSetting;
