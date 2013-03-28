

/*
 * Mesh JS extends Peer.js by handeling automatic
 * creation of a fully connected graph (everyone connected to everyon)
 * and wrapping the output of the connections into a simplified nodejs Stream API
 */

var Mesh = function(id, opts){
	var self = this;
	var options;
	if (id && id.constructor == Object) {
		options = id;
		id = undefined;
	}
	if (!(this instanceof Mesh)) return new Mesh(id, options);
	EventEmitter.call(this);

	if(id === undefined){
		this.peer = new Peer(options);
	} else {
		this.peer = new Peer(id, opts);
	}

	self.peer.on('connection', function(conn){
		self.write({
           type:"connect",
           id:conn.peer
        });
        conn.on('data', function(data) {
            self.read(data);
        });
    });
};

//i'll clean this up some day
function inherits(ctor, superCtor) {
	ctor.super_ = superCtor;
	ctor.prototype = Object.create(superCtor.prototype, {
	  constructor: {
	    value: ctor,
	    enumerable: false,
	    writable: true,
	    configurable: true
	  }
	});
}

inherits(Mesh, EventEmitter);

Mesh.prototype.read = function(data){
	var self = this;
	if(data.type == 'connect'){
        if(self.peer.connections[data.id] === undefined && data.id != self.peer.id){
            self.connect(data.id);
        }
    } else {
    	self.emit('data', data);
    }
}

Mesh.prototype.connect = function(id) {
	var self = this;
    console.log("connecting to " + id);

    self.write({
       type:"connect",
       id:id
    });
    
    var conn = self.peer.connect(id);
    conn.on('data', function(data){
        self.read(data);
    });
    return conn;
};

Mesh.prototype.write = function(package){
	var self = this;
	for(var key in self.peer.connections){
    	var conn = self.peer.connections[key];
        for(var label in conn){
            var channel = conn[label]
            if(channel.open){
                channel.send(package);
            } else {
                channel.once('open', function() {
                    channel.send(package);
                });
            }
        }
    }
};
