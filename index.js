/*
 * JPC is JSON-RPC 2.0 JavaScript Client
*/

var EventEmitter = require('eventemitter3');
var extend = require('extend');

function JPC(connectionString) {
  this.connectionString = connectionString;
  this.messageNum = 0;
  this.reconnectInterval = null;
  this.token = null;

  this.open();
}

extend(true, JPC.prototype, EventEmitter.prototype);

JPC.prototype.open = function() {
  this.shouldReconnect = true;
  this.ws = this._initSocket();
}

JPC.prototype.close = function() {
  this.shouldReconnect = false;
  this.removeAllListeners();
  this.ws.close();
}

JPC.prototype.call = function(method, params, callback) {
  var eventId = this._makeEventId();
  var message;

  if (callback) {
    message = this._makeMessage(method, params, eventId);
    this.once(eventId, callback);
  } else {
    message = this._makeMessage(method, params);
  }

  this._send(message);

  return eventId;
}

JPC.prototype.subscribe = function(channel, callback) {
  var eventId = this._makeEventId();
  var message = this._makeMessage('subscribe', channel, eventId);

  this.once(eventId, function(result) {
    if (result.status == 'subscribed') {
      this.on(result.channel + '_channel', callback);
    }
  });

  this._send(message);

  return eventId;
}

JPC.prototype.unsubscribe = function(channel) {
  var eventId = this._makeEventId();
  var message = this._makeMessage('unsubscribe', channel, eventId);

  this.once(eventId, function(result) {
    if (result.status == 'unsubscribed') {
      this.removeListener(result.channel + '_channel');
    }
  });

  this._send(message);

  return eventId;
}

JPC.prototype._initSocket = function() {
  var self = this;
  var ws = new WebSocket(this.connectionString);

  ws.onopen = function(event) {
    self.emit('open', event);

    if (self.reconnectInterval) {
      clearTimeout(self.reconnectInterval);
      self.reconnectInterval = null;
    }
  };

  ws.onclose = function(event) {
    if (self.shouldReconnect === false) {
      self.emit('close', event);
      return;
    }

    self.emit('lost', event);

    if (self.reconnectInterval === null) {
      self.reconnectInterval = setInterval(function() {
        self.open();
      }, 5000);
    }
  };

  ws.onmessage = function(message) {
    var data = JSON.parse(message.data);

    if (!data.hasOwnProperty('jsonrpc')) {
      self.emit('error', 'Invalid JSON-RPC message');
      return;
    }

    if (data.hasOwnProperty('error')) {
      if (data.error.code && data.error.message) {
        self.emit('error', data.error.message, data.error.code);
      } else {
        self.emit('error', 'Wrong error format');
      }

      return;
    }

    if (data.hasOwnProperty('result')) {
      if (!data.hasOwnProperty('id')) {
        self.emit('error', 'Message ID is missing');
        return;
      }

      self.emit(data.id, data.result);
      return;
    }

    if (data.hasOwnProperty('channel')) {
      self.emit(data.channel + '_channel', data.payload);
      return;
    }

    self.emit('error', 'Unhandled message');
  };

  ws.onerror = function(error) {
    self.emit('error', error);
  };

  return ws;
};

JPC.prototype._send = function(message) {
  var self = this;

  while (this.ws.readyState !== 1) {
    setTimeout(function () {
      self._send(message);
    }, 1000);

    return;
  }

  this.ws.send(message);
};

JPC.prototype._makeMessage = function(method, params, id) {
  if (!method) {
    this.emit('error', 'Method is not specified');
    return;
  }

  var message = { jsonrpc: '2.0' };
  if (id) message.id = id;
  message.method = method;

  if (params !== null) {
    message.params = params;
  }

  if (this.token) {
    message.token = this.token;
  }

  return JSON.stringify(message);
};

JPC.prototype._makeEventId = function() {
  this.messageNum++;

  return Date.now().toString(36)
    + Math.random().toString(36).substr(2, 5)
    + this.messageNum.toString(36)
};

module.exports = JPC;
