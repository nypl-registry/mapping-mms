'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Maps MMS items to TMS objects based on shared image name in mms captures and tms objects
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemsToTmsObjectsByImage (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'tmsObjects', 'mmsCaptures']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var tmsObjects = returnCollections.registryIngest.tmsObjects
    var mmsCaptures = returnCollections.registryIngest.mmsCaptures

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var percentDone = 0

    tmsObjects.count({ imageId: { $ne: false }, matchedMms: {$exists: false} }, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var checkForTmsObjectMatches = (tmsObject, callback) => {
      if (Math.floor(++count / totalItems * 100) !== percentDone) {
        process.stdout.cursorTo(0)
        process.stdout.write(clc.black.bgYellowBright(`TMS Object Map: ${percentDone}% (${countUpdated} Objects)`))
        percentDone = Math.floor(count / totalItems * 100)
      }

      mmsCaptures.find({imageId: tmsObject.imageId}).toArray((err, mmsCaptureAry) => {
        if (mmsCaptureAry.length === 1) {
          countUpdated++
          callback(err, {tmsObject: tmsObject, mmsCaptures: mmsCaptureAry[0]})
        } else {
          callback(err, '')
        }
      })
    }

    var updateTmsMatches = (matches, callback) => {
      // update the MMS collection
      var updateMms = {
        _id: matches.mmsCaptures.itemUuid,
        matchedTms: true,
        matchedTmsType: 'identifier',
        tmsId: matches.tmsObject._id
      }

      var updateTms = {
        matchedMms: true,
        matchedMmsType: 'identifier',
        mmsUuid: matches.mmsCaptures.itemUuid
      }

      mmsItems.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
        if (err) console.log(err)
        tmsObjects.update({ _id: matches.tmsObject._id }, { $set: updateTms }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(tmsObjects.find({ imageId: { $ne: false }, matchedMms: {$exists: false} }))
      .map(_.curry(checkForTmsObjectMatches))
      .nfcall([])
      .parallel(20)
      .compact()
      .map(_.curry(updateTmsMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsItem) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
