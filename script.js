// script.js

// Firebase'i config.js'den gelen bilgilerle başlat
firebase.initializeApp(firebaseConfig);

const database = firebase.database();
const auth = firebase.auth();
const notificationSound = document.getElementById('notification-sound');
const authContainer = document.getElementById('auth-container');
const appContainer = document.getElementById('app-container');
const mesajInput = document.getElementById('mesajInput');
const typingIndicator = document.getElementById('typing-indicator');
const emojiButton = document.getElementById('emoji-button');
const emojiPicker = document.getElementById('emoji-picker');
const imageUploadInput = document.getElementById('image-upload-input');
const videoCallButton = document.getElementById('video-call-button');
const modalOverlay = document.getElementById('modal-overlay');

// KULLANICI ADI DEĞİŞTİRME İÇİN ELEMENTLER
const settingsModal = document.getElementById('settings-modal');
const newUsernameInput = document.getElementById('new-username'); 

// YENİ: AVATAR İÇİN ELEMENTLER VE SABİTLER
const avatarUploadInput = document.getElementById('avatar-upload-input');
const currentAvatarPreview = document.getElementById('current-avatar-preview');
const DEFAULT_AVATAR_URL = "https://i.ibb.co/6g92Y9F/default-avatar.png"; // Varsayılan avatar URL'si

let currentUser = null;
let currentChatId = null;
let typingTimeout = null;
let blockList = {};

// Yönetici e-postalarını burada tanımlıyoruz. 
const adminEmails = ["admin@gmail.com"];
let isAdmin = false; 

const emojis = ['😀', '😂', '😊', '😍', '🤔', '😎', '😭', '😡', '👍', '👎', '❤️', '🔥', '🎉', '👋'];

function initEmojiPicker() { 
    emojiPicker.innerHTML = ''; 
    emojis.forEach(emoji => { 
        const span = document.createElement('span'); 
        span.textContent = emoji; 
        span.onclick = () => { 
            mesajInput.value += emoji; 
            emojiPicker.style.display = 'none'; 
            mesajInput.focus(); 
        }; 
        emojiPicker.appendChild(span); 
    }); 
    emojiButton.onclick = () => { 
        emojiPicker.style.display = emojiPicker.style.display === 'block' ? 'none' : 'block'; 
    }; 
}

// GÜNCELLENDİ: Profil modalında avatarı göster
function showUserProfile(userId, username) { 
    if (userId === currentUser.uid) return; 
    
    // Avatarı çek
    database.ref(`users/${userId}/avatarUrl`).once('value').then(snapshot => {
        const avatarUrl = snapshot.val() || DEFAULT_AVATAR_URL;
        document.getElementById('profile-avatar-display').src = avatarUrl;
    });

    document.getElementById('profile-modal').style.display = 'block';
    document.getElementById('profile-username').textContent = username; 
    document.getElementById('profile-userid').textContent = userId; 
    document.getElementById('profile-block-btn').onclick = () => blockUser(userId, username); 
    document.getElementById('profile-report-btn').onclick = () => reportUser(userId, username); 
    modalOverlay.style.display = 'flex'; 
}

function closeProfileModal() { 
    document.getElementById('profile-modal').style.display = 'none';
    if (settingsModal.style.display === 'none') {
        modalOverlay.style.display = 'none';
    }
}

// GÜNCELLENDİ: Ayarlar modalı açıldığında mevcut avatarı ve kullanıcı adını göster
function openSettingsModal() {
    if (!currentUser || currentUser.isAnonymous) return alert("Bu ayarı değiştirmek için kayıtlı bir kullanıcı olmalısınız.");
    
    newUsernameInput.value = document.getElementById('user-display-name').textContent; 
    
    // Mevcut avatarı yükle
    database.ref(`users/${currentUser.uid}/avatarUrl`).once('value').then(snapshot => {
        const avatarUrl = snapshot.val() || DEFAULT_AVATAR_URL;
        currentAvatarPreview.src = avatarUrl;
    });

    document.getElementById('profile-modal').style.display = 'none';
    settingsModal.style.display = 'block'; 
    modalOverlay.style.display = 'flex';
}

function closeSettingsModal() {
    settingsModal.style.display = 'none';
    if (document.getElementById('profile-modal').style.display === 'none' || document.getElementById('profile-modal').style.display === '') {
        modalOverlay.style.display = 'none';
    }
}

