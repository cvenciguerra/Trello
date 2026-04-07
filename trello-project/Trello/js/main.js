// main.js - Ponto de entrada principal da aplicação
import { migrateData, getData, getLists, getTasks, addTask, updateTask, removeTask, addList, removeList, updateList, updateBoardTitle, toggleDarkMode as toggleDark, clearAllData as clearData, importData } from './storage.js';
import { generateId, formatDate, formatTime, getPriorityLabel, debounce, showToast, confirmAction, downloadJSON } from './utils.js';
import { render, populateListSelect, updateCardModal, renderCalendarView } from './components.js';

let currentCardId = null;
let isDragging = false;
let timerInterval = null;
let selectedDate = new Date(); // Para o calendário
let currentDate = new Date(); // Para navegação do calendário

export function init() {
    migrateData();
    setupEventListeners();
    render();
    exposeFunctions();
}

function setupEventListeners() {
    document.getElementById('searchInput').addEventListener('input', debounce(render, 300));
    document.getElementById('priorityFilter').addEventListener('change', render);
    document.getElementById('categoryFilter').addEventListener('change', render);
    document.getElementById('sortBy').addEventListener('change', render);
    document.addEventListener('keydown', handleKeyboardShortcuts);
}

function handleKeyboardShortcuts(e) {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    if (e.key === 'n') { e.preventDefault(); openAddTaskModal('todo'); }
    if (e.key === 'Escape') { e.preventDefault(); closeAddTaskModal(); closeCardModal(); }
    if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
    if (e.ctrlKey && e.key === 'z') { e.preventDefault(); window.undo(); }
    if (e.ctrlKey && e.key === 'y') { e.preventDefault(); window.redo(); }
}

function exposeFunctions() {
    window.setView = setView;
    window.toggleDarkMode = () => { toggleDark(); render(); showToast(getData().isDarkMode ? 'Modo escuro ativado' : 'Modo claro ativado', 'info'); };
    window.clearAllData = () => { if(confirmAction('Tem certeza?')) { clearData(); render(); showToast('Dados limpos!', 'success'); }};
    window.addList = () => { const name = prompt('Nome da lista:'); if(name) { addList({id: generateId(), name}); render(); showToast('Lista criada!', 'success'); }};
    window.editListName = (listId) => { const list = getLists().find(l => l.id === listId); const newName = prompt('Novo nome:', list.name); if(newName) { updateList(listId, {name: newName}); render(); }};
    window.deleteList = (listId) => { if(confirmAction('Excluir lista?')) { removeList(listId); render(); showToast('Lista excluída!', 'success'); }};
    window.openAddTaskModal = openAddTaskModal;
    window.closeAddTaskModal = closeAddTaskModal;
    window.createTask = createTask;
    window.openCardModal = (taskId) => { currentCardId = taskId; updateCardModal(getTasks().find(t => t.id === taskId)); document.getElementById('cardModal').classList.remove('hidden'); document.getElementById('cardModal').classList.add('flex'); };
    window.closeCardModal = () => { document.getElementById('cardModal').classList.add('hidden'); document.getElementById('cardModal').classList.remove('flex'); currentCardId = null; };
    window.updateCardDesc = () => { updateTask(currentCardId, {description: document.getElementById('cardDesc').value}); showToast('Atualizado!', 'success'); };
    window.updateCardCategory = () => { updateTask(currentCardId, {category: document.getElementById('cardCategory').value}); render(); };
    window.updateCardPriority = () => { updateTask(currentCardId, {priority: document.getElementById('cardPriority').value}); render(); };
    window.updateCardDate = () => { updateTask(currentCardId, {date: document.getElementById('cardDate').value}); render(); };
    window.addChecklistItem = addChecklistItem;
    window.toggleChecklist = toggleChecklist;
    window.deleteChecklistItem = deleteChecklistItem;
    window.addComment = addComment;
    window.toggleTimeTracking = toggleTimeTracking;
    window.duplicateCard = duplicateCard;
    window.deleteCard = (taskId) => { const id = taskId || currentCardId; if(confirmAction('Excluir card?')) { removeTask(id); closeCardModal(); render(); showToast('Card excluído!', 'success'); }};
    window.editBoardTitle = () => { const title = prompt('Nome do quadro:', getData().boardTitle); if(title) { updateBoardTitle(title); render(); }};
    window.reopenTask = (taskId) => { updateTask(taskId, {listId: 'todo'}); render(); };
    window.markAsComplete = () => { updateTask(currentCardId, {listId: 'done', completedAt: new Date().toISOString()}); closeCardModal(); render(); showToast('Concluída! 🎉', 'success'); };
    window.allowDrop = (ev) => { ev.preventDefault(); ev.currentTarget.style.background = 'var(--bg-tertiary)'; };
    window.dragLeave = (ev) => { ev.currentTarget.style.background = 'var(--bg-secondary)'; };
    window.drag = (ev) => { ev.dataTransfer.setData('taskId', ev.target.closest('.card').dataset.taskId); isDragging = true; ev.target.closest('.card').classList.add('dragging'); };
    window.drop = drop;
    window.downloadBackup = () => { downloadJSON(getData(), `focusboard-backup-${new Date().toISOString().split('T')[0]}.json`); showToast('Backup realizado!', 'success'); };
    window.uploadBackup = uploadBackup;
    window.clearFilters = () => { document.getElementById('searchInput').value = ''; document.getElementById('priorityFilter').value = 'all'; document.getElementById('categoryFilter').value = 'all'; document.getElementById('sortBy').value = 'order'; render(); };
    window.showTemplates = showTemplates;
    window.requestNotifications = requestNotifications;
    window.exportPDF = exportPDF;
    window.changeMonth = changeMonth;
    window.selectDate = selectDate;
}

