import { db } from './config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Global State
let state = {
    testData: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    questionsStatus: {}, 
    timeRemaining: 0,
    timerInterval: null,
    isTestActive: false
};

// UI Elements
const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    test: document.getElementById('test-screen'),
    result: document.getElementById('result-screen')
};

// --- Initialization ---
window.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    console.log("Portal Initializing...");
    await fetchDropdownData("sub", "subject");
}

// --- Dynamic Dropdown Engine ---
async function fetchDropdownData(fieldName, elementId, filters = []) {
    const el = document.getElementById(elementId);
    if(!el) return;

    el.innerHTML = `<option value="">Loading...</option>`;
    
    try {
        let q = collection(db, "questions");
        filters.forEach(f => {
            if(f.value) q = query(q, where(f.field, "==", f.value));
        });

        const snapshot = await getDocs(q);
        const uniqueValues = [...new Set(snapshot.docs.map(doc => doc.data()[fieldName]))].filter(Boolean).sort();
        
        el.innerHTML = `<option value="">Select ${fieldName}</option>`;
        uniqueValues.forEach(val => {
            const opt = document.createElement('option');
            opt.value = val;
            opt.textContent = val;
            el.appendChild(opt);
        });
        
        el.disabled = false;
    } catch (err) {
        console.error("Fetch Error:", err);
        el.innerHTML = `<option value="">Error loading data</option>`;
    }
}

window.handleSubjectChange = async () => {
    const sub = document.getElementById('subject').value;
    resetDropdowns(['section', 'topic', 'subtopic']);
    if(sub) await fetchDropdownData("section", "section", [{field: "sub", value: sub}]); 
}

window.handleSectionChange = async () => {
    const sub = document.getElementById('subject').value;
    const section = document.getElementById('section').value;
    resetDropdowns(['topic', 'subtopic']);
    if(section) {
        await fetchDropdownData("topic", "topic", [
            {field: "sub", value: sub},
            {field: "section", value: section}
        ]);
    }
};

window.handleTopicChange = async () => {
    const sub = document.getElementById('subject').value;
    const section = document.getElementById('section').value;
    const topic = document.getElementById('topic').value;
    resetDropdowns(['subtopic']);
    if(topic) {
        await fetchDropdownData("subtopic", "subtopic", [
            {field: "sub", value: sub},
            {field: "section", value: section},
            {field: "topic", value: topic}
        ]);
    }
};

function resetDropdowns(ids) {
    ids.forEach(id => {
        const el = document.getElementById(id);
        if(el) {
            el.innerHTML = `<option value="">Choose previous first</option>`;
            el.disabled = true;
        }
    });
}