function blockUser(userIdToBlock, username) { 
    if (confirm(`${username} adlı kullanıcıyı engellemek istediğine emin misin?`)) { 
        database.ref(`users/${currentUser.uid}/blockedUsers/${userIdToBlock}`).set(true); 
        blockList[userIdToBlock] = true; 
        alert(`${username} engellendi.`); 
        closeProfileModal(); 
        loadChat(currentChatId, document.getElementById('chat-title').textContent); 
    } 
}
function reportUser(userIdToReport, username) { 
    const reason = prompt(`${username} adlı kullanıcıyı neden şikayet ediyorsun?`); 
    if (reason) { 
        database.ref(`reports/${userIdToReport}`).push({ 
            reportedBy: currentUser.uid, 
            reason: reason, 
            timestamp: firebase.database.ServerValue.TIMESTAMP 
        }); 
        alert(`${username} şikayet edildi.`); 
        closeProfileModal(); 
    } 
}
function startVideoCall() { 
    if (!currentChatId || currentChatId === 'public_chat') return; 
    const roomName = `SohbetProjesi-${currentChatId.replace('private-', '')}-${Date.now()}`; 
    const videoLink = `https://meet.jit.si/${roomName}`; 
    const messageText = `Görüntülü aramaya katılmak için tıkla: <a href="${videoLink}" target="_blank" rel="noopener noreferrer">${videoLink}</a>`; 
    const username = document.getElementById('user-display-name').textContent; 
    database.ref('chats/' + currentChatId).push({ 
        username: username, 
        userId: currentUser.uid, 
        metin: messageText, 
        type:'text', 
        zaman: Date.now() 
    }); 
}
function copyMyId() { 
    if (!currentUser || currentUser.isAnonymous) return; 
    navigator.clipboard.writeText(currentUser.uid).then(() => { 
        alert("Kullanıcı ID'n panoya kopyalandı!"); 
    }); 
}
function signInAnonymously() { 
    auth.signInAnonymously().catch(error => alert("Anonim giriş başarısız: " + error.message)); 
}

