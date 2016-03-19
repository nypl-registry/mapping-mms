'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Maps MMS items to Archive components based on MSS and bNumber if they have not been matched yet
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemsToArchivesComponents (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'archivesComponents']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var archivesComponents = returnCollections.registryIngest.archivesComponents

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var percentDone = 0

    mmsItems.count({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}], 'matchedArchives': {$exists: false} }, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var checkForArchivesComponentMatches = (mmsItem, callback) => {
      if (Math.floor(++count / totalItems * 100) !== percentDone) {
        process.stdout.cursorTo(0)
        process.stdout.write(clc.black.bgYellowBright(`MMS Item Map: ${percentDone}% (${countUpdated} Items)`))
        percentDone = Math.floor(count / totalItems * 100)
      }

      var mss = (mmsItem.mss) ? mmsItem.mss : -1000
      var bNumber = (mmsItem.bNumber) ? mmsItem.bNumber : 'Not a b number'
      if (mss === -1000 && bNumber === 'Not a b number') {
        callback(err, '')
        return false
      }

      archivesComponents.find({ $or: [{ bNumber: bNumber }, { mss: parseInt(mss) }] }).toArray((err, archiveComponentAry) => {
        if (archiveComponentAry.length > 0) {
          countUpdated++
          callback(err, {mmsItem: mmsItem, archivesComponents: archiveComponentAry})
        } else {
          callback(err, '')
        }
      })
    }

    var updateArchivesComponentMatches = (matches, callback) => {
      var archivesIds = matches.archivesComponents.map((x) => {
        return x._id
      })

      // update the MMS collection
      var updateMms = {
        _id: matches.mmsItem._id,
        matchedArchives: true,
        matchedArchivesType: 'identifier',
        archivesCollectionDb: archivesIds
      }

      var updateArchives = {
        matchedMms: true,
        matchedMmsType: 'identifier',
        mmsUuid: matches.mmsItem._id
      }

      mmsItems.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
        if (err) console.log(err)
        archivesComponents.update({ _id: { $in: archivesIds } }, { $set: updateArchives }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(mmsItems.find({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}], 'matchedArchives': {$exists: false} }))
      .map(_.curry(checkForArchivesComponentMatches))
      .nfcall([])
      .parallel(10)
      .compact()
      .map(_.curry(updateArchivesComponentMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsItem) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
