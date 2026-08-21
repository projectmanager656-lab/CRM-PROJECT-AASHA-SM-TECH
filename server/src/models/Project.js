import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  category: { type: String, enum: ['Tech', 'Non-Tech'], required: true, default: 'Tech' },
  status: { type: String, enum: ['Planning', 'Active', 'On Hold', 'Completed'], default: 'Planning' },
  startDate: { type: Date, default: null },
  dueDate: { type: Date, default: null },
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  sharedWith: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
}, { timestamps: true });
projectSchema.pre('validate', function (next) {
  if (this.startDate && this.dueDate && this.dueDate < this.startDate) {
    this.invalidate('dueDate', 'Due date must be on or after start date');
  }
  next();
});

export default mongoose.models.Project || mongoose.model('Project', projectSchema, 'projects');
