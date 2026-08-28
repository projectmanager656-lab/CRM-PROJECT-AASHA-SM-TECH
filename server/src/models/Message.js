import mongoose from 'mongoose';

const schema = new mongoose.Schema(
  {
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: 'senderModel'
    },
    senderModel: {
      type: String,
      required: true,
      enum: ['User', 'Admin', 'SuperAdmin']
    },
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true,
      refPath: 'recipientModel'
    },
    recipientModel: {
      type: String,
      required: true,
      enum: ['User', 'Admin', 'SuperAdmin']
    },
    content: {
      type: String,
      required: true,
      trim: true,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Compound indexes for fetching conversations and messages efficiently
schema.index({ sender: 1, senderModel: 1, recipient: 1, recipientModel: 1, createdAt: -1 });
schema.index({ recipient: 1, recipientModel: 1, sender: 1, senderModel: 1, createdAt: -1 });

export default mongoose.models.Message || mongoose.model('Message', schema, 'messages');
