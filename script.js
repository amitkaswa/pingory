// DOM elements
const elements = {
  chatArea: document.getElementById("chat_area"),
  userInput: document.getElementById("user_input"),
  submitBtn: document.getElementById("submit_btn"),
  inputForm: document.getElementById("input_chat"),
  sidebar: document.getElementById("mySidebar"),
  savedChats: document.getElementById("savedChats"),
  dropdown: document.getElementById("dropdown"),
  menuDots: document.getElementById("menuDots"),
  hamburger: document.getElementById("hamburger"),
  chatModule: document.getElementById("chatModule"),
  imageUpload: document.getElementById("image_upload"),
  voiceBtn: document.getElementById("voice_btn"),
  recordingTimer: document.getElementById("recordingTimer"),
  messageContextMenu: document.getElementById("messageContextMenu"),
  chatContextMenu: document.getElementById("chatContextMenu"),
  chatSearch: document.getElementById("chatSearch"),
  notebookIcon: document.getElementById("notebookIcon"),
  closeSidebar: document.getElementById("closeSidebar"),
  profileBtn: document.getElementById("profileBtn"),
  settingsBtn: document.getElementById("settingsBtn")
};

// State management
const state = {
  chats: JSON.parse(localStorage.getItem("savedChats")) || [],
  currentChatId: null,
  currentModule: "grok",
  mediaRecorder: null,
  audioChunks: [],
  recordingStartTime: null,
  pinnedMessages: {},
  maxPinnedMessages: 5,
  maxImages: 5,
  maxRecordingTime: 120000 // 2 minutes in ms
};

// Event listeners
elements.submitBtn.addEventListener("click", sendMessage);
elements.inputForm.addEventListener("submit", (e) => {
  e.preventDefault();
  sendMessage();
});
elements.userInput.addEventListener("input", autoResizeTextarea);
elements.userInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});
elements.hamburger.addEventListener("click", toggleSidebar);
elements.closeSidebar.addEventListener("click", toggleSidebar);
elements.notebookIcon.addEventListener("click", createNewChat);
elements.menuDots.addEventListener("click", toggleMenu);
elements.dropdown.addEventListener("click", handleDropdownAction);
elements.chatModule.addEventListener("change", (e) => {
  state.currentModule = e.target.value;
  simulateBotResponse();
});
elements.imageUpload.addEventListener("change", handleImageUpload);
elements.voiceBtn.addEventListener("click", toggleVoiceRecording);
elements.chatArea.addEventListener("contextmenu", handleMessageContextMenu);
elements.savedChats.addEventListener("contextmenu", handleChatContextMenu);
elements.chatSearch.addEventListener("input", filterChats);
elements.profileBtn.addEventListener("click", () => alert("Profile view to be implemented"));
elements.settingsBtn.addEventListener("click", () => alert("Settings to be implemented"));
document.addEventListener("click", handleOutsideClick);

// Initialize
initializeChats();
if (state.chats.length > 0) {
  loadChat(0);
}

// Initialize saved chats
function initializeChats() {
  console.log("Initializing chats...");
  elements.savedChats.innerHTML = "";
  state.chats.forEach((chat, index) => {
    const firstMessage = chat.messages.find(msg => msg.content)?.content || "No messages yet";
    renderSavedChat(index, firstMessage.slice(0, 50), chat.pinned, chat.unread);
  });
}

// Auto-resize textarea
function autoResizeTextarea() {
  elements.userInput.style.height = "auto";
  elements.userInput.style.height = `${Math.min(elements.userInput.scrollHeight, 160)}px`;
}

