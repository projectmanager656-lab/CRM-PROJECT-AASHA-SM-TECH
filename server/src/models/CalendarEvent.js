import mongoose from 'mongoose';

const calendarEventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true, default: '' },
    startAt: { type: Date, required: true, index: true },
    endAt: { type: Date, required: true },
    location: { type: String, trim: true, default: '' },
    meetingLink: { type: String, trim: true, default: '' },
    department: { type: String, trim: true, default: '' },
    type: {
      type: String,
      enum: [
        'Meeting',
        'HR Meeting',
        'Employee Meeting',
        'Interview',
        'Company Event',
        'HR Event',
        'Workshop',
        'Training',
        'Leave',
        'Holiday',
        'Payroll Deadline',
        'Task',
        'Reminder',
        'Other',
      ],
      default: 'Meeting',
    },
    status: {
      type: String,
      enum: ['Scheduled', 'Completed', 'Rescheduled', 'Cancelled'],
      default: 'Scheduled',
    },
    reminderMinutes: { type: Number, min: 0, default: 0 },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    participants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Interview integration fields (optional)
    candidate: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate', default: null },
    candidateName: { type: String, trim: true, default: '' },
    candidateEmail: { type: String, trim: true, default: '' },
    candidatePhone: { type: String, trim: true, default: '' },
    jobPosition: { type: String, trim: true, default: '' },
    interviewRound: { type: String, trim: true, default: '' },
    interviewType: {
      type: String,
      enum: ['Online Video', 'In-Person', 'Telephonic', ''],
      default: 'Online Video',
    },
    notes: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

calendarEventSchema.pre('validate', function validateTimes(next) {
  if (this.startAt && this.endAt && this.endAt <= this.startAt) {
    this.invalidate('endAt', 'End time must be after start time');
  }
  next();
});

export default mongoose.models.CalendarEvent || mongoose.model('CalendarEvent', calendarEventSchema, 'calendarEvents');
