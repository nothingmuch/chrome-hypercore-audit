"use strict";

var key = '2bc930e3487e05bccc234c928a9513a2ed3f2c2e30e59dd2dbae9e7ca5f52e86'

var hypercore = require('hypercore')
var memdb = require('memdb')

var core = hypercore(memdb())
var feed = core.createFeed(key)

var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

console.log("discovering", feed.discoveryKey.toString('hex'))

var hub = signalhub(feed.discoveryKey.toString('hex'), ['http://localhost:8080'])

var sw = swarm(hub, {
    wrtc: require('electron-webrtc')({ headless: true })
    // wrtc: require('wrtc')
})


// Replicate
var pump = require('pump')

sw.on('peer', function(peer, id) {
    console.log('connected to a new peer:', id)
    console.log('total peers:', sw.peers.length)
    var replstream = feed.replicate({ download: true })
    console.log("starting pump");
    pump(peer, replstream, peer, function (...args) {
        console.log("pump complete", args)
    })
})

sw.on('disconnect', function (peer, id) {
    console.log('disconnected from a peer:', id)
    console.log('total peers:', sw.peers.length)
})

feed.on('download', function (block, data) {
    console.log("downloaded", block, data.toString())
});