// Send message
function sendMessage() {
  const message = elements.userInput.value.trim();
  const images = elements.imageUpload.files;
  let voiceUrl = null;

  if (!message && images.length === 0 && !state.audioChunks.length) return;

  elements.submitBtn.disabled = true;
  const messageDiv = document.createElement("div");
  messageDiv.className = "message user";
  const messageData = { type: "user", reactions: [], pinned: false };

  if (message) {
    messageDiv.textContent = message;
    messageData.content = message;
  }

  if (images.length > 0) {
    const imageContainer = document.createElement("div");
    Array.from(images).slice(0, state.maxImages).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = document.createElement("img");
        img.src = reader.result;
        img.alt = "Uploaded image";
        imageContainer.appendChild(img);
        if (!messageData.images) messageData.images = [];
        messageData.images.push(reader.result);
        updateChatMessages(messageData);
      };
      reader.readAsDataURL(file);
    });
    messageDiv.appendChild(imageContainer);
    elements.imageUpload.value = "";
  }

  if (state.audioChunks.length > 0) {
    const audioBlob = new Blob(state.audioChunks, { type: "audio/webm" });
    voiceUrl = URL.createObjectURL(audioBlob);
    const audio = document.createElement("audio");
    audio.controls = true;
    audio.src = voiceUrl;
    messageDiv.appendChild(audio);
    messageData.audio = voiceUrl;
    state.audioChunks = [];
  }

  elements.chatArea.appendChild(messageDiv);
  elements.userInput.value = "";
  autoResizeTextarea();
  updateChatMessages(messageData);
  scrollToBottom();
  simulateBotResponse();
  setTimeout(() => {
    elements.submitBtn.disabled = false;
  }, 300);
}

// Handle image upload
function handleImageUpload(e) {
  if (e.target.files.length > state.maxImages) {
    alert(`Maximum ${state.maxImages} images allowed per message.`);
    e.target.value = "";
    return;
  }
  sendMessage();
}

// Toggle voice recording
function toggleVoiceRecording() {
  if (!elements.voiceBtn.classList.contains("recording")) {
    startVoiceRecording();
  } else {
    stopVoiceRecording();
  }
}

// Start voice recording
function startVoiceRecording() {
  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => {
      state.mediaRecorder = new MediaRecorder(stream);
      state.audioChunks = [];
      state.recordingStartTime = Date.now();
      elements.recordingTimer.hidden = false;
      updateRecordingTimer();

      state.mediaRecorder.addEventListener("dataavailable", e => {
        state.audioChunks.push(e.data);
      });

      state.mediaRecorder.addEventListener("stop", () => {
        elements.recordingTimer.hidden = true;
        clearInterval(state.timerInterval);
        sendMessage();
      });

      state.mediaRecorder.start();
      elements.voiceBtn.classList.add("recording");
    })
    .catch(err => {
      alert("Failed to access microphone. Please check permissions.");
      console.error("Recording error:", err);
    });
}

// Stop voice recording
function stopVoiceRecording() {
  if (state.mediaRecorder) {
    state.mediaRecorder.stop();
    elements.voiceBtn.classList.remove("recording");
  }
}

