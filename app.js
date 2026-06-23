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

let db, storage;
if (firebaseConfig.apiKey !== "YOUR_API_KEY") {
    firebase.initializeApp(firebaseConfig);
    db = firebase.database();
    storage = firebase.storage();
    setupFirebaseListeners();
} else {
    console.log("تطبيق ويكي توكي يعمل محلياً في وضع الديمو.");
}

// ==========================================
// 2. هندسة منع الصدى والمؤثرات الصوتية
// ==========================================
let audioContext;
function playRadioBeep(type) {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);

    if (type === 'start') {
        osc.frequency.setValueAtTime(850, audioContext.currentTime);
        gain.gain.setValueAtTime(0.05, audioContext.currentTime);
        osc.start();
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.05);
        osc.stop(audioContext.currentTime + 0.05);
    } else if (type === 'end') {
        osc.frequency.setValueAtTime(1050, audioContext.currentTime);
        gain.gain.setValueAtTime(0.05, audioContext.currentTime);
        osc.start();
        osc.frequency.setValueAtTime(500, audioContext.currentTime + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + 0.15);
        osc.stop(audioContext.currentTime + 0.15);
    }
}

// ==========================================
// 3. التحكم بالواجهة التفاعلية والموجات
// ==========================================
const pttBtn = document.getElementById('ptt-btn');
const btnLabel = document.getElementById('btn-label');
const wave1 = document.getElementById('wave1');
const wave2 = document.getElementById('wave2');
const statusText = document.getElementById('status-text');
const liveSpeaker = document.getElementById('live-speaker');
const usernameInput = document.getElementById('username');

let mediaRecorder;
let audioChunks = [];
let audioStream;

// استدعاء الميكروفون مع تفعيل ميزات عزل الصدى والضوضاء لمنع الارتداد والأصوات المتكررة
navigator.mediaDevices.getUserMedia({ 
    audio: {
        echoCancellation: true,  // تفعيل إلغاء الصدى بشكل صارم
        noiseSuppression: true,  // تقليل الضوضاء المحيطة
        autoGainControl: true    // توازن مستويات الصوت تلقائياً
    } 
})
.then(stream => { audioStream = stream; })
.catch(err => { alert("الرجاء السماح بالوصول للميكروفون لعزل الصدى والتحدث!"); });

function activateWavesAndUI() {
    playRadioBeep('start');
    pttBtn.classList.add('talking');
    btnLabel.innerText = "تحدث...";
    
    // إطلاق الموجات الصوتية الديناميكية حول الزر
    wave1.classList.add('wave-active-1');
    wave2.classList.add('wave-active-2');

    statusText.innerText = "جاري الإرسال...";
    statusText.style.backgroundColor = "#ff4757";
    liveSpeaker.innerText = "أنت تتحدث";
}

function deactivateWavesAndUI() {
    playRadioBeep('end');
    pttBtn.classList.remove('talking');
    btnLabel.innerText = "اضغط";
    
    // إيقاف الموجات الصوتية فوراً
    wave1.classList.remove('wave-active-1');
    wave2.classList.remove('wave-active-2');

    statusText.innerText = "جاهز للاستقبال";
    statusText.style.backgroundColor = "#2ed573";
    liveSpeaker.innerText = "حول...";
}

// ==========================================
// 4. منطق الإرسال السريع الحامي من التكرار
// ==========================================
function startRecording() {
    if (!audioStream) return;
    audioChunks = [];
    mediaRecorder = new MediaRecorder(audioStream);
    
    mediaRecorder.ondataavailable = event => {
        if (event.data.size > 0) audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        if (db && storage) {
            uploadAudioFile(audioBlob);
        } else {
            // محاكاة محلية آمنة في وضع التجربة
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            setTimeout(() => { audio.play(); }, 300);
        }
    };

    mediaRecorder.start();
    activateWavesAndUI();
    if(db) db.ref('status/talking').set({ name: usernameInput.value, isLive: true });
}

function stopRecording() {
    if (mediaRecorder && mediaRecorder.state === "recording") {
        mediaRecorder.stop();
        deactivateWavesAndUI();
        if(db) db.ref('status/talking').set({ name: "", isLive: false });
    }
}

// ربط أحداث اللمس الفوري والضغط
pttBtn.addEventListener('mousedown', startRecording);
pttBtn.addEventListener('mouseup', stopRecording);
pttBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startRecording(); });
pttBtn.addEventListener('touchend', (e) => { e.preventDefault(); stopRecording(); });

// ==========================================
// 5. الاستماع السحابي الذكي (الحماية من التشغيل الذاتي)
// ==========================================
function uploadAudioFile(blob) {
    const fileId = `track_${Date.now()}.webm`;
    const storageRef = storage.ref('voices/' + fileId);
    
    storageRef.put(blob).then(snap => snap.ref.getDownloadURL()).then(downloadURL => {
        db.ref('broadcast').set({
            url: downloadURL,
            sender: usernameInput.value,
            timestamp: Date.now()
        });
    });
}

function setupFirebaseListeners() {
    // مراقبة من يتحدث لتحديث الشاشة لدى البقية
    db.ref('status/talking').on('value', snapshot => {
        const data = snapshot.val();
        if (data && data.isLive && data.name !== usernameInput.value) {
            liveSpeaker.innerText = data.name;
            statusText.innerText = "يتم التحدث حالياً...";
            statusText.style.backgroundColor = "#ff9f43"; // برتقالي يعني استقبال كلام من طرف آخر
        } else if (data && !data.isLive) {
            statusText.innerText = "جاهز للاستقبال";
            statusText.style.backgroundColor = "#2ed573";
            liveSpeaker.innerText = "حول...";
        }
    });

    // استلام وتشغيل الملفات الصوتية القادمة من هواتف العائلة الأخرى فقط
    let isInitialLoad = true;
    db.ref('broadcast').on('value', snapshot => {
        if (isInitialLoad) { isInitialLoad = false; return; }
        
        const data = snapshot.val();
        // الحماية من الارتداد: التطبيق يتأكد أن المرسل ليس أنت شخصياً قبل تشغيل الصوت
        if (data && data.sender !== usernameInput.value) {
            playRadioBeep('start'); // نغمة لاسلكي للاستقبال
            
            setTimeout(() => {
                const incomingAudio = new Audio(data.url);
                incomingAudio.play().then(() => {
                    incomingAudio.onended = () => { playRadioBeep('end'); };
                }).catch(e => console.log("المتصفح يتطلب تفاعل مسبق لتشغيل الصوت تلقائياً"));
            }, 100);
        }
    });
}