// --- Dynamic Smart Test Generation ---
window.generateTest = async () => {
    const config = {
        sub: document.getElementById('subject').value,
        section: document.getElementById('section').value,
        topic: document.getElementById('topic').value,
        subtopic: document.getElementById('subtopic').value,
        difficulty: document.getElementById('difficulty').value,
        count: parseInt(document.getElementById('num-questions').value) || 5,
        time: parseInt(document.getElementById('time-limit').value) || 10
    };

    const mapDiff = (d) => (d === "Moderate" ? "Medium" : d);

    if (!config.sub) {
        alert("Bhai, kam se kam Subject toh select kar lo! 📚");
        return;
    }

    // --- NEW: Dynamic Weightage Calculation ---
    let weightage = { easy: 30, moderate: 50, hard: 20 };
    if (config.difficulty === "Mixed") {
        weightage.easy = parseInt(document.getElementById('w-easy').value) || 0;
        weightage.moderate = parseInt(document.getElementById('w-moderate').value) || 0;
        weightage.hard = parseInt(document.getElementById('w-hard').value) || 0;

        // Validation: Total 100% hona chahiye
        if (weightage.easy + weightage.moderate + weightage.hard !== 100) {
            alert(`Bhai, total weightage 100% hona chahiye! (Abhi ${weightage.easy + weightage.moderate + weightage.hard}% hai)`);
            return;
        }
    }

    showScreen('loading');

    try {
        let finalQuestions = [];
        let baseConstraints = [where("sub", "==", config.sub)];
        
        if (config.section) baseConstraints.push(where("section", "==", config.section));
        if (config.topic) baseConstraints.push(where("topic", "==", config.topic));
        if (config.subtopic) baseConstraints.push(where("subtopic", "==", config.subtopic));

        const shuffleArray = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        if (config.difficulty === "Mixed") {
            // --- UPDATED MIXED LOGIC: Based on user weightage ---
            const counts = {
                Easy: Math.round(config.count * (weightage.easy / 100)),
                Moderate: Math.round(config.count * (weightage.moderate / 100)),
                Hard: Math.round(config.count * (weightage.hard / 100))
            };
            
            // Adjust total count if rounding causes issues (e.g. 10 questions, 33% each)
            let currentTotal = counts.Easy + counts.Moderate + counts.Hard;
            if (currentTotal < config.count) counts.Moderate += (config.count - currentTotal);
            else if (currentTotal > config.count) counts.Moderate -= (currentTotal - config.count);

            const levels = [
                { ui: 'Easy', db: 'Easy', req: counts.Easy },
                { ui: 'Moderate', db: 'Medium', req: counts.Moderate },
                { ui: 'Hard', db: 'Hard', req: counts.Hard }
            ];

            for (const lvl of levels) {
                if (lvl.req <= 0) continue; // Agar kisi ka weightage 0% hai toh query mat karo

                const q = query(collection(db, "questions"), ...baseConstraints, where("difficulty", "==", lvl.db));
                const snap = await getDocs(q);
                let levelPool = [];
                snap.forEach(doc => levelPool.push({ id: doc.id, ...doc.data() }));
                
                const picked = shuffleArray(levelPool).slice(0, lvl.req);
                finalQuestions.push(...picked);
            }
        } else {
            // --- PEHLE WALA LOGIC (Single Difficulty) ---
            const targetDiff = mapDiff(config.difficulty); 
            const q = query(collection(db, "questions"), ...baseConstraints, where("difficulty", "==", targetDiff));
            const snap = await getDocs(q);
            let pool = [];
            snap.forEach(doc => pool.push({ id: doc.id, ...doc.data() }));
            finalQuestions = shuffleArray(pool).slice(0, config.count);
        }

        if (finalQuestions.length === 0) {
            throw new Error("Bhai, is combination mein questions nahi mile. Filter badal ke dekho!");
        }

        // Final Shuffle and State Reset
        state.testData = shuffleArray(finalQuestions);
        state.currentQuestionIndex = 0;
        state.userAnswers = {};
        state.questionsStatus = {};
        state.timeRemaining = config.time * 60;
        
        startTest();

    } catch (err) {
        console.error("Test Gen Error:", err);
        alert(err.message);
        showScreen('setup');
    }
};

// --- Core Test Logic ---
// --- Core Test Logic ---
function startTest() {
    showScreen('test');
    state.isTestActive = true;
    renderQuestion();
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        if (state.timeRemaining <= 0) finishTest();
    }, 1000);
}

