from flask import Flask, render_template, request, redirect, url_for
import os
import importlib

app = Flask(__name__)

base_path = r"C:\Users\david\OneDrive\Desktop\test"
os.environ["PATH"] += os.pathsep + r"C:\ffmpeg\bin"


@app.route("/", methods = ['GET','POST'])
def hello_world():
    path = os.listdir(path=base_path)
    script_dir = os.path.join(os.path.dirname(__file__), "scripts")
    script_list = os.listdir(script_dir)
    scripts = [s for s in script_list if s.endswith(".py")]


    if request.method == 'POST':
        if 'delete' in request.form:
            files = request.form.getlist('selected_files')
            del_files(files)
            return redirect(url_for('hello_world'))
        elif 'process' in request.form:
            selected_files = request.form.getlist("selected_files")
            selected_file_paths = [os.path.join(base_path, f) for f in selected_files]
            selected_script = request.form.get("selected_script").strip()
            module_name = selected_script.replace(".py", "")
            mod = importlib.import_module(f"scripts.{module_name}")
            if hasattr(mod, "main"):
                mod.main(selected_file_paths)
            else:
                write_log(f"Script '{selected_script}' does NOT define main()")

            return redirect(url_for('hello_world'))
            
    return render_template('index.html', files=path, scripts=scripts)

@app.route("/logs")
def show_logs():
    with open("scripts\logs.txt", "r") as file:
        return file.read()

def del_files(files):
    for file in files:
        delete_me = os.path.join(base_path, file)
        if os.path.exists(delete_me):
            os.remove(delete_me)
            msg = f'File "{file}" deleted.\n'
        else:
            msg = f'File "{file}" DNE.\n'
        write_log(msg)

def write_log(msg):
    with open("scripts\logs.txt", "a") as log:
        log.write(msg)

@app.route("/logs_raw")
def logs_raw():
    try:
        with open("scripts/logs.txt", "r", encoding="utf-8") as f:
            return f.read()
    except FileNotFoundError:
        return ""


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=True)
