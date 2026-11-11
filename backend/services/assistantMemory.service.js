/**
 * B-LO's memory: saved conversations and the notes it keeps about a user.
 *
 * After each answer, extractNotes() asks Gemini (separately, at temperature 0)
 * which lasting facts the USER stated in that exchange - preferences, rules,
 * decisions - and stores them as short notes. Those notes go into every later
 * system prompt in the same scope, so B-LO "remembers" across sections and
 * sessions. Users can see and delete them.
 */
const AssistantMemory = require('../models/AssistantMemory.model');

const { LIMITS } = AssistantMemory;

/** The user's memory document for a scope, created on first use. */
const load = (userId, scope = 'builder') => AssistantMemory.findOneAndUpdate(
  { user: userId, scope },
  { $setOnInsert: { user: userId, scope } },
  { upsert: true, new: true }
);

const findConversation = (doc, key) => doc.conversations.find(c => c.key === String(key));

/** Messages of one conversation, oldest first. */
const getConversation = async (userId, scope, key) => {
  const doc = await load(userId, scope);
  const convo = findConversation(doc, key);
  return { messages: convo?.messages || [], notes: doc.notes };
};

/** Recent messages to send back to the model, plus the notes. */
const getContext = async (userId, scope, key) => {
  const { messages, notes } = await getConversation(userId, scope, key);
  return {
    history: messages.slice(-LIMITS.historyForModel).map(m => ({ role: m.role, content: m.content })),
    notes: notes.map(n => n.text),
  };
};

/** Save a question and its answer. */
const appendExchange = async (userId, scope, key, label, question, answer) => {
  const doc = await load(userId, scope);
  let convo = findConversation(doc, key);
  if (!convo) {
    doc.conversations.push({ key: String(key), label: label || '', messages: [] });
    convo = doc.conversations[doc.conversations.length - 1];
  }
  convo.messages.push({ role: 'user', content: String(question).slice(0, 12000) });
  convo.messages.push({ role: 'assistant', content: String(answer).slice(0, 12000) });
  if (convo.messages.length > LIMITS.messagesPerConversation) {
    convo.messages.splice(0, convo.messages.length - LIMITS.messagesPerConversation);
  }
  if (label) convo.label = label;
  convo.updatedAt = new Date();

  // Keep only the most recently used conversations
  if (doc.conversations.length > LIMITS.conversations) {
    doc.conversations.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
    doc.conversations.splice(LIMITS.conversations);
  }
  await doc.save();
};

const clearConversation = async (userId, scope, key) => {
  await AssistantMemory.updateOne({ user: userId, scope }, { $pull: { conversations: { key: String(key) } } });
};

const deleteNote = async (userId, scope, noteId) => {
  await AssistantMemory.updateOne({ user: userId, scope }, { $pull: { notes: { _id: noteId } } });
};

const clearNotes = async (userId, scope) => {
  await AssistantMemory.updateOne({ user: userId, scope }, { $set: { notes: [] } });
};

const normalise = (t) => String(t).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Pull lasting facts out of one exchange and store them as notes.
 * Returns the notes that were added (strings). Never throws.
 */
const extractNotes = async (userId, scope, source, question, answer) => {
  try {
    const doc = await load(userId, scope);
    const existing = doc.notes.map(n => n.text);
    const { generateChatResponse } = require('./gemini.service');

    const systemPrompt = [
      'You maintain the long-term memory of B-LO, a scheduling assistant for a school timetable.',
      'From ONE exchange between the user and B-LO, list lasting facts THE USER stated that will matter in future scheduling conversations:',
      'their preferences, rules, constraints and decisions (for example: a teacher\'s preferred times, days to keep free, rooms to avoid, how they like answers).',
      'Also include an explicit "remember ..." request from the user.',
      'Do NOT include: questions, one-off requests, anything B-LO suggested that the user did not confirm, data B-LO can already see on the grid, or anything already in EXISTING NOTES.',
      'If the user says to forget something, output it in "forget" using the exact existing note text.',
      'Write each note as a short third-person sentence (under 25 words) and name the section when it only applies to one.',
      'Reply with ONLY JSON: {"add": ["..."], "forget": ["..."]}. Use empty arrays when there is nothing.',
      '',
      `SECTION: ${source || 'unknown'}`,
      'EXISTING NOTES:',
      ...(existing.length ? existing.map(t => `- ${t}`) : ['- none']),
    ].join('\n');

    const reply = await generateChatResponse(
      `USER: ${String(question).slice(0, 2000)}\n\nB-LO: ${String(answer).slice(0, 4000)}`,
      {}, [], { systemPrompt, temperature: 0, maxOutputTokens: 2048 }
    );
    if (!reply.success) return [];

    const json = String(reply.message).match(/\{[\s\S]*\}/);
    if (!json) return [];
    let parsed;
    try { parsed = JSON.parse(json[0]); } catch { return []; }

    const seen = new Set(existing.map(normalise));
    const add = (Array.isArray(parsed.add) ? parsed.add : [])
      .map(t => String(t).trim().slice(0, 300))
      .filter(t => t.length > 3 && !seen.has(normalise(t)))
      .slice(0, 5);
    const forget = new Set((Array.isArray(parsed.forget) ? parsed.forget : []).map(normalise));

    if (!add.length && !forget.size) return [];
    const fresh = await load(userId, scope);
    if (forget.size) fresh.notes = fresh.notes.filter(n => !forget.has(normalise(n.text)));
    add.forEach(text => fresh.notes.push({ text, source: source || '' }));
    if (fresh.notes.length > LIMITS.notes) fresh.notes.splice(0, fresh.notes.length - LIMITS.notes);
    await fresh.save();
    return add;
  } catch (error) {
    console.error('B-LO memory update failed:', error.message);
    return [];
  }
};

module.exports = {
  getConversation, getContext, appendExchange, clearConversation, deleteNote, clearNotes, extractNotes,
};
