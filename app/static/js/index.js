// Delete button confirmation state
let deleteConfirmState = false;
let deleteTimeout = null;

// Update selection count in real-time
function updateSelectionCount() {
    const checkedBoxes = document.querySelectorAll('input[name="selected_files"]:checked');
    document.getElementById('selectionCount').textContent = checkedBoxes.length;
}

// Drive Toggle Button functionality
const driveToggleBtn = document.getElementById('driveToggleBtn');
if (driveToggleBtn) {
    driveToggleBtn.addEventListener('click', async () => {
        try {
            const response = await fetch('/toggle_drive', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                }
            });

            if (response.ok) {
                const data = await response.json();
                // Update button text
                driveToggleBtn.textContent = data.button_text;
                // Reload the page to show the new drive's root directory
                window.location.href = '/';
            } else {
                console.error('Failed to toggle drive');
                alert('Failed to switch drive. Please try again.');
            }
        } catch (error) {
            console.error('Error toggling drive:', error);
            alert('Error switching drive. Please try again.');
        }
    });
}

// Handle file card selection with instant updates
document.querySelectorAll('.file-card').forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    const filepath = card.dataset.filepath;
    const isDir = card.dataset.isDir === 'true';

    card.addEventListener('click', async (e) => {
        if (e.target.closest('.kebab-menu-container')) {
            return;
        }
        // If clicking a link, allow normal behavior
        if (e.target.tagName === "A") {
            return;
        }

        // For folders, if clicking on the folder checkbox area, toggle selection
        if (isDir && e.target.closest('.folder-checkbox-area')) {
            e.preventDefault();
            e.stopPropagation();

            checkbox.checked = !checkbox.checked;
            card.classList.toggle('selected', checkbox.checked);
            updateSelectionCount();

            const action = checkbox.checked ? 'add' : 'remove';
            await updateServerSelection(action, filepath, checkbox, card);
            return;
        }

        // For folders, if clicking anywhere else on the card, navigate
        if (isDir) {
            const link = card.querySelector('a');
            if (link) {
                window.location.href = link.href;
            }
            return;
        }

        // For files, toggle selection
        e.preventDefault();
        checkbox.checked = !checkbox.checked;
        card.classList.toggle('selected', checkbox.checked);
        updateSelectionCount();

        const action = checkbox.checked ? 'add' : 'remove';
        await updateServerSelection(action, filepath, checkbox, card);
    });
});

async function updateServerSelection(action, filepath, checkbox, card) {
    try {
        const response = await fetch('/update_selection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: action,
                filepath: filepath
            })
        });

        if (response.ok) {
            // Update the local array so "View Selected" is accurate without a refresh
            if (action === 'add') {
                if (!SELECTED_FILES.includes(filepath)) {
                    SELECTED_FILES.push(filepath);
                }
            } else if (action === 'remove') {
                const index = SELECTED_FILES.indexOf(filepath);
                if (index > -1) {
                    SELECTED_FILES.splice(index, 1);
                }
            }

            // Sync the counter display
            document.getElementById('selectionCount').textContent = SELECTED_FILES.length;
        } else {
            console.error('Failed to update selection');
            // Revert UI if server fails
            checkbox.checked = !checkbox.checked;
            card.classList.toggle('selected', checkbox.checked);
        }
    } catch (error) {
        console.error('Error updating selection:', error);
        checkbox.checked = !checkbox.checked;
        card.classList.toggle('selected', checkbox.checked);
    }
}

// Select All in Directory button
document.getElementById('select_all_button').addEventListener('click', async () => {
    const allCards = document.querySelectorAll('.file-card');
    const allCheckboxes = document.querySelectorAll('input[name="selected_files"]');

    // Select all files/folders
    for (let i = 0; i < allCards.length; i++) {
        const card = allCards[i];
        const checkbox = allCheckboxes[i];
        const filepath = card.dataset.filepath;

        if (!checkbox.checked) {
            checkbox.checked = true;
            card.classList.add('selected');

            // Update server
            await updateServerSelection('add', filepath, checkbox, card);
        }
    }

    updateSelectionCount();
});

