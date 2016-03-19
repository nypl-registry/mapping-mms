'use strict'

var _ = require('highland')
var db = require('nypl-registry-utils-database')
var clc = require('cli-color')
var exec = require('child_process').exec
var parseCsv = require('csv-parse')
var lexicon = require('nypl-registry-utils-lexicon')
var fs = require('fs')
var mapUtils = require('../lib/utils.js')

// file name
var archivesRepo = `${process.cwd()}${lexicon.configs.dataSourceFiles.archivesRepoObjects}`

var csv2Json = function (line, callback) {
  parseCsv(line, {escape: '\\'}, function (err, item) {
    if (err) {
      console.log(clc.bgRedBright('--------------------------'))
      console.log(clc.bgRedBright(line))
      console.log(clc.bgRedBright('CSV PARSE Error ' + err))
      console.log(clc.bgRedBright('--------------------------'))
      // we are not going to do anything with these errors, just ignore them since it is not critical that it works
      callback(null, false)
    } else {
      callback(null, item[0])
    }
  })
}

/**
 * Maps MMS items to Archive components based the archives REPO Objects tables data
 *
 * @param  {function} cb - Nothing returned
 */
module.exports = function mmsItemsToArchivesComponentsByRepo (cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'mmsContainers', 'archivesComponents']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var mmsContainers = returnCollections.registryIngest.mmsContainers
    var archivesComponents = returnCollections.registryIngest.archivesComponents

    var totalLinesDone = 0
    var previousPercent = -1

    exec('wc -l ' + archivesRepo, function (error, results) {
      if (error) console.log(error)

      var totalLines = results.trim().split(' ')[0]
      if (isNaN(totalLines)) totalLines = 0
      totalLines = parseInt(totalLines)

      var buildMatches = (repoObj, callback) => {
        var matches = {repoObj: repoObj, archivesComponent: false, mmsContainer: false, mmsItem: false}

        archivesComponents.find({ _id: parseInt(repoObj.describable_id) }).toArray((err, archivesComponentsAry) => {
          if (err) console.log(err)
          if (archivesComponentsAry[0] && !archivesComponentsAry[0].matchedMms) matches.archivesComponent = archivesComponentsAry[0]
          mmsItems.find({ _id: repoObj.uuid }).toArray((err, mmsItemsAry) => {
            if (err) console.log(err)
            if (mmsItemsAry[0]) matches.mmsItem = mmsItemsAry[0]
            mmsContainers.find({ _id: repoObj.uuid }).toArray((err, mmsContainersAry) => {
              if (err) console.log(err)
              if (mmsContainersAry[0]) matches.mmsContainer = mmsContainersAry[0]
              callback(err, matches)
            })
          })
        })
      }

      var updateArchivesRepoMatches = (matches, callback) => {
        var updateMmmsSource = mmsContainers
        var updateMms = {
          _id: matches.mmsContainer._id,
          matchedArchives: true,
          matchedArchivesType: 'identifier',
          archivesCollectionDb: matches.archivesComponent._id
        }
        var updateArchives = {
          matchedMms: true,
          matchedMmsType: 'identifier',
          mmsUuid: matches.mmsContainer._id
        }

        // it can only be one or the other, if it is mmsItem then switch over
        if (matches.mmsItem) {
          updateMmmsSource = mmsItems
          updateMms = {
            _id: matches.mmsItem._id,
            matchedArchives: true,
            matchedArchivesType: 'identifier',
            archivesCollectionDb: matches.archivesComponent._id
          }
          updateArchives = {
            matchedMms: true,
            matchedMmsType: 'identifier',
            mmsUuid: matches.mmsItem._id
          }
        }

        updateMmmsSource.update({ _id: updateMms._id }, { $set: updateMms }, function (err, result) {
          if (err) console.log(err)
          archivesComponents.update({_id: matches.archivesComponent._id}, { $set: updateArchives }, function (err, result) {
            if (err) console.log(err)
            callback(err, matches)
          })
        })
      }
      _(fs.createReadStream(archivesRepo))
        .split()
        .compact()
        .map(_.curry(csv2Json))
        .nfcall([])
        .parallel(20)
        .map((line) => {
          var percent = Math.floor(++totalLinesDone / totalLines * 100)

          if (percent > previousPercent) {
            previousPercent = percent
            if (process.stdout.cursorTo) {
              process.stdout.cursorTo(0)
              process.stdout.write(clc.black.bgYellowBright('mmsItemsToArchivesComponentsByRepo: ' + percent + '%'))
            }
          }

          if (!line) return ''
          var repoObj = mapUtils.mapRepoCsvToJson(line)
          if (repoObj.describable_type !== 'Component') return ''
          return repoObj
        })
        .compact()
        .map(_.curry(buildMatches))
        .nfcall([])
        .parallel(20)
        .map((matches) => {
          return (!matches.archivesComponent) ? '' : matches // drop anything that we could not find an archives or it was already mapped
        })
        .compact()
        .map((matches) => {
          return (!matches.mmsContainer && !matches.mmsItem) ? '' : matches // drop anything that we could not find in mms
        })
        .compact()
        .map(_.curry(updateArchivesRepoMatches))
        .nfcall([])
        .parallel(20)
        .done(function () {
          console.log('Done mmsItemsToArchivesComponentsByRepo')
          if (cb) {
            cb(true)
          }
        })
    })
  })
}
