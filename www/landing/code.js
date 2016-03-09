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

    dbs[key].onload = function() {
	views[this.key].sort();
    }.bind({key: key});

    msgs[key] = new S.Subcollection(dbs[key], function(x) { return x.type=="message"; });

    var $column = document.getElementById(key);
    var $list = $column.querySelector("ul");
    // Clear
    $list.innerHTML = "";

    views[key] = new S.CollectionView(msgs[key], function(obj, $div) {
	// replace newlines with breaks
	if(obj.text) {
	    var text = obj.text.replace("\n", "<p>");
	    text = text.replace(/(https?:\/\/[^\s$]*)[\s$]/gim, '<a class="extlink" target="_blank" href="$1">$1</a> ')
	    $div.innerHTML = text;
	}
	if(obj._attachments) {
	    for(var name in obj._attachments) {
		var $a = document.createElement("a");
		$a.href = obj.get_attachment_url(name);
		$a.textContent = name;
		$div.appendChild($a);

		var parts = name.split(".");
		var ext = parts[parts.length-1].toLowerCase();
		if(ext == "jpg" || ext == "png") {
		    var $img = document.createElement("img");
		    $img.src = obj.get_attachment_url(name);
		    $div.appendChild($img);
		}
	    }
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
    }, false);

    $textarea.addEventListener("drop", function(evt) {
    	evt.preventDefault();
	var files = evt.dataTransfer.files;

	// Make one Document for all uploaded attachments
	var doc = new S.Document(this.db, {
	    "type": "message",
	    "time": new Date().getTime(),
	});

	var file = files[0];

	doc.save(function() {
	    this.doc.put_file_attachment(file.name, this.file);
	}.bind({
	    doc: doc,
	    file: file}));

    }.bind({
	db: dbs[key]
    }), false);;

}