// Connect to the databases for each chat, so we can display their actual content

var db_key = {"one": "social",
	      "two": "chat",
	      "thre": "details",
	      "four": "physical"};

var dbs = {};
var msgs ={};
var views={};

var bigview, codelog;

var CodeLog = function(key, $root) {
    S.Triggerable.call(this);
    
    this.key = key;
    this.db = dbs[key];

    this.$el = $root;
    // Clear
    this.$el.innerHTML = "";

    // Make sure we have at least one code object
    var msg_render = this.db.get("message-render");
    if(!msg_render) {
	msg_render = new S.Document(this.db, {
	    "_id": "message-render",
	    "type": "message",
	    "code": [
		"CHAT.message_render = function(obj, $div) {",
		"    $div.textContent = JSON.stringify(obj.get_doc());",
		"}"
	    ].join("\n")
	});
	msg_render.save();
    }
    this.init_code();

    this.log("" + this.db.items().length + " documents loaded into database `" + db_key[key] + "`");

    this.connect(this.db, "create", this._oncreate.bind(this));
    this.connect(this.db, "change", this._onchange.bind(this));
    this.connect(this.db, "delete", this._ondelete.bind(this));
}
CodeLog.prototype = new S.Triggerable;
CodeLog.prototype.init_code = function() {
    this.db.items("time")
	.filter(function(obj) { return obj.type=='message' && obj.code; })
	.forEach(function(obj) {
	    var $li = this.put_preamble(obj);
	    var $code = document.createElement("textarea");
	    $code.className = "code";
	    $code.value = obj.code;
	    $li.appendChild($code);
	}, this)
}
CodeLog.prototype.render_kv = function(k,v,classname, $parent) {
    var $span = document.createElement("span");
    $span.className = "keyvalue";
    if(classname) {
	$span.classList.add(classname)
    }

    var $k = document.createElement("span");
    $k.className = "key";
    $k.textContent = k;
    $span.appendChild($k);

    var $v = document.createElement("span");
    $v.className = "value";
    $v.textContent = v;
    $span.appendChild($v);

    if($parent) {
	$parent.appendChild($span);
    }
    
    return $span;
}
CodeLog.prototype.put_preamble = function(obj) {
    var $li = document.createElement("li");

    var $intro = document.createElement("div");
    $intro.className = "intro";
    $li.appendChild($intro);

    if(obj.type) {
	this.render_kv("type", obj.type, "type", $intro);
    }
    this.render_kv("_id", obj._id, "id", $intro);
    if(obj.time || obj._rev) {
	this.render_kv("time", "" + new Date(obj.time || 1000*Number(obj._rev.split("-")[1])), "time", $intro);
    }
    if(obj._peer) {
	this.render_kv("_peer", obj._peer, "peer", $intro);
    }

    this.$el.appendChild($li);
    return $li;
}
CodeLog.prototype.log = function(msg, classname) {
    var $li = document.createElement("li");
    if(classname) {
	$li.className = classname;
    }
    $li.textContent = msg;
    this.$el.appendChild($li);
}
CodeLog.prototype._oncreate = function(obj) {
    this.put_preamble(obj);
}
CodeLog.prototype._onchange = function(obj) {
    this.put_preamble(obj);
}
CodeLog.prototype._ondelete = function(obj) {
    this.put_preamble(obj);
}

Object.keys(db_key).forEach(function(key) {
    dbs[key] = new S.Database(db_key[key] + "/db/");
    dbs[key].connect();

    dbs[key].socket.onerror = function() {console.log("wserror", key); }
    dbs[key].socket.onclose = function() {
	ws_closed(key);
    }

    msgs[key] = new S.Subcollection(dbs[key], function(x) { return x.type=="message"; });

    var $column = document.getElementById(key);
    var $list = $column.querySelector("ul");
    // Clear
    $list.innerHTML = "";

    views[key] = new S.CollectionView(msgs[key], message_render, "li", message_sort, $list);

    // Hook up the input to to be a functioning element
    var $textarea = $column.querySelector("textarea");

    // Find the clickable arrow
    var $arrow = $column.querySelector(".send");

    bind_message_send(dbs[key], $textarea, $arrow);
    
    bind_message_drag(dbs[key], $textarea);

    var $opener = $column.querySelector(".open");
    $opener.onclick = function() {
	// Show split screen
	var $chatOne = document.getElementById("chatOne");
	$chatOne.classList.add("visible");

	// NEED TO FIX: DIFFERENTIATE BETWEEN LEFT AND RIGHT TEXTAREAS!
	var $textA = $chatOne.querySelector("textarea");

	// Add "zoomed" class to the column
	views[key].$el.parentElement.classList.add("zoomed");

	// Get the right prefix for the <li> and <p>
	var $preFix = views[key].$el.getAttribute("class");
	var $fiXed = $chatOne.querySelector(".numb");

	// Show messages
	var $list = document.getElementById("leftOne");
	$list.innerHTML = "";
	
	// Add the right prefix to the <li> and <p>
	$list.classList.add($preFix);
	$fiXed.classList.add($preFix);
	
	bigview = new S.CollectionView(msgs[key], message_render, "li", message_sort, $list);

	// Create a log
	codelog = new CodeLog(key, document.getElementById("codeOne"));
	
	// Right screen
	/*var $renderF = $chatOne.querySelector(".renderF");
	$renderF.innerHTML = message_render;*/

	// Close screen
	$chatOne.querySelector(".close").onclick = function() {
	    bigview.destroy();
	    bigview = null;

	    codelog.destroy();
	    codelog = null;
	    
	    // Empty textarea when closing window
	    $textA.value = "";
	    $chatOne.classList.remove("visible");
	    views[key].$el.parentElement.classList.remove("zoomed");
	    
	    // Remove prefixes
	    $list.classList.remove($preFix);
	    $fiXed.classList.remove($preFix);
	}
    }

    dbs[key].onload = function() {
	views[key].sort();
    }
})