function setView(view) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${view}`).classList.add('active');
    document.getElementById('boardView').classList.toggle('hidden', view !== 'board');
    document.getElementById('completedView').classList.toggle('hidden', view !== 'completed');
    document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');
    document.getElementById('dashboardView').classList.toggle('hidden', view !== 'dashboard');
    document.getElementById('miniStats').classList.toggle('hidden', view !== 'board');
    render();
}

function openAddTaskModal(listId) {
    currentCardId = null;
    document.getElementById('newTaskTitle').value = '';
    document.getElementById('newTaskDesc').value = '';
    document.getElementById('newTaskDate').value = '';
    populateListSelect('newTaskList', listId);
    document.getElementById('addTaskModal').classList.remove('hidden');
    document.getElementById('addTaskModal').classList.add('flex');
    document.getElementById('newTaskTitle').focus();
}

function closeAddTaskModal() {
    document.getElementById('addTaskModal').classList.add('hidden');
    document.getElementById('addTaskModal').classList.remove('flex');
}

function createTask() {
    const title = document.getElementById('newTaskTitle').value.trim();
    if (!title) { showToast('Digite um título!', 'error'); return; }
    addTask({
        id: generateId(), title,
        description: document.getElementById('newTaskDesc').value.trim(),
        category: document.getElementById('newTaskCategory').value,
        priority: document.getElementById('newTaskPriority').value,
        date: document.getElementById('newTaskDate').value || null,
        listId: document.getElementById('newTaskList').value,
        comments: [], checklists: [], timeSpent: 0, order: getTasks().length, createdAt: Date.now()
    });
    closeAddTaskModal();
    render();
    showToast('Card criado!', 'success');
}

function addChecklistItem() {
    const text = document.getElementById('checklistInput').value.trim();
    if (!text) return;
    const task = getTasks().find(t => t.id === currentCardId);
    if (!task.checklists) task.checklists = [];
    task.checklists.push({text, done: false});
    updateTask(currentCardId, {checklists: task.checklists});
    document.getElementById('checklistInput').value = '';
    updateCardModal(task);
}

function toggleChecklist(index) {
    const task = getTasks().find(t => t.id === currentCardId);
    task.checklists[index].done = !task.checklists[index].done;
    updateTask(currentCardId, {checklists: task.checklists});
    updateCardModal(task);
    render();
}

function deleteChecklistItem(index) {
    const task = getTasks().find(t => t.id === currentCardId);
    task.checklists.splice(index, 1);
    updateTask(currentCardId, {checklists: task.checklists});
    updateCardModal(task);
}

function addComment() {
    const text = document.getElementById('commentInput').value.trim();
    if (!text) return;
    const task = getTasks().find(t => t.id === currentCardId);
    if (!task.comments) task.comments = [];
    task.comments.push({text, date: new Date().toISOString()});
    updateTask(currentCardId, {comments: task.comments});
    document.getElementById('commentInput').value = '';
    updateCardModal(task);
}

function toggleTimeTracking() {
    const task = getTasks().find(t => t.id === currentCardId);
    if (!task) return;
    if (task.isTracking) {
        task.isTracking = false;
        updateTask(currentCardId, {isTracking: false});
        document.getElementById('timeBtn').innerText = 'Iniciar';
    } else {
        getTasks().forEach(t => { if(t.isTracking) { t.isTracking = false; updateTask(t.id, {isTracking: false}); }});
        task.isTracking = true;
        updateTask(currentCardId, {isTracking: true});
        document.getElementById('timeBtn').innerText = 'Pausar';
        if (!timerInterval) {
            timerInterval = setInterval(() => { getTasks().forEach(t => { if(t.isTracking) t.timeSpent++; }); 
                if(currentCardId) { const t = getTasks().find(x => x.id === currentCardId); if(t) document.getElementById('timeDisplay').innerText = formatTime(t.timeSpent); }
            }, 1000);
        }
    }
    updateCardModal(getTasks().find(t => t.id === currentCardId));
}

function duplicateCard() {
    const task = getTasks().find(t => t.id === currentCardId);
    if (task) {
        addTask({...task, id: generateId(), title: task.title + ' (Cópia)', createdAt: Date.now(), comments: [], checklists: [], timeSpent: 0, isTracking: false});
        closeCardModal();
        render();
        showToast('Card duplicado!', 'success');
    }
}

function drop(ev) {
    ev.preventDefault();
    ev.currentTarget.style.background = 'var(--bg-secondary)';
    if (!isDragging) return;
    const taskId = ev.dataTransfer.getData('taskId');
    const listId = ev.currentTarget.closest('.list').id.replace('list-', '');
    const task = getTasks().find(t => t.id === taskId);
    if (task && task.listId !== listId) {
        updateTask(taskId, {listId});
        render();
        showToast('Card movido!', 'success');
    }
    isDragging = false;
}

function uploadBackup(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            try { importData(JSON.parse(e.target.result)); render(); showToast('Backup restaurado!', 'success'); }
            catch (err) { showToast('Arquivo inválido!', 'error'); }
        };
        reader.readAsText(file);
    }
    event.target.value = '';
}

function showTemplates() {
    const templates = [
        {name: '📋 Projeto Simples', lists: ['A Fazer', 'Em Progresso', 'Concluído']},
        {name: '🐛 Bug Tracking', lists: ['Reportado', 'Em Análise', 'Em Correção', 'Testes', 'Resolvido']},
        {name: '📝 Conteúdo', lists: ['Ideias', 'Rascunho', 'Revisão', 'Publicado']},
        {name: '🏃 Sprint', lists: ['Backlog', 'To Do', 'Doing', 'Review', 'Done']}
    ];
    const choice = prompt(`Escolha um template:\n${templates.map((t,i)=>`${i+1}. ${t.name}`).join('\n')}\n\nNúmero:`);
    if (choice && templates[choice-1]) {
        const data = getData();
        const emojis = {'A Fazer':'📋 A Fazer','Em Progresso':'⏳ Em Progresso','Concluído':'✅ Concluído','Ideias':'💡 Ideias','Rascunho':'✏️ Rascunho','Revisão':'👀 Revisão','Publicado':'📢 Publicado','Backlog':'📦 Backlog','To Do':'📝 To Do','Doing':'🔨 Doing','Review':'🔍 Review','Done':'✨ Done','Reportado':'🐛 Reportado','Em Análise':'🔬 Em Análise','Em Correção':'🔧 Em Correção','Testes':'🧪 Testes','Resolvido':'✅ Resolvido'};
        data.lists = templates[choice-1].lists.map((name,i) => ({id: ['todo','doing','review','done'][i]||generateId(), name: emojis[name]||name}));
        localStorage.setItem('kanban_v5', JSON.stringify(data));
        render();
        showToast(`Template aplicado!`, 'success');
    }
}

function requestNotifications() {
    if ('Notification' in window) {
        Notification.requestPermission().then(p => {
            if (p === 'granted') { showToast('Notificações ativadas!', 'success'); new Notification('FocusBoard', {body: 'Alertas ativados!'}); }
            else { showToast('Notificações negadas', 'warning'); }
        });
    } else { showToast('Navegador não suporta notificações', 'error'); }
}

function exportPDF() {
    const data = getData();
    let content = `<h1>${data.boardTitle}</h1>`;
    data.lists.forEach(list => {
        content += `<h2>${list.name}</h2>`;
        data.tasks.filter(t => t.listId === list.id).forEach(task => {
            content += `<div style="border:1px solid #ddd;padding:10px;margin:5px 0;border-left:4px solid ${task.priority==='high'?'#ef4444':task.priority==='medium'?'#f59e0b':'#10b981'}"><strong>${task.title}</strong>${task.description?`<p>${task.description}</p>`:''}<small>${task.category} • ${getPriorityLabel(task.priority)}${task.date?' • '+formatDate(task.date):''}</small></div>`;
        });
    });
    const w = window.open('','_blank');
    w.document.write(`<html><head><title>${data.boardTitle}</title></head><body style="font-family:Arial;padding:20px">${content}</body><script>setTimeout(()=>{print();close();},500)<\/script></html>`);
    w.document.close();
}

// Funções do Calendário
window.changeMonth = function(delta) {
    currentDate.setMonth(currentDate.getMonth() + delta);
    renderCalendarView(currentDate, selectedDate);
}

window.selectDate = function(dateStr) {
    selectedDate = new Date(dateStr);
    renderCalendarView(currentDate, selectedDate);
}

function renderCalendar() {
    const grid = document.getElementById('calendarGrid');
    const monthYearEl = document.getElementById('currentMonthYear');
    const tasksContainer = document.getElementById('calendarTasks');
    
    if (!grid || !monthYearEl) return;
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    // Atualiza título do mês
    const monthNames = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
    monthYearEl.textContent = `${monthNames[month]} ${year}`;
    
    // Dias da semana
    const weekDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    
    // Limpa grid
    grid.innerHTML = '';
    
    // Adiciona cabeçalho dos dias
    weekDays.forEach(day => {
        const dayEl = document.createElement('div');
        dayEl.className = 'text-center font-semibold py-2 text-sm';
        dayEl.style.color = 'var(--text-primary)';
        dayEl.textContent = day;
        grid.appendChild(dayEl);
    });
    
    // Primeiro dia do mês e total de dias
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    // Dias vazios antes do primeiro dia
    for (let i = 0; i < firstDay; i++) {
        const emptyEl = document.createElement('div');
        grid.appendChild(emptyEl);
    }
    
    // Dias do mês
    const allTasks = getTasks();
    const today = new Date();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dateStr = date.toISOString().split('T')[0];
        const dayTasks = allTasks.filter(t => t.date && t.date.startsWith(dateStr));
        
        const isToday = date.toDateString() === today.toDateString();
        const isSelected = date.toDateString() === selectedDate.toDateString();
        
        const dayEl = document.createElement('div');
        dayEl.className = `min-h-[80px] p-2 rounded-lg cursor-pointer border transition-all ${
            isSelected 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        } ${isToday ? 'bg-blue-100 dark:bg-blue-800/30' : 'bg-white dark:bg-gray-800'}`;
        dayEl.style.borderColor = 'var(--border)';
        dayEl.onclick = () => selectDate(dateStr);
        
        const dayNum = document.createElement('span');
        dayNum.className = `text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`;
        dayNum.style.color = isToday ? '' : 'var(--text-primary)';
        dayNum.textContent = day;
        dayEl.appendChild(dayNum);
        
        if (dayTasks.length > 0) {
            const taskCount = document.createElement('div');
            taskCount.className = 'mt-1 flex flex-wrap gap-1';
            
            const maxVisible = 3;
            dayTasks.slice(0, maxVisible).forEach(task => {
                const pill = document.createElement('span');
                pill.className = 'text-xs px-2 py-1 rounded-full truncate max-w-full';
                const priorityColors = {
                    'high': 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-200',
                    'medium': 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200',
                    'low': 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200'
                };
                pill.className += ` ${priorityColors[task.priority] || priorityColors['low']}`;
                pill.textContent = task.title.substring(0, 15) + (task.title.length > 15 ? '...' : '');
                pill.onclick = (e) => { e.stopPropagation(); openCardModal(task.id); };
                taskCount.appendChild(pill);
            });
            
            if (dayTasks.length > maxVisible) {
                const more = document.createElement('span');
                more.className = 'text-xs text-gray-500 dark:text-gray-400';
                more.textContent = `+${dayTasks.length - maxVisible} mais`;
                taskCount.appendChild(more);
            }
            
            dayEl.appendChild(taskCount);
        }
        
        grid.appendChild(dayEl);
    }
    
    // Renderiza tarefas do dia selecionado
    const selectedStr = selectedDate.toISOString().split('T')[0];
    const selectedTasks = allTasks.filter(t => t.date && t.date.startsWith(selectedStr));
    
    if (tasksContainer) {
        if (selectedTasks.length === 0) {
            tasksContainer.innerHTML = '<p class="text-center py-8" style="color: var(--text-secondary);">Nenhuma tarefa para este dia.</p>';
        } else {
            tasksContainer.innerHTML = `<h3 class="text-lg font-semibold mb-3" style="color: var(--text-primary);">Tarefas em ${formatDate(selectedStr)}</h3>`;
            selectedTasks.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = 'card p-4 rounded-lg shadow cursor-pointer hover:shadow-md transition-shadow';
                taskEl.style.background = 'var(--bg-secondary)';
                taskEl.style.borderLeft = `4px solid ${task.priority === 'high' ? '#ef4444' : task.priority === 'medium' ? '#f59e0b' : '#10b981'}`;
                taskEl.onclick = () => openCardModal(task.id);
                
                const statusBadge = task.listId === 'done' 
                    ? '<span class="ml-2 px-2 py-1 text-xs bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 rounded">✓ Concluída</span>'
                    : '';
                
                taskEl.innerHTML = `
                    <div class="flex justify-between items-start">
                        <h4 class="font-medium" style="color: var(--text-primary);">${task.title}${statusBadge}</h4>
                        <span class="text-xs px-2 py-1 rounded" style="background: var(--bg-tertiary); color: var(--text-secondary);">${task.category}</span>
                    </div>
                    <div class="mt-2 flex items-center space-x-3 text-sm" style="color: var(--text-secondary);">
                        <span>🎯 ${getPriorityLabel(task.priority)}</span>
                        ${task.timeSpent > 0 ? `<span>⏱️ ${formatTime(task.timeSpent)}</span>` : ''}
                    </div>
                `;
                tasksContainer.appendChild(taskEl);
            });
        }
    }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
