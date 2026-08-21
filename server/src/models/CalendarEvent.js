import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true },
  description: { type: String, trim: true, default: '' },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true },
  location: { type: String, trim: true, default: '' },
  type: { type: String, enum: ['Meeting', 'Task', 'Reminder', 'Other'], default: 'Meeting' },
  status: { type: String, enum: ['Scheduled', 'Completed', 'Cancelled'], default: 'Scheduled' },
  reminderMinutes: { type: Number, min: 0, default: 0 },
  assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
}, { timestamps: true });

calendarEventSchema.pre('validate', function validateTimes(next) {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) this.invalidate('endAt', 'End time must be after start time');
  next();
});

export default mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema, 'calendarEvents');
