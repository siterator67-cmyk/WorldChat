const API_URL = 'https://worldchat-server.onrender.com';

const app = {
  currentScreen: 'auth',
  authMode: 'register',
  selectedLang: null,
  myCountry: null,
  theirCountry: null,
  countryStep: 'my',
  chatMode: null,
  subscription: 'free',
  chats: [],
  activeChatId: null,
  addingChat: false,
  token: null,
  pendingEmail: null,
};

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (app.token) headers['Authorization'] = 'Bearer ' + app.token;
  const res = await fetch(API_URL + path, { ...options, headers, body: options.body ? JSON.stringify(options.body) : undefined });
  return res.json();
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const screen = document.getElementById(id);
  if (screen) {
    screen.classList.add('active');
    app.currentScreen = id;
    parseEmojis(screen);
  }
}

function parseEmojis(el) {
  if (typeof twemoji !== 'undefined') {
    twemoji.parse(el, { folder: 'svg', ext: '.svg' });
  }
}

// ===== AUTH =====
function initAuth() {
  const tabs = document.querySelectorAll('.auth-box .tab');
  const registerFields = document.getElementById('register-fields');
  const authBtn = document.getElementById('auth-btn');

  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      app.authMode = tab.dataset.mode;
      registerFields.style.display = app.authMode === 'register' ? 'block' : 'none';
      authBtn.textContent = app.authMode === 'register' ? 'Create account' : 'Log in';
      clearErrors();
    });
  });

  authBtn.addEventListener('click', handleAuth);

  const toggleBtn = document.getElementById('toggle-password');
  const passInput = document.getElementById('auth-password');
  toggleBtn.addEventListener('click', () => {
    const showing = passInput.type === 'text';
    passInput.type = showing ? 'password' : 'text';
    toggleBtn.textContent = showing ? '👁' : '🙈';
  });

  document.querySelectorAll('.social-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen('screen-lang');
    });
  });
}

function getUsers() {
  return JSON.parse(localStorage.getItem('worldchat_users') || '[]');
}
function saveUsers(users) {
  localStorage.setItem('worldchat_users', JSON.stringify(users));
}
function loginAs(email) {
  app.currentUser = email;
  localStorage.setItem('worldchat_session', email);
  loadUserData();
}
function loadUserData() {
  const data = JSON.parse(localStorage.getItem('worldchat_data_' + app.currentUser) || 'null');
  if (data) {
    app.chats = data.chats || [];
    app.myCountry = data.myCountry || null;
    app.selectedLang = data.selectedLang || null;
    app.subscription = data.subscription || 'free';
  } else {
    app.chats = [];
    app.myCountry = null;
    app.selectedLang = null;
    app.subscription = 'free';
  }
  app.activeChatId = null;
}
function saveUserData() {
  if (!app.currentUser) return;
  localStorage.setItem('worldchat_data_' + app.currentUser, JSON.stringify({
    chats: app.chats,
    myCountry: app.myCountry,
    selectedLang: app.selectedLang,
    subscription: app.subscription,
  }));
}
function logout() {
  if (app.token) api('/api/logout', { method: 'POST' });
  localStorage.removeItem('worldchat_token');
  localStorage.removeItem('worldchat_session');
  app.token = null;
  app.currentUser = null;
  app.chats = [];
  app.myCountry = null;
  app.selectedLang = null;
  app.subscription = 'free';
  app.activeChatId = null;
  showScreen('screen-auth');
}