function renderQuestion() {
    const q = state.testData[state.currentQuestionIndex];
    const container = document.getElementById('question-container');
    
    // 1. Container check (innerHTML error fix)
    if (!container) return;

    if (!state.questionsStatus[state.currentQuestionIndex]) {
        state.questionsStatus[state.currentQuestionIndex] = 'visited';
    }

    // 2. Question numbers update (Safe update)
    const curEl = document.getElementById('current-q-num');
    const totEl = document.getElementById('total-q-num');
    if (curEl) curEl.textContent = state.currentQuestionIndex + 1;
    if (totEl) totEl.textContent = state.testData.length;

    // 3. Progress Bar Logic (Aapke HTML ki IDs: progress-text aur progress-bar)
    const progressText = document.getElementById('progress-text');
    const progressBar = document.getElementById('progress-bar');
    const percent = Math.round(((state.currentQuestionIndex + 1) / state.testData.length) * 100);
    
    if (progressText) progressText.textContent = `${percent}%`;
    if (progressBar) progressBar.style.width = `${percent}%`;

    container.innerHTML = `
        <div class="animate-fade-in">
            <h3 class="text-xl md:text-2xl font-bold text-slate-800 mb-8">${q.text}</h3>
            <div class="grid grid-cols-1 gap-4">
                ${q.options.map((opt, idx) => `
                    <button onclick="selectOption(${idx})" 
    class="option-card w-full flex items-center gap-4 p-4 md:p-5 rounded-2xl border-2 transition-all text-left 
    ${state.userAnswers[state.currentQuestionIndex] === idx 
        ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-100' 
        : 'border-slate-100 hover:border-indigo-200 hover:bg-slate-50'}">
    <span class="w-8 h-8 md:w-10 md:h-10 shrink-0 rounded-xl flex items-center justify-center font-bold 
    ${state.userAnswers[state.currentQuestionIndex] === idx ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'}">
        ${String.fromCharCode(65 + idx)}
    </span>
    <span class="text-sm md:text-base font-medium text-slate-700">${opt}</span>
</button>
                `).join('')}
            </div>
        </div>
    `;

    if (window.MathJax) MathJax.typesetPromise([container]);
    updateSidebarUI();

    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    if (prevBtn) prevBtn.disabled = state.currentQuestionIndex === 0;
    if (nextBtn) {
        const isLast = state.currentQuestionIndex === state.testData.length - 1;
        nextBtn.textContent = isLast ? "Finish & Review" : "Save & Next";
    }
}

function updateSidebarUI() {
    const paletteGrid = document.getElementById('palette-grid');
    if (!paletteGrid) return;
    paletteGrid.innerHTML = '';
    
    let counts = { answered: 0, notAnswered: 0, review: 0, notVisited: 0 };

    state.testData.forEach((_, i) => {
        const status = state.questionsStatus[i];
        const isAns = state.userAnswers[i] !== undefined;
        let colorClass = 'bg-white text-slate-400 border-slate-200';

        if (status === 'review') { colorClass = 'bg-amber-500 text-white border-amber-600'; counts.review++; }
        else if (isAns) { colorClass = 'bg-emerald-500 text-white border-emerald-600'; counts.answered++; }
        else if (status === 'visited' || status === 'not-answered') { colorClass = 'bg-rose-500 text-white border-rose-600'; counts.notAnswered++; }
        else counts.notVisited++;

        if (state.currentQuestionIndex === i) colorClass += ' ring-2 ring-indigo-600 ring-offset-1';
        paletteGrid.innerHTML += `<button onclick="jumpTo(${i})" class="w-10 h-10 rounded-lg border font-bold text-xs transition-all ${colorClass}">${i + 1}</button>`;
    });

    // Sidebar stats update (Safe)
    const updateEl = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };
    updateEl('stat-answered', counts.answered);
    updateEl('stat-not-answered', counts.notAnswered);
    updateEl('stat-review', counts.review);
    updateEl('stat-not-visited', counts.notVisited);
}

