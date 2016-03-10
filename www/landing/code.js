// Connect to the databases for each chat, so we can display their actual content

var db_key = {"one": "social",
	      "two": "chat",
	      "thre": "details",
	      "four": "physical"};

var dbs = {};
var msgs ={};
var views={};

Object.keys(db_key).forEach(function(key) {
    dbs[key] = new S.Database(db_key[key] + "/db/");
    dbs[key].connect();

    dbs[key].socket.onerror = function() {console.log("wserror", key); }
    dbs[key].socket.onclose = function() {console.log("wsclose", key); }

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

	// Close screen
	$chatOne.querySelector(".close").onclick = function() {
	    $chatOne.classList.remove("visible");
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

	    if(ext == "jpg" || ext == "png" || ext == "gif") {
		var $img = document.createElement("img");
		$img.src = obj.get_attachment_url(name);
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