async function handleAuth() {
  clearErrors();
  const username = document.getElementById('auth-username').value.trim();
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value.trim();

  if (app.authMode === 'register') {
    if (!username) return showError('error-username', t('usernameRequired'));
    if (/[а-яА-ЯёЁ]/.test(username)) return showError('error-username', t('cyrillicNotAllowed'));
    if (username.length < 3) return showError('error-username', t('minChars3'));
  }

  if (!email) return showError('error-email', t('emailRequired'));
  if (/[а-яА-ЯёЁ]/.test(email)) return showError('error-email', t('cyrillicNotAllowed'));
  if (!email.includes('@')) return showError('error-email', t('invalidEmail'));

  if (!password) return showError('error-password', t('passwordRequired'));
  if (password.length < 6) return showError('error-password', t('minChars6'));

  const authBtn = document.getElementById('auth-btn');
  authBtn.disabled = true;
  authBtn.textContent = 'Please wait...';

  if (app.authMode === 'register') {
    const res = await api('/api/register', { method: 'POST', body: { username, email, password } });
    authBtn.disabled = false;
    authBtn.textContent = 'Create account';
    if (res.error) return showError('error-email', res.error);
    app.pendingEmail = email.toLowerCase();
    document.getElementById('verify-subtitle').textContent = 'We sent a 6-digit code to ' + email;
    showScreen('screen-verify');
  } else {
    const res = await api('/api/login', { method: 'POST', body: { email, password } });
    authBtn.disabled = false;
    authBtn.textContent = 'Log in';
    if (res.needsVerification) {
      app.pendingEmail = email.toLowerCase();
      document.getElementById('verify-subtitle').textContent = 'We sent a 6-digit code to ' + email;
      showScreen('screen-verify');
      return;
    }
    if (res.error) return showError('error-email', res.error);
    app.token = res.token;
    localStorage.setItem('worldchat_token', res.token);
    app.currentUser = res.user.email;
    app.subscription = res.user.subscription;
    loadUserData();
    if (app.selectedLang && app.myCountry && app.chats.length > 0) {
      renderSidebar();
      showScreen('screen-main');
    } else if (app.selectedLang) {
      showScreen('screen-country');
    } else {
      showScreen('screen-lang');
    }
  }
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (el) { el.textContent = msg; el.style.display = 'block'; }
}
function clearErrors() {
  document.querySelectorAll('.error-msg').forEach(e => { e.style.display = 'none'; });
}

// ===== VERIFY EMAIL =====
function initVerify() {
  document.getElementById('verify-btn').addEventListener('click', async () => {
    const code = document.getElementById('verify-code').value.trim();
    if (code.length !== 6) return showError('error-verify', 'Enter the 6-digit code');
    const btn = document.getElementById('verify-btn');
    btn.disabled = true;
    btn.textContent = 'Verifying...';
    const res = await api('/api/verify', { method: 'POST', body: { email: app.pendingEmail, code } });
    btn.disabled = false;
    btn.textContent = 'Verify';
    if (res.error) return showError('error-verify', res.error);
    if (res.token) {
      app.token = res.token;
      localStorage.setItem('worldchat_token', res.token);
      app.currentUser = res.user.email;
      app.subscription = res.user.subscription;
      showScreen('screen-lang');
    }
  });

  document.getElementById('resend-btn').addEventListener('click', async () => {
    const btn = document.getElementById('resend-btn');
    btn.disabled = true;
    btn.textContent = 'Sending...';
    await api('/api/resend-code', { method: 'POST', body: { email: app.pendingEmail } });
    btn.disabled = false;
    btn.textContent = 'Resend code';
  });
}

// ===== LANGUAGE SELECT =====
function initLangSelect() {
  const grid = document.getElementById('lang-grid');
  LANGUAGES.forEach(lang => {
    const card = document.createElement('div');
    card.className = 'lang-card';
    card.innerHTML = `<span class="flag">${lang.flag}</span><span class="name">${lang.native}</span>`;
    card.addEventListener('click', () => {
      grid.querySelectorAll('.lang-card').forEach(c => c.classList.remove('selected'));
      card.classList.add('selected');
      app.selectedLang = lang.code;
      saveUserData();
      applyTranslations();
      setTimeout(() => {
        app.addingChat = true;
        app.countryStep = 'my';
        initCountrySelect();
        showScreen('screen-country');
      }, 300);
    });
    grid.appendChild(card);
  });
}

// ===== COUNTRY SELECT =====
function initCountrySelect() {
  const stepLabel = document.getElementById('country-step-label');
  const title = document.getElementById('country-title');
  const search = document.getElementById('country-search');

  if (app.countryStep === 'my') {
    stepLabel.textContent = t('step1of2');
    title.textContent = t('selectYourCountry');
  } else {
    stepLabel.textContent = t('step2of2');
    title.textContent = t('whoToTalkTo');
  }

  search.value = '';
  renderCountries('');

  search.oninput = () => renderCountries(search.value.toLowerCase());
}

