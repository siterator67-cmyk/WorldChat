const TRANSLATIONS = {
  en: {
    // Auth
    createAccount: 'Create account',
    logIn: 'Log in',
    username: 'Username',
    email: 'Email',
    password: 'Password',
    yourUsername: 'Your username',
    emailPlaceholder: 'you@gmail.com',
    minChars6: 'Minimum 6 characters',
    orContinueWith: 'or continue with',
    // Auth errors
    usernameRequired: 'Username is required',
    cyrillicNotAllowed: 'Cyrillic characters are not allowed',
    minChars3: 'Minimum 3 characters',
    emailRequired: 'Email is required',
    invalidEmail: 'Invalid email format',
    onlyRealEmail: 'Only real email providers allowed (Gmail, Yahoo, Outlook, etc.)',
    passwordRequired: 'Password is required',
    accountExists: 'Account with this email already exists',
    userNotFound: 'User not found or wrong password',
    // Language select
    chooseLanguage: 'Choose your language',
    langSubtitle: 'This will be used for the interface and auto-translation',
    // Country select
    step1of2: 'Step 1 of 2',
    step2of2: 'Step 2 of 2',
    selectYourCountry: 'Select your country',
    whoToTalkTo: 'Who do you want to talk to?',
    countriesSorted: 'Countries are sorted by online users',
    searchCountries: 'Search countries...',
    online: 'online',
    // Chat modes
    chooseChatMode: 'Choose chat mode',
    chattingWith: 'Chatting with people from another country',
    oneOnOne: '1 on 1',
    groupOf4: 'Group of 4',
    premium: 'Premium',
    premiumPlus: 'Premium+',
    free: 'Free',
    perMonth: '/ month',
    findOnePerson: 'Find one person from the selected country',
    twoFromEach: '2 from your country + 2 from theirs',
    publicChatDesc: 'Public chat with everyone from both countries. Text only',
    premPlusDesc: 'Everything from Premium + photos, videos, voice messages, "Prem+" badge',
    publicChat: 'Public chat',
    included: 'Included',
    publicChatEveryoneDesc: 'Chat with everyone from both countries',
    premPlusNote: 'Same as public chat — included in your subscription',
    activeSub: 'Active subscription:',
    // Main screen
    chats: 'Chats',
    addChat: '+ Add chat',
    writeToAdmin: '✉ Write to admin',
    logOut: '⬅ Log out',
    selectAChat: 'Select a chat',
    orAddNew: 'Or add a new one to start talking',
    noMessagesYet: 'No messages yet',
    changeAvatar: 'Change avatar',
    // Chat
    typeMessage: 'Type a message...',
    premiumOnlyNote: '🔒 Photo and voice messages are Premium+ only',
    translatedShowOriginal: 'Translated — show original',
    sentAs: 'Sent as: [translated to partner\'s language]',
    typing: 'typing...',
    // Admin
    adminName: '🛡️ WorldChat Admin',
    adminWelcome: 'Hi! How can we help you? Describe your issue and we\'ll get back to you as soon as possible.',
    adminReply: 'Thanks for reaching out! Our team will review your message and get back to you shortly.',
    describeIssue: 'Describe your issue...',
    back: '← Back',
  },

  ru: {
    createAccount: 'Создать аккаунт',
    logIn: 'Войти',
    username: 'Имя пользователя',
    email: 'Почта',
    password: 'Пароль',
    yourUsername: 'Ваше имя',
    emailPlaceholder: 'вы@gmail.com',
    minChars6: 'Минимум 6 символов',
    orContinueWith: 'или продолжить через',
    usernameRequired: 'Введите имя пользователя',
    cyrillicNotAllowed: 'Кириллица не допускается',
    minChars3: 'Минимум 3 символа',
    emailRequired: 'Введите почту',
    invalidEmail: 'Неверный формат почты',
    onlyRealEmail: 'Только настоящие почтовые сервисы (Gmail, Yahoo, Outlook и т.д.)',
    passwordRequired: 'Введите пароль',
    accountExists: 'Аккаунт с такой почтой уже существует',
    userNotFound: 'Пользователь не найден или неверный пароль',
    chooseLanguage: 'Выберите язык',
    langSubtitle: 'Будет использоваться для интерфейса и автоперевода',
    step1of2: 'Шаг 1 из 2',
    step2of2: 'Шаг 2 из 2',
    selectYourCountry: 'Выберите свою страну',
    whoToTalkTo: 'С кем хотите общаться?',
    countriesSorted: 'Страны отсортированы по онлайну',
    searchCountries: 'Поиск стран...',
    online: 'онлайн',
    chooseChatMode: 'Выберите режим чата',
    chattingWith: 'Общение с людьми из другой страны',
    oneOnOne: '1 на 1',
    groupOf4: 'Группа из 4',
    premium: 'Премиум',
    premiumPlus: 'Премиум+',
    free: 'Бесплатно',
    perMonth: '/ мес',
    findOnePerson: 'Найти одного человека из выбранной страны',
    twoFromEach: '2 из вашей страны + 2 из их',
    publicChatDesc: 'Общий чат со всеми из обеих стран. Только текст',
    premPlusDesc: 'Всё из Премиум + фото, видео, голосовые, значок "Prem+"',
    publicChat: 'Общий чат',
    included: 'Включено',
    publicChatEveryoneDesc: 'Чат со всеми из обеих стран',
    premPlusNote: 'То же, что общий чат — включено в подписку',
    activeSub: 'Активная подписка:',
    chats: 'Чаты',
    addChat: '+ Добавить чат',
    writeToAdmin: '✉ Написать админу',
    logOut: '⬅ Выйти',
    selectAChat: 'Выберите чат',
    orAddNew: 'Или добавьте новый, чтобы начать общение',
    noMessagesYet: 'Пока нет сообщений',
    changeAvatar: 'Сменить аватар',
    typeMessage: 'Введите сообщение...',
    premiumOnlyNote: '🔒 Фото и голосовые только для Премиум+',
    translatedShowOriginal: 'Переведено — показать оригинал',
    sentAs: 'Отправлено как: [переведено на язык собеседника]',
    typing: 'печатает...',
    adminName: '🛡️ Админ WorldChat',
    adminWelcome: 'Привет! Чем можем помочь? Опишите проблему, и мы ответим как можно скорее.',
    adminReply: 'Спасибо за обращение! Наша команда рассмотрит ваше сообщение и скоро ответит.',
    describeIssue: 'Опишите проблему...',
    back: '← Назад',
  },

  es: {
    createAccount: 'Crear cuenta',
    logIn: 'Iniciar sesión',
    username: 'Nombre de usuario',
    email: 'Correo',
    password: 'Contraseña',
    yourUsername: 'Tu nombre',
    emailPlaceholder: 'tu@gmail.com',
    minChars6: 'Mínimo 6 caracteres',
    orContinueWith: 'o continuar con',
    usernameRequired: 'Nombre de usuario requerido',
    cyrillicNotAllowed: 'Caracteres cirílicos no permitidos',
    minChars3: 'Mínimo 3 caracteres',
    emailRequired: 'Correo requerido',
    invalidEmail: 'Formato de correo inválido',
    onlyRealEmail: 'Solo proveedores reales (Gmail, Yahoo, Outlook, etc.)',
    passwordRequired: 'Contraseña requerida',
    accountExists: 'Ya existe una cuenta con este correo',
    userNotFound: 'Usuario no encontrado o contraseña incorrecta',
    chooseLanguage: 'Elige tu idioma',
    langSubtitle: 'Se usará para la interfaz y la traducción automática',
    step1of2: 'Paso 1 de 2',
    step2of2: 'Paso 2 de 2',
    selectYourCountry: 'Selecciona tu país',
    whoToTalkTo: '¿Con quién quieres hablar?',
    countriesSorted: 'Países ordenados por usuarios en línea',
    searchCountries: 'Buscar países...',
    online: 'en línea',
    chooseChatMode: 'Elige el modo de chat',
    chattingWith: 'Chateando con personas de otro país',
    oneOnOne: '1 a 1',
    groupOf4: 'Grupo de 4',
    premium: 'Premium',
    premiumPlus: 'Premium+',
    free: 'Gratis',
    perMonth: '/ mes',
    findOnePerson: 'Encuentra una persona del país seleccionado',
    twoFromEach: '2 de tu país + 2 del otro',
    publicChatDesc: 'Chat público con todos de ambos países. Solo texto',
    premPlusDesc: 'Todo de Premium + fotos, videos, mensajes de voz, insignia "Prem+"',
    publicChat: 'Chat público',
    included: 'Incluido',
    publicChatEveryoneDesc: 'Chat con todos de ambos países',
    premPlusNote: 'Igual que el chat público — incluido en tu suscripción',
    activeSub: 'Suscripción activa:',
    chats: 'Chats',
    addChat: '+ Añadir chat',
    writeToAdmin: '✉ Escribir al admin',
    logOut: '⬅ Cerrar sesión',
    selectAChat: 'Selecciona un chat',
    orAddNew: 'O añade uno nuevo para empezar a hablar',
    noMessagesYet: 'Sin mensajes aún',
    changeAvatar: 'Cambiar avatar',
    typeMessage: 'Escribe un mensaje...',
    premiumOnlyNote: '🔒 Fotos y voz solo para Premium+',
    translatedShowOriginal: 'Traducido — mostrar original',
    sentAs: 'Enviado como: [traducido al idioma del compañero]',
    typing: 'escribiendo...',
    adminName: '🛡️ Admin WorldChat',
    adminWelcome: '¡Hola! ¿En qué podemos ayudarte? Describe tu problema y te responderemos lo antes posible.',
    adminReply: '¡Gracias por escribir! Nuestro equipo revisará tu mensaje y te responderá pronto.',
    describeIssue: 'Describe tu problema...',
    back: '← Volver',
  },
};

