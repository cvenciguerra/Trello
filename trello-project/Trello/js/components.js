// components.js - Renderização de componentes da UI

import { getData, getLists, getTasks, updateTask, removeTask, addTask, saveHistory } from './storage.js';
import { generateId, formatDate, formatTime, isOverdue, getPriorityLabel, getCategoryLabel, showToast } from './utils.js';

// Variáveis globais para os gráficos
let statusChartInstance = null;
let productivityChartInstance = null;
let priorityChartInstance = null;

export function render() {
    const data = getData();
    
    document.documentElement.setAttribute('data-theme', data.isDarkMode ? 'dark' : 'light');
    document.getElementById('themeToggle').innerText = data.isDarkMode ? '☀️' : '🌙';
    document.getElementById('boardTitle').innerText = data.boardTitle;

    // Atualizar estatísticas (mini stats)
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

    // Renderizar gráficos apenas se a view dashboard estiver visível
    const dashboardView = document.getElementById('dashboardView');
    if (dashboardView && !dashboardView.classList.contains('hidden')) {
        renderCharts();
    }

    renderBoard();
    renderCompleted();
    // renderCalendar() é chamado apenas quando necessário em main.js
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
    // A função renderCalendar agora está em main.js para melhor controle do estado do calendário
    // Esta função stub é mantida para compatibilidade de importação
}