function message_render(obj, $div) {
    // Are we at the bottom?
    var at_bottom = ($div.parentElement.scrollTop + $div.parentElement.clientHeight) >= ($div.parentElement.scrollHeight - 30);
    
    // replace newlines with breaks
    if(obj.text) {
	var text = obj.text.replace("\n", "<p>");
	text = text.replace(/(https?:\/\/[^\s$]*)[\s$]?/gim, '<a class="extlink" target="_blank" href="$1">$1</a> ')
	$div.innerHTML = text;
    }
    if(obj._attachments) {
	for(var name in obj._attachments) {
	    var parts = name.split(".");
	    var ext = parts[parts.length-1].toLowerCase();

	    var $a = document.createElement("a");
	    $a.setAttribute("target", "_blank");
	    $a.href = obj.get_attachment_url(name);

	    if(ext == "jpg" || ext == "png" || ext == "jpeg" || ext == "gif") {
		var $img = document.createElement("img");
		if(ext == "gif") {
		    $img.src = obj.get_attachment_url(name);
		}
		else {
		    $img.src = obj.get_attachment_url(name + ".x100.jpg");
		}
		$a.appendChild($img);
	    }
	    else {
		$a.textContent = name;
	    }
	    $div.appendChild($a);
	}
    }

    if(at_bottom) {
	// Make sure we're still at the bottom
	$div.parentElement.scrollTop = $div.parentElement.scrollHeight;
    }
}

function message_sort(x,y) {
    return x.time > y.time ? 1 : -1
}

function bind_message_send(db, $textarea, $arrow) {

    var _send_cb = function() {
	if(!$textarea.value) {
	    console.log("Refusing to send an empty message");
	    return
	}
	var doc = new S.Document(db, {
	    "type": "message",
	    "time": new Date().getTime(),
	    "text": $textarea.value
	});
	doc.save();

	$textarea.value = "";
    }

    $arrow.onclick = _send_cb;

    $textarea.onkeydown = function(ev) {
	if(ev.keyCode == 13) {	// Return key
	    // TODO: Check if SHIFT is depressed, to allow a newline
	    ev.preventDefault();

	    _send_cb();
	}
    }
    
}

function bind_message_drag(db, $textarea) {
    //Allow dragging files into the text area
    
    $textarea.addEventListener("dragover", function(evt) {
    	evt.stopPropagation();
    	evt.preventDefault();
    	evt.dataTransfer.dropEffect = "copy";
	$textarea.parentElement.classList.add("over");
    }, false);

    $textarea.addEventListener("dragleave", function(evt) {
    	evt.stopPropagation();
    	evt.preventDefault();
	$textarea.parentElement.classList.remove("over");
    }, false)

    $textarea.addEventListener("drop", function(evt) {
    	evt.preventDefault();

	if($textarea.parentElement.className.indexOf("over") >= 0) {
	    $textarea.parentElement.classList.remove("over");
	}

	var files = evt.dataTransfer.files;

	// Make one Document for all uploaded attachments
	var doc = new S.Document(db, {
	    "type": "message",
	    "time": new Date().getTime(),
	});

	var file = files[0];

	doc.save(function() {
	    this.doc.put_file_attachment(file.name, this.file, null, function(percent) {
		$textarea.setAttribute("placeholder", "" + Math.floor(percent*100) + "%");
		if(percent == 1) {
		    $textarea.setAttribute("placeholder", "type or drag here");
		}
	    });
	}.bind({doc: doc, file: file}))
    }, false);
}

function ws_closed(key) {
    // uh-oh!
    var $column = document.getElementById(key);
    var $textarea = $column.querySelector("textarea");

    $textarea.value = "";
    $textarea.setAttribute("readonly", true);
    $textarea.setAttribute("placeholder", "disconnected...");
    $textarea.onclick = window.location.reload.bind(window.location);
}
