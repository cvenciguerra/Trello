// components.js - Renderização de componentes da UI

import { getData, getLists, getTasks, updateTask, removeTask, addTask, saveHistory } from './storage.js';
import { generateId, formatDate, isOverdue, getPriorityLabel, getCategoryLabel, showToast } from './utils.js';

export function render() {
    const data = getData();
    
    document.documentElement.setAttribute('data-theme', data.isDarkMode ? 'dark' : 'light');
    document.getElementById('themeToggle').innerText = data.isDarkMode ? '☀️' : '🌙';
    document.getElementById('boardTitle').innerText = data.boardTitle;

    // Atualizar estatísticas
    const tasks = getTasks();
    document.getElementById('stat-total').innerText = tasks.length;
    document.getElementById('stat-doing').innerText = tasks.filter(t => t.listId === 'doing').length;
    document.getElementById('stat-done').innerText = tasks.filter(t => t.listId === 'done').length;
    
    const today = new Date();
    today.setHours(0,0,0,0);
    document.getElementById('stat-overdue').innerText = tasks.filter(t => {
        if (!t.date || t.listId === 'done') return false;
        return new Date(t.date) < today;
    }).length;

    renderBoard();
    renderCompleted();
    renderCalendar();
}

export function renderBoard() {
    const data = getData();
    const boardView = document.getElementById('boardView');
    const searchInput = document.getElementById('searchInput').value.toLowerCase();
    const priorityFilter = document.getElementById('priorityFilter').value;
    const categoryFilter = document.getElementById('categoryFilter').value;
    const sortBy = document.getElementById('sortBy').value;

    let filteredTasks = data.tasks.filter(task => {
        const matchesSearch = task.title.toLowerCase().includes(searchInput) || 
                            (task.description && task.description.toLowerCase().includes(searchInput));
        const matchesPriority = priorityFilter === 'all' || task.priority === priorityFilter;
        const matchesCategory = categoryFilter === 'all' || task.category === categoryFilter;
        return matchesSearch && matchesPriority && matchesCategory;
    });

    if (sortBy === 'priority') {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        filteredTasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
    } else if (sortBy === 'date') {
        filteredTasks.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return new Date(a.date) - new Date(b.date);
        });
    } else if (sortBy === 'title') {
        filteredTasks.sort((a, b) => a.title.localeCompare(b.title));
    }

    let html = '';
    data.lists.forEach(list => {
        const listTasks = filteredTasks.filter(t => t.listId === list.id);
        html += `
            <div class="list min-w-[300px] max-w-xs flex flex-col rounded-xl shadow-lg" 
                 style="background: var(--bg-secondary);"
                 ondragover="allowDrop(event)" 
                 ondragleave="dragLeave(event)" 
                 ondrop="drop(event)">
                <div class="p-4 border-b flex justify-between items-center" style="border-color: var(--border);">
                    <h3 class="font-semibold list-title" style="color: var(--text-primary);">${list.name}</h3>
                    <div class="flex gap-2">
                        <button onclick="editListName('${list.id}')" style="color: var(--text-muted);" class="hover:opacity-75 text-sm">✏️</button>
                        <button onclick="deleteList('${list.id}')" style="color: var(--error);" class="hover:opacity-75 text-sm">🗑️</button>
                    </div>
                </div>
                <div class="p-3 flex-1 overflow-y-auto space-y-3" id="list-${list.id}" ondrop="drop(event)">
                    ${listTasks.map(task => createCardHTML(task)).join('')}
                </div>
                <div class="p-3 pt-0">
                    <button onclick="openAddTaskModal('${list.id}')" 
                            class="w-full py-2 rounded-lg transition-colors text-sm font-medium"
                            style="background: var(--bg-tertiary); color: var(--text-primary);">
                        + Adicionar Card
                    </button>
                </div>
            </div>
        `;
    });

    boardView.innerHTML = html;
}

