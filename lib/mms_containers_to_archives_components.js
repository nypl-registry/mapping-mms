'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')

/**
 * Maps MMS containers to Archive components based on MSS and bNumber
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsContainerToArchivesComponents (cb) {
  db.returnCollections({registryIngest: ['mmsContainers', 'archivesComponents']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsContainers = returnCollections.registryIngest.mmsContainers
    var archivesComponents = returnCollections.registryIngest.archivesComponents

    var totalItems = 10000000000
    var count = 0
    var countUpdated = 0
    var percentDone = 0

    mmsContainers.count({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}] }, (err, result) => {
      if (err) console.log(err)
      totalItems = result
    })

    var checkForArchivesComponentMatches = (mmsContainer, callback) => {
      if (Math.floor(++count / totalItems * 100) !== percentDone) {
        process.stdout.cursorTo(0)
        process.stdout.write(clc.black.bgYellowBright(`MMS Container Map: ${percentDone}% (${countUpdated} Containers)`))
        percentDone = Math.floor(count / totalItems * 100)
      }

      var mss = (mmsContainer.mss) ? mmsContainer.mss : -1000
      var bNumber = (mmsContainer.bNumber) ? mmsContainer.bNumber : 'Not a b number'
      if (mss === -1000 && bNumber === 'Not a b number') {
        callback(err, '')
        return false
      }

      archivesComponents.find({ $or: [{ bNumber: bNumber }, { mss: parseInt(mss) }] }).toArray((err, archiveComponentAry) => {
        if (archiveComponentAry.length > 0) {
          countUpdated++
          callback(err, {mmsContainer: mmsContainer, archivesComponents: archiveComponentAry})
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
        _id: matches.mmsContainer._id,
        matchedArchives: true,
        matchedArchivesType: 'identifier',
        archivesCollectionDb: archivesIds
      }

      var updateArchives = {
        matchedMms: true,
        matchedMmsType: 'identifier',
        mmsUuid: matches.mmsContainer._id
      }

      mmsContainers.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
        if (err) console.log(err)
        archivesComponents.update({ _id: { $in: archivesIds } }, { $set: updateArchives }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(mmsContainers.find({ $or: [{bNumber: {$exists: true}}, {mss: {$exists: true}}] }))
      .map(_.curry(checkForArchivesComponentMatches))
      .nfcall([])
      .parallel(10)
      .compact()
      .map(_.curry(updateArchivesComponentMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsContainer) => {
        console.log('Done')
        if (cb) cb()
      })
  })
}
