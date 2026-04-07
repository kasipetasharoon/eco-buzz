let timerInterval = null;
let teamCache = {}; 
let currentRound = 0;
let remainingOnPause = 100;
const GAME_TIME = 100; 

function adminAuth() {
    if (document.getElementById('adminPass').value === "admin123") {
        document.getElementById('adminLogin').style.opacity = '0';
        setTimeout(() => document.getElementById('adminLogin').style.display = 'none', 300);
        repairScores(); 
    } else { alert("Unauthorized."); }
}

function switchTab(id) {
    ['control', 'logs', 'teams', 'scoreboard'].forEach(t => {
        document.getElementById(`tab-${t}`).classList.add('hidden');
        document.getElementById(`btn-${t}`).classList.remove('active-tab', 'text-green-400');
        document.getElementById(`btn-${t}`).classList.add('text-gray-400');
    });
    document.getElementById(`tab-${id}`).classList.remove('hidden');
    document.getElementById(`btn-${id}`).classList.add('active-tab', 'text-green-400');
}

function repairScores() {
    window.db.ref('teams').once('value', snap => {
        snap.forEach(child => {
            let val = child.val();
            let safeScore = Number(val.score);
            if (isNaN(safeScore)) window.db.ref(`teams/${child.key}`).update({ score: 0 });
            else if (val.score !== safeScore) window.db.ref(`teams/${child.key}`).update({ score: safeScore });
        });
    });
}

// --- GAME CONTROLS ---
function startQuestion() {
    currentRound++;
    window.db.ref('gameState').update({ 
        status: 'OPEN', 
        startTime: firebase.database.ServerValue.TIMESTAMP,
        round: currentRound,
        remainingTime: GAME_TIME
    });
}

function togglePause() {
    window.db.ref('gameState/status').once('value', snap => {
        const currentStatus = snap.val();
        if (currentStatus === 'OPEN') {
            // Pause logic
            window.db.ref('gameState').update({ 
                status: 'PAUSED',
                remainingTime: remainingOnPause 
            });
        } else if (currentStatus === 'PAUSED') {
            // Resume logic: Set new startTime based on remaining seconds
            const newStartTime = Date.now() - ((GAME_TIME - remainingOnPause) * 1000);
            window.db.ref('gameState').update({ 
                status: 'OPEN',
                startTime: newStartTime 
            });
        }
    });
}

function stopQuestion() { 
    window.db.ref('gameState').update({ status: 'CLOSED' }); 
}

function resetQuestion() {
    window.db.ref('currentQuestion/buzzQueue').remove();
    window.db.ref('gameState').update({ status: 'WAITING', remainingTime: GAME_TIME });
    document.getElementById('buzzList').innerHTML = '<div class="text-gray-600 italic text-sm">Waiting for buzzes...</div>'; 
}

// --- WINNER LOGIC ---
function endGame() {
    Swal.fire({
        title: 'End Event?',
        text: "This will show TOP 2 ranks to everyone.",
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#16a34a',
        confirmButtonText: 'SHOW WINNERS'
    }).then((result) => {
        if (result.isConfirmed) {
            window.db.ref('teams').once('value', snap => {
                let allTeams = [];
                snap.forEach(c => {
                    let t = c.val();
                    allTeams.push({ name: t.name, score: Number(t.score) || 0 });
                });
                allTeams.sort((a, b) => b.score - a.score);
                let buckets = [];
                allTeams.forEach(t => {
                    if (buckets.length === 0 || buckets[buckets.length-1].score !== t.score) {
                        buckets.push({ score: t.score, names: [t.name] });
                    } else { buckets[buckets.length-1].names.push(t.name); }
                });
                let html = "";
                for(let i=0; i < Math.min(2, buckets.length); i++) {
                    let bucket = buckets[i];
                    let rank = i + 1;
                    let color = rank === 1 ? "#4ade80" : "#94a3b8";
                    html += `<div style="border: 2px solid ${color}; background: rgba(74,222,128,0.05); border-radius: 15px; margin-bottom: 12px; padding: 20px;">
                        <div style="color:${color}; font-size: 1.8rem; font-weight: 900;">RANK ${rank}</div>
                        <div style="font-size: 1.4rem; margin: 8px 0; font-weight: 700; color: white;">${bucket.names.join("<br>")}</div>
                        <div style="color: #6b7280; font-weight:bold;">SCORE: ${bucket.score}</div>
                    </div>`;
                }
                window.db.ref('gameState').update({ status: 'ENDED', winnerName: html });
            });
        }
    });
}

function toggleEmergency() {
    window.db.ref('gameState/emergencyMode').once('value', snap => {
        const nextState = !snap.val();
        window.db.ref('gameState').update({ emergencyMode: nextState });
    });
}