// Update recording timer
function updateRecordingTimer() {
  state.timerInterval = setInterval(() => {
    const elapsed = Date.now() - state.recordingStartTime;
    if (elapsed >= state.maxRecordingTime) {
      stopVoiceRecording();
      return;
    }
    const minutes = Math.floor(elapsed / 60000);
    const seconds = Math.floor((elapsed % 60000) / 1000);
    elements.recordingTimer.textContent = `${minutes.toString().padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
  }, 1000);
}

// Simulate bot response
function simulateBotResponse() {
  setTimeout(() => {
    const responses = {
      grok: "Grok here! Got your message.",
      chatgpt: "ChatGPT responding to your input!",
      mock: "Mock Bot says hi!"
    };
    const messageDiv = document.createElement("div");
    messageDiv.className = "message bot";
    messageDiv.textContent = responses[state.currentModule] || "Hello!";
    elements.chatArea.appendChild(messageDiv);
    updateChatMessages({ type: "bot", content: messageDiv.textContent, reactions: [], pinned: false });
    scrollToBottom();
  }, 500);
}

// Update chat messages
function updateChatMessages(message) {
  if (state.currentChatId !== null) {
    state.chats[state.currentChatId].messages.push(message);
    state.chats[state.currentChatId].unread = true;
    saveChats();
    initializeChats();
  }
}

// Filter chats
function filterChats() {
  const query = elements.chatSearch.value.toLowerCase();
  elements.savedChats.innerHTML = "";
  state.chats.forEach((chat, index) => {
    const firstMessage = chat.messages.find(msg => msg.content)?.content || "";
    if (chat.title.toLowerCase().includes(query) || firstMessage.toLowerCase().includes(query)) {
      renderSavedChat(index, firstMessage.slice(0, 50) || "No messages yet", chat.pinned, chat.unread);
    }
  });
}

// Scroll to bottom
function scrollToBottom() {
  elements.chatArea.scrollTo({ top: elements.chatArea.scrollHeight, behavior: "smooth" });
}

// Toggle menu
function toggleMenu() {
  const isOpen = elements.dropdown.classList.contains("active");
  elements.dropdown.classList.toggle("active", !isOpen);
  elements.menuDots.setAttribute("aria-expanded", !isOpen);
}

// Close menu
function closeMenu() {
  elements.dropdown.classList.remove("active");
  elements.menuDots.setAttribute("aria-expanded", "false");
}

// Handle dropdown actions
function handleDropdownAction(e) {
  const action = e.target.dataset.action;
  if (!action) return;

  switch (action) {
    case "clear":
      clearChat();
      break;
    case "share":
      shareChat();
      break;
    case "screenshot":
      takeScreenshot();
      break;
  }
}

// Handle message context menu
function handleMessageContextMenu(e) {
  e.preventDefault();
  if (!e.target.closest(".message")) return;

  const messageDiv = e.target.closest(".message");
  const index = Array.from(elements.chatArea.querySelectorAll(".message")).indexOf(messageDiv);
  elements.messageContextMenu.setAttribute("data-index", index);
  elements.messageContextMenu.hidden = false;
  elements.messageContextMenu.style.top = `${e.clientY}px`;
  elements.messageContextMenu.style.left = `${e.clientX}px`;

  elements.messageContextMenu.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => handleMessageAction(btn.dataset.action, index);
  });
}

// Handle chat context menu
function handleChatContextMenu(e) {
  e.preventDefault();
  if (!e.target.closest(".saved-chat")) return;

  const chatDiv = e.target.closest(".saved-chat");
  const index = Number(chatDiv.querySelector("button").dataset.index);
  elements.chatContextMenu.setAttribute("data-index", index);
  elements.chatContextMenu.hidden = false;
  elements.chatContextMenu.style.top = `${e.clientY}px`;
  elements.chatContextMenu.style.left = `${e.clientX}px`;

  elements.chatContextMenu.querySelectorAll("button").forEach(btn => {
    btn.onclick = () => handleChatAction(btn.dataset.action, index);
  });
}

// Handle message actions
function handleMessageAction(action, index) {
  if (state.currentChatId === null) return;

  const message = state.chats[state.currentChatId].messages[index];
  const messageDiv = elements.chatArea.querySelectorAll(".message")[index];

  switch (action) {
    case "like":
    case "unlike":
    case "heart":
      toggleReaction(message, messageDiv, action);
      break;
    case "pin":
      pinMessage(index);
      break;
    case "delete":
      deleteMessage(index);
      break;
  }
  elements.messageContextMenu.hidden = true;
}

// Handle chat actions
function handleChatAction(action, index) {
  switch (action) {
    case "pinChat":
      pinChat(index);
      break;
    case "renameChat":
      renameChat(index);
      break;
    case "deleteChat":
      deleteChat(index);
      break;
  }
  elements.chatContextMenu.hidden = true;
}

// Toggle reaction
function toggleReaction(message, messageDiv, reaction) {
  if (!message.reactions.includes(reaction)) {
    message.reactions.push(reaction);
  } else {
    message.reactions = message.reactions.filter(r => r !== reaction);
  }
  updateReactions(messageDiv, message.reactions);
  saveChats();
}

// Update reactions display
function updateReactions(messageDiv, reactions) {
  let reactionsDiv = messageDiv.querySelector(".reactions");
  if (!reactionsDiv) {
    reactionsDiv = document.createElement("div");
    reactionsDiv.className = "reactions";
    messageDiv.appendChild(reactionsDiv);
  }
  reactionsDiv.innerHTML = reactions.map(r => `<span>${r === "like" ? "👍" : r === "unlike" ? "👎" : "❤️"}</span>`).join("");
}

// Pin message
function pinMessage(index) {
  if (state.currentChatId === null) return;

  const pinnedCount = state.chats[state.currentChatId].messages.filter(m => m.pinned).length;
  if (pinnedCount >= state.maxPinnedMessages && !state.chats[state.currentChatId].messages[index].pinned) {
    alert(`Maximum ${state.maxPinnedMessages} messages can be pinned.`);
    return;
  }

  state.chats[state.currentChatId].messages[index].pinned = !state.chats[state.currentChatId].messages[index].pinned;
  saveChats();
  loadChat(state.currentChatId);
}

// Delete message
function deleteMessage(index) {
  if (state.currentChatId === null) return;

  if (confirm("Delete this message?")) {
    state.chats[state.currentChatId].messages.splice(index, 1);
    saveChats();
    loadChat(state.currentChatId);
  }
}

// Pin chat
function pinChat(index) {
  state.chats[index].pinned = !state.chats[index].pinned;
  saveChats();
  initializeChats();
}

// Rename chat
function renameChat(index) {
  const newTitle = prompt("Enter new chat title:", state.chats[index].title);
  if (newTitle && newTitle.trim()) {
    state.chats[index].title = newTitle.trim();
    saveChats();
    initializeChats();
  }
}

// Clear chat
function clearChat() {
  transitionChat(() => {
    elements.chatArea.innerHTML = '<div class="chat-placeholder" aria-hidden="true">Start a new chat or select a saved one...</div>';
    if (state.currentChatId !== null) {
      state.chats[state.currentChatId].messages = [];
      saveChats();
    }
  });
}

// Share chat
async function shareChat() {
  try {
    const text = Array.from(elements.chatArea.querySelectorAll(".message"))
      .map((msg, i) => {
        const content = msg.querySelector("img") ? "[Image]" : msg.querySelector("audio") ? "[Voice Message]" : msg.textContent;
        const reactions = state.chats[state.currentChatId]?.messages[i]?.reactions.join(", ") || "";
        return `${msg.classList.contains("user") ? "You" : state.currentModule.toUpperCase()}: ${content}${reactions ? ` [Reactions: ${reactions}]` : ""}`;
      })
      .join("\n");
    await navigator.clipboard.writeText(text);
    alert("Chat copied to clipboard!");
  } catch (err) {
    alert("Failed to copy chat. Please try again.");
    console.error("Share error:", err);
  }
  closeMenu();
}

// Take screenshot
function takeScreenshot() {
  alert("Screenshot functionality to be implemented");
  closeMenu();
}

// Create new chat
function createNewChat() {
  transitionChat(() => {
    const newChat = { title: `Chat #${state.chats.length + 1}`, messages: [], pinned: false, unread: false };
    state.chats.push(newChat);
    state.currentChatId = state.chats.length - 1;
    saveChats();
    renderSavedChat(state.currentChatId, "No messages yet", newChat.pinned, newChat.unread);
    elements.chatArea.innerHTML = '<div class="chat-placeholder" aria-hidden="true">Start a new chat or select a saved one...</div>';
    toggleSidebar();
  });
}