function createCardHTML(task) {
    const isExpired = isOverdue(task.date) && task.listId !== 'done';
    const checklistTotal = task.checklists ? task.checklists.length : 0;
    const checklistDone = task.checklists ? task.checklists.filter(c => c.done).length : 0;
    const checklistProgress = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

    return `
        <div class="card p-4 rounded-lg cursor-pointer shadow-md transition-all hover:shadow-lg relative group"
             style="background: var(--bg-card); border-left: 4px solid var(--${task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'success'});"
             draggable="true"
             ondragstart="drag(event)"
             data-task-id="${task.id}"
             onclick="openCardModal('${task.id}')">
            <div class="flex justify-between items-start mb-2">
                <h4 class="font-medium card-title" style="color: var(--text-primary);">${task.title}</h4>
                <span class="priority-badge px-2 py-1 rounded text-xs font-medium" 
                      style="background: var(--${task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'success'}); color: white;">
                    ${getPriorityLabel(task.priority)}
                </span>
            </div>
            ${task.description ? `<p class="text-sm mb-3 line-clamp-2" style="color: var(--text-secondary);">${task.description}</p>` : ''}
            <div class="flex flex-wrap gap-2 mb-3">
                <span class="category-badge px-2 py-1 rounded text-xs" style="background: var(--bg-tertiary); color: var(--text-primary);">
                    ${getCategoryLabel(task.category)}
                </span>
                ${task.date ? `
                    <span class="date-badge px-2 py-1 rounded text-xs ${isExpired ? 'expired' : ''}" 
                          style="background: ${isExpired ? 'var(--error)' : 'var(--bg-tertiary)'}; color: ${isExpired ? 'white' : 'var(--text-primary)'};">
                        📅 ${formatDate(task.date)}
                    </span>
                ` : ''}
            </div>
            ${checklistTotal > 0 ? `
                <div class="progress-bar w-full h-2 rounded-full mb-2" style="background: var(--bg-tertiary);">
                    <div class="progress-fill h-full rounded-full transition-all" 
                         style="width: ${checklistProgress}%; background: var(--accent);"></div>
                </div>
                <div class="text-xs" style="color: var(--text-secondary);">${checklistDone}/${checklistTotal} itens</div>
            ` : ''}
            ${task.timeSpent > 0 ? `
                <div class="mt-2 text-xs font-mono" style="color: var(--text-secondary);">
                    ⏱️ ${formatTime(task.timeSpent)}
                </div>
            ` : ''}
        </div>
    `;
}

export function renderCompleted() {
    const data = getData();
    const completedTasks = data.tasks.filter(t => t.listId === 'done');
    const container = document.getElementById('completedTasks');

    if (completedTasks.length === 0) {
        container.innerHTML = `<p class="text-center py-8" style="color: var(--text-secondary);">Nenhuma tarefa concluída ainda.</p>`;
        return;
    }

    container.innerHTML = completedTasks.map(task => `
        <div class="card p-4 rounded-lg shadow-md flex justify-between items-center"
             style="background: var(--bg-card);">
            <div class="flex-1">
                <h4 class="font-medium" style="color: var(--text-primary); text-decoration: line-through; opacity: 0.7;">${task.title}</h4>
                <div class="flex gap-2 mt-2">
                    <span class="text-xs" style="color: var(--text-secondary);">
                        ${getCategoryLabel(task.category)}
                    </span>
                    ${task.date ? `<span class="text-xs" style="color: var(--text-secondary);">Concluída em: ${formatDate(task.completedAt)}</span>` : ''}
                </div>
            </div>
            <div class="flex gap-2">
                <button onclick="reopenTask('${task.id}')" 
                        class="px-3 py-1 rounded text-sm font-medium"
                        style="background: var(--accent); color: white;">
                    Reabrir
                </button>
                <button onclick="deleteCard('${task.id}')" 
                        class="px-3 py-1 rounded text-sm font-medium"
                        style="background: var(--error); color: white;">
                    Excluir
                </button>
            </div>
        </div>
    `).join('');
}

