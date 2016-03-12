# GUI

#!/usr/bin/env python

from PyQt5 import QtWidgets

import logging
import threading
from twisted.internet import reactor
import webbrowser
import os
import sys

import serve
from __version__ import __version__

def get_open_port(desired=0):
    import socket
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("",desired))
    except socket.error:
        return get_open_port(0)
    s.listen(1)
    port = s.getsockname()[1]
    s.close()
    return port

PORT = get_open_port(8001)

DBDIR = sys.argv[1] if len(sys.argv) > 1 else None

webthread = None

def start_thread():
    global webthread
    
    # Start a thread for the web server.
    if not DBDIR:
        return
    webthread = threading.Thread(target=serve.serve, args=(DBDIR, PORT))
    webthread.start()

def open_browser():
    webbrowser.open("http://localhost:%d/" % (PORT))

def open_about():
    webbrowser.open("https://lowerquality.com/chat")

app = QtWidgets.QApplication(sys.argv)

w = QtWidgets.QWidget()
w.resize(250, 150)
w.setWindowTitle('Chat')

def run_chat():
    global DBDIR
    # Select a database directory
    if DBDIR is None:
        DBDIR = QtWidgets.QFileDialog.getExistingDirectory(
            None,
            "Select a database folder",
            os.path.join(os.path.expanduser("~"), "Desktop"),
            QtWidgets.QFileDialog.ShowDirsOnly)
    start_thread()

    txt.setText("Chat (%s) is running" % (__version__))

    btn.setText("Open in browser")
    btn.clicked.disconnect()
    btn.clicked.connect(open_browser)

def quit_server():
    app.exit()

layout = QtWidgets.QVBoxLayout()
w.setLayout(layout)

txt = QtWidgets.QLabel('Chat (v.%s) is not running' % (__version__))
layout.addWidget(txt)

btn = QtWidgets.QPushButton('Run chat')
btn.setStyleSheet("font-weight: bold;")
layout.addWidget(btn)
btn.clicked.connect(run_chat)

abt = QtWidgets.QPushButton('About Chat')
layout.addWidget(abt)
abt.clicked.connect(open_about)

quitb = QtWidgets.QPushButton('Quit')
layout.addWidget(quitb)
quitb.clicked.connect(quit_server)

w.show()

if DBDIR is not None:
    run_chat()

w.raise_()
w.activateWindow()
 
app.exec_()

logging.info("Waiting for server to quit.")
reactor.callFromThread(reactor.stop)
if webthread:
    webthread.join()