function renderCountries(filter) {
  const grid = document.getElementById('country-grid');
  grid.innerHTML = '';

  const sorted = [...COUNTRIES].sort((a, b) => b.online - a.online);
  const filtered = filter ? sorted.filter(c => c.name.toLowerCase().includes(filter)) : sorted;

  filtered.forEach(country => {
    const card = document.createElement('div');
    card.className = 'country-card';
    const onlineText = country.online === 0
      ? '<span class="online zero">● 0 online</span>'
      : `<span class="online">● ${country.online.toLocaleString()} online</span>`;
    card.innerHTML = `<div class="flag">${country.flag}</div><div class="name">${country.name}</div>${onlineText}`;

    card.addEventListener('click', () => {
      if (app.countryStep === 'my') {
        app.myCountry = country;
        saveUserData();
        app.countryStep = 'their';
        initCountrySelect();
      } else {
        app.theirCountry = country;
        updateModesScreen();
        showScreen('screen-modes');
      }
    });

    card.addEventListener('mouseenter', () => card.classList.add('selected'));
    card.addEventListener('mouseleave', () => card.classList.remove('selected'));

    grid.appendChild(card);
  });
  parseEmojis(grid);
}

// ===== CHAT MODES =====
function initModes() {
  document.querySelectorAll('.mode-card').forEach(card => {
    card.addEventListener('click', () => {
      const mode = card.dataset.mode;
      if (mode === 'premium' || mode === 'premplus') {
        openPaymentScreen(mode);
        return;
      }
      app.chatMode = mode;
      createNewChat();
    });
  });

  document.getElementById('public-chat-btn').addEventListener('click', () => {
    app.chatMode = 'public';
    createNewChat();
  });
}

function updateModesScreen() {
  const subLabel = document.getElementById('subscription-label');
  const premCard = document.querySelector('.mode-card.premium');
  const premplusCard = document.querySelector('.mode-card.premplus');
  const publicBtn = document.getElementById('public-chat-btn');
  const premplusNote = document.getElementById('premplus-note');
  const premplusPrice = premplusCard.querySelector('.price');

  if (app.subscription === 'premplus') {
    subLabel.innerHTML = '💎 Active subscription: <strong>Premium+</strong>';
    subLabel.style.display = 'block';
    premCard.style.display = 'none';
    premplusCard.style.display = 'none';
    publicBtn.style.display = 'block';
    premplusNote.style.display = 'block';
  } else if (app.subscription === 'premium') {
    subLabel.innerHTML = '👑 Active subscription: <strong>Premium</strong>';
    subLabel.style.display = 'block';
    premCard.style.display = 'none';
    publicBtn.style.display = 'block';
    premplusCard.style.display = '';
    premplusPrice.textContent = '$1.99 / month';
    premplusNote.style.display = 'none';
  } else {
    subLabel.style.display = 'none';
    premCard.style.display = '';
    premplusCard.style.display = '';
    premplusPrice.textContent = '$2.99 / month';
    publicBtn.style.display = 'none';
    premplusNote.style.display = 'none';
  }
}

// ===== MAIN SCREEN =====
function pickRandomNames(count, exclude) {
  const allNames = [
    'Alex_92', 'Yuki_Tokyo', 'Hans_Berlin', 'Maria_SP', 'Kim_Seoul',
    'Pierre_Paris', 'Luna_Roma', 'Akira_23', 'Sofia_BA', 'Chen_Wei',
    'Leo_NYC', 'Nina_Oslo', 'Ravi_Delhi', 'Mia_Rio', 'Omar_Cairo',
    'Liam_UK', 'Sakura_JP', 'Marco_IT', 'Anya_RU', 'Jake_AU',
    'Priya_IN', 'Carlos_MX', 'Emma_SE', 'Ali_TR', 'Zara_NG',
    'Tomas_CZ', 'Hana_KR', 'Diego_AR', 'Freya_NO', 'Yusuf_EG',
  ];
  const available = allNames.filter(n => !exclude.includes(n));
  const picked = [];
  while (picked.length < count && available.length > 0) {
    const i = Math.floor(Math.random() * available.length);
    picked.push(available.splice(i, 1)[0]);
  }
  return picked;
}

