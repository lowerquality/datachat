// Connect to the databases for each chat, so we can display their actual content

var db_key = {"one": "social",
	      "two": "chat",
	      "thre": "details",
	      "four": "physical"};

var dbs = {};
var msgs ={};
var views={};

for(var key in db_key) {
    dbs[key] = new S.Database(db_key[key] + "/db/");
    dbs[key].connect();

    msgs[key] = new S.Subcollection(dbs[key], function(x) { return x.type=="message"; });

    var $column = document.getElementById(key);
    var $list = $column.querySelector("ul");
    // Clear
    $list.innerHTML = "";

    views[key] = new S.CollectionView(msgs[key], function(obj, $div) {

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
    }, "li", function(x,y) { return x.time > y.time ? 1 : -1}, $list);

    // Hook up the input to to be a functioning element

    var $textarea = $column.querySelector("textarea");

    var send_message = function() {
	if(!this.$textarea.value) {
	    console.log("Refusing to send an empty message");
	    return
	}
	var doc = new S.Document(this.db, {
	    "type": "message",
	    "time": new Date().getTime(),
	    "text": this.$textarea.value
	});
	doc.save();

	this.$textarea.value = "";
    }.bind({"$textarea": $textarea, "db": dbs[key]});

    $textarea.onkeydown = function(ev) {
	if(ev.keyCode == 13) {	// Return key
	    // TODO: Check if SHIFT is depressed, to allow a newline
	    ev.preventDefault();

	    this.send_message();
	}
    }.bind({"send_message": send_message});

    // Find the clickable arrow
    var $arrow = $column.querySelector(".send");
    $arrow.onclick = send_message;


    //Allow dragging files into the text area
    $textarea.addEventListener("dragover", function(evt) {
    	evt.stopPropagation();
    	evt.preventDefault();
    	evt.dataTransfer.dropEffect = "copy";
	this.$textarea.parentElement.classList.add("over");
    }.bind({"$textarea": $textarea}), false);

    $textarea.addEventListener("dragleave", function(evt) {
    	evt.stopPropagation();
    	evt.preventDefault();
	this.$textarea.parentElement.classList.remove("over");
    }.bind({"$textarea": $textarea}), false);

    $textarea.addEventListener("drop", function(evt) {
    	evt.preventDefault();

	if(this.$textarea.parentElement.className.indexOf("over") >= 0) {
	    this.$textarea.parentElement.classList.remove("over");
	}

	var files = evt.dataTransfer.files;

	// Make one Document for all uploaded attachments
	var doc = new S.Document(this.db, {
	    "type": "message",
	    "time": new Date().getTime(),
	});

	var file = files[0];

	doc.save(function() {
	    this.doc.put_file_attachment(file.name, this.file, null, function(percent) {
		console.log("placeholder", "" + Math.floor(percent*100) + "%");

		this.$textarea.setAttribute("placeholder", "" + Math.floor(percent*100) + "%");
		if(percent == 1) {
		    this.$textarea.setAttribute("placeholder", "type or drag here");
		}
	    }.bind({"$textarea": this.$textarea}));
	}.bind({
	    doc: doc,
	    "$textarea": this.$textarea,
	    file: file}));

    }.bind({
	db: dbs[key],
	"$textarea": $textarea	
    }), false);


    dbs[key].onload = function() {
	views[this.key].sort();

	// Scroll to the bottom
	// this.$list.scrollTop = this.$list.scrollHeight;
	
    }.bind({key: key, "$list": $list});

}
