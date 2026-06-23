// ==========================================
// 1. إعدادات FIREBASE
// ==========================================
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// تفعيل المحرك السحابي في حال وجود الإعدادات
let db, storage;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    storage = firebase.storage();
    setupFirebaseListeners();
} else {
    console.log("%c📻 ويكي توكي يعمل في وضع المعاينة المحلية (Demo Mode). للربط الفوري مع العائلة، أضف إعدادات Firebase الخاصة بك.", "color: #06b6d4; font-weight: bold; font-size: 12px;");
}

// ==========================================
// 2. محرك النغمات اللاسلكية (Roger Beep Core)
// ==========================================
let audioContext;
function playRadioBeep(style) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);

    if (style === 'press') {
        // نغمة كبسة زر اللاسلكي الذكية (تنبيه سريع)
        osc.frequency.setValueAtTime(900, audioContext.currentTime);
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.06);
        osc.stop(audioContext.currentTime + 0.06);
    } else if (style === 'release') {
        // نغمة الـ Roger Beep الحية الشهيرة عند انتهاء الكلام
        osc.frequency.setValueAtTime(1100, audioContext.currentTime);
        gain.gain.setValueAtTime(0.08, audioContext.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(550, audioContext.currentTime + 0.07);
        gain.gain.setValueAtTime(0.08, audioContext.currentTime + 0.07);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.18);
        osc.stop(audioContext.currentTime + 0.18);
    }
}

// ==========================================
// 3. التحكم بالواجهة الحية (Alive UI Controller)
// ==========================================
const screenHub = document.getElementById('screen-hub');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');
const liveSpeaker = document.getElementById('live-speaker');
const waveform = document.getElementById('waveform');
const innerBtn = document.getElementById('inner-btn');
const usernameInput = document.getElementById('username');
const pttBtn = document.getElementById('ptt-btn');

let mediaRecorder;
let audioChunks = [];
let audioStream;

// تهيئة وصول الميكروفون مبكراً لجاهزية سريعة
navigator.mediaDevices.getUserMedia({ audio: true })
    .then(stream => { audioStream = stream; })
    .catch(err => { console.warn("يرجى السماح بالوصول للميكروفون لتتمكن من التحدث."); });

function updateUItoSending() {
    playRadioBeep('press');
    // تحويل الواجهة بالكامل للون الوردى المتوهج (حالة الإرسال)
    screenHub.classList.replace('border-cyan-500/30', 'border-rose-500');
    screenHub.classList.replace('neon-glow-cyan', 'neon-glow-rose');
    statusDot.classList.replace('bg-emerald-400', 'bg-rose-500');
    statusText.classList.replace('text-emerald-400', 'text-rose-500');
    statusText.innerText = "جاري البث المباشر...";
    liveSpeaker.innerText = "أنت تتحدث الآن";
    waveform.classList.remove('waves-paused'); // تفعيل أنيميشن حركة الأمواج
    
    innerBtn.classList.replace('from-cyan-500', 'from-rose-500');
    innerBtn.classList.replace('to-teal-600', 'to-red-600');
}

function updateUItoReceiving() {
    playRadioBeep('release');
    // إعادة الواجهة للوضع الأصلي الجذاب (جاهز للاستقبال)
    screenHub.classList.replace('border-rose-500', 'border-cyan-500/30');
    screenHub.classList.replace('neon-glow-rose', 'neon-glow-cyan');
    statusDot.classList.replace('bg-rose-500', 'bg-emerald-400');
    statusText.classList.replace('text-rose-500', 'text-emerald-400');
    statusText.innerText = "جاهز للاستقبال";
    liveSpeaker.innerText = "حول...";
    waveform.classList.add('waves-paused'); // إيقاف حركة الأمواج
    
    innerBtn.classList.replace('from-rose-500', 'from-cyan-500');
    innerBtn.classList.replace('to-red-600', 'to-teal-600');
}

// ==========================================
// 4. منطق التسجيل والبث
// ==========================================
function startBroadcast() {
    if (!audioStream) return;
    audioChunks = [];
    mediaRecorder = new MediaRecorder(audioStream);
    
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (db && storage) {
            uploadAudio(audioBlob);
        } else {
            // تشغيل محلي فوري (Demo) في حال لم يتم ربط سحابة فايربيس بعد
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            setTimeout(() => { audio.play(); }, 300);
        }
    };

    mediaRecorder.start();
    updateUItoSending();
    if(db) db.ref('alive_status/talking').set({ name: usernameInput.value, isLive: true });
}

function stopBroadcast() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        updateUItoReceiving();
        if(db) db.ref('alive_status/talking').set({ name: "", isLive: false });
    }
}

// ربط أحداث اللمس والضغط (دعم كامل للجوال والكمبيوتر)
pttBtn.addEventListener('mousedown', startBroadcast);
pttBtn.addEventListener('mouseup', stopBroadcast);
pttBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startBroadcast(); });
pttBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopBroadcast(); });

// ==========================================
// 5. المزامنة والربط السحابي (Firebase Live Sync)
// ==========================================
function uploadAudio(blob) {
    const fileId = `voice_${Date.now()}.webm`;
    const storageRef = storage.ref('alive_voices/' + fileId);
    
    storageRef.put(blob).then(snap => snap.ref.getDownloadURL()).then(url => {
        db.ref('alive_broadcast').set({
            url: url,
            sender: usernameInput.value,
            time: Date.now()
        });
    });
}

function setupFirebaseListeners() {
    // مراقبة من يتحدث الآن لتحديث شاشات بقية أفراد العائلة
    db.ref('alive_status/talking').on('value', snapshot => {
        const data = snapshot.val();
        if (data && data.isLive && data.name !== usernameInput.value) {
            liveSpeaker.innerText = data.name;
            statusText.innerText = "يتم التحدث الآن...";
            statusText.classList.replace('text-emerald-400', 'text-amber-400');
            statusDot.classList.replace('bg-emerald-400', 'bg-amber-400'); // لون برتقالي يعني شخص يتحدث
            screenHub.classList.replace('neon-glow-cyan', 'neon-glow-emerald');
            waveform.classList.remove('waves-paused');
        } else if (data && !data.isLive) {
            updateUItoReceiving();
        }
    });

    // استلام أصوات العائلة وتشغيلها تلقائياً بالخلفية
    let ignoreInitial = true;
    db.ref('alive_broadcast').on('value', snapshot => {
        if (ignoreInitial) { ignoreInitial = false; return; }
        
        const data = snapshot.val();
        if (data && data.sender !== usernameInput.value) {
            playRadioBeep('press'); // نغمة استقبال البث
            setTimeout(() => {
                const audio = new Audio(data.url);
                audio.play();
                audio.onended = () => { playRadioBeep('release'); }; // نغمة نهاية البث
            }, 150);
        }
    });
}