// Delete button with confirmation
const deleteButton = document.getElementById('delete_button');
deleteButton.addEventListener('click', () => {
    const checkedBoxes = document.querySelectorAll('input[name="selected_files"]:checked');
    if (checkedBoxes.length === 0) {
        alert('Please select at least one file');
        return;
    }

    if (!deleteConfirmState) {
        // First click - change to confirmation state
        deleteConfirmState = true;
        deleteButton.textContent = 'Confirm Deletion';
        deleteButton.classList.add('confirm-delete');

        // Reset after 5 seconds
        deleteTimeout = setTimeout(() => {
            deleteConfirmState = false;
            deleteButton.textContent = 'Delete Selected';
            deleteButton.classList.remove('confirm-delete');
            // Clear the delete input when timeout expires
            document.getElementById('delete_input').value = '';
        }, 5000);
    } else {
        // Second click - actually delete
        clearTimeout(deleteTimeout);
        document.getElementById('delete_input').value = 'delete';
        document.getElementById('fileForm').submit();
    }
});



// New Folder Modal ----------------------------
const newFolderModal = document.getElementById('createFolderModal');
const folderBtn = document.getElementById('create_folder');
const closeFolderBtn = document.querySelector('#createFolderModal .close'); // More specific selector
const folderNameInput = document.getElementById('folder_name_input');
const confirmCreateBtn = document.getElementById('confirmCreateFolder');

// Open modal when button clicked
folderBtn.addEventListener('click', (e) => {
    e.preventDefault(); // Prevent form submission
    folderNameInput.value = ''; // Clear input
    newFolderModal.style.display = 'block';
});

// Close modal
closeFolderBtn.addEventListener('click', () => {
    newFolderModal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
    if (e.target === newFolderModal) {
        newFolderModal.style.display = 'none';
    }
});