// Render saved chat
function renderSavedChat(index, firstMessage, pinned, unread) {
  const saveDiv = document.createElement("div");
  saveDiv.className = `saved-chat ${pinned ? "pinned" : ""} ${unread ? "unread" : ""}`;
  saveDiv.setAttribute("role", "listitem");
  saveDiv.setAttribute("aria-label", `Load saved chat ${firstMessage}`);
  saveDiv.tabIndex = 0;
  saveDiv.innerHTML = `
    <span>${firstMessage}</span>
    <button aria-label="Delete chat" data-index="${index}">🗑️</button>
  `;

  saveDiv.addEventListener("click", (e) => {
    if (e.target.tagName !== "BUTTON") {
      loadChat(index);
    }
  });

  saveDiv.addEventListener("keypress", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      loadChat(index);
    }
  });

  saveDiv.querySelector("button").addEventListener("click", () => deleteChat(index));
  elements.savedChats.appendChild(saveDiv);
}

// Load chat
function loadChat(index) {
  transitionChat(() => {
    state.currentChatId = index;
    state.chats[index].unread = false;
    elements.chatArea.innerHTML = "";
    if (state.chats[index].messages.length === 0) {
      elements.chatArea.innerHTML = '<div class="chat-placeholder" aria-hidden="true">Start a new chat or select a saved one...</div>';
    } else {
      state.chats[index].messages.forEach((msg, i) => {
        const messageDiv = document.createElement("div");
        messageDiv.className = `message ${msg.type} ${msg.pinned ? "pinned" : ""}`;
        if (msg.content) {
          messageDiv.textContent = msg.content;
        }
        if (msg.images) {
          const imageContainer = document.createElement("div");
          msg.images.forEach(imgSrc => {
            const img = document.createElement("img");
            img.src = imgSrc;
            img.alt = "Uploaded image";
            imageContainer.appendChild(img);
          });
          messageDiv.appendChild(imageContainer);
        }
        if (msg.audio) {
          const audio = document.createElement("audio");
          audio.controls = true;
          audio.src = msg.audio;
          messageDiv.appendChild(audio);
        }
        if (msg.reactions.length > 0) {
          updateReactions(messageDiv, msg.reactions);
        }
        elements.chatArea.appendChild(messageDiv);
      });
    }
    saveChats();
    scrollToBottom();
    toggleSidebar();
  });
}