function t(key) {
  const lang = app.selectedLang || 'en';
  const dict = TRANSLATIONS[lang] || TRANSLATIONS.en;
  return dict[key] || TRANSLATIONS.en[key] || key;
}

function applyTranslations() {
  // Auth
  document.querySelector('.tab[data-mode="register"]').textContent = t('createAccount');
  document.querySelector('.tab[data-mode="login"]').textContent = t('logIn');
  document.querySelectorAll('.input-group label')[0].textContent = t('username');
  document.querySelectorAll('.input-group label')[1].textContent = t('email');
  document.querySelectorAll('.input-group label')[2].textContent = t('password');
  document.getElementById('auth-username').placeholder = t('yourUsername');
  document.getElementById('auth-email').placeholder = t('emailPlaceholder');
  document.getElementById('auth-password').placeholder = t('minChars6');
  const authBtn = document.getElementById('auth-btn');
  authBtn.textContent = app.authMode === 'register' ? t('createAccount') : t('logIn');
  document.querySelector('.divider').textContent = t('orContinueWith');

  // Language select
  document.querySelector('#screen-lang .screen-title').textContent = t('chooseLanguage');
  document.querySelector('#screen-lang .screen-subtitle').textContent = t('langSubtitle');

  // Country select
  document.getElementById('country-search').placeholder = t('searchCountries');
  document.querySelector('#screen-country .screen-subtitle').textContent = t('countriesSorted');

  // Modes
  document.querySelector('#screen-modes .screen-title').textContent = t('chooseChatMode');
  document.getElementById('modes-subtitle').textContent = t('chattingWith');

  const modeCards = document.querySelectorAll('.mode-card');
  const modeData = [
    { title: 'oneOnOne', price: 'free', desc: 'findOnePerson' },
    null, // public chat btn
    { title: 'groupOf4', price: 'free', desc: 'twoFromEach' },
    { title: 'premium', price: null, desc: 'publicChatDesc' },
    null, // public chat
    { title: 'premiumPlus', price: null, desc: 'premPlusDesc' },
  ];
  const card1on1 = document.querySelector('.mode-card[data-mode="1on1"]');
  const cardGroup = document.querySelector('.mode-card[data-mode="group"]');
  const cardPrem = document.querySelector('.mode-card.premium');
  const cardPP = document.querySelector('.mode-card.premplus');
  const cardPublic = document.getElementById('public-chat-btn');

  card1on1.querySelector('.title').textContent = t('oneOnOne');
  card1on1.querySelector('.price').textContent = t('free');
  card1on1.querySelector('.desc').textContent = t('findOnePerson');

  cardGroup.querySelector('.title').textContent = t('groupOf4');
  cardGroup.querySelector('.price').textContent = t('free');
  cardGroup.querySelector('.desc').textContent = t('twoFromEach');

  cardPrem.querySelector('.title').textContent = t('premium');
  cardPrem.querySelector('.desc').textContent = t('publicChatDesc');

  cardPP.querySelector('.title').textContent = t('premiumPlus');
  cardPP.querySelector('.desc').textContent = t('premPlusDesc');

  cardPublic.querySelector('.title').textContent = t('publicChat');
  cardPublic.querySelector('.desc').textContent = t('publicChatEveryoneDesc');

  document.getElementById('premplus-note').textContent = t('premPlusNote');

  // Main screen
  document.querySelector('.sidebar-header h2').textContent = t('chats');
  document.getElementById('btn-add-chat').textContent = t('addChat');
  document.getElementById('btn-write-admin').innerHTML = t('writeToAdmin');
  document.getElementById('btn-logout').innerHTML = t('logOut');
  document.querySelector('.empty-title').textContent = t('selectAChat');
  document.querySelector('.empty-subtitle').textContent = t('orAddNew');
  document.getElementById('avatar-wrap').title = t('changeAvatar');

  // Chat
  document.getElementById('chat-input').placeholder = t('typeMessage');
  document.getElementById('chat-footer-note').textContent = t('premiumOnlyNote');

  // Admin
  document.querySelector('#screen-admin .partner-name').textContent = t('adminName');
  document.getElementById('admin-back-btn').textContent = t('back');
  document.getElementById('admin-input').placeholder = t('describeIssue');
}