// Sanitize folder name - remove unsafe characters
function sanitizeFolderName(name) {
    // Remove leading/trailing whitespace
    name = name.trim();

    // Replace unsafe characters with underscores
    // Disallow: / \ : * ? " < > |
    name = name.replace(/[\/\\:*?"<>|]/g, '_');

    // Remove leading/trailing dots (hidden files or current/parent dir)
    name = name.replace(/^\.+|\.+$/g, '');

    return name;
}


// Confirm and create folder
confirmCreateBtn.addEventListener('click', () => {
    let folderName = folderNameInput.value;

    if (!folderName || folderName.trim() === '') {
        alert('Please enter a folder name');
        return;
    }

    // Sanitize the input
    folderName = sanitizeFolderName(folderName);

    if (!folderName || folderName === '') {
        alert('Invalid folder name. Please use only valid characters.');
        return;
    }

    // Set the hidden input value and submit
    document.getElementById('folder_name_hidden').value = folderName;

    // Create a hidden submit button specifically for folder creation
    const hiddenSubmit = document.createElement('input');
    hiddenSubmit.type = 'hidden';
    hiddenSubmit.name = 'create_folder';
    hiddenSubmit.value = 'create_folder';
    document.getElementById('fileForm').appendChild(hiddenSubmit);

    document.getElementById('fileForm').submit();
    newFolderModal.style.display = 'none';
});



// Process Modal functionality -----------------------------------------
const modal = document.getElementById('myModal');
const processBtn = document.getElementById('process_button');
const closeBtn = document.querySelector('.close');

processBtn.addEventListener('click', () => {
    // Use the global selection count instead of just current directory checkboxes
    const globalSelectionCount = parseInt(document.getElementById('selectionCount').textContent);

    if (globalSelectionCount === 0) {
        alert('Please select at least one file');
        return;
    }

    // Clear the delete input when opening process modal
    document.getElementById('delete_input').value = '';

    modal.style.display = 'block';
});

closeBtn.addEventListener('click', () => {
    modal.style.display = 'none';
});

window.addEventListener('click', (e) => {
    if (e.target === modal) {
        modal.style.display = 'none';
    }
});

// Handles Data Submission
// ALSO: Add a form submit handler to ensure process doesn't include delete
document.getElementById('fileForm').addEventListener('submit', (e) => {
    // If processing, make sure delete is cleared
    if (e.submitter && e.submitter.name === 'process') {
        document.getElementById('delete_input').value = '';
        console.log('Processing files - delete input cleared');
    }

    // If deleting, make sure it's intentional
    if (document.getElementById('delete_input').value === 'delete') {
        console.log('Deleting files');
    }
});


// View Selected Modal functionality
const viewSelectedModal = document.getElementById('viewSelectedModal');
const viewSelectedBtn = document.getElementById('view_selected_button');
const closeViewSelectedBtn = document.getElementById('closeViewSelected');

if (viewSelectedBtn) {
    viewSelectedBtn.addEventListener('click', () => {
        console.log('View Selected button clicked');

        // Use the global selection count instead of just current directory checkboxes
        const globalSelectionCount = parseInt(document.getElementById('selectionCount').textContent);
        console.log('Global selection count:', globalSelectionCount);

        if (globalSelectionCount === 0) {
            alert('No files selected');
            return;
        }

        populateSelectedFilesList();
        viewSelectedModal.style.display = 'block';
    });
}

if (closeViewSelectedBtn) {
    closeViewSelectedBtn.addEventListener('click', () => {
        viewSelectedModal.style.display = 'none';
    });
}

window.addEventListener('click', (e) => {
    if (e.target === viewSelectedModal) {
        viewSelectedModal.style.display = 'none';
    }
});

function populateSelectedFilesList() {
    // Use the selected array passed from Flask template (from selected_files.txt)
    const selectedFiles = SELECTED_FILES;
    const selectedFilesList = document.getElementById('selectedFilesList');
    const modalCount = document.getElementById('modalSelectionCount');

    console.log('Populating list with', selectedFiles.length, 'items from selected_files.txt');

    if (modalCount) {
        modalCount.textContent = selectedFiles.length;
    }

    if (selectedFiles.length === 0) {
        selectedFilesList.innerHTML = '<div class="no-selection">No files selected</div>';
        return;
    }

    selectedFilesList.innerHTML = '';

    selectedFiles.forEach(filepath => {
        const fileName = filepath.split('/').pop() || filepath;

        // Determine if it's a directory by checking the filesystem
        // (We may not have the card in the current view, so default to file icon)
        const card = document.querySelector('.file-card[data-filepath="' + filepath.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
        const isDir = card ? card.dataset.isDir === 'true' : false;

        const fileItem = document.createElement('div');
        fileItem.className = 'selected-file-item';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.setAttribute('data-filepath', filepath);
        removeBtn.setAttribute('title', 'Remove from selection (does not delete file)');
        removeBtn.textContent = '❌';
        removeBtn.setAttribute('type', 'button');

        const typeIcon = document.createElement('span');
        typeIcon.className = 'file-type-icon';
        typeIcon.textContent = isDir ? '📁' : '📄';

        const fileNameSpan = document.createElement('span');
        fileNameSpan.className = 'file-path';
        fileNameSpan.setAttribute('title', filepath);
        fileNameSpan.textContent = fileName;

        fileItem.appendChild(removeBtn);
        fileItem.appendChild(typeIcon);
        fileItem.appendChild(fileNameSpan);

        selectedFilesList.appendChild(fileItem);

        removeBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            e.stopPropagation();
            await removeFromSelection(filepath);
        });
    });
}

async function removeFromSelection(filepath) {
    console.log('Removing from selection (not deleting file):', filepath);

    // Try to find the card if it exists in current view
    const card = document.querySelector('.file-card[data-filepath="' + filepath.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"]');
    const checkbox = card ? card.querySelector('input[type="checkbox"]') : null;

    // Update server to remove from selection file
    try {
        const response = await fetch('/update_selection', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                action: 'remove',
                filepath: filepath
            })
        });

        if (!response.ok) {
            console.error('Failed to remove from selection');
            alert('Failed to remove from selection. Please try again.');
            return;
        }

        console.log('Successfully removed from selection');

        // If the checkbox exists in current view, update it
        if (checkbox && card) {
            checkbox.checked = false;
            card.classList.remove('selected');
        }

        // Update SELECTED_FILES array by removing this filepath
        const index = SELECTED_FILES.indexOf(filepath);
        if (index > -1) {
            SELECTED_FILES.splice(index, 1);
        }

        // Update the global count display
        document.getElementById('selectionCount').textContent = SELECTED_FILES.length;

        // Refresh the modal list to show updated selection
        populateSelectedFilesList();

    }
    catch (error) {
        console.error('Error removing from selection:', error);
        alert('Error removing from selection. Please try again.');
    }
}

// ============================================
// Kebab Menu functionality
// ============================================
let currentOpenKebab = null;

