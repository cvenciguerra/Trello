// main.js - Ponto de entrada principal da aplicação
import { migrateData, getData, getLists, getTasks, addTask, updateTask, removeTask, addList, removeList, updateList, updateBoardTitle, toggleDarkMode as toggleDark, clearAllData as clearData, importData } from './storage.js';
import { generateId, formatDate, formatTime, getPriorityLabel, debounce, showToast, confirmAction, downloadJSON } from './utils.js';
import { render, populateListSelect, updateCardModal } from './components.js';

let currentCardId = null;
let isDragging = false;
let timerInterval = null;

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
    window.deleteCard = () => { if(confirmAction('Excluir card?')) { removeTask(currentCardId); closeCardModal(); render(); showToast('Card excluído!', 'success'); }};
    window.editBoardTitle = () => { const title = prompt('Nome do quadro:', getData().boardTitle); if(title) { updateBoardTitle(title); render(); }};
    window.reopenTask = (taskId) => { updateTask(taskId, {listId: 'todo'}); render(); };
    window.markAsComplete = () => { updateTask(currentCardId, {listId: 'done', completedAt: new Date().toISOString()}); closeCardModal(); render(); showToast('Concluída! 🎉', 'success'); };
    window.allowDrop = (ev) => { ev.preventDefault(); ev.currentTarget.style.background = 'var(--bg-tertiary)'; };
    window.dragLeave = (ev) => { ev.currentTarget.style.background = 'var(--bg-secondary)'; };
    window.drag = (ev) => { ev.dataTransfer.setData('taskId', ev.target.closest('.card').dataset.taskId); isDragging = true; };
    window.drop = drop;
    window.downloadBackup = () => { downloadJSON(getData(), `focusboard-backup-${new Date().toISOString().split('T')[0]}.json`); showToast('Backup realizado!', 'success'); };
    window.uploadBackup = uploadBackup;
    window.clearFilters = () => { document.getElementById('searchInput').value = ''; document.getElementById('priorityFilter').value = 'all'; document.getElementById('categoryFilter').value = 'all'; document.getElementById('sortBy').value = 'order'; render(); };
    window.showTemplates = showTemplates;
    window.requestNotifications = requestNotifications;
    window.exportPDF = exportPDF;
}

function setView(view) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.getElementById(`tab-${view}`).classList.add('active');
    document.getElementById('boardView').classList.toggle('hidden', view !== 'board');
    document.getElementById('completedView').classList.toggle('hidden', view !== 'completed');
    document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');
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

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
