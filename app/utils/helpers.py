import os
import mimetypes
from flask import current_app

mimetypes.add_type('video/x-matroska', '.mkv')

def del_files(full_paths):
    deleted_count = 0
    for full_path in full_paths:
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
                msg = f'✓ Deleted: "{full_path}"\n'
                deleted_count += 1
            except Exception as e:
                msg = f'✗ Error deleting "{full_path}": {str(e)}\n'
        else:
            msg = f'✗ File not found: "{full_path}"\n'

        write_log(msg)
    
    write_log(f"\nTotal deleted: {deleted_count}/{len(full_paths)}\n{'='*50}\n")



def fileTypes(entries, path):
    files = []
    for entry in entries:
        if entry.lower().endswith('.parts'):
            continue
        full_path = os.path.join(path, entry)
        files.append({
            "name": entry,
            "file_type": identify_file(full_path),
            "full_path": full_path,
            "is_dir": os.path.isdir(full_path)
        })

    files.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
    return files


def identify_file(path):
    if os.path.isdir(path):
        return "folder"
    mime_type, _ = mimetypes.guess_type(path)
    if mime_type:
        if mime_type.startswith('image'):
            return "img"
        elif mime_type.startswith('video'):
            return "vid"
        elif mime_type.startswith('text'):
            return "txt"
    return "unknown"

# SELECTION FILE HELPERS
def get_selected_files():
    """Read selected file paths from the selection file"""
    if not os.path.exists(current_app.config["SELECTION_FILE"]):
        return set()
    
    with open(current_app.config["SELECTION_FILE"], "r", encoding="utf-8") as f:
        return set(line.strip() for line in f if line.strip())


def add_selected_file(filepath):
    """Add a single file to the selection"""
    selected = get_selected_files()
    selected.add(filepath)
    save_selected_files(selected)


def remove_selected_file(filepath):
    """Remove a single file from the selection"""
    selected = get_selected_files()
    selected.discard(filepath)
    save_selected_files(selected)


def save_selected_files(file_paths):
    """Write selected file paths to the selection file"""
    os.makedirs("scripts", exist_ok=True)
    with open(current_app.config["SELECTION_FILE"], "w", encoding="utf-8") as f:
        for path in sorted(file_paths):
            f.write(path + "\n")


def clear_selected_files():
    """Clear the selection file"""
    if os.path.exists(current_app.config["SELECTION_FILE"]):
        os.remove(current_app.config["SELECTION_FILE"])

def get_available_scripts():
    # Use .get() to prevent KeyError. If missing, it returns None.
    scripts_path = current_app.config.get("scripts_folder")
    
    if not scripts_path or not os.path.exists(scripts_path):
        # Log the error so you know why scripts aren't showing up
        print(f"DEBUG: SCRIPTS_FOLDER not found or invalid: {scripts_path}")
        return []

    # If it's a directory, list files. If it's a file path, handle accordingly.
    if os.path.isdir(scripts_path):
        return [f for f in os.listdir(scripts_path) if f.endswith('.py')]
    
    return []


def write_log(msg):
    os.makedirs("scripts", exist_ok=True)
    with open(current_app.config["LOG_PATH"], "a", encoding="utf-8") as log:
        log.write(msg)