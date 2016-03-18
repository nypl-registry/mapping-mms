'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var mapUtils = require('../lib/utils.js')

/**
 * Maps MMS collections to Archive collections based on MSS and bNumber and callnumber
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsCollectionsToArchivesCollections (cb) {
  db.returnCollections({registryIngest: ['mmsCollections', 'archivesCollections']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsCollections = returnCollections.registryIngest.mmsCollections
    var archivesCollections = returnCollections.registryIngest.archivesCollections

    var checkForArchivesCollectionMatches = (mmsCollection, callback) => {
      var mss = (mmsCollection.mss) ? mmsCollection.mss : -1000
      var bNumber = (mmsCollection.bNumber) ? mmsCollection.bNumber : 'Not a b number'
      var callNumber = (mmsCollection.callNumber) ? mmsCollection.callNumber : 'this is not a call number'

      archivesCollections.find({ $or: [{ bNumber: bNumber }, { mss: parseInt(mss) }] }).toArray((err, archiveCollectionAry) => {
        if (archiveCollectionAry.length > 0) {
          // if (archiveCollectionAry.length > 1) console.log('Warning: Multiple matches on bnumber/mss query', {mmsCollection: mmsCollection, archivesCollections: archiveCollectionAry})
          callback(err, {mmsCollection: mmsCollection, archivesCollections: archiveCollectionAry})
        } else {
          archivesCollections.find({callNumber: callNumber}).toArray(function (err, archiveCollectionAry) {
            if (archiveCollectionAry.length < 2) {
              callback(err, {mmsCollection: mmsCollection, archivesCollections: archiveCollectionAry})
            } else {
              // figure out which one to use/not use
              // console.log(mapUtils.compareCollectionCallNumberMatch({mmsCollection: mmsCollection, archivesCollections: archiveCollectionAry}))
              callback(err, mapUtils.compareCollectionCallNumberMatch({mmsCollection: mmsCollection, archivesCollections: archiveCollectionAry}))
            }
          })
        }
      })
    }

    var updateArchivesCollectionMatches = (matches, callback) => {
      var archivesIds = matches.archivesCollections.map((x) => {
        return x._id
      })

      // update the MMS collection
      var updateMms = {
        _id: matches.mmsCollection._id,
        matchedArchives: true,
        matchedArchivesType: 'identifier',
        archivesCollectionDb: archivesIds
      }

      var updateArchives = {
        matchedMms: true,
        matchedMmsType: 'identifier',
        mmsUuid: matches.mmsCollection._id
      }

      mmsCollections.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
        if (err) console.log(err)
        archivesCollections.update({ _id: { $in: archivesIds } }, { $set: updateArchives }, function (err, result) {
          if (err) console.log(err)
          callback(err, matches)
        })
      })
    }

    _(mmsCollections.find({}))
      .map(_.curry(checkForArchivesCollectionMatches))
      .nfcall([])
      .parallel(10)
      .map((matches) => {
        return (matches.archivesCollections.length > 0) ? matches : ''
      })
      .compact()
      .map(_.curry(updateArchivesCollectionMatches))
      .nfcall([])
      .parallel(10)
      .done((mmsCollection) => {
        if (cb) cb()
        console.log('Done')
      })
  })
}