// Função real de renderização do calendário (exportada para uso em main.js)
export function renderCalendarView(currentDateObj, selectedDateObj) {
    const grid = document.getElementById('calendarGrid');
    const monthYearEl = document.getElementById('currentMonthYear');
    const tasksContainer = document.getElementById('calendarTasks');
    
    if (!grid || !monthYearEl) return;
    
    const year = currentDateObj.getFullYear();
    const month = currentDateObj.getMonth();
    
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
        const isSelected = date.toDateString() === selectedDateObj.toDateString();
        
        const dayEl = document.createElement('div');
        dayEl.className = `min-h-[80px] p-2 rounded-lg cursor-pointer border transition-all ${
            isSelected 
                ? 'ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/20' 
                : 'hover:bg-gray-100 dark:hover:bg-gray-700'
        } ${isToday ? 'bg-blue-100 dark:bg-blue-800/30' : 'bg-white dark:bg-gray-800'}`;
        dayEl.style.borderColor = 'var(--border)';
        dayEl.onclick = () => window.selectDate(dateStr);
        
        const dayNum = document.createElement('span');
        dayNum.className = `text-sm font-medium ${isToday ? 'text-blue-600 dark:text-blue-400' : ''}`;
        dayNum.style.color = isToday ? '' : 'var(--text-primary)';
        dayNum.textContent = day;
        dayEl.appendChild(dayNum);
        
        // Tarefas do dia (mostrar apenas as 3 primeiras)
        const maxVisible = 3;
        dayTasks.slice(0, maxVisible).forEach(task => {
            const taskEl = document.createElement('div');
            taskEl.className = 'mt-1 text-xs px-2 py-1 rounded truncate cursor-pointer';
            taskEl.style.background = task.priority === 'high' ? 'rgba(239, 68, 68, 0.2)' : 
                                     task.priority === 'medium' ? 'rgba(245, 158, 11, 0.2)' : 
                                     'rgba(34, 197, 94, 0.2)';
            taskEl.style.color = 'var(--text-primary)';
            taskEl.textContent = task.title;
            taskEl.onclick = (e) => { e.stopPropagation(); window.openCardModal(task.id); };
            dayEl.appendChild(taskEl);
        });
        
        // Indicador de mais tarefas
        if (dayTasks.length > maxVisible) {
            const moreEl = document.createElement('div');
            moreEl.className = 'mt-1 text-xs text-center font-medium';
            moreEl.style.color = 'var(--text-secondary)';
            moreEl.textContent = `+${dayTasks.length - maxVisible} mais`;
            dayEl.appendChild(moreEl);
        }
        
        grid.appendChild(dayEl);
    }
    
    // Renderizar tarefas do dia selecionado
    if (tasksContainer) {
        tasksContainer.innerHTML = '';
        const selectedDateStr = selectedDateObj.toISOString().split('T')[0];
        const selectedTasks = allTasks.filter(t => t.date && t.date.startsWith(selectedDateStr));
        
        const titleEl = document.createElement('h3');
        titleEl.className = 'text-lg font-semibold mb-4';
        titleEl.style.color = 'var(--text-primary)';
        titleEl.textContent = `Tarefas para ${selectedDateObj.toLocaleDateString('pt-BR')}`;
        tasksContainer.appendChild(titleEl);
        
        if (selectedTasks.length === 0) {
            const emptyEl = document.createElement('p');
            emptyEl.className = 'text-center py-8';
            emptyEl.style.color = 'var(--text-secondary)';
            emptyEl.textContent = 'Nenhuma tarefa para este dia.';
            tasksContainer.appendChild(emptyEl);
        } else {
            selectedTasks.forEach(task => {
                const taskEl = document.createElement('div');
                taskEl.className = 'p-4 rounded-lg border hover:shadow-md transition-shadow cursor-pointer';
                taskEl.style.borderColor = 'var(--border)';
                taskEl.style.background = 'var(--bg-card)';
                taskEl.onclick = () => window.openCardModal(task.id);
                
                const statusBadge = task.listId === 'done' ? '<span class="ml-2 px-2 py-1 text-xs rounded bg-green-100 text-green-800">✓ Concluída</span>' :
                                   task.listId === 'doing' ? '<span class="ml-2 px-2 py-1 text-xs rounded bg-yellow-100 text-yellow-800">⋯ Em Progresso</span>' : '';
                
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

// Função para renderizar os gráficos do dashboard
export function renderCharts() {
    const tasks = getTasks();
    const data = getData();
    
    // Cores baseadas no tema
    const isDark = data.isDarkMode;
    const textColor = isDark ? '#e5e7eb' : '#374151';
    const gridColor = isDark ? '#374151' : '#e5e7eb';
    
    // 1. Gráfico de Status (Doughnut)
    const statusCtx = document.getElementById('statusChart');
    if (statusCtx) {
        const todoCount = tasks.filter(t => t.listId === 'todo').length;
        const doingCount = tasks.filter(t => t.listId === 'doing').length;
        const doneCount = tasks.filter(t => t.listId === 'done').length;
        
        if (statusChartInstance) {
            statusChartInstance.destroy();
        }
        
        statusChartInstance = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['A Fazer', 'Em Progresso', 'Concluídas'],
                datasets: [{
                    data: [todoCount, doingCount, doneCount],
                    backgroundColor: ['#f59e0b', '#3b82f6', '#10b981'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: textColor }
                    }
                }
            }
        });
    }
    
    // 2. Gráfico de Produtividade (Line - últimos 30 dias)
    const prodCtx = document.getElementById('productivityChart');
    if (prodCtx) {
        const last30Days = [];
        const completedPerDay = [];
        
        for (let i = 29; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            date.setHours(0, 0, 0, 0);
            last30Days.push(date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }));
            
            const count = tasks.filter(t => {
                if (!t.completedAt) return false;
                const taskDate = new Date(t.completedAt);
                taskDate.setHours(0, 0, 0, 0);
                return taskDate.getTime() === date.getTime();
            }).length;
            completedPerDay.push(count);
        }
        
        if (productivityChartInstance) {
            productivityChartInstance.destroy();
        }
        
        productivityChartInstance = new Chart(prodCtx, {
            type: 'line',
            data: {
                labels: last30Days,
                datasets: [{
                    label: 'Tarefas Concluídas',
                    data: completedPerDay,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    fill: true,
                    tension: 0.4,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor, maxRotation: 45 },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        mode: 'index',
                        intersect: false
                    }
                }
            }
        });
    }
    
    // 3. Gráfico de Prioridade (Bar)
    const prioCtx = document.getElementById('priorityChart');
    if (prioCtx) {
        const highCount = tasks.filter(t => t.priority === 'high').length;
        const mediumCount = tasks.filter(t => t.priority === 'medium').length;
        const lowCount = tasks.filter(t => t.priority === 'low').length;
        
        if (priorityChartInstance) {
            priorityChartInstance.destroy();
        }
        
        priorityChartInstance = new Chart(prioCtx, {
            type: 'bar',
            data: {
                labels: ['Alta 🔴', 'Média 🟡', 'Baixa 🟢'],
                datasets: [{
                    label: 'Tarefas por Prioridade',
                    data: [highCount, mediumCount, lowCount],
                    backgroundColor: ['#ef4444', '#f59e0b', '#10b981'],
                    borderRadius: 8
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: textColor },
                        grid: { color: gridColor }
                    },
                    x: {
                        ticks: { color: textColor },
                        grid: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }
    
    // 4. Heatmap de Atividade Anual
    renderHeatmap(tasks, isDark, textColor);
}

// Função para renderizar o heatmap estilo GitHub
function renderHeatmap(tasks, isDark, textColor) {
    const container = document.getElementById('heatmapContainer');
    if (!container) return;
    
    const today = new Date();
    const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthLabels = [];
    for (let i = 0; i < 12; i++) {
        monthLabels.push(months[i]);
    }
    
    // Calcular dados dos últimos 365 dias
    const dayData = {};
    const startOfDay = new Date(today);
    startOfDay.setDate(startOfDay.getDate() - 364);
    startOfDay.setHours(0, 0, 0, 0);
    
    // Inicializar todos os dias com 0
    for (let i = 0; i < 365; i++) {
        const date = new Date(startOfDay);
        date.setDate(date.getDate() + i);
        const dateStr = date.toISOString().split('T')[0];
        dayData[dateStr] = 0;
    }
    
    // Contar tarefas concluídas por dia
    tasks.forEach(task => {
        if (task.completedAt) {
            const dateStr = new Date(task.completedAt).toISOString().split('T')[0];
            if (dayData.hasOwnProperty(dateStr)) {
                dayData[dateStr]++;
            }
        }
    });
    
    // Função para obter cor baseada na contagem
    function getColor(count) {
        if (count === 0) return isDark ? '#161b22' : '#ebedf0';
        if (count <= 2) return isDark ? '#0e4429' : '#9be9a8';
        if (count <= 4) return isDark ? '#006d32' : '#40c463';
        if (count <= 6) return isDark ? '#26a641' : '#30a14e';
        return isDark ? '#39d353' : '#216e39';
    }
    
    // Gerar HTML do heatmap
    let html = '<div class="flex gap-2">';
    html += '<div class="flex flex-col justify-between text-xs py-2" style="color: ' + textColor + ';">';
    monthLabels.forEach(m => html += `<div class="h-3 mb-1">${m}</div>`);
    html += '</div>';
    
    html += '<div class="grid grid-cols-[repeat(53,minmax(0,12px))] gap-[3px]">';
    
    for (let week = 0; week < 53; week++) {
        html += '<div class="flex flex-col gap-[3px]">';
        for (let day = 0; day < 7; day++) {
            const date = new Date(startOfDay);
            date.setDate(date.getDate() + (week * 7) + day);
            if (date > today) {
                html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#161b22' : '#ebedf0'};"></div>`;
            } else {
                const dateStr = date.toISOString().split('T')[0];
                const count = dayData[dateStr] || 0;
                const color = getColor(count);
                html += `<div class="w-3 h-3 rounded-sm" style="background: ${color};" title="${date.toLocaleDateString('pt-BR')}: ${count} tarefas"></div>`;
            }
        }
        html += '</div>';
    }
    
    html += '</div></div>';
    
    // Legenda
    html += '<div class="flex items-center gap-2 mt-4 text-xs" style="color: ' + textColor + ';">';
    html += '<span>Menos</span>';
    html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#161b22' : '#ebedf0'};"></div>`;
    html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#0e4429' : '#9be9a8'};"></div>`;
    html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#006d32' : '#40c463'};"></div>`;
    html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#26a641' : '#30a14e'};"></div>`;
    html += `<div class="w-3 h-3 rounded-sm" style="background: ${isDark ? '#39d353' : '#216e39'};"></div>`;
    html += '<span>Mais</span>';
    html += '</div>';
    
    container.innerHTML = html;
}
