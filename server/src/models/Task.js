import mongoose from 'mongoose';

const { Schema } = mongoose;

const taskSchema = new Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true },
    description: { type: String, trim: true },
    projectId: { type: Schema.Types.ObjectId, ref: 'Project', default: null },
    priority: { type: String, enum: ['Low', 'Medium', 'High'], default: 'Medium' },
    status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Overdue'], default: 'Pending' },
    dueDate: { type: Date, default: null },
    startDate: { type: Date, default: null },
    department: { type: String, trim: true, default: '' },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
    notes: { type: Array, default: [] },
  },
  {
    timestamps: true,
  }
);

// Add a toJSON method to remove internal fields if needed
taskSchema.methods.toJSON = function () {
  const obj = this.toObject();
  return obj;
};

const Task = mongoose.model('Task', taskSchema);
export default Task;
