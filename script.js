// Global Durum: Mesajları tutan dizi (Gerçekte her "mesaj" bir Commit'tir)
let messages = [];

// Kullanıcı Adı (Senin adın, mesaj gönderenin adı)
const userName = "@Sen";

/**
 * Mesajı/Commit'i DOM'a ekler.
 * @param {string} author - Mesajı gönderen.
 * @param {string} content - Mesajın içeriği.
 * @param {boolean} isSent - Mesajın senin tarafından gönderilip gönderilmediği.
 */
function addMessageToDOM(author, content, isSent) {
    const messagesDiv = document.getElementById('messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message');
    messageDiv.classList.add(isSent ? 'sent' : 'received');

    // Basit bir zaman damgası taklidi
    const timeAgo = (new Date().getMinutes() % 5) + 's ago'; // 0-4 saniye arası rastgele

    messageDiv.innerHTML = `
        <span class="author">${author}:</span>
        <span class="content">'${content}'</span>
        <span class="timestamp">// ${timeAgo}</span>
    `;

    messagesDiv.appendChild(messageDiv);
    // En alta kaydır (scrollTo(0, messagesDiv.scrollHeight) tam doğru olur ama bu da olur)
    messagesDiv.scrollTop = messagesDiv.scrollHeight; 
}

/**
 * Commit & Push düğmesine basıldığında çalışır.
 * (Mesajı gönderir ve simüle eder.)
 */
function sendMessage() {
    const inputElement = document.getElementById('message-input');
    const messageContent = inputElement.value.trim();

    if (messageContent === "") {
        return; // Boş Commit/Mesaj gönderme
    }

    // 1. Kendi Mesajını/Commit'ini ekle
    const commitMessage = `Fix: ${messageContent} (from local branch)`;
    messages.push({ author: userName, content: commitMessage, isSent: true });
    addMessageToDOM(userName, commitMessage, true);

    // 2. Mesajı gönderdikten sonra giriş alanını temizle
    inputElement.value = '';

    // 3. Kısa bir gecikmeyle yapay zeka/başka bir kullanıcıdan gelen yanıtı simüle et
    setTimeout(simulateResponse, 1500); // 1.5 saniye sonra yanıt simülasyonu
}

/**
 * Başka bir kullanıcının yanıtını simüle eder (Yapay zeka/Bot).
 */
function simulateResponse() {
    const botUser = "@GitHubBot";
    const botResponses = [
        "Merge edildi! Hızlı çözüm için teşekkürler.",
        "Conflict var gibi, bir PR daha açabilirsin.",
        "Feature: Lisanstan bahsedilmiş, yasal uyarı eklendi.",
        "Refactor: Kod daha temiz görünüyor, onaylandı!",
        "Issue açıldı: Bu commit biraz kırılmış.",
        "LGTM (Looks Good To Me)!",
        "Bu ne ya? Revert edilmeli!"
    ];

    const response = botResponses[Math.floor(Math.random() * botResponses.length)];
    const botCommit = `Docs: ${response}`;

    messages.push({ author: botUser, content: botCommit, isSent: false });
    addMessageToDOM(botUser, botCommit, false);
}

// Enter tuşu ile de mesaj göndermeyi sağla (Kullanıcı Deneyimi İyileştirmesi)
document.getElementById('message-input').addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

// Başlangıçta var olan mesajları yükle (index.html'den)
// Gerçek projede bu, "git log" çıktısı olurdu.
document.addEventListener('DOMContentLoaded', () => {
    // index.html'deki mevcut mesajları zaten DOM'a ekledik.
    // Sadece input alanına odaklanma ekleyelim.
    document.getElementById('message-input').focus();
});
