        let data = JSON.parse(localStorage.getItem('kanban_v5')) || {
            boardTitle: 'FocusBoard',
            isDarkMode: false,
            lists: [
                { id: 'todo', name: '📋 A Fazer' },
                { id: 'doing', name: '⏳ Em Andamento' },
                { id: 'done', name: '✅ Concluído' }
            ],
            tasks: []
        };

        // Migração e normalização de dados
        data.tasks.forEach(task => {
            if (!task.category) task.category = 'Trabalho';
            if (!task.priority) task.priority = 'medium';
            if (!task.comments) task.comments = [];
            if (!task.checklists) task.checklists = [];
            if (!task.timeSpent) task.timeSpent = 0;
            if (!task.order) task.order = 0;
            if (!task.createdAt) task.createdAt = Date.now();
        });

        localStorage.setItem('kanban_v5', JSON.stringify(data));

        let currentCardId = null;
        let isDragging = false;
        let currentView = 'board';
        let timerInterval = null;
        
        // Sistema Undo/Redo
        let history = [JSON.stringify(data)];
        let historyIndex = 0;
        let isUndoing = false;

        function saveHistory() {
            if (!isUndoing) {
                history = history.slice(0, historyIndex + 1);
                history.push(JSON.stringify(data));
                historyIndex++;
                if (history.length > 50) {
                    history.shift();
                    historyIndex--;
                }
            }
        }

        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                isUndoing = true;
                data = JSON.parse(history[historyIndex]);
                render();
                isUndoing = false;
            }
        }

        function redo() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                isUndoing = true;
                data = JSON.parse(history[historyIndex]);
                render();
                isUndoing = false;
            }
        }

        function setView(view) {
            currentView = view;
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            document.getElementById(`tab-${view}`).classList.add('active');
            document.getElementById('boardView').classList.toggle('hidden', view !== 'board');
            document.getElementById('completedView').classList.toggle('hidden', view !== 'completed');
            document.getElementById('calendarView').classList.toggle('hidden', view !== 'calendar');
            render();
        }

        function toggleDarkMode() {
            data.isDarkMode = !data.isDarkMode;
            localStorage.setItem('kanban_v5', JSON.stringify(data));
            render();
        }

        function render() {
            document.documentElement.setAttribute('data-theme', data.isDarkMode ? 'dark' : 'light');
            document.getElementById('themeToggle').innerText = data.isDarkMode ? '☀️' : '🌙';
            document.getElementById('boardTitle').innerText = data.boardTitle;

            // Atualizar estatísticas
            const totalTasks = data.tasks.length;
            const doneTasks = data.tasks.filter(t => t.listId === 'done').length;
            const doingTasks = data.tasks.filter(t => t.listId === 'doing').length;
            const todoTasks = data.tasks.filter(t => t.listId === 'todo').length;
            
            document.getElementById('stat-total').innerText = totalTasks;
            document.getElementById('stat-doing').innerText = doingTasks;
            document.getElementById('stat-done').innerText = doneTasks;
            
            // Calcular taxa de conclusão
            const completionRate = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0;
            document.getElementById('stat-completion').innerText = completionRate + '%';
            
            // Atualizar barra de progresso
            const progressBar = document.getElementById('completion-progress');
            if (progressBar) {
                progressBar.style.width = completionRate + '%';
                progressBar.setAttribute('aria-valuenow', completionRate);
            }
            
            // Adicionar gráfico de distribuição no dashboard
            updateTaskDistributionChart(todoTasks, doingTasks, doneTasks);
            
            const today = new Date();
            today.setHours(0,0,0,0);
            const overdueTasks = data.tasks.filter(t => {
                if (!t.date || t.listId === 'done') return false;
                return new Date(t.date) < today;
            }).length;
            document.getElementById('stat-overdue').innerText = overdueTasks;

            if (currentView === 'board') renderBoard();
            if (currentView === 'completed') renderCompleted();
            if (currentView === 'calendar') renderCalendar();

            localStorage.setItem('kanban_v5', JSON.stringify(data));
            saveHistory();

            if (data.tasks.some(t => t.isTracking)) {
                if (!timerInterval) {
                    timerInterval = setInterval(() => {
                        data.tasks.forEach(t => { if (t.isTracking) t.timeSpent++; });
                        updateTimeDisplays();
                    }, 1000);
                }
            } else {
                if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
            }
        }

        function renderBoard() {
            const boardLists = document.getElementById('boardView');
            boardLists.innerHTML = '';

            data.lists.forEach(list => {
                const listDiv = document.createElement('div');
                listDiv.className = 'list';
                listDiv.innerHTML = `
                    <div class="flex justify-between items-center mb-4">
                        <h3 class="font-semibold cursor-pointer" style="color: var(--text-primary);" onclick="editListName('${list.id}')">${list.name}</h3>
                        <button onclick="deleteList('${list.id}')" style="color: var(--text-muted);" class="hover:opacity-75">
                            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
                            </svg>
                        </button>
                    </div>
                    <div id="list-${list.id}" class="space-y-2 min-h-[200px]" ondrop="drop(event)" ondragover="allowDrop(event)" ondragleave="dragLeave(event)">
                    </div>
                    <button onclick="openAddTaskModal('${list.id}')" class="w-full mt-2 py-2 rounded-lg transition-colors text-sm font-medium" style="color: var(--text-secondary); background: var(--bg-tertiary);">+ Adicionar Card</button>
                `;
                boardLists.appendChild(listDiv);
            });

            const addListBtn = document.createElement('button');
            addListBtn.className = 'list flex items-center justify-center rounded-lg transition-colors cursor-pointer';
            addListBtn.style.color = 'var(--text-muted)';
            addListBtn.innerHTML = '<span class="text-3xl">+</span>';
            addListBtn.onclick = addList;
            boardLists.appendChild(addListBtn);

            const searchTerm = document.getElementById('searchInput').value.toLowerCase();
            const priorityFilter = document.getElementById('priorityFilter').value;
            const categoryFilter = document.getElementById('categoryFilter').value;
            const sortBy = document.getElementById('sortBy').value;

            let tasksToRender = [...data.tasks];

            if (priorityFilter !== 'all') tasksToRender = tasksToRender.filter(t => t.priority === priorityFilter);
            if (categoryFilter !== 'all') tasksToRender = tasksToRender.filter(t => t.category === categoryFilter);
            if (searchTerm !== '') tasksToRender = tasksToRender.filter(t => 
                t.title.toLowerCase().includes(searchTerm) ||
                (t.description && t.description.toLowerCase().includes(searchTerm)) ||
                t.category.toLowerCase().includes(searchTerm)
            );

            const priorityOrder = { high: 0, medium: 1, low: 2 };
            tasksToRender.sort((a, b) => {
                switch(sortBy) {
                    case 'priority': return priorityOrder[a.priority] - priorityOrder[b.priority];
                    case 'date': return new Date(a.date) - new Date(b.date);
                    case 'title': return a.title.localeCompare(b.title);
                    default: return (b.order || 0) - (a.order || 0);
                }
            });

            data.lists.forEach(list => {
                const listContainer = document.getElementById(`list-${list.id}`);
                if (!listContainer) return;
                listContainer.innerHTML = '';

                tasksToRender.filter(task => task.listId === list.id).forEach(task => {
                    const card = document.createElement('div');
                    card.className = `card priority-${task.priority}`;
                    card.draggable = true;
                    card.id = task.id;
                    card.ondragstart = drag;
                    card.onclick = (e) => { if (!isDragging && !e.target.closest('button') && !e.target.closest('input')) openCardModal(task.id); };

                    const today = new Date();
                    today.setHours(0,0,0,0);
                    const dueDate = task.date ? new Date(task.date) : null;
                    let dateClass = '';
                    let dateIcon = '📅';
                    if (dueDate) {
                        const diffDays = Math.ceil((dueDate - today) / (1000 * 60 * 60 * 24));
                        if (diffDays < 0) { dateClass = 'overdue'; dateIcon = '⚠️'; }
                        else if (diffDays <= 2) { dateClass = 'due-soon'; }
                    }

                    const priorityColors = { high: 'priority-high', medium: 'priority-medium', low: 'priority-low' };
                    const categoryEmojis = { 'Trabalho': '💼', 'Pessoal': '🏠', 'Estudo': '📚', 'Lazer': '🎮' };

                    card.innerHTML = `
                        <div class="flex justify-between items-start mb-2">
                            <div class="flex flex-wrap gap-1">
                                <span class="label ${priorityColors[task.priority]}">${task.priority === 'high' ? 'Alta' : task.priority === 'medium' ? 'Média' : 'Baixa'}</span>
                                <span class="label category-label">${categoryEmojis[task.category]} ${task.category}</span>
                            </div>
                        </div>
                        <h4 class="font-medium mb-2" style="color: var(--text-primary);">${highlightSearch(task.title, searchTerm)}</h4>
                        ${task.description ? `<p class="text-sm mb-2 line-clamp-2" style="color: var(--text-secondary);">${highlightSearch(task.description, searchTerm)}</p>` : ''}
                        <div class="flex justify-between items-center text-xs" style="color: var(--text-muted);">
                            <span class="${dateClass}">${dueDate ? `${dateIcon} ${task.date}` : ''}</span>
                            <span>⏱️ ${formatTime(task.timeSpent)} 📋 ${task.checklists.filter(c => c.done).length}/${task.checklists.length} 💬 ${task.comments.length}</span>
                        </div>
                    `;
                    card.ondrop = (e) => dropOnCard(e, task.id);
                    card.ondragover = allowDrop;
                    card.ondragleave = dragLeave;
                    card.ondragend = () => { isDragging = false; card.classList.remove('dragging'); };
                    listContainer.appendChild(card);
                });
            });
        }

        function renderCompleted() {
            const completedTasks = document.getElementById('completedTasks');
            completedTasks.innerHTML = '';
            const doneTasks = data.tasks.filter(task => task.listId === 'done').sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
            
            if (doneTasks.length === 0) {
                completedTasks.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma tarefa concluída ainda.</p>';
            } else {
                doneTasks.forEach(task => {
                    const taskDiv = document.createElement('div');
                    taskDiv.className = 'p-4 rounded-lg shadow-sm border transition-all hover:shadow-md';
                    taskDiv.style.background = 'var(--bg-card)';
                    taskDiv.style.borderColor = 'var(--border)';
                    taskDiv.innerHTML = `
                        <div class="flex justify-between items-start">
                            <h4 class="font-medium" style="color: var(--text-primary);">✅ ${task.title}</h4>
                            <button onclick="reopenTask('${task.id}')" style="color: var(--accent);" class="hover:opacity-75 text-sm">↩️ Reabrir</button>
                        </div>
                        ${task.description ? `<p class="text-sm mt-2" style="color: var(--text-secondary);">${task.description}</p>` : ''}
                        <div class="flex justify-between items-center mt-3 text-xs" style="color: var(--text-muted);">
                            <span>Concluída em ${task.date || 'Sem data'}</span>
                            <span>⏱️ ${formatTime(task.timeSpent)}</span>
                        </div>
                    `;
                    completedTasks.appendChild(taskDiv);
                });
            }
        }

        function renderCalendar() {
            const calendarTasks = document.getElementById('calendarTasks');
            calendarTasks.innerHTML = '';
            
            const tasksWithDate = data.tasks.filter(t => t.date && t.listId !== 'done').sort((a, b) => new Date(a.date) - new Date(b.date));
            
            if (tasksWithDate.length === 0) {
                calendarTasks.innerHTML = '<p class="text-gray-500 text-center py-8">Nenhuma tarefa com data definida.</p>';
                return;
            }

            const grouped = {};
            tasksWithDate.forEach(t => {
                if (!grouped[t.date]) grouped[t.date] = [];
                grouped[t.date].push(t);
            });

            Object.keys(grouped).sort().forEach(date => {
                const dateDiv = document.createElement('div');
                const d = new Date(date);
                const isToday = d.toDateString() === new Date().toDateString();
                dateDiv.className = `p-4 rounded-lg mb-3 ${isToday ? 'border-2' : 'border'}`;
                dateDiv.style.background = 'var(--bg-card)';
                dateDiv.style.borderColor = isToday ? 'var(--accent)' : 'var(--border)';
                
                dateDiv.innerHTML = `
                    <h3 class="font-semibold mb-3" style="color: ${isToday ? 'var(--accent)' : 'var(--text-primary)'};">
                        ${isToday ? '📍 Hoje - ' : ''}${new Date(date).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                    </h3>
                    <div class="space-y-2">
                        ${grouped[date].map(t => `
                            <div class="p-3 rounded" style="background: var(--bg-tertiary);">
                                <div class="flex justify-between">
                                    <span style="color: var(--text-primary);">${t.title}</span>
                                    <span class="label ${t.priority === 'high' ? 'priority-high' : t.priority === 'medium' ? 'priority-medium' : 'priority-low'}">${t.priority === 'high' ? 'Alta' : t.priority === 'medium' ? 'Média' : 'Baixa'}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                `;
                calendarTasks.appendChild(dateDiv);
            });
        }

        function updateTimeDisplays() {
            data.tasks.forEach(task => {
                const card = document.getElementById(task.id);
                if (card) {
                    const timeSpan = card.querySelector('.time-display');
                    if (timeSpan) timeSpan.textContent = formatTime(task.timeSpent);
                }
            });
            localStorage.setItem('kanban_v5', JSON.stringify(data));
        }

        function formatTime(seconds) {
            const hrs = Math.floor(seconds / 3600);
            const mins = Math.floor((seconds % 3600) / 60);
            const secs = seconds % 60;
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }

        function clearAllData() {
            if (confirm('Tem certeza que deseja APAGAR TODOS os dados? Esta ação não pode ser desfeita.')) {
                localStorage.clear();
                location.reload();
            }
        }

        function addList() {
            const listName = prompt('Nome da nova lista:');
            if (listName) {
                const listId = 'list-' + Date.now();
                data.lists.push({ id: listId, name: listName });
                render();
            }
        }

        function editListName(listId) {
            const list = data.lists.find(l => l.id === listId);
            const newName = prompt('Novo nome da lista:', list.name);
            if (newName) { list.name = newName; render(); }
        }

        function deleteList(listId) {
            if (confirm('Tem certeza que deseja deletar esta lista? Todos os cards serão perdidos.')) {
                data.lists = data.lists.filter(l => l.id !== listId);
                data.tasks = data.tasks.filter(t => t.listId !== listId);
                render();
            }
        }

        function openAddTaskModal(listId) {
            document.getElementById('newTaskList').innerHTML = data.lists.map(list =>
                `<option value="${list.id}" ${list.id === listId ? 'selected' : ''}>${list.name}</option>`
            ).join('');
            document.getElementById('addTaskModal').classList.remove('hidden');
            document.getElementById('addTaskModal').classList.add('modal-active');
            document.getElementById('newTaskTitle').focus();
        }

        function closeAddTaskModal() {
            document.getElementById('addTaskModal').classList.remove('modal-active');
            document.getElementById('addTaskModal').classList.add('hidden');
        }

        function createTask() {
            const title = document.getElementById('newTaskTitle').value;
            const desc = document.getElementById('newTaskDesc').value;
            const category = document.getElementById('newTaskCategory').value;
            const priority = document.getElementById('newTaskPriority').value;
            const date = document.getElementById('newTaskDate').value;
            const listId = document.getElementById('newTaskList').value;

            if (!title.trim()) { alert('Digite um título para o card.'); return; }

            const listTasks = data.tasks.filter(t => t.listId === listId);
            const maxOrder = listTasks.length > 0 ? Math.max(...listTasks.map(t => t.order || 0)) : 0;

            data.tasks.push({
                id: 'task-' + Date.now(),
                title,
                description: desc,
                category,
                priority,
                date: date || new Date().toISOString().split('T')[0],
                listId,
                order: maxOrder + 1,
                comments: [],
                checklists: [],
                timeSpent: 0,
                isTracking: false,
                createdAt: Date.now()
            });

            document.getElementById('newTaskTitle').value = '';
            document.getElementById('newTaskDesc').value = '';
            document.getElementById('newTaskDate').value = '';

            closeAddTaskModal();
            setView('board');
        }

        function openCardModal(taskId) {
            currentCardId = taskId;
            const task = data.tasks.find(t => t.id === taskId);
            document.getElementById('cardModalTitle').innerText = task.title;
            document.getElementById('cardDesc').value = task.description || '';
            document.getElementById('cardCategory').value = task.category;
            document.getElementById('cardPriority').value = task.priority;
            document.getElementById('cardDate').value = task.date || '';
            document.getElementById('timeDisplay').innerText = formatTime(task.timeSpent);
            document.getElementById('timeBtn').innerText = task.isTracking ? '⏹ Parar' : '▶️ Iniciar';

            const checklistsList = document.getElementById('checklistsList');
            checklistsList.innerHTML = task.checklists.map((item, index) =>
                `<div class="flex items-center gap-2 p-2 rounded" style="background: var(--bg-tertiary);">
                    <input type="checkbox" ${item.done ? 'checked' : ''} onchange="toggleChecklist(${index})" style="accent-color: var(--accent);">
                    <span class="${item.done ? 'line-through' : ''}" style="color: var(--text-secondary); flex-1;">${item.text}</span>
                    <button onclick="deleteChecklistItem(${index})" style="color: var(--error);">×</button>
                </div>`
            ).join('');

            const commentsList = document.getElementById('commentsList');
            commentsList.innerHTML = task.comments.map(comment =>
                `<div class="p-3 rounded-lg text-sm" style="background: var(--bg-tertiary); color: var(--text-secondary);">${comment}</div>`
            ).join('');

            document.getElementById('cardModal').classList.remove('hidden');
            document.getElementById('cardModal').classList.add('modal-active');
        }

        function closeCardModal() {
            document.getElementById('cardModal').classList.remove('modal-active');
            document.getElementById('cardModal').classList.add('hidden');
            currentCardId = null;
        }

        function updateCardDesc() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.description = document.getElementById('cardDesc').value;
            render();
        }

        function updateCardCategory() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.category = document.getElementById('cardCategory').value;
            render();
        }

        function updateCardPriority() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.priority = document.getElementById('cardPriority').value;
            render();
        }

        function updateCardDate() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.date = document.getElementById('cardDate').value;
            render();
        }

        function addChecklistItem() {
            const input = document.getElementById('checklistInput');
            if (!input.value || !currentCardId) return;
            const task = data.tasks.find(t => t.id === currentCardId);
            task.checklists.push({ text: input.value, done: false });
            input.value = '';
            openCardModal(currentCardId);
            render();
        }

        function toggleChecklist(index) {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.checklists[index].done = !task.checklists[index].done;
            render();
        }

        function deleteChecklistItem(index) {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.checklists.splice(index, 1);
            openCardModal(currentCardId);
            render();
        }

        function addComment() {
            const input = document.getElementById('commentInput');
            if (!input.value || !currentCardId) return;
            const task = data.tasks.find(t => t.id === currentCardId);
            task.comments.push(input.value);
            input.value = '';
            openCardModal(currentCardId);
            render();
        }

        function toggleTimeTracking() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.isTracking = !task.isTracking;
            openCardModal(currentCardId);
            render();
        }

        function duplicateCard() {
            const task = data.tasks.find(t => t.id === currentCardId);
            const newTask = {...task, id: 'task-' + Date.now(), createdAt: Date.now()};
            data.tasks.push(newTask);
            closeCardModal();
            render();
        }

        function deleteCard() {
            if (confirm('Tem certeza que deseja deletar este card?')) {
                data.tasks = data.tasks.filter(t => t.id !== currentCardId);
                closeCardModal();
                render();
            }
        }

        function editBoardTitle() {
            const newTitle = prompt('Novo título do quadro:', data.boardTitle);
            if (newTitle) { data.boardTitle = newTitle; render(); }
        }

        function reopenTask(taskId) {
            const task = data.tasks.find(t => t.id === taskId);
            task.listId = 'todo';
            render();
        }

        function markAsComplete() {
            const task = data.tasks.find(t => t.id === currentCardId);
            task.listId = 'done';
            task.isTracking = false;
            closeCardModal();
            render();
        }

        // Drag & Drop
        function allowDrop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.add('drag-over');
        }

        function dragLeave(ev) {
            ev.currentTarget.classList.remove('drag-over');
        }

        function drag(ev) {
            ev.dataTransfer.setData("text", ev.target.id);
            isDragging = true;
            ev.target.classList.add('dragging');
        }

        function drop(ev) {
            ev.preventDefault();
            ev.currentTarget.classList.remove('drag-over');
            const taskId = ev.dataTransfer.getData("text");
            const targetListId = ev.currentTarget.id.replace('list-', '');
            const task = data.tasks.find(t => t.id === taskId);
            if (task.listId !== targetListId) {
                task.listId = targetListId;
                const listTasks = data.tasks.filter(t => t.listId === targetListId);
                const maxOrder = listTasks.length > 0 ? Math.max(...listTasks.map(t => t.order || 0)) : 0;
                task.order = maxOrder + 1;
            }
            render();
        }

        function dropOnCard(ev, targetTaskId) {
            ev.preventDefault();
            ev.stopPropagation();
            ev.currentTarget.classList.remove('drag-over');
            const draggedTaskId = ev.dataTransfer.getData("text");
            if (draggedTaskId === targetTaskId) return;

            const draggedTask = data.tasks.find(t => t.id === draggedTaskId);
            const targetTask = data.tasks.find(t => t.id === targetTaskId);

            if (draggedTask.listId === targetTask.listId) {
                const listTasks = data.tasks.filter(t => t.listId === draggedTask.listId).sort((a, b) => (a.order || 0) - (b.order || 0));
                const draggedIndex = listTasks.findIndex(t => t.id === draggedTaskId);
                const targetIndex = listTasks.findIndex(t => t.id === targetTaskId);

                listTasks.splice(draggedIndex, 1);
                listTasks.splice(targetIndex, 0, draggedTask);

                listTasks.forEach((task, index) => { task.order = listTasks.length - index; });
            } else {
                draggedTask.listId = targetTask.listId;
                const listTasks = data.tasks.filter(t => t.listId === targetTask.listId).sort((a, b) => (b.order || 0) - (a.order || 0));
                const targetIndex = listTasks.findIndex(t => t.id === targetTaskId);
                listTasks.splice(targetIndex, 0, draggedTask);
                listTasks.forEach((task, index) => { task.order = listTasks.length - index; });
            }
            render();
        }

        // Marcar tarefa como concluída com animação
        function completeTaskWithAnimation(taskId) {
            const task = data.tasks.find(t => t.id === taskId);
            if (task && task.listId !== 'done') {
                task.listId = 'done';
                const listTasks = data.tasks.filter(t => t.listId === 'done');
                const maxOrder = listTasks.length > 0 ? Math.max(...listTasks.map(t => t.order || 0)) : 0;
                task.order = maxOrder + 1;
                
                // Adicionar classe de animação
                setTimeout(() => {
                    createConfetti();
                }, 100);
                
                render();
            }
        }

        // Backup
        function downloadBackup() {
            const dataStr = JSON.stringify(data, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const linkElement = document.createElement('a');
            linkElement.setAttribute('href', dataUri);
            linkElement.setAttribute('download', `kanban_backup_${new Date().toISOString().split('T')[0]}.json`);
            linkElement.click();
        }

        function uploadBackup(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const importedData = JSON.parse(e.target.result);
                    if (importedData.lists && importedData.tasks) {
                        data = importedData;
                        localStorage.setItem('kanban_v5', JSON.stringify(data));
        // Iniciar verificador de notificações se já permitido
        if ('Notification' in window && Notification.permission === 'granted') {
            document.getElementById('notifBtn').innerText = '🔔 ✓';
            startNotificationChecker();
        }

        render();
                        alert('Backup restaurado com sucesso!');
                    } else {
                        alert('Arquivo inválido.');
                    }
                } catch (error) {
                    alert('Erro ao carregar o arquivo.');
                }
            };
            reader.readAsText(file);
        }

        function clearFilters() {
            document.getElementById('searchInput').value = '';
            document.getElementById('priorityFilter').value = 'all';
            document.getElementById('categoryFilter').value = 'all';
            document.getElementById('sortBy').value = 'order';
            render();
        }

        // Templates de tarefas
        const defaultTemplates = [
            { title: "Bugfix", description: "Reportar, reproduzir, corrigir e testar bug", priority: "high", category: "Trabalho" },
            { title: "Reunião", description: "Preparar pauta, anotações e follow up", priority: "medium", category: "Trabalho" },
            { title: "Estudo", description: "Material de estudo, exercícios e revisão", priority: "medium", category: "Estudo" },
            { title: "Compra", description: "Lista de compras do supermercado", priority: "low", category: "Pessoal" }
        ];

        function showTemplates() {
            const template = prompt('Escolha template:\n1 - Bugfix\n2 - Reunião\n3 - Estudo\n4 - Compra\nDigite o número:');
            if (template && template >=1 && template <=4) {
                const t = defaultTemplates[template-1];
                document.getElementById('newTaskTitle').value = t.title;
                document.getElementById('newTaskDesc').value = t.description;
                document.getElementById('newTaskPriority').value = t.priority;
                document.getElementById('newTaskCategory').value = t.category;
                openAddTaskModal('todo');
            }
        }

        // Notificações
        let notificationInterval = null;

        function requestNotifications() {
            if ('Notification' in window) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        document.getElementById('notifBtn').innerText = '🔔 ✓';
                        startNotificationChecker();
                    }
                });
            }
        }

        function startNotificationChecker() {
            if (notificationInterval) clearInterval(notificationInterval);
            notificationInterval = setInterval(() => {
                const today = new Date();
                today.setHours(0,0,0,0);
                data.tasks.forEach(t => {
                    if (t.date && t.listId !== 'done') {
                        const due = new Date(t.date);
                        const diff = Math.ceil((due - today) / (1000*60*60*24));
                        if (diff === 1 || diff === 0) {
                            new Notification('Kanban - Tarefa próxima!', { body: `${t.title} vence ${diff === 0 ? 'HOJE' : 'amanhã'}`, icon: '📋' });
                        }
                    }
                });
            }, 3600000); // Verificar a cada 1 hora
        }

        // Exportar PDF
        function exportPDF() {
            const printContent = document.querySelector('.board').innerHTML;
            const printWindow = window.open('', '_blank');
            printWindow.document.write(`
                <html>
                <head><title>Kanban Export</title>
                <style>body{font-family:Inter,sans-serif;padding:20px;} .list{display:inline-block;width:30%;margin:1%;vertical-align:top;} .card{margin:8px 0;padding:10px;border-radius:8px;border:1px solid #ddd;}</style>
                </head>
                <body>${printContent}</body>
                <script>setTimeout(()=>{print();close();},500);<\/script>
                </html>
            `);
            printWindow.document.close();
        }

        // Atalhos de teclado
        document.addEventListener('keydown', (e) => {
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
            if (e.key === 'n') { e.preventDefault(); openAddTaskModal('todo'); }
            if (e.key === 'Escape') { e.preventDefault(); closeAddTaskModal(); closeCardModal(); }
            if (e.ctrlKey && e.key === 'k') { e.preventDefault(); document.getElementById('searchInput').focus(); }
            if (e.ctrlKey && e.key === 'b') { e.preventDefault(); downloadBackup(); }
            if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
            if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
        });

        // Filter events
        document.getElementById('searchInput').addEventListener('input', render);
        document.getElementById('priorityFilter').addEventListener('change', render);
        document.getElementById('categoryFilter').addEventListener('change', render);
        document.getElementById('sortBy').addEventListener('change', render);

        // Menu mobile toggle
        function toggleMobileMenu() {
            const menu = document.getElementById('headerActions');
            const toggle = document.getElementById('menuToggle');
            menu.classList.toggle('show');
            toggle.classList.toggle('active');
        }

        // Animação de confete ao completar tarefa
        function createConfetti() {
            const colors = ['#ef4444', '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];
            for (let i = 0; i < 30; i++) {
                const confetti = document.createElement('div');
                confetti.className = 'confetti';
                confetti.style.left = Math.random() * 100 + 'vw';
                confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                confetti.style.animationDuration = (Math.random() * 2 + 2) + 's';
                confetti.style.opacity = Math.random();
                document.body.appendChild(confetti);
                
                setTimeout(() => confetti.remove(), 4000);
            }
        }

        // Gráfico de distribuição de tarefas (pizza simples com CSS)
        function updateTaskDistributionChart(todo, doing, done) {
            const chartContainer = document.getElementById('task-distribution-chart');
            if (!chartContainer) return;
            
            const total = todo + doing + done;
            if (total === 0) {
                chartContainer.innerHTML = '<p style="text-align:center;color:#666;">Sem tarefas para exibir</p>';
                return;
            }
            
            const todoPercent = Math.round((todo / total) * 100);
            const doingPercent = Math.round((doing / total) * 100);
            const donePercent = Math.round((done / total) * 100);
            
            // Criar gráfico de pizza usando conic-gradient
            chartContainer.innerHTML = `
                <div class="distribution-chart">
                    <div class="chart-pie" style="background: conic-gradient(
                        #3b82f6 0% ${todoPercent}%,
                        #f59e0b ${todoPercent}% ${todoPercent + doingPercent}%,
                        #10b981 ${todoPercent + doingPercent}% 100%
                    );"></div>
                    <div class="chart-legend">
                        <div class="legend-item">
                            <span class="legend-color" style="background:#3b82f6;"></span>
                            <span>A Fazer: ${todo} (${todoPercent}%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background:#f59e0b;"></span>
                            <span>Em Andamento: ${doing} (${doingPercent}%)</span>
                        </div>
                        <div class="legend-item">
                            <span class="legend-color" style="background:#10b981;"></span>
                            <span>Concluído: ${done} (${donePercent}%)</span>
                        </div>
                    </div>
                </div>
            `;
        }

        // Highlight em search
        function highlightSearch(text, search) {
            if (!search) return text;
            const regex = new RegExp(`(${search})`, 'gi');
            return text.replace(regex, '<span class="search-highlight">$1</span>');
        }

        render();
