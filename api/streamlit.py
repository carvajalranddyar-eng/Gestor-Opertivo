import subprocess
import os
import sys

def handler(event, context):
    # Run streamlit app
    cmd = [
        sys.executable, 
        "-m", 
        "streamlit", 
        "run", 
        "auditor_app.py",
        "--server.port=8501",
        "--server.address=0.0.0.0",
        "--server.headless=true"
    ]
    
    process = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE
    )
    
    return {
        "statusCode": 200,
        "body": "Streamlit app started"
    }
