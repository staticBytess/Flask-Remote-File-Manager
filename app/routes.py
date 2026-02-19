import importlib
from flask import Blueprint, redirect, render_template, request, jsonify, current_app, url_for, session
import os
from .utils.helpers import *

# Define the blueprint + var setup
main = Blueprint('main', __name__)


# AJAX ENDPOINT FOR INSTANT SELECTION UPDATES
@main.route("/update_selection", methods=['POST'])
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
    
    return jsonify({
        'success': True, 
        'selected_count': len(get_selected_files())
    })


# DRIVE TOGGLE ENDPOINT
@main.route("/toggle_drive", methods=['POST'])
def toggle_drive():
    """Toggle between first and alternate starting paths"""
    current_drive = session.get('current_drive', 'D')
    
    # Toggle the drive
    if current_drive == 'D':
        session['current_drive'] = 'E'
        new_drive = 'E'
    else:
        session['current_drive'] = 'D'
        new_drive = 'D'
    
    return jsonify({
        'success': True,
        'current_drive': new_drive,
        'button_text': 'Switch to Drive D' if new_drive == 'E' else 'Switch to Drive E'
    })


# INDEX + NAVIGATION
@main.route("/", defaults={"req_path": ""}, methods=['GET','POST'])
@main.route("/<path:req_path>", methods=['GET','POST'])
def index(req_path):
    # Get current drive from session (default to 'D')
    current_drive = session.get('current_drive', 'D')
    
    # Choose the appropriate base path based on current drive
    if current_drive == 'E':
        base_path = current_app.config.get("ALT_STARTING_PATH", current_app.config["STARTING_PATH"])
    else:
        base_path = current_app.config["STARTING_PATH"]

    abs_path = os.path.join(base_path, req_path)

    abs_path = os.path.abspath(abs_path)
    if not abs_path.startswith(os.path.abspath(base_path)):
        return "Access denied", 403
    
    # Get sort parameters from request
    sort_by = request.args.get('sort_by', 'name')  # default: name
    sort_order = request.args.get('sort_order', 'asc')  # default: ascending

    # Filter only at root (base_path)
    if os.path.isdir(abs_path):
        entries = os.listdir(abs_path)
        if current_app.config["ONLY_SHOW_ROOT_FOLDERS"] and abs_path.rstrip("\\/") == os.path.abspath(base_path).rstrip("\\/"):
            entries = [
                e for e in entries
                if e in current_app.config["ALLOWED_ROOT_FOLDERS"]
                and os.path.isdir(os.path.join(abs_path, e))
            ]
        files = fileTypes(entries, abs_path, sort_by, sort_order)
    else:
        return f"{abs_path} is not a directory", 404


    if request.method == 'POST':

        if 'clear_selection' in request.form:
            clear_selected_files()
            return redirect(url_for('main.index', req_path=req_path))

        # IMPORTANT: Check for delete FIRST and only if the delete input is explicitly set
        if 'delete' in request.form and request.form.get('delete') == 'delete':
            delete_targets = get_selected_files()
            if delete_targets:
                del_files(delete_targets)
                clear_selected_files()
            return redirect(url_for('main.index', req_path=req_path))
        
        if request.form.get('delete_single_file'):
            target_file = request.form.get('delete_single_file')
            if target_file:
                remove_selected_file(target_file)
                del_files([target_file])
            return redirect(url_for('main.index', req_path=req_path))

        # Process should only run if delete is NOT set
        if 'process' in request.form:
            # Double-check that we're not also deleting
            if request.form.get('delete') == 'delete':
                write_log("ERROR: Both process and delete were triggered. Ignoring request.")
                return redirect(url_for('main.index', req_path=req_path))
                
            process_targets = get_selected_files()
            selected_script = request.form.get("selected_script", "").strip()
            
            if not selected_script:
                write_log("No script selected")
                return redirect(url_for('main.index', req_path=req_path))
            
            try:
                write_log(f"{'='*20}\nStarting script: {selected_script}\nFiles to process: {len(process_targets)}\n{'='*20}")
                
                module_name = selected_script.replace(".py", "")
                mod = importlib.import_module(f"app.scripts.{module_name}")

                if hasattr(mod, "main"):
                    mod.main(list(process_targets))
                    write_log(f"✓ Successfully processed {len(process_targets)} files with {selected_script}")
                else:
                    write_log(f"✗ Script '{selected_script}' does NOT define main()")
            except Exception as e:
                write_log(f"✗ Error running script '{selected_script}': {str(e)}")
                import traceback
                write_log(traceback.format_exc())

            clear_selected_files()
            return redirect(url_for('main.index', req_path=req_path))
        
        if 'create_folder' in request.form:
            folder_name = request.form.get('folder_name', '').strip()
            create_folder(folder_name, abs_path)
            return redirect(url_for('main.index', req_path=req_path))
        
        if 'move_here' in request.form:
            if not get_selected_files():
                write_log("No files selected")
            else:
                move_files(abs_path)
            return redirect(url_for('main.index', req_path=req_path))

        return redirect(url_for('main.index', req_path=req_path))

    scripts = get_available_scripts()
    selected = get_selected_files()

    return render_template("index.html", files=files, current_path=req_path, selected=list(selected), scripts=scripts, current_drive=current_drive)


# RENAME
@main.route("/rename", methods=['POST'])
def rename():
    data = request.get_json()
    curr_filepath = data.get('filepath')
    new_name = data.get('new_name')
    rename_file(curr_filepath, new_name)
    return "OK", 200

# LOGS
@main.route("/logs")
def show_logs():
    try:
        with open(current_app.config["LOG_PATH"], "r") as file:
            return file.read()
    except FileNotFoundError:
        return "No logs found"


@main.route("/logs_raw")
def logs_raw():
    try:
        with open(current_app.config["LOG_PATH"], "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""