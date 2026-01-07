from flask import Flask
import os
import json

def create_app():
    app = Flask(__name__)

    basedir = os.path.abspath(os.path.dirname(__file__))
    config_path = os.path.join(basedir, "..", "config.local.json")
    
    with open(config_path) as f:
        config_data = json.load(f)

    app.secret_key = config_data["my_key"]
    app.config["STARTING_PATH"] = config_data["starting_path"]
    app.config["SELECTION_FILE"] = config_data["selection_file"]
    app.config["LOG_PATH"] = config_data["log_path"]
    app.config["ONLY_SHOW_ROOT_FOLDERS"] = config_data["root_bool"]
    app.config["scripts_folder"] = config_data["scripts_folder"]
    
    if app.config["ONLY_SHOW_ROOT_FOLDERS"]:
        app.config["ALLOWED_ROOT_FOLDERS"] = set(config_data.get("allowed_root_folders", []))

    from .routes import main as main_blueprint
    app.register_blueprint(main_blueprint)

    return app