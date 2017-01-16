"use strict";


/* TODO
 - dump initial state?
    - windows
    - tabs
    - history?
 - system.memory & cpu polling
 - pageCapture
 - generate event handlers by scraping developer API pages
 - can anything interesting be done with GCM? pairing?
 - network, webrequests, identity?
 - filter events with checkboxes, rules https://developer.chrome.com/extensions/events
*/

var categories = {
    "tabs": ["Created", "Updated", "Moved", "Activated", "Highlighted", "Detached", "Attached", "Removed", "Replaced"],
    "windows": ["Created", "Removed", "FocusChanged"],
    "bookmarks": ["Created", "Removed", "Changed", "Moved", "ChildrenReordered"],
    "cookies": ["Changed"],
    "history": ["Visited"],
    "downloads": ["Created", "Erased", "Changed", "DeterminingFilename"],
    "sessions": ["Changed"],
    "idle": ["StateChanged"]
};

var hypercore = require('hypercore');
var memdb = require('memdb');

var core = hypercore(memdb());
var feed = core.createFeed();


console.log('key is', feed.key.toString('hex'))

feed.on('upload', function(block, data) {
    console.log('uploaded block', block, data)
})

Object.keys(categories).forEach(function(category) {
    console.log("registering", category);
    categories[category].forEach(function(event) {
        console.log("registering", category, event);
        chrome[category]["on" + event].addListener(function(...args) {
            var msg = JSON.stringify({
                category: category,
                event: event,
                args: args,
                now: Date.now()
            });
            feed.append(msg, function() {
                console.log("appended", msg);
                console.log('key is', feed.key.toString('hex'));
            });
        });
    });
});

// Replicate
var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var hub = signalhub('swarm-example', ['http://localhost:8080'])

console.log(feed.key.toString('hex'))

var sw = swarm(hub, {});

sw.on('peer', function(peer, id) {
    console.log('connected to a new peer:', id)
    console.log('total peers:', sw.peers.length)
})

sw.on('disconnect', function(peer, id) {
    console.log('disconnected from a peer:', id)
    console.log('total peers:', sw.peers.length)
})


/* no worky - hyperdiscovery had webrtc support removed, and now tries
discovery-swarm directly, which fails. chrome.sockets api only available to
apps, not extensions.

var swarm = require('hyperdiscovery')

var sw = swarm(feed)
sw.on('connection', function (peer, type) {
    console.log('got', peer, type) // type is 'webrtc-swarm' or 'discovery-swarm' 
    console.log('connected to', sw.connections.length, 'peers')
    peer.on('close', function () {
        console.log('peer disconnected')
    })
})
*/