function createNewChat() {
  const isPublic = app.chatMode === 'public';
  const isGroup = app.chatMode === 'group';

  let members = [];
  if (isPublic) {
    const myCount = 3 + Math.floor(Math.random() * 3);
    const theirCount = 4 + Math.floor(Math.random() * 4);
    const myNames = pickRandomNames(myCount, []);
    const theirNames = pickRandomNames(theirCount, myNames);
    myNames.forEach(n => members.push({ name: n, country: app.myCountry, side: 'my' }));
    theirNames.forEach(n => members.push({ name: n, country: app.theirCountry, side: 'their' }));
  } else if (isGroup) {
    const myTeam = pickRandomNames(2, []);
    const theirTeam = pickRandomNames(2, myTeam);
    members = [
      { name: myTeam[0], country: app.myCountry, side: 'my' },
      { name: myTeam[1], country: app.myCountry, side: 'my' },
      { name: theirTeam[0], country: app.theirCountry, side: 'their' },
      { name: theirTeam[1], country: app.theirCountry, side: 'their' },
    ];
  } else {
    const name = pickRandomNames(1, [])[0];
    members = [{ name, country: app.theirCountry, side: 'their' }];
  }

  let partnerName;
  if (isPublic) {
    partnerName = `Public ${app.myCountry.flag}×${app.theirCountry.flag}`;
  } else if (isGroup) {
    partnerName = `Group ${app.myCountry.flag}×${app.theirCountry.flag}`;
  } else {
    partnerName = members[0].name;
  }

  const chat = {
    id: Date.now(),
    myCountry: app.myCountry,
    theirCountry: app.theirCountry,
    mode: app.chatMode,
    isGroup: isGroup || isPublic,
    members,
    partnerName,
    messages: [],
    lastMessage: '',
    lastTime: new Date(),
  };

  app.chats.push(chat);
  app.activeChatId = chat.id;
  saveUserData();

  renderSidebar();
  openChat(chat.id);
  showScreen('screen-main');
}

function renderSidebar() {
  updateSidebarUser();
  const container = document.getElementById('sidebar-chats');
  container.innerHTML = '';

  app.chats.forEach(chat => {
    const item = document.createElement('div');
    item.className = 'sidebar-chat-item' + (chat.id === app.activeChatId ? ' active' : '');

    const preview = chat.lastMessage || t('noMessagesYet');
    const timeStr = formatTime(chat.lastTime);

    item.innerHTML = `
      <div class="chat-item-flags">${chat.myCountry.flag} ${chat.theirCountry.flag}</div>
      <div class="chat-item-info">
        <div class="chat-item-name">${escapeHtml(chat.partnerName)}</div>
        <div class="chat-item-preview">${escapeHtml(preview)}</div>
      </div>
      <div>
        <div class="chat-item-time">${timeStr}</div>
        <div class="chat-item-online" style="margin-top:6px;"></div>
      </div>
    `;

    item.addEventListener('click', () => {
      app.activeChatId = chat.id;
      openChat(chat.id);
      renderSidebar();
    });

    container.appendChild(item);
  });

  parseEmojis(container);
}

function openChat(chatId) {
  const chat = app.chats.find(c => c.id === chatId);
  if (!chat) return;

  document.getElementById('main-chat-empty').style.display = 'none';
  const panel = document.getElementById('chat-panel');
  panel.style.display = 'flex';

  const headerFlags = document.getElementById('chat-flags');
  const partnerName = document.getElementById('chat-partner-name');
  headerFlags.textContent = `${chat.myCountry.flag} ↔ ${chat.theirCountry.flag}`;
  if (chat.isGroup) {
    partnerName.textContent = chat.members.map(m => m.name).join(', ') + ' & You';
  } else {
    partnerName.textContent = chat.members[0].name;
  }

  const isPremPlus = app.subscription === 'premplus';
  document.querySelectorAll('#chat-panel .chat-media-btn').forEach(btn => {
    if (isPremPlus) {
      btn.classList.add('unlocked');
      btn.style.cursor = 'pointer';
    } else {
      btn.classList.remove('unlocked');
      btn.style.cursor = 'not-allowed';
    }
  });

  const footer = document.getElementById('chat-footer-note');
  footer.style.display = isPremPlus ? 'none' : 'block';

  const messagesContainer = document.getElementById('chat-messages');
  messagesContainer.innerHTML = `<div class="typing-indicator" id="typing-indicator" style="display:none;"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-label">${t('typing')}</span></div>`;

  chat.messages.forEach(msg => {
    addMessageToDOM(msg.text, msg.who, msg.sender, chat.isGroup);
  });

  parseEmojis(panel);

  const input = document.getElementById('chat-input');
  const sendBtn = document.getElementById('chat-send');

  const sendMessage = () => {
    const text = input.value.trim();
    if (!text) return;
    chat.messages.push({ text, who: 'me', sender: 'You' });
    chat.lastMessage = text;
    chat.lastTime = new Date();
    addMessageToDOM(text, 'me', 'You', chat.isGroup);
    renderSidebar();
    saveUserData();
    input.value = '';

    if (chat.isGroup) {
      const responders = [...chat.members].sort(() => Math.random() - 0.5);
      const isPublic = chat.mode === 'public';
      const minReplies = isPublic ? 3 : 2;
      let delay = 800;
      let replied = 0;
      responders.forEach(member => {
        const chance = isPublic ? 0.5 : 0.7;
        if (replied >= minReplies && Math.random() > chance) return;
        delay += 600 + Math.random() * (isPublic ? 2500 : 1500);
        replied++;
        setTimeout(() => {
          const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
          chat.messages.push({ text: reply, who: 'them', sender: member.name });
          chat.lastMessage = `${member.name}: ${reply}`;
          chat.lastTime = new Date();
          addMessageToDOM(reply, 'them', member.name, true);
          renderSidebar();
        }, delay);
      });
    } else {
      showTyping();
      setTimeout(() => {
        hideTyping();
        const reply = BOT_REPLIES[Math.floor(Math.random() * BOT_REPLIES.length)];
        const sender = chat.members[0].name;
        chat.messages.push({ text: reply, who: 'them', sender });
        chat.lastMessage = reply;
        chat.lastTime = new Date();
        addMessageToDOM(reply, 'them', sender, false);
        renderSidebar();
      }, 1500 + Math.random() * 2000);
    }
  };

  sendBtn.onclick = sendMessage;
  input.onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };
}

