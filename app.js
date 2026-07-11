import { db } from './config.js';
import { 
    collection, 
    getDocs, 
    query, 
    where, 
    limit 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";


import { ref, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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


// --- NAYA: Multi-select selections state ---
let selections = {
    sections: [],
    topics: []
};

const firebaseConfig = {
  databaseURL: "https://ai-mock-test-1bc80-default-rtdb.firebaseio.com" // Bina slash ke
};

// --- NAYA: Multi-Select UI Logic ---
window.toggleDropdown = (id) => {
    // Dusre dropdowns band karein aur isse toggle karein
    document.querySelectorAll('.multi-select-list').forEach(list => {
        if(list.id !== id) list.classList.add('hidden');
    });
    document.getElementById(id).classList.toggle('hidden');
};

function updateDisplay(id) {
    const display = document.getElementById(`${id}-display`);
    
    // ERROR FIX: Agar element nahi mila toh function yahi ruk jayega
    if (!display) {
        console.warn(`Element ID '${id}-display' HTML mein nahi mila.`);
        return; 
    }

    const items = selections[`${id}s`]; 
    
    if (items.length === 0) {
        display.innerHTML = `<span class="text-slate-400 text-sm">Select ${id}</span>`;
    } else {
        display.innerHTML = items.map(item => `
            <div class="bg-blue-600 text-white text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1">
                ${item} 
                <i class="fas fa-times cursor-pointer" onclick="event.stopPropagation(); handleToggle('${id}', '${item}')"></i>
            </div>
        `).join('');
    }
}

// --- OPTIMIZED: handleToggle ---
window.handleToggle = async (type, val) => {
    const arr = selections[`${type}s`];
    const index = arr.indexOf(val);
    if (index > -1) arr.splice(index, 1); else arr.push(val);
    
    // Refresh UI
    updateDisplay(type);
    
    // Trigger Children
    const sub = document.getElementById('subject').value;
    if (type === 'section') {
        selections.topics = [];
        updateDisplay('topic');
        if(selections.sections.length > 0) 
            await fetchMultiDropdown("topic", "topic", [{field: "sub", value: sub}, {field: "section", value: selections.sections}]);
    }
};

// UI Elements
const screens = {
    setup: document.getElementById('setup-screen'),
    loading: document.getElementById('loading-screen'),
    test: document.getElementById('test-screen'),
    result: document.getElementById('result-screen')
};

// --- Initialization ---
window.addEventListener('DOMContentLoaded', initApp);

async function initApp() { 
    const subjectSelect = document.getElementById('subject');
    
    try {
        const snapshot = await get(ref(db, 'questions'));
        if (snapshot.exists()) {
            const subjects = Object.keys(snapshot.val());
            subjectSelect.innerHTML = '<option value="">Select Subject</option>';
            subjects.forEach(sub => {
                subjectSelect.innerHTML += `<option value="${sub}">${sub}</option>`;
            });
        }
    } catch (err) {
        console.error("Database connection error:", err);
    }
}

function renderSubjects(subjects) {
    const selectEl = document.getElementById('subject');
    if (!selectEl) return;
    
    selectEl.innerHTML = '<option value="">Select Subject</option>';
    subjects.forEach(sub => {
        selectEl.innerHTML += `<option value="${sub}">${sub}</option>`;
    });
    console.log("UI updated with subjects.");
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

// --- UPDATED: Dynamic Dropdown Engine ---

window.fetchMultiDropdown = async (fieldName, elementId, filters = []) => {
    const listEl = document.getElementById(`${elementId}-list`);
    if (!listEl) return;

    try {
        // Realtime DB mein 'questions' ke andar subject select hoga
        // Hum subject filter ko lekar data fetch karenge
        const subFilter = filters.find(f => f.field === 'sub');
        const path = subFilter ? `questions/${subFilter.value}` : 'questions';
        
        const snapshot = await get(ref(db, path));
        
        if (!snapshot.exists()) {
            console.log("No data found at path:", path);
            return;
        }

        const data = snapshot.val();
        let uniqueValues = [];

        // Structure ke mutabik logic:
        if (fieldName === 'section') {
            uniqueValues = Object.keys(data);
        } else if (fieldName === 'topic') {
            // Agar sections select hain, unke topics nikalna
            selections.sections.forEach(sec => {
                if (data[sec]) {
                    uniqueValues.push(...Object.keys(data[sec]));
                }
            });
        }

        uniqueValues = [...new Set(uniqueValues)].sort();

        listEl.innerHTML = uniqueValues.map(val => {
            const isSelected = selections[`${elementId}s`].includes(val);
            return `
                <div class="p-3 cursor-pointer flex justify-between items-center text-sm ${isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}" 
                     onclick="handleToggle('${elementId}', '${val}')">
                    ${val} ${isSelected ? '<i class="fas fa-check text-xs"></i>' : ''}
                </div>`;
        }).join('');

    } catch (err) {
        console.error("Dropdown Error:", err);
    }
};

window.handleSubjectChange = async () => {
    const sub = document.getElementById('subject').value;
    selections = { sections: [], topics: [] };
    updateDisplay('section'); updateDisplay('topic');
    if(sub) await window.fetchMultiDropdown("section", "section", [{field: "sub", value: sub}]);
};

// --- NAYA: Render List Only (Error fix karne ke liye) ---
// Ye function cached data ya dynamic data ko dropdown mein render karega
function renderListOnly(type, uniqueValues) {
    const listEl = document.getElementById(`${type}-list`);
    if (!listEl || !uniqueValues) return;

    listEl.innerHTML = uniqueValues.map(val => {
        const isSelected = selections[`${type}s`].includes(val);
        return `
            <div class="p-3 hover:bg-blue-50 cursor-pointer flex justify-between items-center text-sm ${isSelected ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-700'}" 
                 onclick="handleToggle('${type}', '${val}')">
                <span>${val}</span>
                ${isSelected ? '<i class="fas fa-check-circle text-xs"></i>' : ''}
            </div>`;
    }).join('');
}

// --- UPDATED: handleToggle (Jo dropdown hide karega aur fetch trigger karega) ---
window.handleToggle = async (type, val) => {
    const arr = selections[`${type}s`];
    const index = arr.indexOf(val);
    
    // Toggle logic
    if (index > -1) arr.splice(index, 1);
    else arr.push(val);
    
    // UI Update (Tags dikhana)
    updateDisplay(type);
    
    // Dropdown ko hide karein click ke baad
    const listEl = document.getElementById(`${type}-list`);
    if(listEl) listEl.classList.add('hidden');

    const sub = document.getElementById('subject').value;
    
    // Dependent levels ko trigger karein
    if (type === 'section') {
        selections.topics = []; selections.subtopics = [];
        updateDisplay('topic'); updateDisplay('subtopic');
        if (selections.sections.length > 0) {
            await fetchMultiDropdown("topic", "topic", [{field: "sub", value: sub}, {field: "section", value: selections.sections}]);
        }
    } 
    else if (type === 'topic') {
        selections.subtopics = [];
        updateDisplay('subtopic');
        if (selections.topics.length > 0) {
            await fetchMultiDropdown("subtopic", "subtopic", [{field: "sub", value: sub}, {field: "topic", value: selections.topics}]);
        }
    }
};

window.handleSectionChange = async () => {
    const sub = document.getElementById('subject').value;
    selections.topics = []; selections.subtopics = []; // Reset children
    updateDisplay('topic'); updateDisplay('subtopic');
    
    if(selections.sections.length > 0) {
        await fetchMultiDropdown("topic", "topic", [
            {field: "sub", value: sub},
            {field: "section", value: selections.sections}
        ]);
    }
    // Refresh current list UI (checkmarks ke liye)
    await fetchMultiDropdown("section", "section", [{field: "sub", value: sub}]);
};

window.handleTopicChange = async () => {
    const sub = document.getElementById('subject').value;
    selections.subtopics = [];
    updateDisplay('subtopic');
    
    if(selections.topics.length > 0) {
        await fetchMultiDropdown("subtopic", "subtopic", [
            {field: "sub", value: sub},
            {field: "topic", value: selections.topics}
        ]);
    }
    // Refresh topic list UI
    await fetchMultiDropdown("topic", "topic", [
        {field: "sub", value: sub},
        {field: "section", value: selections.sections}
    ]);
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

const testRef = ref(db, 'questions/Analytical Ability & Logical Reasoning/Deductive Reasoning/Logical Statement');
get(testRef).then(snap => {
    if(snap.exists()) {
        console.log("Data reached:");
    } else {
        console.log("Still no data at deep path.");
    }
});

// --- Dynamic Smart Test Generation ---
window.generateTest = async () => {
    const sub = document.getElementById('subject').value;
    const section = selections.sections[0]; 
    const topic = selections.topics[0];
    
    // UI input se values lein
    const numQuestions = parseInt(document.getElementById('num-questions').value) || 5;
    const timeLimit = parseInt(document.getElementById('time-limit').value) || 10;
    
    if (!sub || !section || !topic) {
        alert("Please select Subject, Section, and Topic first!");
        return;
    }

    showScreen('loading');

    try {
        const path = `questions/${sub}/${section}/${topic}`;
        const snapshot = await get(ref(db, path));
        
        if (!snapshot.exists()) throw new Error("No data found at path: " + path);

        const rawData = snapshot.val();
        const uniqueKey = Object.keys(rawData)[0];
        const fullData = rawData[uniqueKey].data;

        // Yahan limit apply karein
        state.testData = fullData.slice(0, numQuestions);
        
        // Time limit ko state mein set karein
        state.timeRemaining = timeLimit * 60; 
        
        
        startTest(); 

    } catch (err) {
        console.error("Fetch Error:", err);
        alert(err.message);
        showScreen('setup');
    }
};

const limitCount = parseInt(document.getElementById('num-questions').value) || 5;

// --- Core Test Logic ---
function startTest() {
    showScreen('test');
    state.isTestActive = true;
    
    // Timer update function call karein
    updateTimerDisplay(); 
    
    state.timerInterval = setInterval(() => {
        state.timeRemaining--;
        updateTimerDisplay();
        
        if (state.timeRemaining <= 0) {
            clearInterval(state.timerInterval);
            finishTest();
        }
    }, 1000);
    
    renderQuestion();
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
window.prevQuestion = () => { if(state.currentQuestionIndex > 0) { state.currentQuestionIndex--; renderQuestion(); }};
window.clearResponse = () => { delete state.userAnswers[state.currentQuestionIndex]; renderQuestion(); };
window.markForReview = () => { window.nextQuestion(); };
window.resetApp = () => location.reload(); 




window.selectOption = (idx) => {
    // 1. Answer save karein
    state.userAnswers[state.currentQuestionIndex] = idx;
    
    // 2. UI ko refresh karein taaki selection dikhe
    renderQuestion(); 
    
    // 3. Sidebar (Palette) update karein
    updateSidebarUI();
};

window.nextQuestion = () => {
    if (state.currentQuestionIndex < state.testData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else { window.finishTest(); }
};

window.markForReview = () => {
    state.questionsStatus[state.currentQuestionIndex] = 'review';
    if (state.currentQuestionIndex < state.testData.length - 1) {
        state.currentQuestionIndex++;
        renderQuestion();
    } else { 
        updateSidebarUI(); 
    }
};

window.clearResponse = () => {
    delete state.userAnswers[state.currentQuestionIndex];
    state.questionsStatus[state.currentQuestionIndex] = 'visited';
    renderQuestion();
};

window.prevQuestion = () => { 
    if(state.currentQuestionIndex > 0) { 
        state.currentQuestionIndex--; 
        renderQuestion(); 
    }
};

window.finishTest = () => {
    clearInterval(state.timerInterval);
    document.getElementById('test-screen').classList.add('hidden');
    document.getElementById('result-screen').classList.remove('hidden');
    
    if (!state.testData || state.testData.length === 0) return;

    let correct = 0;
    let wrong = 0;
    let analysisHtml = '';

    // finishTest function ke andar analysisHtml wale part mein:
state.testData.forEach((q, i) => {
    const uAns = state.userAnswers[i]; // User ne jo index select kiya
    const correctIndex = parseInt(q.correct); // Database se sahi index
    
    // Check if answered, correct or wrong
    const isAttempted = uAns !== undefined;
    const isCorrect = isAttempted && (uAns === correctIndex);

    analysisHtml += `
    <div class="bg-white rounded-3xl p-6 shadow-sm border-l-8 ${!isAttempted ? 'border-l-slate-300' : (isCorrect ? 'border-l-emerald-500' : 'border-l-rose-500')} mb-6">
        <h4 class="text-lg font-bold text-slate-800 mb-4">${q.text}</h4>
        
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="p-4 rounded-2xl ${!isAttempted ? 'bg-slate-50' : (isCorrect ? 'bg-emerald-50' : 'bg-rose-50')}">
                <p class="text-[10px] font-bold text-slate-400 uppercase">Your Answer</p>
                <p class="font-bold">${isAttempted ? (q.options[uAns] || 'Invalid') : 'Not Attempted'}</p>
            </div>
            
            <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                <p class="text-[10px] font-bold text-emerald-600 uppercase">Correct Answer</p>
                <p class="font-bold text-emerald-700">${q.options[correctIndex] || 'N/A'}</p>
            </div>
        </div>

        <div class="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
            <p class="text-[10px] font-bold text-slate-500 uppercase">Solution</p>
            <p class="text-sm text-slate-700 mt-1">${q.sol || 'No explanation provided.'}</p>
        </div>
    </div>`;
});

    // Score update
    const totalQuestions = state.testData.length;
    const scorePct = Math.round((correct / totalQuestions) * 100);
    
    document.getElementById('correct-count').textContent = correct;
    document.getElementById('wrong-count').textContent = wrong;
    document.getElementById('score-percent').textContent = `${scorePct}%`;

    // CRITICAL: Analysis container mein HTML inject karna
    const container = document.getElementById('analysis-container');
    if (container) {
        container.innerHTML = analysisHtml;
        // Agar MathJax use kar rahe hain toh typeset call karein
        if (window.MathJax) MathJax.typesetPromise([container]);
    }
};

// DIFFICULTY dropdown fix
const diffEl = document.getElementById('difficulty');
if (diffEl) {
    diffEl.addEventListener('change', (e) => {
        const weightageBox = document.getElementById('weightage-section');
        if (weightageBox) {
            weightageBox.classList.toggle('hidden', e.target.value !== 'Mixed');
        }
    });
}

function showScreen(screenKey) {
    Object.values(screens).forEach(s => s.classList.add('hidden'));
    screens[screenKey].classList.remove('hidden');
    window.scrollTo(0,0);
}


// Dropdown ke bahar click karne par band karein
window.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
        document.querySelectorAll('.multi-select-list').forEach(list => {
            list.classList.add('hidden');
        });
    }
});

window.resetApp = () => window.location.reload();