// Delete chat
function deleteChat(index) {
  if (confirm(`Delete this chat?`)) {
    state.chats.splice(index, 1);
    saveChats();
    elements.savedChats.innerHTML = "";
    initializeChats();
    if (state.currentChatId === index) {
      state.currentChatId = null;
      elements.chatArea.innerHTML = '<div class="chat-placeholder" aria-hidden="true">Start a new chat or select a saved one...</div>';
    } else if (state.currentChatId !== null && state.currentChatId > index) {
      state.currentChatId--;
    }
  }
}

// Save chats to localStorage
function saveChats() {
  localStorage.setItem("savedChats", JSON.stringify(state.chats));
}

// Transition chat area
function transitionChat(callback) {
  elements.chatArea.classList.add("transitioning");
  setTimeout(() => {
    callback();
    elements.chatArea.classList.remove("transitioning");
    scrollToBottom();
  }, 300);
}

// Handle outside clicks
function handleOutsideClick(e) {
  if (!elements.menuDots.contains(e.target) && !elements.dropdown.contains(e.target)) {
    closeMenu();
  }
  if (!elements.sidebar.contains(e.target) && !elements.hamburger.contains(e.target) && elements.sidebar.classList.contains("active")) {
    toggleSidebar();
  }
  if (!elements.messageContextMenu.contains(e.target)) {
    elements.messageContextMenu.hidden = true;
  }
  if (!elements.chatContextMenu.contains(e.target)) {
    elements.chatContextMenu.hidden = true;
  }
}

// Toggle sidebar
function toggleSidebar() {
  console.log("Toggling sidebar...");
  elements.sidebar.classList.toggle("active");
}