// Toggle kebab menus - use event delegation on document
document.addEventListener('click', (e) => {
    // Check if click is on kebab button or its child (the dots span)
    const kebabButton = e.target.closest('.kebab-button');

    if (kebabButton) {
        e.preventDefault();
        e.stopPropagation();

        const dropdown = kebabButton.nextElementSibling;
        const currentCard = kebabButton.closest('.file-card'); // Get the card

        // 1. Close any OTHER open kebab menus first
        if (currentOpenKebab && currentOpenKebab !== dropdown) {
            currentOpenKebab.classList.remove('show');
            // Remove z-index boost from the previous card
            currentOpenKebab.closest('.file-card').classList.remove('menu-active');
        }

        // 2. Toggle THIS dropdown
        dropdown.classList.toggle('show');

        // 3. Toggle the z-index class on the parent card
        if (dropdown.classList.contains('show')) {
            currentCard.classList.add('menu-active');
            currentOpenKebab = dropdown;
        } else {
            currentCard.classList.remove('menu-active');
            currentOpenKebab = null;
        }

        return;
    }

    // If we clicked on a kebab option, do nothing (let the other handler work)
    if (e.target.closest('.kebab-option')) {
        return;
    }

    // 4. Click outside - close active menu and reset card z-index
    if (currentOpenKebab) {
        console.log('Closing kebab menu (clicked outside)');
        currentOpenKebab.classList.remove('show');

        // Remove the class from the card to reset stacking order
        currentOpenKebab.closest('.file-card').classList.remove('menu-active');

        currentOpenKebab = null;
    }
});

// Handle kebab menu options
document.addEventListener('click', async (e) => {
    const option = e.target.closest('.kebab-option');

    if (option) {
        console.log('Kebab option clicked:', option.dataset.action);
        e.preventDefault();
        e.stopPropagation();

        const action = option.dataset.action;
        const container = option.closest('.kebab-menu-container');
        const dropdown = container.querySelector('.kebab-dropdown');
        const card = option.closest('.file-card');
        const filepath = card.dataset.filepath;
        const isDir = card.dataset.isDir === 'true';
        const checkbox = card.querySelector('input[type="checkbox"]');

        // Close the dropdown
        dropdown.classList.remove('show');
        currentOpenKebab = null;

        // Handle different actions
        switch (action) {
            case 'select':
                checkbox.checked = !checkbox.checked;
                card.classList.toggle('selected', checkbox.checked);
                updateSelectionCount();
                const selectAction = checkbox.checked ? 'add' : 'remove';
                await updateServerSelection(selectAction, filepath, checkbox, card);
                break;

            case 'open':
                if (isDir) {
                    const link = card.querySelector('a');
                    if (link) {
                        window.location.href = link.href;
                    }
                }
                break;

            case 'delete':
                const filename = filepath.split('/').pop() || filepath.split('\\').pop();
                if (confirm(`Are you sure you want to delete "${filename}"?`)) {
                    const form = document.getElementById('fileForm');
                    const singleInput = document.getElementById('delete_single_file_input');
                    singleInput.value = filepath;
                    form.submit();
                }
                break;

            case 'rename':
                const currentName = filepath.replace(/\\/g, '/').split('/').pop();

                const newName = prompt('Enter new name:', currentName);
                if (newName && newName !== currentName) {
                    await renameFile(filepath, newName);
                }
                break;

            case 'download':
                alert('Download functionality - to be implemented');
                // You can implement download here
                break;

            default:
                console.log('Unknown action:', action);
        }
    }
});

// Rename function (you'll need to add a backend route for this)
async function renameFile(filepath, newName) {
    try {
        const response = await fetch('/rename', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                filepath: filepath,
                new_name: newName
            })
        });

        if (response.ok) {
            alert('File renamed successfully');
            location.reload();
        } else {
            alert('Failed to rename file');
        }
    } catch (error) {
        console.error('Error renaming file:', error);
        alert('Error renaming file');
    }
}

// Hide dmix functionality
const hideDmixCheckbox = document.getElementById('hideDmixCheckbox');

// Load saved preference from localStorage
if (localStorage.getItem('hideDmix') === 'true') {
    hideDmixCheckbox.checked = true;
    hideDmixFiles();
}

// Handle checkbox change
hideDmixCheckbox.addEventListener('change', () => {
    if (hideDmixCheckbox.checked) {
        hideDmixFiles();
        localStorage.setItem('hideDmix', 'true');
    } else {
        showDmixFiles();
        localStorage.setItem('hideDmix', 'false');
    }
});

function hideDmixFiles() {
    const dmixCards = document.querySelectorAll('.file-card.dmix-file');
    dmixCards.forEach(card => {
        card.style.display = 'none';
    });
}

function showDmixFiles() {
    const dmixCards = document.querySelectorAll('.file-card.dmix-file');
    dmixCards.forEach(card => {
        card.style.display = '';
    });
}