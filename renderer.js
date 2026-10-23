
"use strict";

// ======================================================
// GUIDE AI - OFFLINE DESKTOP ASSISTANT
// No API key | No paid API | Rule-based local responses
// ======================================================

// 1. HTML ELEMENTS
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

const imageViewer = document.getElementById("image-viewer");
const viewerImg = document.getElementById("viewer-img");
const viewerTitle = document.getElementById("viewer-title");
const viewerCloseBtn = document.getElementById("viewer-close-btn");

// 2. SETTINGS
const MAX_FILES = 4;
const USER_NAME = "Avinash";
const MAX_HISTORY = 40;

let attachments = [];
let screenshotCount = 0;
let isProcessing = false;
let lastTopic = "";
let lastQuestion = "";

const conversationHistory = [];

const random = (items) =>
    items[Math.floor(Math.random() * items.length)];

const containsAny = (text, words) =>
    words.some(word => text.includes(word));

function escapeHTML(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// 3. LINK STYLES
const linkStyle = document.createElement("style");
linkStyle.textContent = `
.chat-link {
    color: #93c5fd !important;
    text-decoration: underline !important;
    cursor: pointer;
    overflow-wrap: anywhere;
}
.chat-link:hover { color: #bfdbfe !important; }
`;
document.head.appendChild(linkStyle);

// 4. SAFE TEXT FORMATTER
function formatTextWithLinks(text) {
    let html = escapeHTML(text || "");

    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_, title, url) =>
            `<a href="#" class="chat-link"
                data-url="${escapeHTML(url)}">${title}</a>`
    );

    html = html.replace(
        /(^|[\s(])(https?:\/\/[^\s<]+)/g,
        (match, prefix, url) => {
            const cleanURL = url.replace(/[.,!?;:)]+$/, "");
            const ending = url.slice(cleanURL.length);

            return `${prefix}<a href="#" class="chat-link"
                data-url="${escapeHTML(cleanURL)}">${cleanURL}</a>${ending}`;
        }
    );

    html = html.replace(/\*\*(.*?)\*\*/g, "<b>$1</b>");

    return html.replace(/\n/g, "<br>");
}