function addMessageToDOM(text, who, sender, isGroup, mediaType, mediaSrc) {
  const container = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.className = `msg msg-${who}`;

  const nameTag = isGroup && sender ? `<div class="msg-sender">${escapeHtml(sender)}</div>` : '';
  let content = '';

  if (mediaType === 'image') {
    content = `<img src="${mediaSrc}" class="msg-media-img" alt="photo">`;
  } else if (mediaType === 'video') {
    content = `<video src="${mediaSrc}" class="msg-media-video" controls></video>`;
  } else if (mediaType === 'voice') {
    content = `<div class="msg-voice"><span class="voice-icon">🎤</span><audio src="${mediaSrc}" class="msg-audio" controls></audio></div>`;
  } else {
    content = escapeHtml(text);
  }

  if (who === 'me') {
    div.innerHTML = `${nameTag}${content}<div class="translate">${t('sentAs')}</div>`;
  } else {
    div.innerHTML = `${nameTag}${content}<div class="translate">${t('translatedShowOriginal')}</div>`;
  }

  container.appendChild(div);
  parseEmojis(div);
  container.scrollTop = container.scrollHeight;
}

function formatTime(date) {
  const d = new Date(date);
  const h = d.getHours().toString().padStart(2, '0');
  const m = d.getMinutes().toString().padStart(2, '0');
  return `${h}:${m}`;
}

function initMainScreen() {
  document.getElementById('btn-add-chat').addEventListener('click', () => {
    app.addingChat = true;
    if (app.myCountry) {
      app.countryStep = 'their';
    } else {
      app.countryStep = 'my';
    }
    initCountrySelect();
    showScreen('screen-country');
  });

  document.getElementById('btn-write-admin').addEventListener('click', () => {
    const url = 'https://t.me/WorldChatAdmin';
    if (window.electronAPI) window.electronAPI.openExternal(url);
    else window.open(url, '_blank');
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    logout();
  });
}

function updateSidebarUser() {
  const users = getUsers();
  const user = users.find(u => u.email === app.currentUser);
  const nameEl = document.getElementById('sidebar-username');
  nameEl.textContent = user ? user.username : '';

  const defaultEl = document.getElementById('avatar-default');
  const imgEl = document.getElementById('avatar-img');
  const savedAvatar = localStorage.getItem('worldchat_avatar_' + app.currentUser);

  if (savedAvatar) {
    defaultEl.style.display = 'none';
    imgEl.style.display = 'block';
    imgEl.src = savedAvatar;
  } else {
    const initial = user ? user.username.charAt(0).toUpperCase() : '?';
    defaultEl.textContent = initial;
    defaultEl.style.display = 'flex';
    imgEl.style.display = 'none';
  }

  const wrap = document.getElementById('avatar-wrap');
  const badge = document.getElementById('avatar-badge');
  wrap.classList.remove('sub-premium', 'sub-premplus');
  badge.style.display = 'none';
  badge.className = 'avatar-sub-badge';

  if (app.subscription === 'premplus') {
    wrap.classList.add('sub-premplus');
    badge.classList.add('badge-premplus');
    badge.textContent = 'Prem+';
    badge.style.display = 'block';
  } else if (app.subscription === 'premium') {
    wrap.classList.add('sub-premium');
    badge.classList.add('badge-premium');
    badge.textContent = 'Prem';
    badge.style.display = 'block';
  }
}