// --- LISTENERS ---
window.db.ref('gameState').on('value', snap => {
    const data = snap.val() || {};
    const status = data.status || 'WAITING';
    const timerEl = document.getElementById('adminTimer');
    const pauseBtn = document.getElementById('pauseBtn');
    
    document.getElementById('gameStatus').innerText = status;
    document.getElementById('roundText').innerText = `ROUND ${data.round || 0}`;
    currentRound = data.round || 0;

    // Update Pause Button Text
    pauseBtn.disabled = (status !== 'OPEN' && status !== 'PAUSED');
    pauseBtn.innerText = (status === 'PAUSED') ? 'Resume' : 'Pause';
    pauseBtn.className = (status === 'PAUSED') ? 'bg-green-600 hover:bg-green-700 h-24 rounded-2xl font-black text-lg shadow-xl' : 'bg-amber-600 hover:bg-amber-700 h-24 rounded-2xl font-black text-lg shadow-xl';

    if (timerInterval) clearInterval(timerInterval);

    if (status === 'OPEN') {
        const updateTimer = () => {
            const elapsed = Math.floor((Date.now() - data.startTime) / 1000);
            const remaining = Math.max(0, GAME_TIME - elapsed);
            remainingOnPause = remaining; // Sync for pausing
            timerEl.innerText = remaining + "s";
            
            // Dynamic Colors
            if (remaining > 50) { timerEl.style.color = "#4ade80"; timerEl.style.opacity = "0.3"; }
            else if (remaining > 20) { timerEl.style.color = "#fbbf24"; timerEl.style.opacity = "0.6"; }
            else { timerEl.style.color = "#f87171"; timerEl.style.opacity = "1"; }

            if (remaining <= 0) stopQuestion();
        };
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    } else if (status === 'PAUSED') {
        timerEl.innerText = (data.remainingTime || remainingOnPause) + "s";
        timerEl.style.color = "#fbbf24";
        timerEl.style.opacity = "1";
    } else {
        timerEl.innerText = GAME_TIME + "s";
        timerEl.style.opacity = "0.1";
    }
});

// Teams grid & Scoreboard listeners remain the same...
window.db.ref('teams').on('value', snap => {
    const teams = [];
    snap.forEach(c => {
        const val = c.val();
        teamCache[c.key] = val.name; 
        teams.push({ id: c.key, ...val });
    });
    const sortedTeams = [...teams].sort((a,b) => (Number(b.score)||0) - (Number(a.score)||0));
    document.getElementById('scoreTable').innerHTML = sortedTeams.map((t, i) => `
        <tr class="border-b border-gray-800/50">
            <td class="p-4 text-green-500 font-black">#${i+1}</td>
            <td class="p-4 font-bold text-gray-200">${t.name}</td>
            <td class="p-4 text-right font-mono font-bold text-xl">${t.score}</td>
        </tr>`).join('');
    document.getElementById('teamGrid').innerHTML = teams.sort((a,b) => a.id.localeCompare(b.id)).map(t => {
        const isOnline = (Date.now() - t.lastActive) < 15000;
        return `<div class="card p-4 border-l-4 ${isOnline?'border-green-500':'border-red-900'} bg-[#111827] flex flex-col gap-3">
            <div class="flex justify-between items-start">
                <div class="truncate"><div class="text-[10px] text-gray-500 font-black uppercase">${t.id}</div><div class="font-bold text-white truncate">${t.name}</div><div class="text-xs text-green-400 font-black">${t.score} PTS</div></div>
                <button onclick="kick('${t.id}')" class="text-red-900 hover:text-red-500"><i class="fas fa-user-slash"></i></button>
            </div>
            <div class="grid grid-cols-2 gap-2">
                <button onclick="setManualPoints('${t.id}')" class="bg-gray-800 hover:bg-gray-700 text-[10px] font-bold py-1 rounded border border-gray-700 uppercase">Edit Marks</button>
                <button onclick="kick('${t.id}')" class="bg-red-950/20 text-red-500 text-[10px] font-bold py-1 rounded border border-red-900/30 uppercase">Logout</button>
            </div>
        </div>`;
    }).join('');
});

window.db.ref('currentQuestion/buzzQueue').orderByChild('time').on('value', snap => {
    const list = document.getElementById('buzzList');
    if (snap.numChildren() > 0) list.innerHTML = '';
    let rank = 1;
    snap.forEach(child => {
        if (rank > 10) return;
        const teamId = child.key;
        const data = child.val();
        list.innerHTML += `<div class="card p-4 flex justify-between items-center border-l-4 border-green-500 new-buzz">
            <div class="flex items-center">
                <span class="w-8 h-8 rounded-full bg-green-500 text-[#0a0f1e] flex items-center justify-center font-black mr-4">${rank}</span>
                <div><div class="font-black text-white">${teamCache[teamId] || "Loading..."}</div><div class="text-[10px] text-gray-500 font-mono">${new Date(data.time).toLocaleTimeString()}</div></div>
            </div>
            <div class="flex gap-2">
                <button onclick="givePoints('${teamId}', 15)" class="bg-green-600 px-4 py-2 rounded-lg font-black text-xs hover:bg-green-500 shadow-lg shadow-green-900/20">+15</button>
                <button onclick="givePoints('${teamId}', -10)" class="bg-red-600 px-4 py-2 rounded-lg font-black text-xs hover:bg-red-500 shadow-lg shadow-red-900/20">-10</button>
            </div>
        </div>`;
        const rowId = `log-${currentRound}-${teamId}`;
        if (!document.getElementById(rowId)) {
            document.getElementById('logTable').insertAdjacentHTML('afterbegin', `<tr id="${rowId}" class="border-b border-gray-800/50">
                <td class="p-4 text-green-500 font-bold">#${rank}</td><td class="p-4 font-bold text-gray-200">${teamCache[teamId] || "Loading..."}</td><td class="p-4 text-gray-500 text-xs font-mono">${new Date(data.time).toLocaleTimeString()}</td><td class="p-4 font-bold text-[10px]">RD ${currentRound}</td>
            </tr>`);
        }
        rank++;
    });
});

function givePoints(teamId, pts) { window.db.ref(`teams/${teamId}/score`).transaction(c => (Number(c)||0) + pts); }
function setManualPoints(teamId) { Swal.fire({ title: `Score: ${teamCache[teamId]}`, input: 'number', showCancelButton: true }).then(r => { if(r.isConfirmed) window.db.ref(`teams/${teamId}/score`).set(Number(r.value)); }); }
function kick(id) { if(confirm("Kick team?")) window.db.ref(`teams/${id}/sessionId`).set(null); }
function clearLogs() { if(confirm("Clear logs?")) document.getElementById('logTable').innerHTML = ''; }
