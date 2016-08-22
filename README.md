# JPC

JPC is JavaScript Library that provides JSON-RPC 2.0 client with pub/sub channels support via WebSockets.

## Usage

You should set up your backend to support JSON-RPC 2.0 via WebSockets. I recommend to use my gem http://github.com/lysenkooo/jpc-ruby.

```javascript
var jpc = JPC('ws://localhost:8090');

jpc.call('ping', null, function(response) {
    console.log('Response: ', response);
});
```