function initAvatarPicker() {
  const wrap = document.getElementById('avatar-wrap');
  const input = document.getElementById('avatar-input');
  const modal = document.getElementById('avatar-modal');
  const modalDefault = document.getElementById('avatar-modal-default');
  const modalImg = document.getElementById('avatar-modal-img');
  const cancelBtn = document.getElementById('avatar-modal-cancel');
  const changeBtn = document.getElementById('avatar-modal-change');
  const backdrop = document.getElementById('avatar-modal-backdrop');

  wrap.addEventListener('click', () => {
    const users = getUsers();
    const user = users.find(u => u.email === app.currentUser);
    const savedAvatar = localStorage.getItem('worldchat_avatar_' + app.currentUser);
    document.getElementById('avatar-modal-name').textContent = user ? user.username : '';
    if (savedAvatar) {
      modalDefault.style.display = 'none';
      modalImg.style.display = 'block';
      modalImg.src = savedAvatar;
    } else {
      modalDefault.textContent = user ? user.username.charAt(0).toUpperCase() : '?';
      modalDefault.style.display = 'flex';
      modalImg.style.display = 'none';
    }
    modal.style.display = 'flex';
  });

  cancelBtn.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  backdrop.addEventListener('click', () => {
    modal.style.display = 'none';
  });

  changeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
    input.click();
  });

  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      localStorage.setItem('worldchat_avatar_' + app.currentUser, e.target.result);
      updateSidebarUser();
    };
    reader.readAsDataURL(file);
    input.value = '';
  });
}

// ===== ADMIN CHAT =====
function initAdminChat() {
  document.getElementById('admin-back-btn').addEventListener('click', () => {
    showScreen('screen-main');
  });

  const input = document.getElementById('admin-input');
  const sendBtn = document.getElementById('admin-send');

  const sendAdminMsg = () => {
    const text = input.value.trim();
    if (!text) return;
    const container = document.getElementById('admin-messages');
    const div = document.createElement('div');
    div.className = 'msg msg-me';
    div.textContent = text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    input.value = '';

    setTimeout(() => {
      const reply = document.createElement('div');
      reply.className = 'msg msg-them';
      reply.textContent = 'Thanks for reaching out! Our team will review your message and get back to you shortly.';
      container.appendChild(reply);
      container.scrollTop = container.scrollHeight;
    }, 1500);
  };

  sendBtn.addEventListener('click', sendAdminMsg);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendAdminMsg(); });
}

const BOT_REPLIES = [
  "That's really interesting! Tell me more about your country.",
  "I've always wanted to visit there! What's the weather like?",
  "Haha, we have something similar here too!",
  "What kind of music do you listen to?",
  "Do you like traveling? Where have you been?",
  "That's cool! I didn't know that.",
  "How do you say 'hello' in your language?",
  "What's the most popular food in your country?",
  "Wow, nice! I love learning about different cultures 🌍",
  "Same here! We should meet up someday 😄",
  "That's so different from what we have here",
  "Really? Tell me more!",
  "Haha that's funny 😂",
  "I agree with that 100%",
  "No way! That's amazing",
  "What time is it there right now?",
  "Do you have any pets?",
  "What do you do for fun on weekends?",
  "I love that! We have something similar",
  "Have you tried any food from my country?",
  "That sounds awesome! 🔥",
  "lol I didn't expect that",
  "Interesting perspective, thanks for sharing",
  "What's your favorite movie?",
  "I want to learn your language someday",
  "The culture there seems really cool",
  "How's life treating you? 😊",
  "That reminds me of a story...",
  "We should definitely keep in touch!",
  "You're so lucky to live there!",
];

function showTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) { el.style.display = 'flex'; }
  const container = document.getElementById('chat-messages');
  if (container) container.scrollTop = container.scrollHeight;
}
function hideTyping() {
  const el = document.getElementById('typing-indicator');
  if (el) { el.style.display = 'none'; }
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

// ===== MEDIA & VOICE =====
function initMedia() {
  const photoBtn = document.getElementById('btn-photo');
  const voiceBtn = document.getElementById('btn-voice');
  const mediaInput = document.getElementById('media-input');

  photoBtn.addEventListener('click', () => {
    if (app.subscription !== 'premplus') return;
    if (!app.activeChatId) return;
    mediaInput.click();
  });

  mediaInput.addEventListener('change', () => {
    const file = mediaInput.files[0];
    if (!file) return;
    const chat = app.chats.find(c => c.id === app.activeChatId);
    if (!chat) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target.result;
      const isVideo = file.type.startsWith('video/');
      const mediaType = isVideo ? 'video' : 'image';
      const label = isVideo ? '🎬 Video' : '📷 Photo';

      chat.messages.push({ text: label, who: 'me', sender: 'You', mediaType, mediaSrc: src });
      chat.lastMessage = label;
      chat.lastTime = new Date();
      addMessageToDOM(label, 'me', 'You', chat.isGroup, mediaType, src);
      renderSidebar();
      saveUserData();
    };
    reader.readAsDataURL(file);
    mediaInput.value = '';
  });

  let mediaRecorder = null;
  let audioChunks = [];
  let recording = false;

  voiceBtn.addEventListener('click', () => {
    if (app.subscription !== 'premplus') return;
    if (!app.activeChatId) return;

    if (recording) {
      mediaRecorder.stop();
      voiceBtn.classList.remove('recording');
      recording = false;
      return;
    }

    navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
      mediaRecorder = new MediaRecorder(stream);
      audioChunks = [];
      recording = true;
      voiceBtn.classList.add('recording');

      mediaRecorder.ondataavailable = (e) => {
        audioChunks.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(tr => tr.stop());
        const blob = new Blob(audioChunks, { type: 'audio/webm' });
        const src = URL.createObjectURL(blob);
        const chat = app.chats.find(c => c.id === app.activeChatId);
        if (!chat) return;

        chat.messages.push({ text: '🎤 Voice message', who: 'me', sender: 'You', mediaType: 'voice', mediaSrc: src });
        chat.lastMessage = '🎤 Voice message';
        chat.lastTime = new Date();
        addMessageToDOM('🎤 Voice message', 'me', 'You', chat.isGroup, 'voice', src);
        renderSidebar();
      };

      mediaRecorder.start();
    }).catch(() => {
      alert('Microphone access denied. Please allow microphone access in your system settings.');
    });
  });
}

// ===== PAYMENT =====
async function openPaymentScreen(plan) {
  if (!app.token) return;
  const res = await api('/api/create-checkout', { method: 'POST', body: { plan } });
  if (res.url) {
    if (window.electronAPI) window.electronAPI.openExternal(res.url);
    else window.open(res.url, '_blank');
    app.pendingPlan = plan;
    startSubscriptionPolling();
  } else if (res.error) {
    alert(res.error);
  }
}

function startSubscriptionPolling() {
  let checks = 0;
  const interval = setInterval(async () => {
    checks++;
    const res = await api('/api/me');
    if (res.user && res.user.subscription !== 'free') {
      clearInterval(interval);
      app.subscription = res.user.subscription;
      saveUserData();
      updateModesScreen();
    }
    if (checks > 60) clearInterval(interval);
  }, 5000);
}

function initPayment() {}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  initAuth();
  initVerify();
  initLangSelect();
  initModes();
  initPayment();
  initMedia();
  initMainScreen();
  initAvatarPicker();
  initAdminChat();

  const savedToken = localStorage.getItem('worldchat_token');
  if (savedToken) {
    app.token = savedToken;
    api('/api/me').then(res => {
      if (res.user) {
        app.currentUser = res.user.email;
        app.subscription = res.user.subscription;
        loadUserData();
        applyTranslations();
        if (app.selectedLang && app.myCountry && app.chats.length > 0) {
          renderSidebar();
          showScreen('screen-main');
        } else if (app.selectedLang) {
          app.countryStep = 'my';
          initCountrySelect();
          showScreen('screen-country');
        } else {
          showScreen('screen-lang');
        }
      } else {
        localStorage.removeItem('worldchat_token');
        app.token = null;
        showScreen('screen-auth');
      }
    });
  } else {
    showScreen('screen-auth');
  }
});
