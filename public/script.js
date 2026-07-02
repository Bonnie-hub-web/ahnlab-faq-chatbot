let isAuthenticated = false;

function authenticate() {
    const authKey = document.getElementById('authKey').value;

    if (!authKey) {
        alert('인증 키를 입력하세요');
        return;
    }

    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: 'AUTH_CHECK',
            authKey: authKey
        })
    })
    .then(res => res.json())
    .then(data => {
        if (data.authenticated) {
            isAuthenticated = true;
            sessionStorage.setItem('authKey', authKey);

            document.getElementById('authSection').style.display = 'none';
            document.getElementById('chatContainer').style.display = 'flex';
            document.getElementById('inputSection').style.display = 'flex';

            addBotMessage('안녕하세요! 무엇을 도와드릴까요?');
            document.getElementById('messageInput').focus();
        } else {
            alert('인증 키가 올바르지 않습니다');
        }
    })
    .catch(err => {
        alert('인증 실패: ' + err.message);
    });
}

function sendMessage() {
    const input = document.getElementById('messageInput');
    const message = input.value.trim();

    if (!message) return;

    addUserMessage(message);
    input.value = '';

    addBotMessage('<div class="loading"><span>.</span><span>.</span><span>.</span></div>');

    const authKey = sessionStorage.getItem('authKey');

    fetch('/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            message: message,
            authKey: authKey
        })
    })
    .then(res => res.json())
    .then(data => {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.removeChild(chatContainer.lastChild);

        if (data.success) {
            addBotMessage(data.answer);
        } else {
            addBotMessage('❌ ' + (data.message || '답변을 찾을 수 없습니다'));
        }
    })
    .catch(err => {
        const chatContainer = document.getElementById('chatContainer');
        chatContainer.removeChild(chatContainer.lastChild);
        addBotMessage('❌ 오류가 발생했습니다: ' + err.message);
    });
}

function addUserMessage(text) {
    const chatContainer = document.getElementById('chatContainer');
    const message = document.createElement('div');
    message.className = 'message user';
    message.innerHTML = `<div class="message-content">${escapeHtml(text)}</div>`;
    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function addBotMessage(text) {
    const chatContainer = document.getElementById('chatContainer');
    const message = document.createElement('div');
    message.className = 'message bot';
    message.innerHTML = `<div class="message-content">${text}</div>`;
    chatContainer.appendChild(message);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('authKey').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') authenticate();
    });

    document.getElementById('messageInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendMessage();
    });
});