function attachLinkHandlers(container) {
    container.querySelectorAll(".chat-link").forEach(link => {
        link.addEventListener("click", event => {
            event.preventDefault();

            const url = link.dataset.url;
            if (!url || !/^https?:\/\//i.test(url)) return;

            if (window.api?.openExternal) {
                window.api.openExternal(url);
            } else {
                window.open(url, "_blank", "noopener,noreferrer");
            }
        });
    });
}

function addMessage(role, text) {
    const message = document.createElement("div");

    message.className =
        `message ${role === "user" ? "user-msg" : "ai-msg"}`;

    message.innerHTML = formatTextWithLinks(text);
    attachLinkHandlers(message);

    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;

    conversationHistory.push({ role, text });

    if (conversationHistory.length > MAX_HISTORY) {
        conversationHistory.shift();
    }

    return message;
}

// ======================================================
// 5. DRAGGABLE BUBBLE
// ======================================================

let isMouseDown = false;
let startScreenX = 0;
let startScreenY = 0;
let hasDragged = false;

bubble.addEventListener("mousedown", event => {
    if (event.button !== 0) return;

    isMouseDown = true;
    hasDragged = false;
    startScreenX = event.screenX;
    startScreenY = event.screenY;

    window.api?.startDrag?.();
});

window.addEventListener("mousemove", event => {
    if (!isMouseDown) return;

    if (
        Math.hypot(
            event.screenX - startScreenX,
            event.screenY - startScreenY
        ) > 3
    ) {
        hasDragged = true;
        window.api?.dragMove?.(event.screenX, event.screenY);
    }
});

window.addEventListener("mouseup", () => {
    if (!isMouseDown) return;

    isMouseDown = false;

    if (!hasDragged) {
        bubble.classList.add("hidden");
        panel.classList.remove("hidden");
        window.api?.togglePanel?.(true);
    }
});

// ======================================================
// 6. WINDOW CONTROLS
// ======================================================

minBtn.addEventListener("click", () => {
    closeImageViewer();
    panel.classList.add("hidden");
    bubble.classList.remove("hidden");
    window.api?.togglePanel?.(false);
});

closeBtn.addEventListener("click", () => {
    window.api?.closeApp?.();
});

// ======================================================
// 7. ATTACHMENT MANAGEMENT
// ======================================================

function renderAttachments() {
    if (!attachmentList) return;

    attachmentList.innerHTML = "";

    attachments.forEach(file => {
        const row = document.createElement("div");
        row.className = "file-chip";

        const icon = document.createElement("span");
        icon.textContent = "🖼️";

        const name = document.createElement("span");
        name.className = "file-name";
        name.textContent = file.name;
        name.title = file.name;

        const viewBtn = document.createElement("button");
        viewBtn.className = "view-btn";
        viewBtn.title = "View image";
        viewBtn.textContent = "👁️";

        viewBtn.addEventListener("click", () => {
            openImageViewer(file.src, file.name);
        });

        const removeBtn = document.createElement("button");
        removeBtn.className = "remove-btn";
        removeBtn.title = "Remove attachment";
        removeBtn.textContent = "✕";

        removeBtn.addEventListener("click", () => {
            removeAttachment(file.id);
        });

        row.append(icon, name, viewBtn, removeBtn);
        attachmentList.appendChild(row);
    });
}

function addAttachment(src, name) {
    if (attachments.length >= MAX_FILES) {
        addMessage("ai", "You can attach up to four images at a time.");
        return false;
    }

    attachments.push({
        id: Date.now() + Math.random(),
        name: name || `Image_${attachments.length + 1}.png`,
        src
    });

    renderAttachments();
    userInput.focus();
    return true;
}

function removeAttachment(id) {
    attachments = attachments.filter(file => file.id !== id);
    renderAttachments();
    closeImageViewer();
}

function clearAllAttachments() {
    attachments = [];
    renderAttachments();
    closeImageViewer();
}

// ======================================================
// 8. IMAGE VIEWER
// ======================================================

function openImageViewer(src, name) {
    if (!src || !viewerImg || !imageViewer) return;

    viewerImg.src = src;
    if (viewerTitle) {
        viewerTitle.textContent = name || "Image Preview";
    }

    imageViewer.classList.remove("hidden");
}

function closeImageViewer() {
    if (imageViewer) imageViewer.classList.add("hidden");
    if (viewerImg) viewerImg.src = "";
}

viewerCloseBtn?.addEventListener("click", closeImageViewer);

// ======================================================
// 9. OFFLINE CONVERSATION DATABASE
// ======================================================

const knowledge = {

    greetings: {
        keywords: [
            "hello", "hey", "hii", "heyy", "good morning",
            "good afternoon", "good evening", "howdy",
            "what's up", "whats up", "hey there"
        ],
        replies: [
            `Hey ${USER_NAME}! 👋 How's your day going?`,
            `Hello ${USER_NAME}! It's good to see you. What is on your mind?`,
            "Hey there! Want to talk, learn something, or relax for a while?",
            "Hello! 😊 How have you been?",
            "Hi! I'm here for a chat. Tell me what's happening in your world.",
            "Hey! What would make today a little better for you?"
        ]
    },

    wellbeing: {
        keywords: [
            "how are you", "how are u", "how are things",
            "how have you been", "are you okay", "how is it going",
            "how's it going", "hows it going", "you doing well"
        ],
        replies: [
            "I'm doing well and ready to chat! How are you?",
            "I'm here and ready to help. How has your day been?",
            "All systems ready! 😄 What about you?",
            "Thanks for asking! I don't have feelings like a person, but I'm ready to talk with you."
        ]
    },

    identity: {
        keywords: [
            "who are you", "what are you", "your name",
            "introduce yourself", "tell me about yourself",
            "are you a robot", "are you human", "are you real",
            "are you an ai"
        ],
        replies: [
            "I'm Guide AI, your desktop companion. I can chat about everyday topics, offer basic suggestions, and help with simple questions.",
            "I'm Guide AI! I run using local JavaScript rules and a built-in response library. I don't have human experiences or feelings.",
            "Think of me as a small desktop companion for conversations, study motivation, and everyday guidance."
        ]
    },

    capabilities: {
        keywords: [
            "what can you do", "your features", "your abilities",
            "how can you help", "what do you know",
            "what are your features"
        ],
        replies: [
            "I can chat about everyday life, greetings, hobbies, books, study habits, programming basics, careers, travel, motivation, jokes, and riddles. I can also use the image attachment and screenshot features in this app.",
            "I can offer predefined answers, conversation prompts, simple study advice, and general suggestions. I work offline, so I cannot answer every new question like a full AI model.",
            "Try asking me for a joke, a riddle, study advice, a conversation topic, a coding tip, or a daily routine."
        ]
    },

    gratitude: {
        keywords: [
            "thank you", "thanks", "thank u", "thx",
            "thanks a lot", "thank you so much",
            "i appreciate it", "much appreciated"
        ],
        replies: [
            "You're very welcome! 😊",
            "Anytime! Happy to help.",
            "No problem at all!",
            "Glad I could help. What else is on your mind?",
            "You're welcome! Keep going, one step at a time."
        ]
    },

    goodbye: {
        keywords: [
            "goodbye", "bye", "see you", "see ya",
            "talk later", "gotta go", "catch you later",
            "goodbye for now"
        ],
        replies: [
            "See you later! Take care. 👋",
            "Bye for now! I'll be here when you want to chat.",
            "Take care, and I hope the rest of your day goes well.",
            "See you soon! Keep learning and keep smiling."
        ]
    },

    mood: {
        keywords: [
            "i am sad", "i'm sad", "feeling sad", "feel sad",
            "i am upset", "i'm upset", "feeling low", "feel low",
            "i am lonely", "i'm lonely", "feel lonely",
            "having a bad day", "feeling terrible",
            "i am worried", "i'm worried", "i feel bad"
        ],
        replies: [
            "I'm sorry things feel difficult right now. Would you like to tell me what happened?",
            "It's okay not to feel okay all the time. You don't have to solve everything at once.",
            "That sounds like a tough moment. Take your time. What has been bothering you?",
            "Sometimes talking things through can help. I'm here to listen, although I'm not a substitute for professional support."
        ]
    },

    happiness: {
        keywords: [
            "i am happy", "i'm happy", "feeling happy",
            "i feel great", "i am excited", "i'm excited",
            "i am proud", "i'm proud", "great news",
            "i did it", "i succeeded", "i passed",
            "i got selected", "i got the job"
        ],
        replies: [
            "That's wonderful! 🎉 Tell me more about it!",
            "I'm glad to hear that. Enjoy this moment!",
            "Amazing! Keep that positive energy going.",
            "That's worth celebrating! What happened?"
        ]
    },

    boredom: {
        keywords: [
            "i am bored", "i'm bored", "feeling bored",
            "nothing to do", "bored right now"
        ],
        replies: [
            "Let's change that! We could try a riddle, a joke, a fun fact, or a random conversation.",
            "If you could learn any skill instantly, what would you choose?",
            "Let's talk about travel, books, technology, movies, or your future goals.",
            "Want a joke, a brain teaser, or a question about your dream life?"
        ]
    },

    motivation: {
        keywords: [
            "motivate me", "motivation", "need motivation",
            "i feel lazy", "i am lazy", "i'm lazy",
            "cannot focus", "can't focus", "give up",
            "i feel stuck", "inspire me", "no motivation"
        ],
        replies: [
            "You don't need to feel motivated to start. Begin with just five minutes.",
            "Your future is shaped by small actions repeated consistently. Choose one manageable task today.",
            "Progress doesn't need to be fast to be meaningful. Start where you are.",
            "Rest if you need to, then take one small step forward. You don't have to do everything today.",
            "Imagine how proud you might feel after finishing the task you've been avoiding. Start with the smallest part."
        ]
    },

    college: {
        keywords: [
            "college life", "my college", "college student",
            "exams", "my exam", "semester exam", "assignments",
            "attendance", "study timetable", "engineering student"
        ],
        replies: [
            "College is a mix of learning, deadlines, friendships, and planning your future. Which part is on your mind?",
            "Try short, focused study sessions with small breaks. Which subject are you studying?",
            "A useful student routine balances classes, revision, projects, sleep, and exercise.",
            "Even 20 minutes of progress today can make tomorrow easier. What's your next assignment?",
            "Try explaining a concept in your own words after studying it. It can help you find gaps in your understanding."
        ]
    },

    programming: {
        keywords: [
            "programming", "coding", "javascript", "python",
            "html", "css", "node js", "nodejs", "express",
            "mern stack", "web development", "developer",
            "debugging", "bug in my code", "learn coding",
            "database", "mongodb", "sql", "api"
        ],
        replies: [
            "Coding becomes easier when you break a problem into small steps. What are you building?",
            "Try this learning cycle: understand one concept, write a small example, modify it, and observe the result.",
            "HTML builds structure, CSS handles presentation, JavaScript adds behavior, and backend code handles server-side logic.",
            "When debugging, read the exact error message, check the file and line number, and change one thing at a time.",
            "You don't need to memorize every command. Focus on understanding what your code does.",
            "A good beginner project is one you can finish, test, explain, and improve gradually."
        ]
    },

    friendship: {
        keywords: [
            "friendship", "my friend", "best friend",
            "friends ignored me", "my friends", "make new friends",
            "i have no friends", "friendship problem"
        ],
        replies: [
            "Good friendships need trust, respect, and honest communication. What's happening with your friend?",
            "Making friends often starts with small conversations and shared interests. You don't need to impress everyone.",
            "If a friend seems distant, consider a calm conversation rather than immediately assuming the worst.",
            "You deserve friendships where you feel respected and comfortable being yourself."
        ]
    },

    relationships: {
        keywords: [
            "relationship", "love problem", "breakup", "my crush",
            "one sided love", "she likes me", "he likes me",
            "girlfriend", "boyfriend", "heartbroken",
            "rejected me", "romantic feelings"
        ],
        replies: [
            "Relationships can bring up complicated feelings. Honesty, respect, and consent matter. What's on your mind?",
            "Having feelings for someone is normal, but their feelings and boundaries matter too.",
            "Rejection can hurt, but it doesn't determine your worth. Give yourself time.",
            "If you're confused about a relationship, we can think through the situation calmly. What happened?"
        ]
    },

    confidence: {
        keywords: [
            "confidence", "lack confidence", "i am nervous",
            "i'm nervous", "public speaking", "stage fear",
            "interview fear", "i am shy", "i'm shy",
            "afraid of failure", "fear of failure"
        ],
        replies: [
            "Confidence grows through practice, not perfection. Try one small action outside your comfort zone.",
            "Before a presentation, practise the opening sentence several times and speak slowly.",
            "Everyone makes mistakes while learning. A mistake is something to learn from, not proof you cannot succeed.",
            "You don't have to become fearless. You can learn to act even when you're nervous."
        ]
    },

    productivity: {
        keywords: [
            "time management", "wasting time", "procrastination",
            "procrastinating", "daily routine", "schedule my day",
            "manage my time", "too much work", "organize my day"
        ],
        replies: [
            "Write down your three most important tasks. Start with the smallest one.",
            "Try 25 minutes of focused work followed by a five-minute break.",
            "Make your plan realistic. A short list you finish is better than a huge list you abandon.",
            "Choose tomorrow's first task before you finish today. It can make starting easier."
        ]
    },

    healthyHabits: {
        keywords: [
            "sleep schedule", "can't sleep", "cannot sleep",
            "sleeping late", "healthy habits", "workout routine",
            "feeling exhausted", "i am exhausted", "i'm exhausted"
        ],
        replies: [
            "A consistent sleep schedule, regular movement, balanced meals, and breaks can support general well-being.",
            "If you're tired, you may need rest rather than more pressure. How have you been sleeping?",
            "A short walk and some daylight can be a useful reset during a long study day.",
            "If a physical or emotional problem is persistent or severe, consider speaking with a qualified professional."
        ]
    },

    hobbies: {
        keywords: [
            "hobbies", "my hobby", "free time",
            "what should i do for fun", "reading books",
            "i like reading", "i love reading", "music",
            "movies", "gaming", "photography"
        ],
        replies: [
            "What do you enjoy most: reading, music, sports, gaming, or creating something?",
            "You could try a new book, learn a song, take photographs, or build a small coding project.",
            "A hobby doesn't need to improve your resume or make money. It can simply make you happy.",
            "What's one activity you can do for hours without getting bored?"
        ]
    },

    travel: {
        keywords: [
            "travel", "traveling", "travelling", "vacation",
            "holiday destination", "japan", "tokyo",
            "dream destination", "visit another country"
        ],
        replies: [
            "Travel can be a wonderful way to discover new cultures. Which destination is at the top of your list?",
            "A good trip starts with a budget, dates, transport, accommodation, and places you want to visit.",
            "Japan offers traditional culture, modern cities, food, and beautiful nature. What would you like to experience there?",
            "If you could travel anywhere tomorrow, where would you go and why?"
        ]
    },

    books: {
        keywords: [
            "recommend a book", "book recommendation", "best books",
            "i love books", "i like books", "reading habit",
            "self help book", "novel recommendation"
        ],
        replies: [
            "What do you prefer: fiction, biographies, personal development, science, or technology?",
            "To build a reading habit, start with ten pages a day and choose a book that interests you.",
            "A good recommendation depends on whether you want entertainment, knowledge, inspiration, or a new perspective."
        ]
    },

    career: {
        keywords: [
            "career", "future career", "job search", "internship",
            "placement", "resume", "job interview", "software engineer",
            "career advice", "career confusion", "what should i learn"
        ],
        replies: [
            "For a software career, focus on fundamentals, projects, problem-solving, communication, and practical experience.",
            "A strong portfolio includes projects you can explain clearly, including the problems you solved.",
            "For internships, prepare your resume, practise coding problems, learn core concepts, and apply consistently.",
            "You don't need to learn every technology at once. Choose one goal and build a practical plan."
        ]
    },

    english: {
        keywords: [
            "learn english", "improve my english", "english speaking",
            "speak english", "english practice", "grammar mistake",
            "communication skills", "spoken english"
        ],
        replies: [
            "Let's practise English! Write a few sentences about your day, and we can work on them.",
            "Try speaking for one minute each day about a familiar topic. Focus on clear sentences.",
            "Learn a few practical phrases, use them in sentences, and say those sentences aloud.",
            "We can practise everyday conversations, introductions, interviews, and asking questions."
        ]
    },

    stress: {
        keywords: [
            "overthinking", "i overthink", "too many thoughts",
            "stressed out", "i feel stressed", "i am stressed",
            "i'm stressed", "feeling anxious"
        ],
        replies: [
            "Write down what is worrying you and separate what you can control from what you cannot.",
            "Try taking a few slow, comfortable breaths and focusing on one thing you can do right now.",
            "You don't have to solve every possible future problem today. What is worrying you most?",
            "If stress keeps interfering with daily life, talking with someone you trust or a qualified professional may help."
        ]
    },

    jokes: {
        keywords: [
            "tell me a joke", "make me laugh", "funny joke",
            "say something funny", "i want a joke", "joke please"
        ],
        replies: [
            "Why do programmers prefer dark mode? Because light attracts bugs! 🐛",
            "Why did the computer go to the doctor? It caught a virus! 😂",
            "Why was the JavaScript developer sad? Because they didn't know how to express themselves!",
            "Why do programmers confuse Halloween and Christmas? Because OCT 31 equals DEC 25!",
            "Why did the student eat their homework? The teacher said it was a piece of cake!"
        ]
    },

    compliments: {
        keywords: [
            "you are smart", "you're smart", "you are helpful",
            "you're helpful", "i like you", "you are amazing",
            "you're amazing", "good job", "well done"
        ],
        replies: [
            "That's kind of you to say! 😊",
            "Thank you! I'm glad our conversation is useful.",
            "I appreciate that. What shall we talk about next?",
            "Thanks! I'm happy to help where I can."
        ]
    },

    food: {
        keywords: [
            "food", "hungry", "favorite food", "favourite food",
            "what should i eat", "cooking", "favorite dish",
            "favourite dish", "pizza", "chocolate"
        ],
        replies: [
            "Food is a great conversation topic! What's your favourite dish?",
            "Are you in the mood for something sweet, spicy, light, or filling?",
            "Cooking can be a fun way to learn a new skill. Is there a dish you'd like to try making?",
            "If you tell me what ingredients you have, I can suggest a simple recipe."
        ]
    },

    weather: {
        keywords: [
            "weather today", "how is the weather",
            "what is the weather", "is it raining",
            "hot today", "cold today"
        ],
        replies: [
            "I work offline, so I can't check the current weather. You can check a weather app or https://weather.com.",
            "I can't access live weather information without an online service, but I can help you plan what to pack for a trip."
        ]
    },

    money: {
        keywords: [
            "save money", "budget", "manage my money",
            "personal finance", "spending habits"
        ],
        replies: [
            "A simple budget tracks income, necessary expenses, savings, and optional spending.",
            "Try recording your expenses for a week. It can reveal where your money is going.",
            "A useful first step is to distinguish needs from wants and set a realistic savings target."
        ]
    },

    canva: {
        keywords: [
            "canva", "make a ppt", "create a presentation",
            "make presentation", "powerpoint presentation"
        ],
        replies: [
            "To create a presentation in Canva:\n1. Open https://www.canva.com/presentations/\n2. Choose a presentation template.\n3. Add your content, images, and design elements.\n4. Preview the slides.\n5. Use Share or Download to export your work.",
            "For a good presentation, use one main idea per slide, readable text, consistent colours, and clear images."
        ]
    },

    help: {
        keywords: [
            "what can we talk about", "give me ideas",
            "conversation topics", "i need help",
            "can you help me", "help me please"
        ],
        replies: [
            "Of course! We can talk about your day, hobbies, college, career goals, books, travel, friendships, or technology.",
            "Sure. Tell me what you need help with, and I'll do my best using my offline knowledge.",
            "Let's start simple: is there something you want to solve, something you want to learn, or something you just want to talk about?"
        ]
    }
};

// ======================================================
// 10. CONVERSATION ENGINE
// ======================================================

function normalizeText(text) {
    return String(text || "")
        .toLowerCase()
        .replace(/[’‘]/g, "'")
        .replace(/[^\w\s'-]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function getLocalResponse(userText, files = []) {
    const q = normalizeText(userText);

    if (files.length && !q) {
        return "I received " + files.length +
            " image(s). I can help with general questions, but offline mode cannot actually interpret image contents. Describe the image or the problem you see, and I'll try to guide you.";
    }

    if (!q) {
        return "What would you like to talk about?";
    }

    // Exact conversational greetings.
    if (/^(hi|hello|hey|hii|heyy|good morning|good afternoon|good evening|howdy)[\s!.,]*$/.test(q)) {
        lastTopic = "greetings";
        return random(knowledge.greetings.replies);
    }

    if (/^(ok|okay|alright|sure|fine|got it|understood)$/.test(q)) {
        return random([
            "Sounds good! What would you like to talk about next?",
            "Alright! Is there anything else on your mind?",
            "Great. What shall we explore next?",
            "Okay! I'm listening."
        ]);
    }

    if (/^(yes|yeah|yep|yup)$/.test(q)) {
        if (lastTopic === "followup") {
            return "Go ahead and tell me more. I'm listening.";
        }
        return random([
            "Great! Tell me a little more.",
            "Alright! What would you like to add?",
            "Okay! What's on your mind?"
        ]);
    }

    if (/^(no|nope|not really)$/.test(q)) {
        return random([
            "No problem. We can talk about something else.",
            "That's okay! What would you prefer to discuss?",
            "All right. I'm here if you need anything."
        ]);
    }

    // User asks about the assistant.
    if (containsAny(q, ["who are you", "your name", "what are you", "introduce yourself"])) {
        lastTopic = "identity";
        return random(knowledge.identity.replies);
    }

    // How are you?
    if (containsAny(q, ["how are you", "how are u", "how is it going", "how's it going"])) {
        lastTopic = "wellbeing";
        return random(knowledge.wellbeing.replies);
    }

    // Asking for capabilities.
    if (containsAny(q, ["what can you do", "your features", "how can you help", "your abilities"])) {
        lastTopic = "capabilities";
        return random(knowledge.capabilities.replies);
    }

    // Follow-up conversation.
    if (containsAny(q, [
        "tell me more", "what about you", "and you",
        "why is that", "why do you think", "explain more",
        "go on", "continue", "really", "seriously"
    ])) {
        return random([
            "That's worth exploring further. What part interests you most?",
            "I can discuss that in more detail, but my offline answers are limited. Which part should we focus on?",
            "Let's take it one step at a time. What would you like to understand better?",
            "Interesting question! Could you tell me which part you'd like to explore?"
        ]);
    }

    // Asking for a recommendation.
    if (containsAny(q, ["recommend", "suggest something", "any suggestions", "give me advice"])) {
        return random([
            "I'd be happy to help. Are you looking for a book, a hobby, a learning resource, or advice about a situation?",
            "My suggestion depends on your goal. Tell me a little more about what you want.",
            "Let's narrow it down. What would you like a recommendation for?"
        ]);
    }

    // Direct links.
    if (containsAny(q, ["direct link", "website link", "canva link", "canva website"])) {
        return "Here are some useful links:\n\nCanva: https://www.canva.com/\nCanva Presentations: https://www.canva.com/presentations/\nCanva Templates: https://www.canva.com/templates/\nMDN Web Docs: https://developer.mozilla.org/\nJavaScript Guide: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide";
    }

    // Time-independent arithmetic is handled only for simple expressions.
    const mathMatch = q.match(
        /^(?:what is |calculate )?(-?\d+(?:\.\d+)?)\s*([+\-*/])\s*(-?\d+(?:\.\d+)?)$/
    );

    if (mathMatch) {
        const a = Number(mathMatch[1]);
        const operator = mathMatch[2];
        const b = Number(mathMatch[3]);
        let result;

        if (operator === "+") result = a + b;
        if (operator === "-") result = a - b;
        if (operator === "*") result = a * b;
        if (operator === "/") {
            if (b === 0) return "Division by zero is undefined.";
            result = a / b;
        }

        return `The answer is ${result}.`;
    }

    // How to / what is questions.
    if (q.startsWith("how to ")) {
        const subject = q.slice(7);

        if (subject.includes("learn")) {
            return "Start by choosing one specific skill, learning its basics, practising with small exercises, and building a small project. Which skill do you want to learn?";
        }

        if (subject.includes("study")) {
            return "Choose one topic, study it for 25 minutes, close your notes, and try explaining it from memory. Then review what you missed.";
        }

        if (subject.includes("focus")) {
            return "Put distractions away, choose one small task, set a 25-minute timer, and work only on that task until the timer ends.";
        }

        if (subject.includes("make friends")) {
            return "Start with small conversations, ask people about their interests, listen attentively, and look for shared activities. Friendships usually develop gradually.";
        }

        if (subject.includes("improve")) {
            return "Choose one area to improve, set a small measurable goal, practise regularly, and review your progress each week. What area do you mean?";
        }

        return "I can try to guide you, but I may not know the exact answer offline. Break the task into small steps and tell me what you're trying to achieve.";
    }

    if (q.startsWith("what is ") || q.startsWith("what are ")) {
        if (containsAny(q, ["javascript", "html", "css", "node js", "express", "mongodb", "database", "api"])) {
            return random(knowledge.programming.replies);
        }

        return "I can answer some common questions from my built-in knowledge, but I don't have a full offline language model. Could you give me a little more context about what you want to understand?";
    }

    // Match the built-in topic library.
    for (const [topic, data] of Object.entries(knowledge)) {
        if (containsAny(q, data.keywords)) {
            lastTopic = topic;
            lastQuestion = q;
            return random(data.replies);
        }
    }

    // Additional everyday conversations.
    if (containsAny(q, ["what is your favorite", "what's your favorite", "your favourite"])) {
        return "I don't have personal preferences like a human, but I'd love to hear yours! What's your favourite thing?";
    }

    if (containsAny(q, ["i don't know", "i do not know", "not sure", "i am confused", "i'm confused"])) {
        return "That's okay. You don't need to have everything figured out. We can explore your options one at a time. What's the main thing you're unsure about?";
    }

    if (containsAny(q, ["what do you think", "your opinion", "do you think"])) {
        return "I can offer a general perspective, although my offline responses are limited. What specific situation or idea would you like me to consider?";
    }

    if (containsAny(q, ["good night", "going to sleep", "time to sleep"])) {
        return "Good night! 🌙 I hope you get some good rest. Take care of yourself.";
    }

    if (containsAny(q, ["good morning"])) {
        return "Good morning! ☀️ I hope your day starts well. What's on your plan today?";
    }

    if (containsAny(q, ["i am fine", "i'm fine", "i am good", "i'm good", "doing good", "doing fine"])) {
        return "Glad to hear that! 😊 What have you been up to today?";
    }

    if (containsAny(q, ["i love you", "love you"])) {
        return "That's sweet of you to say! 😊 I'm an AI assistant, so I don't experience love like a person, but I'm here for a friendly conversation.";
    }

    if (containsAny(q, ["sorry", "i am sorry", "i'm sorry"])) {
        return "No worries. Everyone makes mistakes. What's on your mind?";
    }

    // Honest offline fallback.
    return random([
        "That's interesting. Tell me a little more so I can try to help.",
        "I'm listening. What is the most important part of that for you?",
        "I don't have a ready-made answer for that yet, but we can explore the question together.",
        "Could you rephrase that or give me an example? My offline knowledge is limited.",
        "I can chat about many everyday topics, but I don't have ChatGPT-level reasoning without an AI model. Could you give me a little more context?",
        "Let's break that down into smaller parts. What would you like to figure out first?",
        "I may not know that specific answer offline. If you describe your goal, I can try to offer general guidance."
    ]);
}

// ======================================================
// 11. SEND MESSAGE
// ======================================================

async function handleSend() {
    if (isProcessing) return;

    const text = userInput.value.trim();

    if (!text && attachments.length === 0) return;

    closeImageViewer();

    const filesToSend = [...attachments];

    addMessage(
        "user",
        filesToSend.length
            ? `${text || "(Image attached)"} (${filesToSend.length} attachment(s))`
            : text
    );

    userInput.value = "";
    clearAllAttachments();

    isProcessing = true;
    sendBtn.disabled = true;

    const loading = addMessage("ai", "Thinking...");

    try {
        // No API call: use the offline conversation engine.
        await new Promise(resolve => setTimeout(resolve, 250));

        const response = getLocalResponse(text, filesToSend);

        loading.innerHTML = formatTextWithLinks(response);
        attachLinkHandlers(loading);
    } catch (error) {
        loading.textContent = "Sorry, something went wrong. Please try again.";
        console.error("Guide AI error:", error);
    } finally {
        isProcessing = false;
        sendBtn.disabled = false;
        userInput.focus();
        chatContainer.scrollTop = chatContainer.scrollHeight;
    }
}

sendBtn.addEventListener("click", handleSend);

userInput.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
    }
});

