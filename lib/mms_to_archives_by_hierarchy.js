'use strict'

module.exports = function mmsToArchivesByHierarchy (callback) {
  // var viafParse = require(`${__dirname}/viaf_parse`)
  var db = require('nypl-registry-utils-database')
  // var clc = require('cli-color')
  var cluster = require('cluster')
  var totalBots = 8
  totalBots = Array.from(new Array(totalBots), (x, i) => i)

  if (cluster.isMaster) {
    // grab all the collections we need to look at
    db.returnCollectionRegistry('mmsCollections', (err, mmsCollections) => {
      if (err) console.log(err)
      mmsCollections.find({matchedArchives: true}).toArray((err, mmsCollectionsAry) => {
        if (err) console.log(err)
        totalBots.forEach((x) => {
          var worker = cluster.fork()
          console.log('Spawing worker', worker.id)
          worker.on('message', function (msg) {
            // asking for a collection to work, send it or tell them to exit
            if (msg.request) {
              if (mmsCollectionsAry.length === 0) {
                worker.send({ die: true })
              } else {
                worker.send({ work: mmsCollectionsAry.shift() })
              }
            }
          })
        })
      })
    })

    cluster.on('exit', (worker, code, signal) => {
      setTimeout(() => {
        if (Object.keys(cluster.workers).length === 0) {
          if (callback) {
            callback()
            callback = null // make sure it doesn't get called again since we are using setTimeout to check the worker status
          }
        }
      }, 500)
    })
  } else {
    var mapUtils = require('../lib/utils.js')
    // THE WORKER
    process.on('message', (msg) => {
      if (msg.die) {
        console.log('Done Working. #', cluster.worker.id)
        process.exit(0)
      }
      if (msg.work) {
        // console.log(msg.work.title)
        mapUtils.returnMmsCollectionDetails(msg.work, (err, data) => {
          if (err) console.log(err)

          // it already has some sort of mapping from identifiers or from manual work, go with that.
          if (data.itemCountMatchedToArchives >= 5 || data.containerCountMatchedToArchives >= 5) {
            process.send({ results: 'Already has mapping', title: msg.work.title, id: msg.work.mmsDb, archivesId: msg.work.archivesCollectionDb })
            process.send({ request: true })
            return true
          }
          // there is nothing to map the items to
          if (data.componentCount === 0) {
            process.send({ results: 'No Components to map to', title: msg.work.title, id: msg.work.mmsDb, archivesId: msg.work.archivesCollectionDb })
            process.send({ request: true })
            return true
          }

          data.collection = msg.work
          // if (msg.work.title === 'Gideon Welles papers, 1825-1878, bulk (1840-1864)') {
          //   console.log(msg.work.title)
          //   console.log(JSON.stringify(data))
          // }

          // send the data into the maping method and then send it off to get updated in the DB
          mapUtils.updateHierarchyMatches(mapUtils.mapHierarchyByContainers(data), (err, results) => {
            if (err) console.log(err)
            // next
            process.send({ request: true })
          })
        })
      }
    })

    // ask for the first collection to work
    process.send({ request: true })
  }
}
