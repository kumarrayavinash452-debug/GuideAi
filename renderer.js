const bubble = document.getElementById("bubble");
const panel = document.getElementById("panel");
const minBtn = document.getElementById("min-btn");
const closeBtn = document.getElementById("close-btn");
const chatContainer = document.getElementById("chat-container");
const userInput = document.getElementById("user-input");
const sendBtn = document.getElementById("send-btn");
const uploadBtn = document.getElementById("upload-btn");
const screenBtn = document.getElementById("screen-btn");
const micBtn = document.getElementById("mic-btn");

const attachmentList = document.getElementById("attachment-list");

// In-panel Viewer
const imageViewer = document.getElementById("image-viewer");
const viewerImg = document.getElementById("viewer-img");
const viewerTitle = document.getElementById("viewer-title");
const viewerCloseBtn = document.getElementById("viewer-close-btn");

const MAX_FILES = 3;
let attachments = [];
let screenshotCount = 0;

// 🔑 PASTE YOUR GROQ API KEY HERE (gsk_...)
const GROQ_API_KEY = "YOUR_GROQ_API_KEY_HERE";

// ========== INJECT LINK STYLES ==========
const linkStyle = document.createElement("style");
linkStyle.innerHTML = `
  .chat-link {
    color: #93c5fd !important;
    text-decoration: underline !important;
    cursor: pointer !important;
    word-break: break-all !important;
    font-weight: 500;
  }
  .chat-link:hover {
    color: #bfdbfe !important;
  }
`;
document.head.appendChild(linkStyle);

// ========== 1. DRAG LOGIC ==========
let isMouseDown = false, startScreenX = 0, startScreenY = 0, hasDragged = false;

bubble.addEventListener("mousedown", (e) => {
  if (e.button !== 0) return;
  isMouseDown = true; hasDragged = false;
  startScreenX = e.screenX; startScreenY = e.screenY;
  window.api.startDrag();
});

window.addEventListener("mousemove", (e) => {
  if (!isMouseDown) return;
  if (Math.hypot(e.screenX - startScreenX, e.screenY - startScreenY) > 3) {
    hasDragged = true; window.api.dragMove(e.screenX, e.screenY);
  }
});

window.addEventListener("mouseup", () => {
  if (!isMouseDown) return;
  isMouseDown = false;
  if (!hasDragged) {
    bubble.classList.add("hidden"); panel.classList.remove("hidden"); window.api.togglePanel(true);
  }
});

// ========== 2. WINDOW CONTROLS ==========
minBtn.addEventListener("click", () => {
  closeImageViewer();
  panel.classList.add("hidden"); bubble.classList.remove("hidden");
  window.api.togglePanel(false);
});
closeBtn.addEventListener("click", () => window.api.closeApp());

// ========== 3. LINK FORMATTER & CHAT UI ==========
function formatTextWithLinks(text) {
  if (!text) return "";
  
  // Escape HTML
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  // Bold text **bold** -> <b>bold</b>
  html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

  // Markdown links [title](url) -> <a ...>title</a>
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, (match, title, url) => {
    return `<a href="#" class="chat-link" data-url="${url}">${title}</a>`;
  });

  // Raw URLs https://... -> <a ...>https://...</a>
  html = html.replace(/(^|[^"'>])(https?:\/\/[^\s<]+)/g, (match, prefix, url) => {
    return `${prefix}<a href="#" class="chat-link" data-url="${url}">${url}</a>`;
  });

  return html;
}

