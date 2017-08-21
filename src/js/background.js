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

var pump = require('pump');
var swarm = require('webrtc-swarm');
var signalhub = require('signalhub');

var hypercore = require('hypercore');
var crypto = require('hypercore/lib/crypto');

var rai = require('random-access-idb');

var metadata = hypercore(rai('feeds'), { storeSecretKey: true, live: true, createIfMissing: true, overwrite: false });

var cores = {};

metadata.on('ready', function() {
    var keypair = crypto.keyPair();

    console.log('keypair', keypair.publicKey.toString('hex'));

    var session = hypercore(rai(keypair.publicKey.toString('hex')), keypair.publicKey, {
        live: true,
        valueEncoding: 'json',
        secretKey: keypair.secretKey,
        storeSecretKey: false,
    });

    cores[keypair.publicKey] = session

    session.on('ready', function() {
        console.log("appending", session.key.toString('hex'))
        metadata.append(session.key)

        replicate(session);

        register(function(event){ session.append(event) });
    });

    replicate(metadata);

    console.log("blocks in metadata:", metadata.length)
    for ( var i = metadata.length; i >= 0 && metadata.has(i); i-- ) {
        var b = i;
        console.log("var block", b)
        metadata.get(i, null, function(err, pubkey) {
            console.log("var block", b, err, pubkey.toString('hex'))
             if (!cores[pubkey]) {
                 // TODO clear, close & destroy after n replication acks on this core
                 console.log("serving", pubkey)
                 replicate(cores[pubkey] = hypercore(rai(pubkey.toString('hex')), pubkey, { createIfMissing: false }));
             }
         })
     }

    console.log('meta feed key is', metadata.key.toString('hex'))
    metadata.on('upload', function(block, data) {
        console.log('uploaded block', block, data)
    });

});



function register(f) {
    chrome.windows.getAll({ populate: true }, function (windows) {
        f({
            type: 'snapshot',
            windows: windows,
            now: Date.now(),
        })
    })

    Object.keys(categories).forEach(function(category) {
        console.log("registering", category);
        categories[category].forEach(function(event) {
            console.log("registering", category, event);
            chrome[category]["on" + event].addListener(function(...args) {
                f({
                    category: category,
                    event: event,
                    args: args,
                    now: Date.now()
                });
            });
        });
    });
}

function replicate(feed) {
    console.log("discovering", feed.discoveryKey.toString('hex'))
    var hub = signalhub(feed.discoveryKey.toString('hex'), ['http://localhost:8080'])

    console.log("feed key", feed.key.toString('hex'))

    var sw = swarm(hub, {});

    sw.on('peer', function(peer, id) {
        console.log('connected to a new peer:', id)
        console.log('total peers:', sw.peers.length)

        var prevUpdateEnd = peer._updateEnd
        peer._updateEnd = function() {
            prevUpdateEnd.call(this)
            console.log("After update end remote bitfield is ", peer.remoteBitField)
        };

        var replstream = feed.replicate({ encrypt: false, upload: true, download: false, live: true })
        console.log("starting pump");
        pump(peer, replstream, peer, function (...args) {
            console.log("pump complete", args)
        })
    })

    sw.on('disconnect', function(peer, id) {
        console.log('disconnected from a peer:', id)
        console.log('total peers:', sw.peers.length)
    })
}


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


