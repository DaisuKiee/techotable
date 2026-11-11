const mongoose = require('mongoose');

/**
 * B-LO's memory for one user in one place (scope), e.g. the schedule builder.
 *
 *  - conversations: the chat history per context key (a section id), so a
 *    conversation comes back after a refresh or on another device.
 *  - notes: lasting things the user told B-LO (preferences, rules, decisions),
 *    extracted after each exchange and recalled in every later conversation
 *    in this scope, across sections. Each note can be deleted by the user.
 */
const MessageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant'], required: true },
  content: { type: String, required: true, maxlength: 12000 },
  at: { type: Date, default: Date.now },
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  key: { type: String, required: true }, // e.g. the section id
  label: { type: String, default: '' }, // e.g. the section code, for display
  messages: { type: [MessageSchema], default: [] },
  updatedAt: { type: Date, default: Date.now },
}, { _id: false });

const NoteSchema = new mongoose.Schema({
  text: { type: String, required: true, maxlength: 300 },
  // Which conversation it came from (section code), for context in the list
  source: { type: String, default: '' },
  at: { type: Date, default: Date.now },
});

const AssistantMemorySchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  scope: { type: String, required: true, default: 'builder' },
  conversations: { type: [ConversationSchema], default: [] },
  notes: { type: [NoteSchema], default: [] },
}, { timestamps: true });

AssistantMemorySchema.index({ user: 1, scope: 1 }, { unique: true });

// Limits that keep one document small
AssistantMemorySchema.statics.LIMITS = {
  messagesPerConversation: 60, // oldest dropped first
  conversations: 40, // least recently used dropped first
  notes: 40,
  historyForModel: 12, // most recent messages sent back to the model
};

module.exports = mongoose.model('AssistantMemory', AssistantMemorySchema);
