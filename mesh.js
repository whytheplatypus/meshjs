
//I'm being bad and not wrapping anything..

/**
 * Light EventEmitter. Ported from Node.js/events.js
 * Eric Zhang
 */

/**
 * EventEmitter class
 * Creates an object with event registering and firing methods
 */
function EventEmitter() {
  // Initialise required storage variables
  this._events = {};
}

var isArray = Array.isArray;


EventEmitter.prototype.addListener = function(type, listener, scope, once) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }
  
  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, typeof listener.listener === 'function' ?
            listener.listener : listener);
            
  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // If we've already got an array, just append.
    this._events[type].push(listener);

  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }
  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener, scope) {
  if ('function' !== typeof listener) {
    throw new Error('.once only takes instances of Function');
  }

  var self = this;
  function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  };

  g.listener = listener;
  self.on(type, g);

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener, scope) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var position = -1;
    for (var i = 0, length = list.length; i < length; i++) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener))
      {
        position = i;
        break;
      }
    }

    if (position < 0) return this;
    list.splice(position, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (list === listener ||
             (list.listener && list.listener === listener))
  {
    delete this._events[type];
  }

  return this;
};


EventEmitter.prototype.off = EventEmitter.prototype.removeListener;


EventEmitter.prototype.removeAllListeners = function(type) {
  if (arguments.length === 0) {
    this._events = {};
    return this;
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

EventEmitter.prototype.emit = function(type) {
  var type = arguments[0];
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var l = arguments.length;
        var args = new Array(l - 1);
        for (var i = 1; i < l; i++) args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var l = arguments.length;
    var args = new Array(l - 1);
    for (var i = 1; i < l; i++) args[i - 1] = arguments[i];

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;
  } else {
    return false;
  }
};

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
