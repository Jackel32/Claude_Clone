document.addEventListener('DOMContentLoaded', () => {
    // --- ELEMENT SELECTORS ---
    const tabBar = document.getElementById('tab-bar');
    const tabPanels = document.getElementById('tab-panels');
    const chatWindow = document.getElementById('chat-window');
    const chatForm = document.getElementById('chat-form');
    const messageInput = document.getElementById('message-input');
    const agentTaskBtn = document.getElementById('agent-task-btn');
    const testBtn = document.getElementById('test-btn');
    const gitDiffBtn = document.getElementById('git-diff-btn');
    const gitBranchesBtn = document.getElementById('git-branches-btn');
    const reportBtn = document.getElementById('report-btn');
    const repoSelectorOverlay = document.getElementById('repo-selector-overlay');
    const appContainer = document.getElementById('app-container');
    const repoList = document.getElementById('repo-list');
    const localList = document.getElementById('local-list');
    const cloneForm = document.getElementById('clone-form');
    const repoUrlInput = document.getElementById('repo-url');
    const repoPatInput = document.getElementById('repo-pat');
    const indexingModal = document.getElementById('indexing-modal');
    const indexNowBtn = document.getElementById('index-now-btn');
    const indexCancelBtn = document.getElementById('index-cancel-btn');
    const initModal = document.getElementById('init-modal');
    const initNowBtn = document.getElementById('init-now-btn');
    const initCancelBtn = document.getElementById('init-cancel-btn');

    // --- STATE MANAGEMENT ---
    const logHistory = [];
    let tabCounter = 0;
    let assistantMessageElement = null;
    let pendingUserMessage = null;
    let lastSentChatMessage = null;
    let isProjectLoading = false; // Flag to prevent race conditions

    // --- INITIALIZATION ---
    initializeRepoSelector();
    initFixedTabs();

    // --- WEBSOCKET SETUP ---
    const socket = new WebSocket(`ws://${window.location.host}`);
    socket.onopen = () => console.log('WebSocket connection established.');
    socket.onmessage = handleSocketMessage;

    // --- EVENT LISTENERS ---
    chatForm.addEventListener('submit', handleChatSubmit);
    if (agentTaskBtn) agentTaskBtn.addEventListener('click', showTaskLibrary);
    if (testBtn) testBtn.addEventListener('click', showTestDialog);
    if (gitDiffBtn) gitDiffBtn.addEventListener('click', showGitDiffDialog);
    if (gitBranchesBtn) gitBranchesBtn.addEventListener('click', showGitBranchesDialog);
    if (reportBtn) reportBtn.addEventListener('click', showReport);

    indexNowBtn.addEventListener('click', () => {
        indexingModal.classList.add('hidden');
        const taskId = `task-${Date.now()}`;
        const panel = createTab('Indexing Project', true, taskId);
        panel.innerHTML = '<h3>Indexing codebase...</h3>';
        setTabStatus(panel, 'running');
        socket.send(JSON.stringify({ type: 'start-indexing', taskId }));
    });

    indexCancelBtn.addEventListener('click', () => {
        indexingModal.classList.add('hidden');
    });

    initNowBtn.addEventListener('click', async () => {
        initModal.classList.add('hidden');
        const taskId = `task-${Date.now()}`;
        const panel = createTab('Initializing Project', true, taskId);
        panel.innerHTML = '<h3>Starting initialization...</h3>';
        setTabStatus(panel, 'running');

        socket.send(JSON.stringify({ 
            type: 'start-init', 
            taskId,
            projectPath: window.activeProjectPath 
        }));
    });

    initCancelBtn.addEventListener('click', () => {
        initModal.classList.add('hidden');
    });

    // --- REPO SELECTOR LOGIC ---
    async function initializeRepoSelector() {
        try {
            const response = await fetch('/api/projects');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const projects = await response.json();
            if (projects.error) throw new Error(projects.error);
    
            // --- Event Delegation for Cloned Repos ---
            repoList.innerHTML = '';
            if (projects.cloned && projects.cloned.length > 0) {
                projects.cloned.forEach(repo => {
                    const li = document.createElement('li');
                    li.textContent = repo.name;
                    li.dataset.path = repo.path; // Store path in a data attribute
                    repoList.appendChild(li);
                });
            } else {
                repoList.innerHTML = '<li>No repositories cloned yet.</li>';
            }
    
            // --- Event Delegation for Local Projects ---
            localList.innerHTML = '';
            if (projects.local && projects.local.length > 0) {
                projects.local.forEach(project => {
                    const li = document.createElement('li');
                    li.textContent = project.name;
                    li.dataset.path = project.path; // Store path in a data attribute
                    localList.appendChild(li);
                });
            } else {
                localList.innerHTML = '<li>No local projects found in the mounted directory.</li>';
            }
    
            // --- Single Click Handler for both lists ---
            const handleProjectClick = (event) => {
                const target = event.target.closest('li');
                if (target && target.dataset.path) {
                    selectProject(target.dataset.path);
                }
            };
    
            repoList.addEventListener('click', handleProjectClick);
            localList.addEventListener('click', handleProjectClick);
    
        } catch (error) {
            console.error("Failed to initialize repo selector:", error);
            repoList.innerHTML = `<li>Error: ${error.message}</li>`;
            localList.innerHTML = `<li>Check server logs for details.</li>`;
        }
    }
    
    async function selectProject(projectPath) {
        if (isProjectLoading) return; // Prevent concurrent selections
        isProjectLoading = true;
    
        try {
            window.activeProjectPath = projectPath; // Store for later use
            await fetch('/api/set-active-project', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath }),
            });
            repoSelectorOverlay.classList.add('hidden');
            appContainer.classList.remove('hidden');
    
            // Check if project is initialized
            const checkResponse = await fetch('/api/check-init', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectPath }),
            });
    
            if (!checkResponse.ok) {
                throw new Error(`Server error: ${checkResponse.statusText}`);
            }
    
            const status = await checkResponse.json();
            if (!status.initialized) {
                initModal.classList.remove('hidden');
            }
        } catch (error) {
            console.error("Failed to select project:", error);
            alert(`Error selecting project: ${error.message}. Please try again.`);
            // Reset UI to a safe state
            repoSelectorOverlay.classList.remove('hidden');
            appContainer.classList.add('hidden');
        } finally {
            isProjectLoading = false; // Release the lock
        }
    }

    cloneForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const repoUrl = repoUrlInput.value;
        const pat = repoPatInput.value;
        const cloneButton = cloneForm.querySelector('button');
        cloneButton.textContent = 'Cloning...';
        cloneButton.disabled = true;
        try {
            const response = await fetch('/api/repos/clone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ repoUrl, pat }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Unknown cloning error');

            await initializeRepoSelector();
            const newRepoResponse = await fetch('/api/projects');
            const projects = await newRepoResponse.json();
            const newRepo = projects.cloned.find(r => r.name === result.repoName);
            if (newRepo) {
                await selectProject(newRepo.path);
            } else {
                throw new Error('Could not find newly cloned repository.');
            }
        } catch (error) {
            alert(`Error cloning repository: ${error.message}`);
        } finally {
            cloneButton.textContent = 'Clone';
            cloneButton.disabled = false;
        }
    });

    // --- TAB MANAGEMENT ---
    function createTab(title, makeActive = true, taskId = null) {
        tabCounter++;
        const tabId = `tab-${tabCounter}`;
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.dataset.tabId = tabId;
        const titleSpan = document.createElement('span');
        titleSpan.textContent = title;
        tab.appendChild(titleSpan);
        const closeBtn = document.createElement('span');
        closeBtn.className = 'close-tab';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = (e) => { e.stopPropagation(); closeTab(tabId); };
        tab.appendChild(closeBtn);
        const spinner = document.createElement('div');
        spinner.className = 'tab-spinner';
        spinner.style.display = 'none';
        tab.appendChild(spinner);
        tabBar.appendChild(tab);
        tab.onclick = () => switchToTab(tabId);
        const panel = document.createElement('div');
        panel.className = 'tab-panel';
        panel.dataset.tabId = tabId;
        if (taskId) {
            panel.dataset.taskId = taskId;
        }
        tabPanels.appendChild(panel);
        if (makeActive) {
            switchToTab(tabId);
        }
        return panel;
    }

    function switchToTab(tabId) {
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab-id="${tabId}"]`)?.classList.add('active');
        document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
        document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`)?.classList.add('active');
    }

    function closeTab(tabId) {
        if (['home', 'logs'].includes(tabId)) return;
        document.querySelector(`.tab[data-tab-id="${tabId}"]`)?.remove();
        document.querySelector(`.tab-panel[data-tab-id="${tabId}"]`)?.remove();
        switchToTab('home');
    }

    function setTabStatus(panel, status) {
        const tabId = panel.dataset.tabId;
        const tab = document.querySelector(`.tab[data-tab-id="${tabId}"]`);
        if (!tab) return;

        const spinner = tab.querySelector('.tab-spinner');
        const closeBtn = tab.querySelector('.close-tab');

        if (status === 'running') {
            if (spinner) spinner.style.display = 'block';
            if (closeBtn) closeBtn.style.display = 'none';
        } else { // 'finished' or 'error'
            if (spinner) spinner.style.display = 'none';
            if (closeBtn) closeBtn.style.display = 'flex';
        }
    }

    function initFixedTabs() {
        tabBar.innerHTML = '';

        const homeTab = document.createElement('div');
        homeTab.className = 'tab active';
        homeTab.dataset.tabId = 'home';
        homeTab.textContent = 'Chat';
        homeTab.onclick = () => switchToTab('home');
        tabBar.appendChild(homeTab);

        // The 'Logs' tab is kept for general server messages but is no longer used for tasks.
        const logsTab = document.createElement('div');
        logsTab.className = 'tab';
        logsTab.dataset.tabId = 'logs';
        logsTab.textContent = 'Logs';
        logsTab.onclick = () => switchToTab('logs');
        tabBar.appendChild(logsTab);

        const logsPanel = document.createElement('div');
        logsPanel.className = 'tab-panel';
        logsPanel.dataset.tabId = 'logs';
        const pre = document.createElement('pre');
        pre.style.whiteSpace = 'pre-wrap';
        logsPanel.appendChild(pre);
        tabPanels.appendChild(logsPanel);
    }
    initFixedTabs();

    // --- MESSAGE HANDLING ---
    function handleSocketMessage(event) {
        const message = JSON.parse(event.data);
        if (message.type === 'index-required') {
            pendingUserMessage = lastSentChatMessage;
            indexingModal.classList.remove('hidden');
            return;
        }
        if (message.taskId) {
            const panel = document.querySelector(`.tab-panel[data-task-id="${message.taskId}"]`);
            if (panel) handleTaskUpdate(message, panel);
            if (message.type === 'finish' && pendingUserMessage) {
                socket.send(JSON.stringify(pendingUserMessage));
                pendingUserMessage = null;
            }
            return;
        }

        if (['start', 'chunk', 'end'].includes(message.type)) {
            handleChatMessage(message);
        } else {
            handleLogMessage(message);
        }
    }

    function handleChatMessage(message) {
        switch (message.type) {
            case 'start':
                assistantMessageElement = createMessageElement('assistant');
                chatWindow.prepend(assistantMessageElement);
                break;
            case 'chunk':
                if (assistantMessageElement) assistantMessageElement.firstChild.textContent += message.content;
                break;
            case 'end':
                assistantMessageElement = null;
                break;
        }
    }

    function handleTaskUpdate(message, panel) {
        let pre = panel.querySelector('pre');
        if (!pre) {
            panel.innerHTML = ''; // Clear initial message like "Generating..."
            pre = document.createElement('pre');
            panel.appendChild(pre);
        }

        let statusLine = panel.querySelector('.status-line');
        if (!statusLine) {
            statusLine = document.createElement('p');
            statusLine.className = 'status-line';
            panel.prepend(statusLine);
        }

        let logText = '';
        switch (message.type) {
            case 'thought': 
                pre.textContent += `[THOUGHT] ${message.content}\n\n`;
                statusLine.textContent = 'Thinking...';
                break;
            case 'action':
                // Update the single status line for actions, mimicking the CLI
                statusLine.textContent = `[ACTION] ${message.content}`;
                return; // Return early to avoid adding to the main log
            case 'observation': 
                statusLine.textContent = 'Analyzing results...';
                pre.textContent += `[OBSERVATION]\n${message.content}\n\n`; 
                break;
            case 'finish': 
                statusLine.textContent = '✅ Finished';
                pre.textContent += `✅ [FINISH] ${message.content}\n\n`; 
                break;
            case 'error': 
                statusLine.textContent = '❌ Error';
                pre.textContent += `❌ [ERROR] ${message.content}\n\n`; 
                break;
            case 'stream-start': 
                statusLine.textContent = 'Receiving AI response...';
                pre.textContent += '\n--- AI RESPONSE ---\n'; 
                break;
            case 'stream-chunk': 
                pre.textContent += message.content; 
                break;
            case 'stream-end': 
                pre.textContent += '\n--- End of Response ---\n\n'; 
                break;
            default: 
                pre.textContent += `[INFO] ${JSON.stringify(message.content)}\n\n`; 
                break;
        }
        panel.scrollTop = panel.scrollHeight;

        if (message.type === 'finish' || message.type === 'error') {
            setTabStatus(panel, 'finished');
        }
    }

    function handleChatSubmit(e) {
        e.preventDefault();
        const messageText = messageInput.value;
        if (messageText.trim() === '') return;
        switchToTab('home');
        const userMessage = createMessageElement('user');
        userMessage.firstChild.textContent = messageText;
        chatWindow.prepend(userMessage);
        const messageToSend = { type: 'chat', content: messageText };
        lastSentChatMessage = messageToSend;
        socket.send(JSON.stringify(messageToSend));
        messageInput.value = '';
    }

    function createMessageElement(role, type = 'normal') {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', role);
        if (type === 'error') messageDiv.style.color = '#ff8a8a';
        const p = document.createElement('p');
        messageDiv.appendChild(p);
        return messageDiv;
    }

    // --- ACTION WORKFLOWS ---
    async function showTaskLibrary() {
        const panel = createTab('Task Library');
        panel.innerHTML = '<h3>Loading available tasks...</h3>';
        try {
            const response = await fetch('/api/tasks');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const library = await response.json();

            if (library.length === 0) {
                panel.innerHTML = '<h3>No tasks available for the detected languages in this project.</h3>';
                return;
            }

            // Dynamically create task groups
            const taskGroups = library.reduce((acc, task) => {
                if (task.group) {
                    if (!acc[task.group]) {
                        acc[task.group] = [];
                    }
                    acc[task.group].push(task);
                }
                return acc;
            }, {});

            panel.innerHTML = '<h3>Select a Task to Execute</h3>';
            const container = document.createElement('div');
            container.className = 'task-library-container';

            // Create a card for each role
            for (const groupName in taskGroups) {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'task-role-group';
                
                const title = document.createElement('h4');
                title.innerHTML = groupName; // Use innerHTML to render emojis
                groupDiv.appendChild(title);

                const taskList = document.createElement('ul');
                taskGroups[groupName].forEach(task => {
                    const li = document.createElement('li');
                    li.innerHTML = `<strong>${task.title}</strong><p>${task.description}</p>`;
                    li.onclick = () => startTaskWorkflow(task, panel);
                    taskList.appendChild(li);
                });
                groupDiv.appendChild(taskList);
                container.appendChild(groupDiv);
            }
            
            panel.appendChild(container);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    async function startTaskWorkflow(taskTemplate, panel) {
        const inputs = {};
        const taskId = `task-${Date.now()}`;

        // This function will collect all needed inputs from the user
        async function collectInputs(index = 0) {
            // Base case: All inputs have been collected, or there were none to start with.
            if (index >= taskTemplate.inputs.length) {
                // Now that we have all inputs, start the agent in a new tab.
                const outputPanel = createTab(taskTemplate.title, true, taskId);
                outputPanel.innerHTML = `<h3>Starting task: ${taskTemplate.title}...</h3>`;
                setTabStatus(outputPanel, 'running');

                socket.send(JSON.stringify({
                    type: 'agent-task-from-library',
                    taskId: taskId, // This is the unique ID for this specific run
                    taskTemplateId: taskTemplate.id, // This is the ID from the library
                    inputs: inputs
                }));
                
                // Close the original task library or input-gathering tab
                if (panel) {
                    closeTab(panel.dataset.tabId);
                }
                return;
            }

            // Recursive step: Collect the next input.
            const input = taskTemplate.inputs[index];
            panel.innerHTML = `<h3>${taskTemplate.title}</h3><p>${input.message}</p>`;

            if (input.type === 'file' || input.type === 'testable-file') {
                const api = input.type === 'file' ? '/api/file-tree' : '/api/testable-file-tree';
                const response = await fetch(api);
                const treeData = await response.json();
                const treeRoot = document.createElement('ul');
                treeRoot.className = 'file-tree';
                if (treeData && treeData.children && treeData.children.length > 0) {
                    treeData.children.forEach(node => {
                        treeRoot.appendChild(renderFileTree(node, (filePath) => {
                            inputs[input.name] = filePath;
                            collectInputs(index + 1); // Recurse for next input
                        }));
                    });
                } else {
                    panel.innerHTML += '<p>No suitable files found for this task.</p>';
                }
                panel.appendChild(treeRoot);
            } else if (input.type === 'symbol') {
                const response = await fetch('/api/list-symbols', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ filePath: inputs.filePath }), // Assumes filePath was collected previously
                });
                const symbols = await response.json();
                const symbolList = document.createElement('ul');
                symbolList.className = 'symbol-list'; // Add a class for styling if needed
                symbols.forEach(symbol => {
                    const li = document.createElement('li');
                    li.textContent = symbol;
                    li.onclick = () => {
                        inputs[input.name] = symbol;
                        collectInputs(index + 1);
                    };
                    symbolList.appendChild(li);
                });
                panel.appendChild(symbolList);
            } else if (input.type === 'git-branch') {
                const response = await fetch('/api/branches');
                const branches = await response.json();
                const availableBranches = inputs.baseBranch ? branches.filter(b => b !== inputs.baseBranch) : branches;
                const list = document.createElement('ul');
                availableBranches.forEach(branch => {
                    const li = document.createElement('li');
                    li.textContent = branch;
                    li.onclick = () => {
                        inputs[input.name] = branch;
                        collectInputs(index + 1);
                    };
                    list.appendChild(li);
                });
                panel.appendChild(list);
            } else if (input.type === 'git-commit') {
                const response = await fetch('/api/commits');
                const commits = await response.json();
                const list = document.createElement('ul');
                commits.forEach(commitLine => {
                    const [hash, ...rest] = commitLine.split('|');
                    const li = document.createElement('li');
                    li.textContent = `${hash.substring(0, 7)} - ${rest.join('|')}`;
                    li.onclick = () => {
                        inputs[input.name] = hash;
                        collectInputs(index + 1);
                    };
                    list.appendChild(li);
                });
                panel.appendChild(list);
            } else { // 'text' input
                const form = document.createElement('form');
                form.className = 'input-form';
                const textInput = document.createElement('input');
                textInput.type = 'text';
                textInput.required = true;
                const submitButton = document.createElement('button');
                submitButton.type = 'submit';
                submitButton.textContent = 'Continue';
                
                form.appendChild(textInput);
                form.appendChild(submitButton);
                
                form.onsubmit = (e) => {
                    e.preventDefault();
                    inputs[input.name] = textInput.value;
                    collectInputs(index + 1);
                };
                panel.appendChild(form);
                textInput.focus();
            }
        }
        
        await collectInputs();
    }

    function showReport() {
        const taskId = `task-${Date.now()}`;
        const panel = createTab('Project Report', true, taskId);
        panel.innerHTML = '<h3>Generating project report...</h3>';
        setTabStatus(panel, 'running');
        socket.send(JSON.stringify({ type: 'get-report', taskId }));
    }

    async function applyChanges(filePath, newContent, panel) {
        try {
            const response = await fetch('/api/apply-changes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filePath, newContent }),
            });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || 'Failed to apply changes.');
            panel.innerHTML += `<p style="color: #4CAF50;">${result.message}</p>`;
        } catch (e) {
            panel.innerHTML += `<p style="color: #F44336;">Error applying changes: ${e.message}</p>`;
        }
    }

    function showGenericFileDialog(title, onFileSelectCallback) {
        const panel = createTab(title);
        panel.innerHTML = `<h3>${title}: Select a file...</h3>`;
        fetch('/api/file-tree').then(res => res.json()).then(treeData => {
            const treeRoot = document.createElement('ul');
            treeRoot.className = 'file-tree';
            if (treeData && treeData.children && treeData.children.length > 0) {
                treeData.children.forEach(node => {
                    treeRoot.appendChild(renderFileTree(node, (filePath) => {
                        onFileSelectCallback(filePath, panel);
                    }));
                });
            } else {
                panel.innerHTML += '<p>No files found in the project.</p>';
            }
            panel.appendChild(treeRoot);
        }).catch(e => {
            panel.innerHTML = `Error loading file tree: ${e.message}`;
        });
    }

    async function showTestDialog() {
        const panel = createTab('Generate Test');
        panel.innerHTML = 'Finding testable files...';
        try {
            const response = await fetch('/api/testable-file-tree');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const treeData = await response.json();
            if (!treeData || !treeData.children || treeData.children.length === 0) {
                panel.innerHTML = '<h3>No files with testable functions found.</h3>'; return;
            }
            const treeRoot = document.createElement('ul');
            treeRoot.className = 'file-tree';
            treeData.children.forEach(node => {
                treeRoot.appendChild(renderFileTree(node, (filePath) => onFileSelectForTest(filePath, panel)));
            });
            panel.innerHTML = `<h3>Generate Test: Select a File</h3>`;
            panel.appendChild(treeRoot);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }

    function renderFileTree(node, onFileSelect) {
        const li = document.createElement('li');
        li.className = `tree-${node.type}`;
        
        const itemSpan = document.createElement('span');
        itemSpan.className = 'tree-item';
        itemSpan.textContent = node.name;
        li.appendChild(itemSpan);

        if (node.type === 'folder') {
            li.classList.add('collapsed'); // Start with folders collapsed
            const childrenUl = document.createElement('ul');
            if (node.children) {
                node.children.forEach(child => {
                    childrenUl.appendChild(renderFileTree(child, onFileSelect));
                });
            }
            li.appendChild(childrenUl);

            itemSpan.onclick = () => {
                li.classList.toggle('collapsed');
            };
        } else { // It's a file
            itemSpan.onclick = () => {
                onFileSelect(node.path);
            };
        }
        
        return li;
    }

    async function onFileSelectForTest(filePath, panel) {
        panel.innerHTML = `<h3>Select a symbol to test in ${filePath.split('/').pop().split('\\').pop()}:</h3>`;
        const response = await fetch('/api/list-symbols', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filePath }),
        });
        const symbols = await response.json();
        const symbolList = document.createElement('ul');
        symbols.forEach(symbol => {
            const li = document.createElement('li');
            li.textContent = symbol;
            li.onclick = () => onSymbolSelectForTest(filePath, symbol, panel);
            symbolList.appendChild(li);
        });
        panel.appendChild(symbolList);
    }

    async function onSymbolSelectForTest(filePath, symbol, panel) {
        const framework = prompt(`Enter the testing framework for "${symbol}":`, 'jest');
        if (!framework || !framework.trim()) { closeTab(panel.dataset.tabId); return; }
        panel.innerHTML = `<h3>Generating ${framework} test for "${symbol}"...</h3>`;
        try {
            const response = await fetch('/api/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filePath, symbol, framework }) });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { newContent } = await response.json();
            document.querySelector(`.tab[data-tab-id="${panel.dataset.tabId}"] span:first-child`).textContent = `Test: ${symbol}`;
            panel.innerHTML = `<h3>Generated Test for ${symbol}</h3><pre><code>${newContent.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</code></pre>`;
            const actions = document.createElement('div');
            actions.className = 'actions';
            const saveBtn = document.createElement('button');
            saveBtn.textContent = 'Save to File';
            saveBtn.onclick = () => {
                const defaultPath = filePath.replace('.ts', '.test.ts').replace('.py', '_test.py');
                const outputPath = prompt(`Enter path to save test file:`, defaultPath);
                if (outputPath) applyChanges(outputPath, newContent, panel);
            };
            actions.appendChild(saveBtn);
            panel.appendChild(actions);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }

    async function showGitBranchesDialog() {
        const panel = createTab('Analyze Branches');
        panel.innerHTML = '<h3>Loading branch history...</h3>';
        try {
            const response = await fetch('/api/branches');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const branches = await response.json();
            
            if (branches.length < 2) {
                panel.innerHTML = '<h3>Not enough branches to compare.</h3>';
                return;
            }

            const branchList = document.createElement('ul');
            branches.forEach(branchName => {
                const li = document.createElement('li');
                li.textContent = branchName;
                li.onclick = () => onBranchSelect_Start(branchName, branches, panel);
                branchList.appendChild(li);
            });
            panel.innerHTML = '<h3>Select the BASE branch (e.g., main):</h3>';
            panel.appendChild(branchList);

        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    function onBranchSelect_Start(baseBranch, branches, panel) {
        panel.innerHTML = '<h3>Select the COMPARE branch (e.g., your feature branch):</h3>';
        const remainingBranches = branches.filter(b => b !== baseBranch);
        const branchList = document.createElement('ul');
        remainingBranches.forEach(branchName => {
            const li = document.createElement('li');
            li.textContent = branchName;
            li.onclick = () => onBranchSelect_End(baseBranch, branchName, panel);
            branchList.appendChild(li);
        });
        panel.appendChild(branchList);
    }

    async function onBranchSelect_End(baseBranch, compareBranch, panel) {
        panel.innerHTML = '<h3>Generating Diff and AI Analysis...</h3>';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ baseBranch, compareBranch }), // Send branches instead of commits
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, analysis } = await response.json();
            
            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            const analysisHtml = (typeof analysis === 'string' && analysis) ? analysis.replace(/\n/g, '<br>') : 'No analysis provided.';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysisHtml}</p>`;
            
            displayDiff(panel, patch, `Diff: ${baseBranch}...${compareBranch}`);
            panel.prepend(analysisElement);
        } catch (e) {
            panel.innerHTML = `Error: ${e.message}`;
        }
    }

    async function showGitDiffDialog() {
        const panel = createTab('Analyze Commits');
        panel.innerHTML = '<h3>Loading commit history...</h3>';
        try {
            const response = await fetch('/api/commits');
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const commits = await response.json();
            if (commits.length === 0) {
                panel.innerHTML = '<h3>No commits found in this repository.</h3>'; return;
            }
            const commitList = document.createElement('ul');
            commits.forEach(commitLine => {
                const [hash, author, date, msg] = commitLine.split('|');
                const li = document.createElement('li');
                li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
                li.dataset.hash = hash;
                commitList.appendChild(li);
            });
            panel.innerHTML = '<h3>Select the START commit (older):</h3>';
            panel.appendChild(commitList);
            panel.querySelectorAll('li').forEach(li => {
                li.onclick = () => onCommitSelect_Start(li.dataset.hash, commits, panel);
            });
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }
    
    function onCommitSelect_Start(startCommit, commits, panel) {
        panel.innerHTML = '<h3>Select the END commit (newer):</h3>';
        const commitList = document.createElement('ul');
        commits.forEach(commitLine => {
            const [hash, author, date, msg] = commitLine.split('|');
            const li = document.createElement('li');
            li.textContent = `${hash} - ${msg.trim()} (${author}, ${date})`;
            li.dataset.hash = hash;
            commitList.appendChild(li);
        });
        panel.appendChild(commitList);
        panel.querySelectorAll('li').forEach(li => {
            li.onclick = () => onCommitSelect_End(startCommit, li.dataset.hash, panel);
        });
    }
    async function onCommitSelect_End(startCommit, endCommit, panel) {
        panel.innerHTML = '<h3>Generating Diff and AI Analysis...</h3>';
        try {
            const response = await fetch('/api/diff', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ startCommit, endCommit }),
            });
            if (!response.ok) throw new Error(`Server error: ${response.statusText}`);
            const { patch, analysis } = await response.json();
            const analysisElement = document.createElement('div');
            analysisElement.className = 'ai-analysis';
            const analysisHtml = (typeof analysis === 'string' && analysis) ? analysis.replace(/\n/g, '<br>') : 'No analysis provided.';
            analysisElement.innerHTML = `<h3>AI Summary</h3><p>${analysisHtml}</p>`;
            displayDiff(panel, patch, `Diff: ${startCommit.substring(0,7)}..${endCommit.substring(0,7)}`);
            panel.prepend(analysisElement);
        } catch (e) { panel.innerHTML = `Error: ${e.message}`; }
    }
    function displayDiff(panel, patch, title) {
        document.querySelector(`.tab[data-tab-id="${panel.dataset.tabId}"] span:first-child`).textContent = title;
        const diffJson = Diff2Html.parse(patch);
        const diffHtml = Diff2Html.html(diffJson, {
            drawFileList: false,
            outputFormat: 'side-by-side',
            matching: 'lines',
            colorScheme: 'dark'
        });
        if (!diffHtml) {
            panel.innerHTML = `<h3>${title}</h3><p>No changes detected.</p>`;
            return;
        }
        panel.innerHTML = `<h3>${title}</h3>` + diffHtml;
    }
});