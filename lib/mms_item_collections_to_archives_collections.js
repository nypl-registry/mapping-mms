'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Maps MMS items, that are collections (top level items) to Archive collections based on MSS and bNumber
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemCollectionsToArchivesCollections (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'archivesCollections']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var archivesCollections = returnCollections.registryIngest.archivesCollections

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var percentDone = 0

    mmsItems.count({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}] }, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var checkForArchivesCollectionMatches = (mmsItem, callback) => {
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

      archivesCollections.find({ $or: [{ bNumber: bNumber }, { mss: parseInt(mss) }] }).toArray((err, archiveCollectionAry) => {
        if (archiveCollectionAry.length > 0) {
          countUpdated++
          callback(err, {mmsItem: mmsItem, archivesCollections: archiveCollectionAry})
        } else {
          callback(err, '')
        }
      })
    }

    var updateArchivesCollectionMatches = (matches, callback) => {
      var archivesIds = matches.archivesCollections.map((x) => {
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
        archivesCollections.update({ _id: { $in: archivesIds } }, { $set: updateArchives }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(mmsItems.find({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}] }))
      .map(_.curry(checkForArchivesCollectionMatches))
      .nfcall([])
      .parallel(10)
      .compact()
      .map(_.curry(updateArchivesCollectionMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsItem) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