function addMessage(role, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${role === "user" ? "user-msg" : "ai-msg"}`;
  
  msgDiv.innerHTML = formatTextWithLinks(text);

  // Click handler for links
  msgDiv.querySelectorAll(".chat-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const url = link.getAttribute("data-url");
      if (url) {
        if (window.api && window.api.openExternal) {
          window.api.openExternal(url);
        } else {
          window.open(url, "_blank");
        }
      }
    });
  });

  chatContainer.appendChild(msgDiv);
  chatContainer.scrollTop = chatContainer.scrollHeight;
  return msgDiv;
}

// ========== 4. ATTACHMENT LIST RENDERER ==========
function renderAttachments() {
  if (!attachmentList) return;
  attachmentList.innerHTML = "";

  attachments.forEach((file) => {
    const row = document.createElement("div");
    row.className = "file-chip";
    row.innerHTML = `
      <span>🖼️</span>
      <span class="file-name" title="${file.name}">${file.name}</span>
      <button class="view-btn" title="View Image">👁️</button>
      <button class="remove-btn" title="Remove">✕</button>
    `;

    row.querySelector(".view-btn").addEventListener("click", () => {
      openImageViewer(file.src, file.name);
    });

    row.querySelector(".remove-btn").addEventListener("click", () => {
      removeAttachment(file.id);
    });

    attachmentList.appendChild(row);
  });
}

function addAttachment(src, name) {
  if (attachments.length >= MAX_FILES) {
    addMessage("ai", "⚠️ Maximum 3 images allowed. Remove one before adding more.");
    return false;
  }

  attachments.push({
    id: Date.now() + Math.random(),
    name: name || `Image_${attachments.length + 1}.png`,
    src: src
  });

  renderAttachments();
  userInput.focus();
  return true;
}

function removeAttachment(id) {
  attachments = attachments.filter((f) => f.id !== id);
  renderAttachments();
  closeImageViewer();
}

function clearAllAttachments() {
  attachments = [];
  renderAttachments();
  closeImageViewer();
}

// ========== 5. IN-PANEL VIEWER ==========
function openImageViewer(src, name) {
  if (!src) return;
  viewerImg.src = src;
  viewerTitle.innerText = name || "Image Preview";
  imageViewer.classList.remove("hidden");
}

function closeImageViewer() {
  if (imageViewer) imageViewer.classList.add("hidden");
  if (viewerImg) viewerImg.src = "";
}

if (viewerCloseBtn) viewerCloseBtn.addEventListener("click", closeImageViewer);

// ========== 6. LOCAL AI RESPONSES ==========
function getLocalResponse(userText, files) {
  const q = (userText || "").toLowerCase().trim();
  if (files.length > 0 && !q) return `📸 ${files.length} image(s) received! What should I explain or summarize for you?`;
  if (q === "hello" || q === "hi" || q === "hii") return "Hello Eshwar! 👋 I am Guide AI. How can I help you?";
  if (q.includes("can you help me") || q === "help") return "Yes! Ask me anything or attach up to 3 screenshots.";
  if (q.includes("canva") && (q.includes("ppt") || q.includes("make") || q.includes("create"))) {
    return "🎨 **How to make PPT in Canva:**\n\n1) Open https://www.canva.com and log in.\n2) Click 'Create a design' ➔ 'Presentation (16:9)'.\n3) Choose a template and customize.\n4) Click Share ➔ Download (PDF / PPTX).\n\nAsk: *Can you give me direct link*";
  }
  if (q.includes("direct link")) return "🔗 **Direct Links:**\n• Canva PPT: https://www.canva.com/presentations/\n• Canva Home: https://www.canva.com/\n• Canva Templates: https://www.canva.com/templates/";
  if (q.includes("thank")) return "You're welcome! 😊 Have you any question?";
  if (q.includes("who are you")) return "I am Guide AI — Your Desktop Assistant (local + Groq).";
  return null;
}

// ========== 7. GROQ AI ENGINE ==========
async function callGroqAI(userText, files) {
  try {
    if (!GROQ_API_KEY || GROQ_API_KEY.includes("YOUR_GROQ_API_KEY")) {
      return "⚠️ Groq API key missing in `renderer.js`.";
    }

    const promptText = (userText && userText.trim()) ? userText.trim() : "Analyze these attached image(s)/screenshots in detail.";
    const selectedModel = files.length > 0 ? "llama-3.2-11b-vision-preview" : "llama-3.3-70b-versatile";

    const content = [{ type: "text", text: promptText }];
    if (files.length > 0) {
      files.forEach(f => {
        content.push({ type: "image_url", image_url: { url: f.src } });
      });
    }

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_API_KEY.trim()}` },
      body: JSON.stringify({ model: selectedModel, messages: [{ role: "user", content }], max_tokens: 1000 })
    });
    const data = await res.json();
    if (!res.ok) return `❌ Groq API Error: ${data.error?.message || "Invalid Key"}`;
    return data.choices?.[0]?.message?.content || "❌ No response.";
  } catch (err) { return "❌ Connection Error: " + err.message; }
}

async function handleSend() {
  const text = userInput.value.trim();
  if (!text && attachments.length === 0) return;
  closeImageViewer();

  const filesToSend = [...attachments];
  addMessage("user", filesToSend.length > 0 ? `📎 ${text || "(Image Attached)"} (${filesToSend.length} file/s)` : text);

  userInput.value = "";
  clearAllAttachments();

  const loading = addMessage("ai", "⚡ Thinking...");
  const local = getLocalResponse(text, filesToSend);
  loading.innerText = ""; // Clear placeholder
  
  const responseText = local || await callGroqAI(text, filesToSend);
  loading.innerHTML = formatTextWithLinks(responseText);
  
  // Re-attach link click handlers
  loading.querySelectorAll(".chat-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const url = link.getAttribute("data-url");
      if (url) {
        if (window.api && window.api.openExternal) {
          window.api.openExternal(url);
        } else {
          window.open(url, "_blank");
        }
      }
    });
  });

  chatContainer.scrollTop = chatContainer.scrollHeight;
}

sendBtn.addEventListener("click", handleSend);
userInput.addEventListener("keypress", (e) => { if (e.key === "Enter") handleSend(); });

// ========== 8. BUTTON EVENT LISTENERS ==========
uploadBtn.addEventListener("click", async () => {
  if (attachments.length >= MAX_FILES) {
    addMessage("ai", "⚠️ Maximum 3 images allowed.");
    return;
  }
  const filePath = await window.api.selectFile();
  if (filePath) {
    const base64Data = await window.api.readFileBase64(filePath);
    if (base64Data) {
      addAttachment(base64Data, filePath.split(/[/\\]/).pop());
    }
  }
});

screenBtn.addEventListener("click", async () => {
  if (attachments.length >= MAX_FILES) {
    addMessage("ai", "⚠️ Maximum 3 screenshots allowed. Remove one first.");
    return;
  }

  const imgData = await window.api.takeScreenshot();
  if (imgData) {
    screenshotCount += 1;
    addAttachment(imgData, `Screenshot_${screenshotCount}.png`);
  } else {
    addMessage("ai", "❌ Failed to capture screenshot.");
  }
});

// ========== 9. MIC ==========
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if (SpeechRecognition) {
  const recognition = new SpeechRecognition(); recognition.lang = "en-US";
  micBtn.addEventListener("click", () => { micBtn.classList.add("mic-active"); recognition.start(); });
  recognition.onresult = (e) => { userInput.value = e.results[0][0].transcript; };
  recognition.onspeechend = () => { recognition.stop(); micBtn.classList.remove("mic-active"); };
  recognition.onerror = () => { micBtn.classList.remove("mic-active"); };
}