// TIKLANABİLİR LİNKLER İÇİN FONKSİYON
function metniLinkeCevir(metin) {
    const urlRegex = /(\b(https?|ftp|file):\/\/[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])|(\bwww\.[-A-Z0-9+&@#\/%?=~_|!:,.;]*[-A-Z0-9+&@#\/%=~_|])/ig;
    return metin.replace(urlRegex, function(url) {
        let tamURL = url;
        if (!tamURL.match(/^https?:\/\//i)) {
            tamURL = 'http://' + tamURL;
        }
        return `<a href="${tamURL}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });
}

// MESAJ SİLME İÇİN FONKSİYON (Sadece mesaj sahibi silebilir)
function mesajSil(mesajId) {
    if (!currentUser || currentUser.isAnonymous) {
        return alert("Bu işlemi yapmak için giriş yapmalısınız.");
    }
    
    if (confirm("Bu mesajı kalıcı olarak silmek istediğine emin misin?")) {
        database.ref(`chats/${currentChatId}/${mesajId}`).remove()
            .then(() => {
                console.log(`Mesaj (${mesajId}) silindi.`);
            })
            .catch(error => {
                alert("Mesaj silinirken bir hata oluştu: " + error.message);
            });
    }
}

// Admin Mesaj Silme Fonksiyonu (Adminler her mesajı silebilir)
function deleteMessage(chatId, messageKey) {
    if (!isAdmin) {
        console.log("Yetkisiz silme denemesi.");
        return alert("Bu işlemi yapmak için yönetici yetkisine sahip olmalısınız.");
    }
    if (confirm("YÖNETİCİ OLARAK: Bu mesajı silmek istediğinizden emin misiniz?")) {
        database.ref(`chats/${chatId}/${messageKey}`).remove()
            .then(() => {
                console.log("Mesaj başarıyla silindi (Admin).");
            })
            .catch((error) => {
                console.error("Mesaj silinirken hata oluştu: ", error);
            });
    }
}


auth.onAuthStateChanged(user => { 
    if (user) { 
        currentUser = user; 
        
        // Giriş yapan kullanıcının admin olup olmadığını kontrol et
        if (user.email && adminEmails.includes(user.email)) {
            isAdmin = true;
        } else {
            isAdmin = false;
        }

        authContainer.style.display = 'none'; 
        appContainer.style.display = 'block'; 
        initChatApp(user.isAnonymous); 
    } else { 
        if (currentUser && !currentUser.isAnonymous) { 
            // Kullanıcı çıkış yaptığında (veya anonim değilken) durumunu offline yap
            database.ref(`status/${currentUser.uid}`).set({ state: 'offline' }); 
        } 
        currentUser = null;
        isAdmin = false; 
        authContainer.style.display = 'flex'; 
        appContainer.style.display = 'none'; 
    } 
});

function initChatApp(isAnonymous) { 
    const memberFeatures = document.getElementById('member-features'); 
    document.getElementById('chat-list').innerHTML = ''; 
    addChatToList('public_chat', '# Genel Sohbet'); 
    initEmojiPicker(); 

    if (isAnonymous) { 
        const randomId = Math.floor(1000 + Math.random() * 9000); 
        document.getElementById('user-display-name').textContent = `Misafir-${randomId}`; 
        memberFeatures.style.display = 'none'; 
        document.getElementById('image-upload-label').style.display = 'none'; 
        loadChat('public_chat', '# Genel Sohbet'); 
    } else { 
        memberFeatures.style.display = 'block'; 
        document.getElementById('image-upload-label').style.display = 'block'; 
        document.getElementById('my-id-display').textContent = currentUser.uid; 
        
        // Firebase Auth'taki displayName'i kullan, yoksa DB'den al
        let initialUsername = currentUser.displayName || 'Kullanıcı';

        database.ref('users/' + currentUser.uid).once('value').then(snapshot => { 
            const userData = snapshot.val() || {}; 
            // Eğer auth displayName'i yoksa, DB'den alınan kullanıcı adını kullan
            initialUsername = userData.username || initialUsername;
            document.getElementById('user-display-name').textContent = initialUsername; 
            blockList = userData.blockedUsers || {}; 
            setupPresence(currentUser.uid, initialUsername); 
        }); 
        loadUserChats(); 
        loadChat('public_chat', '# Genel Sohbet'); 
    } 
}

function kayitOl() { 
    const username = document.getElementById('register-username').value; 
    const email = document.getElementById('register-email').value; 
    const password = document.getElementById('register-password').value; 

    if (!username) return alert('Lütfen bir kullanıcı adı girin!'); 

    auth.createUserWithEmailAndPassword(email, password).then(userCredential => { 
        // Kullanıcı adını Firebase Auth profiline de kaydet
        return userCredential.user.updateProfile({
            displayName: username
        }).then(() => {
            // Kullanıcı adını Database'e kaydet
            database.ref('users/' + userCredential.user.uid).set({ 
                username: username, 
                email: email 
            });
        });
    }).catch(error => alert('Kayıt başarısız: ' + error.message)); 
}
function girisYap() { 
    const email = document.getElementById('login-email').value; 
    const password = document.getElementById('login-password').value; 
    auth.signInWithEmailAndPassword(email, password).catch(error => alert('Giriş başarısız: ' + error.message)); 
}
function cikisYap() { 
    auth.signOut(); 
}
function toggleForms() { 
    const loginForm = document.getElementById('login-form'); 
    const registerForm = document.getElementById('register-form'); 
    if (loginForm.style.display === 'none') { 
        loginForm.style.display = 'block'; 
        registerForm.style.display = 'none'; 
    } else { 
        loginForm.style.display = 'none'; 
        registerForm.style.display = 'block'; 
    } 
}

// KULLANICI ADI GÜNCELLEME MANTIĞI
function updateUsername() {
    if (!currentUser || currentUser.isAnonymous) return;

    const newUsername = newUsernameInput.value.trim();
    if (newUsername.length < 3) {
        return alert("Kullanıcı adı en az 3 karakter olmalıdır.");
    }

    // 1. Firebase Auth'taki displayName'i güncelle
    currentUser.updateProfile({
        displayName: newUsername
    }).then(() => {
        // 2. Database'deki kullanıcı adını güncelle
        return database.ref(`users/${currentUser.uid}`).update({
            username: newUsername
        });
    }).then(() => {
        document.getElementById('user-display-name').textContent = newUsername;
        alert("Kullanıcı adı başarıyla güncellendi!");
        closeSettingsModal();
        setupPresence(currentUser.uid, newUsername); // Çevrimiçi listesini de güncelle
    }).catch(error => {
        console.error("Kullanıcı adı güncelleme hatası:", error);
        alert("Kullanıcı adı güncellenemedi: " + error.message);
    });
}

// YENİ: PROFİL FOTOĞRAFI YÜKLEME VE GÜNCELLEME MANTIĞI
avatarUploadInput.addEventListener('change', (event) => {
    const file = event.target.files[0];
    if (!file || !currentUser || currentUser.isAnonymous) return;
    if (!file.type.startsWith('image/')) { return alert("Lütfen sadece resim dosyası yükleyin."); }

    if (typeof IMGBB_API_KEY === 'undefined') {
        return alert("HATA: IMGBB_API_KEY config.js dosyanızda tanımlı değil!");
    }

    const formData = new FormData();
    formData.append('image', file);
    
    // Yükleniyor bilgisi
    currentAvatarPreview.style.opacity = 0.5;

    fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    }).then(response => response.json()).then(result => {
        if (result.success) {
            const newAvatarUrl = result.data.url;
            
            // 1. Firebase Database'e kaydet
            return database.ref(`users/${currentUser.uid}`).update({
                avatarUrl: newAvatarUrl
            }).then(() => {
                // 2. DOM'u güncelle
                currentAvatarPreview.src = newAvatarUrl;
                alert("Profil fotoğrafı başarıyla güncellendi!");
            });
        } else {
            alert('Resim yüklenemedi: ' + result.error.message);
        }
    }).catch(error => {
        alert('Resim yüklenirken bir ağ hatası oluştu: ' + error);
    }).finally(() => {
        currentAvatarPreview.style.opacity = 1;
        event.target.value = ''; // Inputu temizle
    });
});


function setupPresence(userId, username) { 
    const userStatusRef = database.ref('/status/' + userId); 
    const isOnlineForDatabase = { state: 'online', username: username }; 
    database.ref('.info/connected').on('value', (snap) => { 
        if (snap.val() === false) { 
            userStatusRef.set({ state: 'offline', username: username }); 
            return; 
        } 
        userStatusRef.onDisconnect().set({ state: 'offline', username: username }).then(() => { 
            userStatusRef.set(isOnlineForDatabase); 
        }); 
    }); 
    const onlineUsersRef = database.ref('/status').orderByChild('state').equalTo('online'); 
    onlineUsersRef.on('value', (snapshot) => { 
        const onlineUsersList = document.getElementById('online-users-list'); 
        onlineUsersList.innerHTML = ''; 
        snapshot.forEach((child) => { 
            const user = child.val(); 
            const uId = child.key; 
            if (user.username && uId !== currentUser.uid) { // Kendi ismini online listesinde gösterme
                const li = document.createElement('li'); 
                li.innerHTML = `<span class="online-dot"></span> ${user.username}`; 
                li.onclick = () => showUserProfile(uId, user.username); 
                onlineUsersList.appendChild(li); 
            } 
        }); 
    }); 
}
mesajInput.addEventListener('input', () => { 
    if (!currentUser || !currentChatId || currentUser.isAnonymous) return; 
    const typingRef = database.ref(`typing/${currentChatId}/${currentUser.uid}`); 
    typingRef.set(document.getElementById('user-display-name').textContent); 
    clearTimeout(typingTimeout); 
    typingTimeout = setTimeout(() => { 
        typingRef.remove(); 
    }, 2000); 
});
function setupTypingIndicator(chatId) { 
    if(currentChatId) { 
        database.ref(`typing/${currentChatId}`).off(); 
    } 
    const typingRef = database.ref(`typing/${chatId}`); 
    typingRef.on('value', snapshot => { 
        const typers = snapshot.val(); 
        if (typers) { 
            const typerIds = Object.keys(typers).filter(id => id !== currentUser.uid); 
            if (typerIds.length > 0) { 
                const names = typerIds.map(id => typers[id]).join(', '); 
                typingIndicator.textContent = `${names} yazıyor...`; 
            } else { 
                typingIndicator.textContent = ''; 
            } 
        } else { 
            typingIndicator.textContent = ''; 
        } 
    }); 
}
function addChatToList(chatId, chatName) { 
    const li = document.createElement('li'); 
    li.textContent = chatName; 
    li.dataset.chatid = chatId; 
    li.onclick = () => loadChat(chatId, chatName); 
    document.getElementById('chat-list').appendChild(li); 
}
function loadUserChats() { 
    const userChatsRef = database.ref(`users/${currentUser.uid}/chats`); 
    userChatsRef.on('child_added', snapshot => { 
        addChatToList(snapshot.key, `🔒 ${snapshot.val().withUsername}`); 
    }); 
}

// GÜNCELLENDİ: Mesaj çekilirken kullanıcının avatar URL'si çekilir ve HTML'e eklenir.
function loadChat(chatId, chatName) { 
    if (currentChatId) { database.ref('chats/' + currentChatId).off(); } 
    currentChatId = chatId; 
    videoCallButton.style.display = chatId.startsWith('private-') ? 'inline-block' : 'none'; 
    const mesajlarDiv = document.getElementById('mesajlar'); 
    mesajlarDiv.innerHTML = ''; 
    document.getElementById('chat-title').textContent = chatName; 
    
    // Aktif sohbeti işaretle
    document.querySelectorAll('#chat-list li').forEach(li => li.classList.remove('active')); 
    const activeChatLi = document.querySelector(`li[data-chatid="${chatId}"]`);
    if(activeChatLi) {
        activeChatLi.classList.add('active'); 
    }

    setupTypingIndicator(chatId); 
    const chatRef = database.ref('chats/' + chatId); 
    
    // Mesaj silindiğinde DOM'dan kaldırmak için child_removed dinleyicisi eklenir
    chatRef.on('child_removed', (snapshot) => {
        const removedMesajId = snapshot.key;
        const element = document.querySelector(`.mesaj[data-mesaj-id="${removedMesajId}"]`);
        if (element) {
            element.remove();
        }
    });

    // Mesajları çekmeden önce, her bir mesaj için avatarı çekmek üzere async/await kullanıyoruz
    chatRef.orderByChild('zaman').limitToLast(100).on('child_added', async (snapshot) => { 
        const mesaj = snapshot.val();
        const mesajId = snapshot.key; 
        const mesajSahibiMi = currentUser && mesaj.userId === currentUser.uid;

        if (blockList[mesaj.userId]) { return; } 
        if (currentUser && mesaj.userId !== currentUser.uid && document.hidden) { 
            notificationSound.play().catch(e => console.error("Bildirim sesi oynatılamadı:", e)); 
        } 
        
        // 🚨 YENİ: Mesaj sahibi avatar URL'sini çek
        let avatarUrl = DEFAULT_AVATAR_URL;
        if (mesaj.userId) {
            const userSnapshot = await database.ref(`users/${mesaj.userId}/avatarUrl`).once('value');
            avatarUrl = userSnapshot.val() || DEFAULT_AVATAR_URL;
        }

        const div = document.createElement('div'); 
        div.className = "mesaj " + (mesajSahibiMi ? 'sent' : 'received'); 
        div.dataset.mesajId = mesajId; 
        
        const tarih = new Date(mesaj.zaman); 
        const saat = tarih.getHours().toString().padStart(2, '0'); 
        const dakika = tarih.getMinutes().toString().padStart(2, '0'); 
        const zamanMetni = `${saat}:${dakika}`; 
        
        let mesajIcerigi = '';
        let silButonuHTML = '';

        if (mesaj.type === 'image') { 
            mesajIcerigi = `<img src="${mesaj.imageUrl}" alt="Yüklenen resim">`; 
        } else { 
            let temizMetin = (mesaj.metin || "").replace(/</g, "&lt;").replace(/>/g, "&gt;");
            mesajIcerigi = metniLinkeCevir(temizMetin);
        }

        // 1. MESAJ SAHİBİ KENDİ MESAJINI SİLEBİLİR
        if (mesajSahibiMi && !currentUser.isAnonymous) {
            silButonuHTML = `<button class="sil-butonu" data-id="${mesajId}">🗑️</button>`;
        }
        
        // 2. ADMİN, HERHANGİ BİR MESAJI SİLEBİLİR
        let adminSilButonuHTML = '';
        if (isAdmin && !mesajSahibiMi) { 
             adminSilButonuHTML = `<span class="admin-delete-btn" onclick="deleteMessage('${chatId}', '${mesajId}')">🗑️</span>`;
        }
        
        // HTML yapısı (Avatar eklendi)
        div.innerHTML = `
            <div class="mesaj-header">
                <img class="avatar" src="${avatarUrl}" alt="${mesaj.username}">
                <strong>${mesaj.username}</strong>
                ${adminSilButonuHTML}
                <span class="timestamp">${zamanMetni}</span>
            </div>
            <div class="message-bubble">${mesajIcerigi} ${mesajSahibiMi ? silButonuHTML : ''}</div>
        `;
        
        // Silme butonuna olay dinleyicisi ekle
        if (mesajSahibiMi && !currentUser.isAnonymous) {
            const silButonu = div.querySelector('.sil-butonu');
            if (silButonu) {
                silButonu.addEventListener('click', (e) => {
                    e.stopPropagation(); 
                    mesajSil(mesajId);
                });
            }
        }
        
        mesajlarDiv.appendChild(div); 
        mesajlarDiv.scrollTop = mesajlarDiv.scrollHeight; 
    }); 
}

function clearChatScreen() { document.getElementById('mesajlar').innerHTML = ''; }
function mesajGonder() { 
    if (mesajInput.value.trim() && currentUser) { 
        const username = document.getElementById('user-display-name').textContent; 
        database.ref('chats/' + currentChatId).push({ 
            username: username, 
            userId: currentUser.uid, 
            metin: mesajInput.value, 
            type:'text', 
            zaman: Date.now() 
        }); 
        database.ref(`typing/${currentChatId}/${currentUser.uid}`).remove(); 
        mesajInput.value = ''; 
    } 
}
imageUploadInput.addEventListener('change', (event) => { 
    const file = event.target.files[0]; 
    if (!file || !currentUser || currentUser.isAnonymous) return; 
    if (!file.type.startsWith('image/')){ return alert("Lütfen sadece resim dosyası yükleyin."); } 
    
    // **ÖNEMLİ:** IMGBB_API_KEY'in config.js'de tanımlı olduğundan emin olun.
    if (typeof IMGBB_API_KEY === 'undefined') {
        return alert("HATA: IMGBB_API_KEY config.js dosyanızda tanımlı değil!");
    }

    const formData = new FormData(); 
    formData.append('image', file); 

    fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { 
        method: 'POST', 
        body: formData 
    }).then(response => response.json()).then(result => { 
        if (result.success) { 
            const imageUrl = result.data.url; 
            const username = document.getElementById('user-display-name').textContent; 
            database.ref('chats/' + currentChatId).push({ 
                username: username, 
                userId: currentUser.uid, 
                imageUrl: imageUrl, 
                type: 'image', 
                zaman: Date.now() 
            }); 
        } else { 
            alert('Resim yüklenemedi: ' + result.error.message); 
        } 
    }).catch(error => { 
        alert('Resim yüklenirken bir ağ hatası oluştu: ' + error); 
    }); 
    event.target.value = ''; 
});
async function startPrivateChat() { 
    const otherUserId = prompt("Konuşmak istediğin kişinin KULLANICI ID'sini yaz:"); 
    if (!otherUserId || otherUserId === currentUser.uid) return; 
    
    const userRef = database.ref('users/' + otherUserId); 
    const snapshot = await userRef.once('value'); 
    
    if (!snapshot.exists()) return alert("Kullanıcı bulunamadı!"); 
    
    const otherUserData = snapshot.val(); 
    const ids = [currentUser.uid, otherUserId].sort(); 
    const privateChatId = `private-${ids.join('-')}`; 
    
    // Kendi kullanıcı adımızı çek
    const myUsernameSnapshot = await database.ref(`users/${currentUser.uid}`).once('value');
    const myUsername = myUsernameSnapshot.val().username; 

    // Her iki kullanıcının da sohbet listesine ekle
    await database.ref(`users/${currentUser.uid}/chats/${privateChatId}`).set({ withUsername: otherUserData.username }); 
    await database.ref(`users/${otherUserId}/chats/${privateChatId}`).set({ withUsername: myUsername }); 
    
    addChatToList(privateChatId, `🔒 ${otherUserData.username}`); 
    loadChat(privateChatId, `🔒 ${otherUserData.username}`); 
}
document.getElementById('mesajInput').addEventListener('keypress', (e) => { 
    if (e.key === 'Enter') mesajGonder(); 
});