from flask import Flask, render_template, request, redirect, url_for, jsonify
import os
import json
import importlib

app = Flask(__name__)

with open("config.local.json") as f:
    config = json.load(f)

app.secret_key = config["my_key"]
STARTING_PATH = config["starting_path"]
SELECTION_FILE = config["selection_file"]
LOG_PATH = config["log_path"]


# SELECTION FILE HELPERS
def get_selected_files():
    """Read selected file paths from the selection file"""
    if not os.path.exists(SELECTION_FILE):
        return set()
    
    with open(SELECTION_FILE, "r", encoding="utf-8") as f:
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
    with open(SELECTION_FILE, "w", encoding="utf-8") as f:
        for path in sorted(file_paths):
            f.write(path + "\n")


def clear_selected_files():
    """Clear the selection file"""
    if os.path.exists(SELECTION_FILE):
        os.remove(SELECTION_FILE)


# AJAX ENDPOINT FOR INSTANT SELECTION UPDATES
@app.route("/update_selection", methods=['POST'])
def update_selection():
    """Handle individual file selection/deselection via AJAX"""
    data = request.get_json()
    action = data.get('action')
    filepath = data.get('filepath')
    
    if not filepath:
        return jsonify({'error': 'No filepath provided'}), 400
    
    if action == 'add':
        add_selected_file(filepath)
    elif action == 'remove':
        remove_selected_file(filepath)
    else:
        return jsonify({'error': 'Invalid action'}), 400
    
    return jsonify({'success': True, 'selected_count': len(get_selected_files())})


# INDEX + NAVIGATION
@app.route("/", defaults={"req_path": ""}, methods=['GET','POST'])
@app.route("/<path:req_path>", methods=['GET','POST'])
def index(req_path):

    base_path = STARTING_PATH
    abs_path = os.path.join(base_path, req_path)

    abs_path = os.path.abspath(abs_path)
    if not abs_path.startswith(os.path.abspath(STARTING_PATH)):
        return "Access denied", 403

    if os.path.isdir(abs_path):
        entries = os.listdir(abs_path)
        files = fileTypes(entries, abs_path)
    else:
        return f"{abs_path} is not a directory", 404

    if request.method == 'POST':

        if 'clear_selection' in request.form:
            clear_selected_files()
            return redirect(url_for('index', req_path=req_path))

        if 'delete' in request.form:
            delete_targets = get_selected_files()
            if delete_targets:
                del_files(delete_targets)
                clear_selected_files()
            return redirect(url_for('index', req_path=req_path))

        if 'process' in request.form:
            process_targets = get_selected_files()
            selected_script = request.form.get("selected_script", "").strip()
            
            if not selected_script:
                write_log("No script selected\n")
                return redirect(url_for('index', req_path=req_path))
            
            if not process_targets:
                write_log("No files selected\n")
                return redirect(url_for('index', req_path=req_path))
            
            try:
                module_name = selected_script.replace(".py", "")
                mod = importlib.import_module(f"scripts.{module_name}")

                if hasattr(mod, "main"):
                    mod.main(list(process_targets))
                    write_log(f"Successfully processed {len(process_targets)} files with {selected_script}\n")
                else:
                    write_log(f"Script '{selected_script}' does NOT define main()\n")
            except Exception as e:
                write_log(f"Error running script '{selected_script}': {str(e)}\n")

            clear_selected_files()
            return redirect(url_for('index', req_path=req_path))

        return redirect(url_for('index', req_path=req_path))

    scripts = get_available_scripts()
    selected = get_selected_files()

    return render_template(
        "test.html",
        files=files,
        current_path=req_path,
        selected=list(selected),
        scripts=scripts
    )


# LOGS
@app.route("/logs")
def show_logs():
    try:
        with open(LOG_PATH, "r") as file:
            return file.read()
    except FileNotFoundError:
        return "No logs found"


@app.route("/logs_raw")
def logs_raw():
    try:
        with open(LOG_PATH, "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


# HELPERS
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


def write_log(msg):
    os.makedirs("scripts", exist_ok=True)
    with open(LOG_PATH, "a", encoding="utf-8") as log:
        log.write(msg)


def fileTypes(entries, path):
    files = []
    for entry in entries:
        full_path = os.path.join(path, entry)
        files.append({
            "name": entry,
            "is_dir": os.path.isdir(full_path),
            "full_path": full_path
        })

    files.sort(key=lambda x: (not x['is_dir'], x['name'].lower()))
    return files


def get_available_scripts():
    """Get list of available Python scripts in the scripts folder"""
    scripts_path = "scripts"
    if not os.path.exists(scripts_path):
        return []
    
    scripts = []
    for file in os.listdir(scripts_path):
        if file.endswith('.py') and not file.startswith('_'):
            scripts.append(file)
    
    return sorted(scripts)

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)