function updateTimerDisplay() {
    const m = Math.floor(state.timeRemaining / 60);
    const s = state.timeRemaining % 60;
    const str = `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    
    // Aapke HTML mein ID 'timer-display' hai
    const timerEl = document.getElementById('timer-display');
    if (timerEl) timerEl.textContent = str;
}


window.jumpTo = (i) => { state.currentQuestionIndex = i; renderQuestion(); };

window.selectOption = (idx) => {
    state.userAnswers[state.currentQuestionIndex] = idx;
    renderQuestion();
};

window.nextQuestion = () => {
    if (state.userAnswers[state.currentQuestionIndex] === undefined && state.questionsStatus[state.currentQuestionIndex] !== 'review') {
        state.questionsStatus[state.currentQuestionIndex] = 'not-answered';
    }
    if (state.currentQuestionIndex < state.testData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    }
};

window.markForReview = () => {
    state.questionsStatus[state.currentQuestionIndex] = 'review';
    if (state.currentQuestionIndex < state.testData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else { updateSidebarUI(); }
};

window.clearResponse = () => {
    delete state.userAnswers[state.currentQuestionIndex];
    state.questionsStatus[state.currentQuestionIndex] = 'visited';
    renderQuestion();
};

window.prevQuestion = () => { if(state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderQuestion(); }};

window.finishTest = () => {
    clearInterval(state.timerInterval);
    showScreen('result');
    
    let correct = 0;
    let wrong = 0;
    let skipped = 0;
    let analysisHtml = '';

    state.testData.forEach((q, i) => {
        const uAns = state.userAnswers[i];
        const isCorrect = uAns !== undefined && uAns === q.correct;
        
        if (uAns === undefined) skipped++;
        else if (isCorrect) correct++;
        else wrong++;

        // Render Question Card
        analysisHtml += `
            <div class="bg-white rounded-3xl p-6 shadow-sm border-l-8 ${uAns === undefined ? 'border-l-slate-300' : (isCorrect ? 'border-l-emerald-500' : 'border-l-rose-500')} mb-6">
                <div class="flex justify-between items-center mb-3">
                    <span class="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Question ${i + 1}</span>
                    <span class="px-2 py-1 rounded text-[9px] font-bold uppercase ${isCorrect ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}">
                        ${uAns === undefined ? 'Skipped' : (isCorrect ? 'Correct' : 'Incorrect')}
                    </span>
                </div>
                
                <h4 class="text-lg font-bold text-slate-800 mb-4">${q.text}</h4>
                
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div class="p-4 rounded-2xl ${uAns === undefined ? 'bg-slate-50' : (isCorrect ? 'bg-emerald-50 border border-emerald-100' : 'bg-rose-50 border border-rose-100')}">
                        <p class="text-[10px] font-bold text-slate-400 uppercase mb-1">Your Answer</p>
                        <p class="font-bold ${isCorrect ? 'text-emerald-700' : 'text-rose-700'}">
                            ${uAns !== undefined ? q.options[uAns] : 'Not Attempted'}
                        </p>
                    </div>
                    <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                        <p class="text-[10px] font-bold text-emerald-600 uppercase mb-1">Correct Answer</p>
                        <p class="font-bold text-emerald-700">${q.options[q.correct]}</p>
                    </div>
                </div>

                <div class="bg-indigo-50 p-4 rounded-2xl border border-indigo-100">
                    <p class="text-xs font-black text-indigo-600 uppercase mb-1 tracking-tighter">Explanation:</p>
                    <div class="text-sm text-indigo-900 leading-relaxed">${q.sol || 'No detailed explanation provided for this question.'}</div>
                </div>
            </div>`;
    });

    // 1. Accuracy Calculation
    const totalQuestions = state.testData.length;
    const scorePct = Math.round((correct / totalQuestions) * 100);

    // 2. Update UI Elements
    const update = (id, val) => { if(document.getElementById(id)) document.getElementById(id).textContent = val; };
    
    update('score-percent', `${scorePct}%`);
    update('correct-count', correct);
    update('wrong-count', wrong);
    
    // 3. Progress Circle Animation (Accuracy)
    // Formula: DashArray = (Percent, 100)
    const circle = document.getElementById('score-circle');
    if(circle) {
        circle.setAttribute('stroke-dasharray', `${scorePct}, 100`);
    }

    // 4. Inject Analysis
    const container = document.getElementById('analysis-container');
    if(container) {
        container.innerHTML = analysisHtml;
        // Re-render MathJax for solutions
        if (window.MathJax) MathJax.typesetPromise([container]);
    }
};


// Dropdown change hone par box show/hide karega
document.getElementById('difficulty').addEventListener('change', (e) => {
    const weightageBox = document.getElementById('weightage-section');
    if (e.target.value === 'Mixed') {
        weightageBox.classList.remove('hidden');
    } else {
        weightageBox.classList.add('hidden');
    }
});

function showScreen(screenKey) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenKey].classList.remove('hidden');
    window.scrollTo(0,0);
}


window.resetApp = () => window.location.reload();