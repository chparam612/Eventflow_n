/**
 * EventFlow V2 — AI Chat Widget (Attendee)
 */
import { askAttendee } from '/src/gemini.js';

const QUICK_QUESTIONS = [
  'Least crowded gate?',
  'Best time for food?',
  'Fastest exit route?',
  'Nearest restroom?'
];

export function renderAIChat() {
  return `
    <!-- Floating AI button -->
    <button id="ai-chat-fab" style="
      position: fixed; bottom: 24px; right: 20px; z-index: 200;
      width: 54px; height: 54px; border-radius: 50%;
      background: var(--green);
      border: none; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      font-size: 22px; transition: all 0.25s;
      box-shadow: 0 4px 20px rgba(0,196,154,0.35);"
      title="Ask EventFlow AI"
      aria-label="Open AI assistant">
      🤖
    </button>

    <!-- Chat Panel (slides up) -->
    <div id="ai-chat-panel" style="
      position: fixed; bottom: 0; left: 0; right: 0; z-index: 300;
      background: var(--bg-card);
      border-top: 1px solid var(--border-accent);
      border-radius: 20px 20px 0 0;
      transform: translateY(100%);
      transition: transform 0.35s cubic-bezier(0.4, 0, 0.2, 1);
      max-height: 75vh; display: flex; flex-direction: column;">

      <!-- Handle -->
      <div style="display:flex;align-items:center;justify-content:space-between;
        padding:14px 18px;border-bottom:1px solid var(--border);">
        <div style="display:flex;align-items:center;gap:10px;">
          <div style="font-size:18px;">🤖</div>
          <div>
            <div style="font-family:'Space Grotesk',sans-serif;font-weight:600;
              font-size:0.92rem;color:var(--text-primary);">EventFlow AI</div>
            <div style="font-size:0.72rem;color:var(--green);">● Crowd Guide · NMS</div>
          </div>
        </div>
        <button id="ai-chat-close" style="
          background:none;border:none;color:var(--text-muted);
          font-size:1.2rem;cursor:pointer;padding:4px;"
          aria-label="Close AI assistant">✕</button>
      </div>

      <!-- Messages -->
      <div id="ai-chat-messages" style="
        flex:1;overflow-y:auto;padding:16px;
        display:flex;flex-direction:column;gap:12px;
        min-height:160px;"
        aria-live="polite" aria-label="AI assistant conversation" role="log">
        <div style="
          background:var(--bg-card2);border:1px solid var(--border);
          border-radius:12px 12px 12px 4px;padding:12px 14px;
          max-width:85%;align-self:flex-start;">
          <p style="font-size:0.88rem;color:var(--text-primary);line-height:1.5;margin:0;">
            Hi! 👋 I'm your EventFlow AI guide for NMS. Ask me anything about entry gates, crowd levels, food, or exit planning!</p>
        </div>

        <!-- Quick questions -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;">
          ${QUICK_QUESTIONS.map(q => `
            <button class="ai-quick-q" data-q="${q}" style="
              background:var(--green-dim);border:1px solid rgba(0,196,154,0.2);
              border-radius:20px;padding:6px 12px;font-size:0.78rem;
              color:#00C49A;cursor:pointer;transition:all 0.2s;">${q}</button>
          `).join('')}
        </div>
      </div>

      <!-- Input -->
      <div style="
        padding:12px 16px;border-top:1px solid var(--border);
        display:flex;gap:8px;align-items:flex-end;
        background:var(--bg-card);">
        <input id="ai-chat-input" type="text"
          placeholder="Ask about gates, exits, crowds…"
          style="flex:1;border-radius:10px;padding:10px 14px;
            font-size:0.88rem;border-color:rgba(0,196,154,0.2);" />
        <button id="ai-chat-send" style="
          background:var(--green);border:none;border-radius:10px;
          width:40px;height:40px;color:#000;
          font-size:1rem;cursor:pointer;flex-shrink:0;
          display:flex;align-items:center;justify-content:center;
          transition:all 0.2s;"
          aria-label="Send message">→</button>
      </div>
    </div>`;
}

export function initAIChat(getCrowdContext) {
  const fab     = document.getElementById('ai-chat-fab');
  const panel   = document.getElementById('ai-chat-panel');
  const closeBtn = document.getElementById('ai-chat-close');
  const messages = document.getElementById('ai-chat-messages');
  const input   = document.getElementById('ai-chat-input');
  const sendBtn = document.getElementById('ai-chat-send');

  if (!fab || !panel) return;

  let isOpen = false;

  const openPanel = () => {
    isOpen = true;
    panel.style.transform = 'translateY(0)';
    fab.style.opacity = '0';
    fab.style.transform = 'scale(0.8)';
    setTimeout(() => input?.focus(), 350);
  };

  const closePanel = () => {
    isOpen = false;
    panel.style.transform = 'translateY(100%)';
    fab.style.opacity = '1';
    fab.style.transform = 'scale(1)';
  };

  fab.addEventListener('click', openPanel);
  closeBtn?.addEventListener('click', closePanel);

  function appendMessage(text, isUser = false) {
    const div = document.createElement('div');
    div.style.cssText = `
      background:${isUser ? 'rgba(0,196,154,0.1)' : 'var(--bg-card2)'};
      border:1px solid ${isUser ? 'rgba(0,196,154,0.2)' : 'var(--border)'};
      border-radius:${isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px'};
      padding:10px 14px;max-width:85%;
      align-self:${isUser ? 'flex-end' : 'flex-start'};
      animation:fadeIn 0.25s ease;`;
    div.innerHTML = `<p style="font-size:0.88rem;color:var(--text-primary);line-height:1.5;margin:0;">${text}</p>`;
    messages?.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function appendThinking() {
    const div = appendMessage('⏳ Thinking…', false);
    div.id = 'ai-thinking';
    return div;
  }

  async function sendMessage(text) {
    if (!text.trim()) return;
    const userEl = appendMessage(text, true);
    if (input) input.value = '';
    if (sendBtn) { sendBtn.disabled = true; sendBtn.style.opacity = '0.5'; }

    const thinking = appendThinking();

    try {
      const ctx = getCrowdContext ? getCrowdContext() : null;
      const reply = await askAttendee(text, ctx);
      thinking.remove();
      appendMessage(reply, false);
    } catch (e) {
      thinking.remove();
      appendMessage('Sorry, I\'m temporarily unavailable. Please check venue screens.', false);
    } finally {
      if (sendBtn) { sendBtn.disabled = false; sendBtn.style.opacity = '1'; }
    }
  }

  sendBtn?.addEventListener('click', () => sendMessage(input?.value));
  input?.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(input.value); });

  // Quick question chips
  document.querySelectorAll('.ai-quick-q').forEach(btn => {
    btn.addEventListener('click', () => sendMessage(btn.dataset.q));
  });

  // FAB hover
  fab.addEventListener('mouseenter', () => { if (!isOpen) fab.style.transform = 'scale(1.08)'; });
  fab.addEventListener('mouseleave', () => { if (!isOpen) fab.style.transform = 'scale(1)'; });
}
