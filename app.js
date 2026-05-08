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


// --- NAYA: Multi-select selections state ---
let selections = {
    sections: [],
    topics: [],
    subtopics: []
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
    const items = selections[`${id}s`]; // e.g., selections.sections
    
    if (items.length === 0) {
        display.innerHTML = `<span class="text-slate-400 text-sm">Select ${id}</span>`;
    } else {
        display.innerHTML = items.map(item => `
            <div class="bg-blue-600 text-white text-[11px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 shadow-sm">
                ${item} 
                <i class="fas fa-times cursor-pointer ml-1 hover:text-blue-200" 
                   onclick="event.stopPropagation(); handleToggle('${id}', '${item}')"></i>
            </div>
        `).join('');
    }
}

window.handleToggle = async (type, val) => {
    const arr = selections[`${type}s`];
    const index = arr.indexOf(val);
    
    if (index > -1) arr.splice(index, 1);
    else arr.push(val);
    
    // UI ko update karein
    updateDisplay(type);
    renderListOnly(type); 

    // --- NAYA: Click hote hi dropdown band kar do ---
    document.getElementById(`${type}-list`).classList.add('hidden');

    // Background mein fetch chalu rakhein
    if (type === 'section') await handleSectionChange();
    else if (type === 'topic') await handleTopicChange();
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

// --- UPDATED: Dynamic Dropdown Engine ---

async function fetchMultiDropdown(fieldName, elementId, filters = []) {
    const listEl = document.getElementById(`${elementId}-list`);
    if(!listEl) return;

    try {
        let q = collection(db, "questions");
        filters.forEach(f => {
            // Agar value array hai toh 'in' query use karein
            if(Array.isArray(f.value) && f.value.length > 0) {
                q = query(q, where(f.field, "in", f.value));
            } else if(f.value && !Array.isArray(f.value)) {
                q = query(q, where(f.field, "==", f.value));
            }
        });

        const snapshot = await getDocs(q);
        const uniqueValues = [...new Set(snapshot.docs.map(doc => doc.data()[fieldName]))].filter(Boolean).sort();
        
        listEl.innerHTML = uniqueValues.map(val => {
            const isSelected = selections[`${elementId}s`].includes(val);
            return `
                <div class="p-3 hover:bg-slate-50 cursor-pointer flex justify-between items-center text-sm border-b border-slate-50 last:border-0 ${isSelected ? 'text-blue-600 font-bold bg-blue-50' : 'text-slate-700'}" 
                     onclick="handleToggle('${elementId}', '${val}')">
                    ${val}
                    ${isSelected ? '<i class="fas fa-check text-xs"></i>' : ''}
                </div>`;
        }).join('');
        
        if(uniqueValues.length === 0) listEl.innerHTML = `<div class="p-4 text-slate-400 text-xs italic text-center">No data available</div>`;
        
        updateDisplay(elementId);
    } catch (err) { console.error("Fetch Error:", err); }
}

window.handleSubjectChange = async () => {
    const sub = document.getElementById('subject').value;
    
    // Resetting ALL selections and displays
    selections = { sections: [], topics: [], subtopics: [] }; 
    updateDisplay('section'); 
    updateDisplay('topic'); 
    updateDisplay('subtopic');

    if(sub) {
        // Sirf section load karo, topic tab load hoga jab section select hoga
        await fetchMultiDropdown("section", "section", [{field: "sub", value: sub}]); 
    }
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

// --- Dynamic Smart Test Generation ---
window.generateTest = async () => {
    // 1. Config gathering
    const config = {
        sub: document.getElementById('subject').value,
        difficulty: document.getElementById('difficulty').value,
        count: parseInt(document.getElementById('num-questions').value) || 5,
        time: parseInt(document.getElementById('time-limit').value) || 10
    };

    const mapDiff = (d) => (d === "Moderate" ? "Medium" : d);

    if (!config.sub) {
        alert("Bhai, kam se kam Subject toh select kar lo! 📚");
        return;
    }

    // 2. Mixed Weightage Logic
    let weightage = { easy: 30, moderate: 50, hard: 20 };
    if (config.difficulty === "Mixed") {
        weightage.easy = parseInt(document.getElementById('w-easy').value) || 0;
        weightage.moderate = parseInt(document.getElementById('w-moderate').value) || 0;
        weightage.hard = parseInt(document.getElementById('w-hard').value) || 0;

        if (weightage.easy + weightage.moderate + weightage.hard !== 100) {
            alert(`Bhai, total weightage 100% hona chahiye! (Abhi ${weightage.easy + weightage.moderate + weightage.hard}% hai)`);
            return;
        }
    }

    showScreen('loading');

    try {
        let finalQuestions = [];
        
        // 3. Base Constraints (Using the Multi-select arrays)
        // Note: Firebase 'in' operator empty array handle nahi karta, isliye check lagaya hai
        let baseConstraints = [where("sub", "==", config.sub)];
        
        if (selections.sections && selections.sections.length > 0) {
            baseConstraints.push(where("section", "in", selections.sections));
        }
        if (selections.topics && selections.topics.length > 0) {
            baseConstraints.push(where("topic", "in", selections.topics));
        }
        if (selections.subtopics && selections.subtopics.length > 0) {
            baseConstraints.push(where("subtopic", "in", selections.subtopics));
        }

        const shuffleArray = (array) => {
            for (let i = array.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [array[i], array[j]] = [array[j], array[i]];
            }
            return array;
        };

        // 4. Fetching Logic
        if (config.difficulty === "Mixed") {
            const counts = {
                Easy: Math.round(config.count * (weightage.easy / 100)),
                Moderate: Math.round(config.count * (weightage.moderate / 100)),
                Hard: Math.round(config.count * (weightage.hard / 100))
            };
            
            // Rounding adjust
            let currentTotal = counts.Easy + counts.Moderate + counts.Hard;
            if (currentTotal !== config.count) {
                counts.Moderate += (config.count - currentTotal);
            }

            const levels = [
                { db: 'Easy', req: counts.Easy },
                { db: 'Medium', req: counts.Moderate }, // Moderate is Medium in DB
                { db: 'Hard', req: counts.Hard }
            ];

            for (const lvl of levels) {
                if (lvl.req <= 0) continue;

                const q = query(collection(db, "questions"), ...baseConstraints, where("difficulty", "==", lvl.db));
                const snap = await getDocs(q);
                let levelPool = [];
                snap.forEach(doc => levelPool.push({ id: doc.id, ...doc.data() }));
                
                const picked = shuffleArray(levelPool).slice(0, lvl.req);
                finalQuestions.push(...picked);
            }
        } else {
            // Single Difficulty Logic
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

        // 5. Finalize & Start
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

// Optimized selectOption function
window.selectOption = (idx) => {
    // State update karein
    state.userAnswers[state.currentQuestionIndex] = idx;

    // Poora renderQuestion call karne ke bajaye, sirf buttons update karein
    const buttons = document.querySelectorAll('.option-card');
    buttons.forEach((btn, i) => {
        const circle = btn.querySelector('.shrink-0'); // Letter circle (A, B, C, D)
        
        if (i === idx) {
            // Selected style
            btn.classList.add('border-indigo-600', 'bg-indigo-50', 'ring-2', 'ring-indigo-100');
            btn.classList.remove('border-slate-100');
            circle.classList.add('bg-indigo-600', 'text-white');
            circle.classList.remove('bg-slate-100', 'text-slate-500');
        } else {
            // Unselected style
            btn.classList.remove('border-indigo-600', 'bg-indigo-50', 'ring-2', 'ring-indigo-100');
            btn.classList.add('border-slate-100');
            circle.classList.remove('bg-indigo-600', 'text-white');
            circle.classList.add('bg-slate-100', 'text-slate-500');
        }
    });

    // Sidebar ko update karein bina question re-render kiye
    updateSidebarUI();
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

    // --- finishTest function ke andar loop ke part ko isse replace karein ---
state.testData.forEach((q, i) => {
    const uAns = state.userAnswers[i];
    const isCorrect = uAns !== undefined && uAns === q.correct;
    
    if (uAns === undefined) skipped++;
    else if (isCorrect) correct++;
    else wrong++;

    analysisHtml += `
        <div class="bg-white rounded-3xl p-6 shadow-sm border-l-8 ${uAns === undefined ? 'border-l-slate-300' : (isCorrect ? 'border-l-emerald-500' : 'border-l-rose-500')} mb-6">
            
            <!-- Metadata Header Row -->
            <div class="flex flex-wrap gap-2 mb-4 border-b border-slate-50 pb-3">
                <span class="bg-blue-50 text-blue-700 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter">
                    <i class="fas fa-book mr-1"></i>${q.sub || 'N/A'}
                </span>
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter">
                    <i class="fas fa-layer-group mr-1"></i>${q.section || 'N/A'}
                </span>
                <span class="bg-slate-100 text-slate-600 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter">
                    <i class="fas fa-tag mr-1"></i>${q.topic || 'N/A'}
                </span>
                <span class="bg-slate-50 text-slate-500 px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter">
                    <i class="fas fa-list-ul mr-1"></i>${q.subtopic || 'N/A'}
                </span>
                <span class="px-2 py-1 rounded-md text-[9px] font-bold uppercase tracking-tighter ${q.difficulty === 'Hard' ? 'bg-rose-50 text-rose-600' : 'bg-amber-50 text-amber-600'}">
                    <i class="fas fa-signal mr-1"></i>${q.difficulty || 'N/A'}
                </span>
            </div>

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
                <div class="text-sm text-indigo-900 leading-relaxed">${q.sol || 'No detailed explanation provided.'}</div>
            </div>
        </div>`;
});


// FinishTest function ke andar:
const totalQuestions = state.testData.length;
const scorePct = Math.round((correct / totalQuestions) * 100);
const correctEl = document.getElementById('correct-count');
const wrongEl = document.getElementById('wrong-count');
const percentEl = document.getElementById('score-percent');

if (correctEl) correctEl.textContent = correct;
if (wrongEl) wrongEl.textContent = wrong;
if (percentEl) percentEl.textContent = `${scorePct}%`;

const circle = document.getElementById('score-circle');
if(circle) {
    const circumference = 440; // 2 * PI * r
    // Offset calculation: jitna percentage hai, utna dash kam (gayab) karna hai
    const offset = circumference - (scorePct / 100) * circumference;
    
    // Set both dasharray and offset
    circle.style.strokeDasharray = circumference;
    circle.style.strokeDashoffset = offset;
}

const badgeEl = document.getElementById('result-badge');
if (badgeEl) {
    if (scorePct >= 80) {
        badgeEl.textContent = "Excellent! 🏆";
        badgeEl.className = "mt-2 text-sm px-4 py-1 inline-block rounded-full bg-emerald-50 text-emerald-700 font-bold";
    } else if (scorePct >= 50) {
        badgeEl.textContent = "Good Effort 👍";
        badgeEl.className = "mt-2 text-sm px-4 py-1 inline-block rounded-full bg-blue-50 text-blue-700 font-bold";
    } else {
        badgeEl.textContent = "Keep Practicing! 💪";
        badgeEl.className = "mt-2 text-sm px-4 py-1 inline-block rounded-full bg-rose-50 text-rose-700 font-bold";
    }
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


// Dropdown ke bahar click karne par band karein
window.addEventListener('click', (e) => {
    if (!e.target.closest('.relative')) {
        document.querySelectorAll('.multi-select-list').forEach(list => {
            list.classList.add('hidden');
        });
    }
});

window.resetApp = () => window.location.reload();