export function renderCalendar() {
    const data = getData();
    const tasksWithDates = data.tasks.filter(t => t.date && t.listId !== 'done');
    const container = document.getElementById('calendarTasks');

    if (tasksWithDates.length === 0) {
        container.innerHTML = `<p class="text-center py-8" style="color: var(--text-secondary);">Nenhuma tarefa com data definida.</p>`;
        return;
    }

    // Agrupar tarefas por mês
    const tasksByMonth = {};
    tasksWithDates.forEach(task => {
        const date = new Date(task.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!tasksByMonth[monthKey]) {
            tasksByMonth[monthKey] = [];
        }
        tasksByMonth[monthKey].push(task);
    });

    const sortedMonths = Object.keys(tasksByMonth).sort();
    
    container.innerHTML = sortedMonths.map(month => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
        
        return `
            <div class="mb-6">
                <h3 class="text-lg font-semibold mb-3 capitalize" style="color: var(--text-primary);">${monthName}</h3>
                <div class="space-y-2">
                    ${tasksByMonth[month].map(task => `
                        <div class="card p-3 rounded-lg flex justify-between items-center"
                             style="background: var(--bg-card);">
                            <div class="flex items-center gap-3">
                                <span class="date-badge px-3 py-1 rounded text-sm font-medium"
                                      style="background: var(--${task.priority === 'high' ? 'error' : task.priority === 'medium' ? 'warning' : 'success'}); color: white;">
                                    ${new Date(task.date).getDate()}
                                </span>
                                <span style="color: var(--text-primary);">${task.title}</span>
                            </div>
                            <span class="text-xs" style="color: var(--text-secondary);">
                                ${getCategoryLabel(task.category)}
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
}

export function populateListSelect(selectId, selectedListId = null) {
    const lists = getLists();
    const select = document.getElementById(selectId);
    select.innerHTML = lists.map(list => 
        `<option value="${list.id}" ${selectedListId === list.id ? 'selected' : ''}>${list.name}</option>`
    ).join('');
}

export function updateCardModal(task) {
    document.getElementById('cardModalTitle').innerText = task.title;
    document.getElementById('cardDesc').value = task.description || '';
    document.getElementById('cardCategory').value = task.category;
    document.getElementById('cardPriority').value = task.priority;
    document.getElementById('cardDate').value = task.date || '';
    document.getElementById('timeDisplay').innerText = formatTime(task.timeSpent || 0);
    
    // Render checklists
    const checklistsContainer = document.getElementById('checklistsList');
    if (task.checklists && task.checklists.length > 0) {
        checklistsContainer.innerHTML = task.checklists.map((item, index) => `
            <div class="flex items-center gap-2">
                <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklist(${index})" class="rounded">
                <span class="flex-1" style="color: var(--text-primary); text-decoration: ${item.done ? 'line-through' : 'none'};">${item.text}</span>
                <button onclick="deleteChecklistItem(${index})" style="color: var(--error);" class="text-sm hover:opacity-75">🗑️</button>
            </div>
        `).join('');
    } else {
        checklistsContainer.innerHTML = '<p class="text-sm" style="color: var(--text-secondary);">Nenhum item na checklist.</p>';
    }

    // Render comments
    const commentsContainer = document.getElementById('commentsList');
    if (task.comments && task.comments.length > 0) {
        commentsContainer.innerHTML = task.comments.map(comment => `
            <div class="p-2 rounded" style="background: var(--bg-tertiary);">
                <p class="text-sm" style="color: var(--text-primary);">${comment.text}</p>
                <span class="text-xs" style="color: var(--text-secondary);">${formatDate(comment.date)}</span>
            </div>
        `).join('');
    } else {
        commentsContainer.innerHTML = '<p class="text-sm" style="color: var(--text-secondary);">Nenhum comentário.</p>';
    }
}
