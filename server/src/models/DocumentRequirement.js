import mongoose from 'mongoose';

const documentRequirementSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Requirement name is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'Identity Proof',
    },
    documentType: {
      type: String,
      trim: true,
      default: '',
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
    applicableDepartment: {
      type: String,
      default: 'All',
      trim: true,
    },
    applicableEmploymentType: {
      type: String,
      default: 'All',
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    createdByName: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

export const DocumentRequirement =
  mongoose.models.DocumentRequirement ||
  mongoose.model('DocumentRequirement', documentRequirementSchema, 'documentrequirements');

export default DocumentRequirement;
