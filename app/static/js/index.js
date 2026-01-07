// Delete button confirmation state
let deleteConfirmState = false;
let deleteTimeout = null;

// Update selection count in real-time
function updateSelectionCount() {
    const checkedBoxes = document.querySelectorAll('input[name="selected_files"]:checked');
    document.getElementById('selectionCount').textContent = checkedBoxes.length;
}

// Handle file card selection with instant updates
document.querySelectorAll('.file-card').forEach(card => {
    const checkbox = card.querySelector('input[type="checkbox"]');
    const filepath = card.dataset.filepath;
    const isDir = card.dataset.isDir === 'true';

    card.addEventListener('click', async (e) => {
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

// Process Modal functionality
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