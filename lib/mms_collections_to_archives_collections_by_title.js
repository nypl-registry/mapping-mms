'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var mapUtils = require('../lib/utils.js')
var lexicon = require('nypl-registry-utils-lexicon')

/**
 * Maps MMS collections to Archive collections on titles matches
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsCollectionsToArchivesCollectionsByTitle (cb) {
  db.returnCollections({registryIngest: ['mmsCollections', 'archivesCollections']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsCollections = returnCollections.registryIngest.mmsCollections
    var archivesCollections = returnCollections.registryIngest.archivesCollections

    mmsCollections.find({$and: [{bNumber: false}, {matchedArchives: { $ne: true }}, {$or: [{divisions: {$in: Object.keys(lexicon.labels.mmsDivisions).map((div) => div.toUpperCase())}}, {divisions: { $size: 0 }}]}]}).toArray((err, mmsCollectionAry) => {
      if (err) console.log(err)
      console.log(mmsCollectionAry.length)

      var compareTitles = (archivesCollection, callback) => {
        var isMatch = false
        mmsCollectionAry.forEach((mmsCollection) => {
          if (isMatch) return
          isMatch = mapUtils.compareCollectionTitles(mmsCollection.title, archivesCollection.title)
          if (isMatch) {
            // update the MMS/archives collection
            var updateMms = {
              _id: mmsCollection._id,
              matchedArchives: true,
              matchedArchivesType: 'title',
              archivesCollectionDb: archivesCollection._id
            }

            var updateArchives = {
              _id: archivesCollection._id,
              matchedMms: true,
              matchedMmsType: 'title',
              mmsUuid: mmsCollection._id
            }

            mmsCollections.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
              if (err) console.log(err)
              archivesCollections.update({ _id: updateArchives._id }, { $set: updateArchives }, function (err, result) {
                if (err) console.log(err)
                callback(null, {archivesCollection: archivesCollection, mmsCollection: mmsCollection, isMatch: true})
              })
            })
          }
        })
        if (isMatch === false) callback(null, {archivesCollection: archivesCollection, mmsCollection: null, isMatch: false})
      }
      _(archivesCollections.find({matchedArchives: { $ne: true }}))
        .compact()
        .map(_.curry(compareTitles))
        .nfcall([])
        .parallel(100)
        .done((archivesCollection) => {
          if (cb) cb()
          console.log('Done')
        })
    })
  })
}
