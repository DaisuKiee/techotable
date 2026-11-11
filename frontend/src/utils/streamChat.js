/**
 * POST to a Server-Sent Events endpoint and hand back the reply as it streams.
 *
 *   const text = await streamChat('/schedules/builder-assistant/stream', body, {
 *     onChunk: (fullTextSoFar) => ..., signal,
 *   });
 *
 * The server sends `data: {"type":"chunk","content":"..."}` lines, then
 * `{"type":"done"}` or `{"type":"error","message":"..."}`. Network reads don't
 * line up with events, so partial lines are buffered until complete.
 * Resolves with the full text; rejects with an Error whose message is safe to
 * show (AbortError when `signal` aborts). Other events (done, memory) go to
 * `onEvent`.
 */
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const streamChat = async (path, body, { onChunk, onEvent, signal } = {}) => {
  const response = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('token')}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let message = response.status === 401 ? 'Your session has expired. Log in again.' : 'B-LO could not be reached.';
    try { message = (await response.json()).message || message; } catch { /* not JSON */ }
    throw new Error(message);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  let serverError = null;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      let data;
      try { data = JSON.parse(line.slice(6)); } catch { continue; }
      if (data.type === 'chunk') {
        text += data.content;
        if (onChunk) onChunk(text);
      } else if (data.type === 'error') {
        serverError = data.message || 'B-LO ran into a problem.';
      } else if (onEvent) {
        onEvent(data); // e.g. { type: 'done' } or { type: 'memory', added: [...] }
      }
    }
  }

  if (serverError && !text) throw new Error(serverError);
  return text;
};

export default streamChat;
