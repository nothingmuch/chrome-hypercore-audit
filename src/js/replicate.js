"use strict";

var key = process.argv[2]

console.log(key)

var wrtc = require('electron-webrtc')({ headless: true })

var hypercore = require('hypercore')


var swarm = require('webrtc-swarm')
var signalhub = require('signalhub')

var core = hypercore('./archive/' + key + '/metadata', key)

var streams = {}

core.on('ready', function(){
    replicate(core)

    var s = core.createReadStream({ start: 0, live: true, snapshot: false, wait: true });
    s.on('data', function (block) {
        console.log("session", block)
        var session = hypercore('./archive/' + key + '/' + block.toString('hex'), block)
        session.on('ready', function(){
            console.log("replicating", session.discoveryKey)
            replicate(session)

            var s = session.createReadStream({ start: 0, live: true, snapshot: false, wait: true });
            s.on('data', function (block) {
                // console.log("block", block.toString())
            })
            s.on('end', function (block) {
                console.log("end")
            })
            s.resume()
        })
    })
    s.on('end', function (block) {
        console.log("root end")
    })
    s.resume()
})


function replicate(core) {
    console.log("discovering", core.discoveryKey.toString('hex'))

    var hub = signalhub(core.discoveryKey.toString('hex'), ['http://localhost:8080'])

    var sw = swarm(hub, {
        wrtc: wrtc
        // wrtc: require('wrtc')
    })


    // Replicate
    var pump = require('pump')

    sw.on('peer', function(peer, id) {
        console.log('connected to a new peer:', id)
        console.log('total peers:', sw.peers.length)
        var replstream = core.replicate({ encrypt: false, download: true, upload: false, live: true })
        console.log("starting pump");
        pump(peer, replstream, peer, function (...args) {
            console.log("pump complete", args)
        })
    })

    sw.on('disconnect', function (peer, id) {
        console.log('disconnected from a peer:', id)
        console.log('total peers:', sw.peers.length)
    })

    //core.on('download', function (block, data) {
        //console.log("downloaded", block, data.toString())
    //});
}