// ======================================================
// 12. IMAGE UPLOAD
// ======================================================

uploadBtn.addEventListener("click", async () => {
    if (attachments.length >= MAX_FILES) {
        addMessage("ai", "You can attach up to four images at a time.");
        return;
    }

    try {
        if (!window.api?.selectFile || !window.api?.readFileBase64) {
            addMessage("ai", "Image upload is unavailable. Check your Electron preload configuration.");
            return;
        }

        const filePath = await window.api.selectFile();
        if (!filePath) return;

        const base64Data = await window.api.readFileBase64(filePath);
        if (!base64Data) {
            addMessage("ai", "I couldn't read that image. Please try again.");
            return;
        }

        addAttachment(
            base64Data,
            filePath.split(/[/\\]/).pop()
        );
    } catch (error) {
        console.error("Upload error:", error);
        addMessage("ai", "Image upload failed. Please try again.");
    }
});

// ======================================================
// 13. SCREENSHOT CAPTURE
// ======================================================

screenBtn.addEventListener("click", async () => {
    if (attachments.length >= MAX_FILES) {
        addMessage("ai", "You can attach up to four images at a time.");
        return;
    }

    try {
        if (!window.api?.takeScreenshot) {
            addMessage("ai", "Screenshot capture is unavailable. Check your Electron preload configuration.");
            return;
        }

        const imageData = await window.api.takeScreenshot();

        if (imageData) {
            screenshotCount++;
            addAttachment(imageData, `Screenshot_${screenshotCount}.png`);
        } else {
            addMessage("ai", "Screenshot capture was cancelled or failed.");
        }
    } catch (error) {
        console.error("Screenshot error:", error);
        addMessage("ai", "I couldn't capture the screenshot. Please try again.");
    }
});

// ======================================================
// 14. MICROPHONE / SPEECH RECOGNITION
// ======================================================

const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && micBtn) {
    const recognition = new SpeechRecognition();

    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    micBtn.addEventListener("click", () => {
        try {
            micBtn.classList.add("mic-active");
            recognition.start();
        } catch (error) {
            console.warn("Speech recognition could not start:", error);
            micBtn.classList.remove("mic-active");
        }
    });

    recognition.onresult = event => {
        userInput.value = event.results[0][0].transcript;
        userInput.focus();
    };

    recognition.onend = () => {
        micBtn.classList.remove("mic-active");
    };

    recognition.onerror = event => {
        micBtn.classList.remove("mic-active");
        console.warn("Speech recognition error:", event.error);
    };
} else if (micBtn) {
    micBtn.title = "Speech recognition is not supported in this environment.";
}

// ======================================================
// 15. INITIAL GREETING
// ======================================================

console.log("Guide AI started in offline mode.");
console.log("No API key or online AI service is being used.");
