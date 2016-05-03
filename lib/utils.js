'use strict'
// var lexicon = require('nypl-registry-utils-lexicon')
var utils = require('nypl-registry-utils-normalize')
var db = require('nypl-registry-utils-database')
var async = require('async')
var clc = require('cli-color')

/**
* Given possible collection level matches it will compare titles to see if they are a match. Depending how broad the callnumber the title needs to be a high match
*
* @param  {object} matches - an object with mmsCollection collection property w/ native JSON and an array archivesCollections of possible archives matches
* @return {object} The modified matches with the correct archivesCollections collection
*/
exports.compareCollectionCallNumberMatch = (matches) => {
  var goodMatches = []
  var bestMatch = {matchScore: 0}

  matches.archivesCollections.forEach((archivesCollection, i) => {
    if (utils.compareNormalizedTitles(matches.mmsCollection.title, archivesCollection.title, 0.5) > 0.75) {
      archivesCollection.matchScore = utils.compareNormalizedTitles(matches.mmsCollection.title, archivesCollection.title, 0.5)
      goodMatches.push(archivesCollection)
    }
  })

  // find the highest match, only going to use one
  goodMatches.forEach((match) => {
    if (match.matchScore > bestMatch.matchScore) bestMatch = match
  })

  // if there was not goo match remove them all
  if (bestMatch.matchScore > 0) {
    delete bestMatch.matchScore
    matches.archivesCollections = [bestMatch]
  } else {
    matches.archivesCollections = []
  }
  return matches
}

/**
* Given a mms title and archvies title return if they are the same collection
*
* @param  {string} mmsTitle - The mms collection title
* @param  {string} archivesTitle - The archives collection title
* @return {boolean} is this a title match
*/
exports.compareCollectionTitles = (mmsTitle, archivesTitle) => {
  if (utils.percentOverlap(mmsTitle, archivesTitle) > 75) {
    if (mmsTitle === 'Oral History Project') return false
    // looks okay, lets flag that we are doing this though
    console.log('Warning: MMS <-> Archives Collections, title match - assuming ', mmsTitle + ' (mms title) is matched to ' + archivesTitle + ' (Archives title)')
    if (mmsTitle.score(archivesTitle, 0.5) < 0.2) {
      console.log('EXTRA Warning: MMS <-> Archives Collections, title match - assuming ', mmsTitle + ' (mms title) is matched to ' + archivesTitle + ' (Archives title) low cosine similarity')
    }
    return true
  }
  return false
}

var repoObjectsMap = ['id', 'describable_id', 'describable_type', 'uuid', 'resource_type', 'total_captures', 'capture_ids', 'sib_seq', 'created_at', 'updated_at', 'collection_id']
/**
* Given a CSV parsed array translate it into json
*
* @param  {array} csvArray - the csv-parse'ed array
* @return {ob} the json object
*/
exports.mapRepoCsvToJson = function (csvArray) {
  var result = {}
  for (var x in csvArray) {
    result[repoObjectsMap[x]] = csvArray[x]
  }
  return result
}

/**
* Given a mms collection object it will lookup all the current mapping stats about it
*
* @param  {obj} collectionObject - the MMS collection object
* @return {obj} the result object
*/
exports.returnMmsCollectionDetails = function (collectionObject, cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'mmsContainers', 'archivesComponents']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var mmsContainers = returnCollections.registryIngest.mmsContainers
    var archivesComponents = returnCollections.registryIngest.archivesComponents

    if (collectionObject.archivesCollectionDb && !Array.isArray(collectionObject.archivesCollectionDb)) collectionObject.archivesCollectionDb = [collectionObject.archivesCollectionDb]

    async.parallel({
      containerCount: (callback) => {
        mmsContainers.find({ collectionUuid: collectionObject._id }).count((err, count) => {
          callback(err, count)
        })
      },

      containerCountMatchedToArchives: (callback) => {
        mmsContainers.find({ collectionUuid: collectionObject._id, matchedArchives: true }).count((err, count) => {
          callback(err, count)
        })
      },

      itemCount: (callback) => {
        mmsItems.find({ collectionUuid: collectionObject._id }).count((err, count) => {
          callback(err, count)
        })
      },

      itemCountMatchedToArchives: (callback) => {
        mmsItems.find({ collectionUuid: collectionObject._id, matchedArchives: true }).count((err, count) => {
          callback(err, count)
        })
      },

      seriesCount: (callback) => {
        archivesComponents.find({ collectionDb: {$in: collectionObject.archivesCollectionDb}, levelText: 'series' }).count((err, count) => {
          callback(err, count)
        })
      },

      seriesCountMatchedToMms: (callback) => {
        archivesComponents.find({ collectionDb: {$in: collectionObject.archivesCollectionDb}, levelText: 'series', matchedMms: true }).count((err, count) => {
          callback(err, count)
        })
      },

      componentCount: (callback) => {
        archivesComponents.find({ collectionDb: {$in: collectionObject.archivesCollectionDb}, levelText: { $ne: 'series' } }).count((err, count) => {
          callback(err, count)
        })
      },

      componentCountMatchedToMms: (callback) => {
        archivesComponents.find({ collectionDb: {$in: collectionObject.archivesCollectionDb}, levelText: { $ne: 'series' }, matchedMms: true }).count((err, count) => {
          callback(err, count)
        })
      },

      mmsContainers: (callback) => {
        mmsContainers.find({ collectionUuid: collectionObject._id }).toArray(function (err, mmsContainersAry) {
          callback(err, mmsContainersAry)
        })
      },

      mmsItems: (callback) => {
        mmsItems.find({ collectionUuid: collectionObject._id }).toArray(function (err, mmsItemsAry) {
          callback(err, mmsItemsAry)
        })
      },

      archivesComponents: (callback) => {
        archivesComponents.find({ collectionDb: {$in: collectionObject.archivesCollectionDb} }).toArray(function (err, archivesComponentsAry) {
          callback(err, archivesComponentsAry)
        })
      }

    },
      (err, results) => {
        cb(err, results)
      })
  })
}

/**
* Given the results of mapHierarchyByContainers
*
* @param  {obj} data - The mapping data
* @param  {function} cb - The callback
*/
exports.updateHierarchyMatches = function (data, cb) {
  db.returnCollections({registryIngest: ['mmsItems', 'mmsContainers', 'archivesComponents']}, (err, returnCollections) => {
    if (err) console.log(err)
    var mmsItems = returnCollections.registryIngest.mmsItems
    var mmsContainers = returnCollections.registryIngest.mmsContainers
    var archivesComponents = returnCollections.registryIngest.archivesComponents

    async.series({
      itemMap: function (callback) {
        async.each(data.itemMap, function (itemMap, eachCallback) {
          var update = {
            _id: itemMap.uuid,
            matchedArchives: true,
            matchedArchivesType: 'hierarchyItem',
            archivesCollectionDb: itemMap.mssDb
          }

          mmsItems.update({ _id: update._id }, { $set: update }, function (err, result) {
            if (err) console.log(err)

            var archivesUpdate = {
              _id: parseInt(itemMap.mssDb),
              matchedMms: true,
              matchedMmsType: 'hierarchyItem',
              mmsUuid: itemMap.uuid
            }

            archivesComponents.update({ _id: archivesUpdate._id }, { $set: archivesUpdate }, function (err, result) {
              if (err) console.log(err)
              eachCallback()
            })
          })
        }, function (err) {
          if (err) console.log(err)
          // done
          callback()
        })
      },

      containerMapMerge: function (callback) {
        async.each(data.containerMapMerge, function (itemMap, eachCallback) {
          var update = {
            _id: itemMap.uuid,
            matchedArchives: true,
            matchedArchivesType: 'containerMerge',
            archivesCollectionDb: itemMap.mssDb
          }

          mmsContainers.update({ _id: update._id }, { $set: update }, function (err, result) {
            if (err) console.log(err)

            var archivesUpdate = {
              _id: parseInt(itemMap.mssDb),
              matchedMms: true,
              matchedMmsType: 'containerMerge',
              mmsUuid: itemMap.uuid
            }

            archivesComponents.update({ _id: archivesUpdate._id }, { $set: archivesUpdate }, function (err, result) {
              if (err) console.log(err)
              eachCallback()
            })
          })
        }, function (err) {
          if (err) console.log(err)
          // done
          callback()
        })
      },

      containerMapInherit: function (callback) {
        async.each(data.containerMapInherit, function (itemMap, eachCallback) {
          var update = {
            _id: itemMap.uuid,
            matchedArchives: true,
            matchedArchivesType: 'containerMulti',
            archivesCollectionDb: itemMap.mssDb
          }

          mmsContainers.update({ _id: update._id }, { $set: update }, function (err, result) {
            if (err) console.log(err)

            var archivesUpdate = {
              _id: parseInt(itemMap.mssDb),
              matchedMms: true,
              matchedMmsType: 'containerMulti',
              mmsUuid: itemMap.uuid
            }

            archivesComponents.update({ _id: archivesUpdate._id }, { $set: archivesUpdate }, function (err, result) {
              if (err) console.log(err)
              eachCallback()
            })
          })
        }, function (err) {
          if (err) console.log(err)
          // done
          callback()
        })
      }
    }, (err, results) => {
      if (err) console.log(err)
      cb(null, results)
    })
  })
}

/**
* Given the data for mms collection and archvies collection try its best to align them based one container hierarchy
*
* @param  {obj} data - The output from returnMmsCollectionDetails
* @return {obj} the result object
*/
exports.mapHierarchyByContainers = function (data) {
  var warnings = []

  // build a map of the containers to see if they match up with the archives hierarchy
  var mmsTitleIndex = {}
  for (var x in data.mmsContainers) {
    if (data.mmsContainers[x].title) {
      mmsTitleIndex[data.mmsContainers[x]._id] = data.mmsContainers[x].title
    } else {
      mmsTitleIndex[data.mmsContainers[x]._id] = ''
    }
  }

  var mssContainerPaths = {}
  var mmsContainerLookup = {}
  for (var mmsContainer in data.mmsContainers) {
    mmsContainer = data.mmsContainers[mmsContainer]

    mmsContainerLookup[mmsContainer._id] = mmsContainer

    var parents = []
    for (x in mmsContainer.parents) {
      var uuid = mmsContainer.parents[x]

      if (uuid !== data.collection._id) {
        if (!mmsTitleIndex[uuid]) console.log('Not in index, mmsContainer:', uuid, data.collection._id)
        parents.push(mmsTitleIndex[uuid])
      }
    }

    parents.unshift(mmsContainer.title)
    parents = parents.reverse()

    mssContainerPaths[mmsContainer._id] = parents
  }

  var itemsByContainer = {}
  var itemsLookup = {}
  var rootItems = []
  for (var mssItem in data.mmsItems) {
    mssItem = data.mmsItems[mssItem]

    itemsLookup[mssItem._id] = mssItem

    if (mssItem.containerUuid) {
      if (!itemsByContainer[mssItem.containerUuid]) itemsByContainer[mssItem.containerUuid] = []
      itemsByContainer[mssItem.containerUuid].push(mssItem)
    } else {
      rootItems.push(mssItem)
    }
  }

  var mmsItemPaths = {}

  // build the items map as well based off of the last container
  for (uuid in mssContainerPaths) {
    var items = itemsByContainer[uuid]

    for (x in items) {
      var containerPath = JSON.parse(JSON.stringify(mssContainerPaths[uuid]))

      if (items[x].title) {
        containerPath.push(items[x].title)
        mmsItemPaths[items[x]._id] = containerPath
      }
    }
  }

  var archivesPaths = {}
  var archivesPathsWithDates = {}
  var componentMap = {}
  var archivesLookup = {}
  for (x in data.archivesComponents) {
    var archviesComponentData = data.archivesComponents[x]

    archivesLookup[archviesComponentData._id] = archviesComponentData

    if (!archviesComponentData.title && archviesComponentData.dateStatement) {
      archviesComponentData.title = archviesComponentData.dateStatement
    }

    if (archviesComponentData.title) {
      if (archviesComponentData.title.trim() === '' && archviesComponentData.dateStatement) {
        archviesComponentData.title = archviesComponentData.dateStatement
      }
    }

    componentMap[data.archivesComponents[x].mssDb] = data.archivesComponents[x]
  }

  // now build a similar structure for the archvies component hiearchy
  for (var archviesComponent in data.archivesComponents) {
    archviesComponentData = data.archivesComponents[archviesComponent]

    var path = []
    var pathWithDates = []

    // build the complete recursive tree for this one
    var recursiveThang = function (mssDb) {
      path.push(componentMap[mssDb].title)

      pathWithDates.push((componentMap[mssDb].dateStatement) ? componentMap[mssDb].title + ' ' + componentMap[mssDb].dateStatement : componentMap[mssDb].title)

      if (componentMap[mssDb].parentDb) {
        recursiveThang(componentMap[mssDb].parentDb)
      }
    }
    recursiveThang(archviesComponentData.mssDb)
    path = path.reverse()
    pathWithDates = pathWithDates.reverse()

    archivesPaths[archviesComponentData.mssDb] = path
    archivesPathsWithDates[archviesComponentData.mssDb] = pathWithDates
  }

  var c = 0
  var cTotal = Object.keys(mmsItemPaths).length
  var itemMappings = {}
  var containerMappings = {}
  var subContainerUnableToMap = {}

  // lets compare the two hierachies first with the items path and archives path
  for (var mmsItemPath in mmsItemPaths) {
    process.stdout.cursorTo(10)
    process.stdout.write(clc.black.bgYellowBright('Done: ' + ++c + ' of ' + cTotal))

    var mmsIndex = mmsItemPath
    mmsItemPath = mmsItemPaths[mmsItemPath]

    for (var archivesPath in archivesPathsWithDates) {
      var archivesIndex = archivesPath
      archivesPath = archivesPathsWithDates[archivesPath]

      if (mmsItemPath.length === archivesPath.length) {
        // now check if each of the hierarchies match at each level
        var passing = true

        for (x = 0; x < mmsItemPath.length; x++) {
          if (utils.compareNormalizedTitles(mmsItemPath[x], archivesPath[x], 0.9) >= 0.7) {
            // sofar.push(mmsItemPath[x])
            // console.log(sofar)

            passing = true
          } else {
            // console.log('\n')
            // console.log(mmsItemPath[x], '||', archivesPath[x], utils.compareNormalizedTitles(mmsItemPath[x], archivesPath[x], 0.9))
            passing = false
            break
          }
        }

        if (passing) {
          // console.log("-----------------------------")
          // console.log(mmsItemPath)
          // console.log("~~~~~~~~~")
          // console.log(archivesPath)
          itemMappings[mmsIndex] = archivesIndex
        }
      }
    }
  }

  var removeItems = Object.keys(itemMappings)

  // delete these from the items by components
  // so if we map them over to the container level we do not include them
  for (uuid in itemsByContainer) {
    for (var aItem in itemsByContainer[uuid]) {
      if (removeItems.indexOf(itemsByContainer[uuid][aItem]._id) > -1) {
        delete itemsByContainer[uuid][aItem]
      }
    }
  }

  c = 0

  // try the same thing with archive title do not have the dates

  // lets compare the two hierachies first with the items path and archives path
  for (mmsItemPath in mmsItemPaths) {
    process.stdout.cursorTo(10)
    process.stdout.write(clc.black.bgYellowBright('Done: ' + ++c + ' of ' + cTotal))

    mmsIndex = mmsItemPath
    mmsItemPath = mmsItemPaths[mmsItemPath]

    for (archivesPath in archivesPaths) {
      archivesIndex = archivesPath
      archivesPath = archivesPaths[archivesPath]

      if (mmsItemPath.length === archivesPath.length) {
        // now check if each of the hierarchies match at each level
        passing = true

        for (x = 0; x < mmsItemPath.length; x++) {
          if (utils.compareNormalizedTitles(mmsItemPath[x], archivesPath[x], 0.9) >= 0.7) {
            // sofar.push(mmsItemPath[x])
            // console.log(sofar)
            passing = true
          } else {
            // console.log("\n")
            // console.log(mmsItemPath[x], "||",archivesPath[x],utils.compareNormalizedTitles(mmsItemPath[x],archivesPath[x],0.9))
            passing = false
            break
          }
        }

        if (passing) {
          // console.log("-----------------------------")
          // console.log(mmsItemPath)
          // console.log("~~~~~~~~~")
          // console.log(archivesPath)
          itemMappings[mmsIndex] = archivesIndex
        }
      }
    }
  }

  removeItems = Object.keys(itemMappings)

  // delete these from the items by components
  // so if we map them over to the container level we do not include them
  for (uuid in itemsByContainer) {
    for (aItem in itemsByContainer[uuid]) {
      if (removeItems.indexOf(itemsByContainer[uuid][aItem]._id) > -1) {
        delete itemsByContainer[uuid][aItem]
      }
    }
  }

  // lets compare the two hierachies of the containers
  // var sofar = []
  for (var mssContainerPath in mssContainerPaths) {
    mmsIndex = mssContainerPath
    // sofar = []

    mssContainerPath = mssContainerPaths[mssContainerPath]

    for (archivesPath in archivesPathsWithDates) {
      archivesIndex = archivesPath

      archivesPath = archivesPathsWithDates[archivesPath]

      if (mssContainerPath.length === archivesPath.length) {
        // now check if each of the hierarchies match at each level
        passing = true

        for (x = 0; x < mssContainerPath.length; x++) {
          if (utils.compareNormalizedTitles(mssContainerPath[x], archivesPath[x], 0.9) >= 0.75) {
            // sofar.push(mssContainerPath[x])
            // console.log(sofar)
            passing = true
          } else {
            // if (sofar.length > 0) {
            //   console.log(sofar)
            //   console.log('<<<<\n')
            //   console.log(mssContainerPath[x], '||', archivesPath[x], utils.compareNormalizedTitles(mssContainerPath[x], archivesPath[x], 0.9))
            // }
            passing = false
            break
          }
        }

        if (passing) {
          containerMappings[archivesIndex] = mmsIndex

          if (itemsByContainer[mmsIndex]) {
            // console.log('-----------------------------', itemsByContainer[mmsIndex].length)
            // console.log(mssContainerPath)
            // console.log('~~~~~~~~~')
            // console.log(archivesPath)

            itemsByContainer[mmsIndex]

            for (var y in itemsByContainer[mmsIndex]) {
              // each one of these items mapps to the archival component and the component maps to the container
              var item = itemsByContainer[mmsIndex][y]
              itemMappings[item._id] = archivesIndex
            }
          } else {
            // console.log("--------------Does not contain any items---------------")
            // console.log(mssContainerPath)
            // console.log("~~~~~~~~~")
            // console.log(archivesPath)
            subContainerUnableToMap[mmsIndex] = { uuid: mmsIndex, archivesDb: archivesIndex, depth: mssContainerPath.length }
          }
        }
      }
    }
  }

  removeItems = Object.keys(itemMappings)
  var deleteing = 0
  // delete these from the items by components
  // so if we map them over to the container level we do not include them
  for (uuid in itemsByContainer) {
    for (aItem in itemsByContainer[uuid]) {
      if (removeItems.indexOf(itemsByContainer[uuid][aItem]._id) > -1) {
        deleteing++
        delete itemsByContainer[uuid][aItem]
      }
    }
  }

  // now without dates
  for (mssContainerPath in mssContainerPaths) {
    mmsIndex = mssContainerPath

    mssContainerPath = mssContainerPaths[mssContainerPath]

    for (archivesPath in archivesPaths) {
      archivesIndex = archivesPath

      archivesPath = archivesPaths[archivesPath]

      if (mssContainerPath.length === archivesPath.length) {
        // now check if each of the hierarchies match at each level
        passing = true

        for (x = 0; x < mssContainerPath.length; x++) {
          if (utils.compareNormalizedTitles(mssContainerPath[x], archivesPath[x], 0.9) >= 0.75) {
            // sofar.push(mssContainerPath[x])
            // console.log(sofar)
            passing = true
          } else {
            // be a litte more lax for the container matching
            if (utils.compareNormalizedTitles(mssContainerPath[x], archivesPath[x], 0.9) >= 0.55) {
              // flag it that it may be probalmatic, only the first time
              var warning = mssContainerPath[x] + ' =? ' + archivesPath[x] + ' UUID:' + mmsIndex
              if (warnings.indexOf(warning) === -1) {
                // errorLib.error("Warning: low confidence container match ", warning)
                warnings.push(warning)
              }
              passing = true
            } else {
              // console.log("\n")
              // console.log(mssContainerPath[x], "||",archivesPath[x],utils.compareNormalizedTitles(mssContainerPath[x],archivesPath[x],0.9))
              passing = false
              break
            }
          }
        }

        if (passing) {
          containerMappings[archivesIndex] = mmsIndex

          if (itemsByContainer[mmsIndex]) {
            // console.log("-----------------------------",itemsByContainer[mmsIndex].length)
            // console.log(mssContainerPath)
            // console.log("~~~~~~~~~")
            // console.log(archivesPath)

            for (y in itemsByContainer[mmsIndex]) {
              // each one of these items mapps to the archival component and the component maps to the container
              item = itemsByContainer[mmsIndex][y]
              itemMappings[item._id] = archivesIndex
            }
          } else {
            // console.log("--------------Does not contain any items---------------")
            // console.log(mssContainerPath)
            // console.log("~~~~~~~~~")
            // console.log(archivesPath)
            subContainerUnableToMap[mmsIndex] = { uuid: mmsIndex, archivesDb: archivesIndex, depth: mssContainerPath.length }
          }
        }
      }
    }
  }

  removeItems = Object.keys(itemMappings)
  deleteing = 0
  // delete these from the items by components
  // so if we map them over to the container level we do not include them
  for (uuid in itemsByContainer) {
    for (aItem in itemsByContainer[uuid]) {
      if (removeItems.indexOf(itemsByContainer[uuid][aItem]._id) > -1) {
        deleteing++
        delete itemsByContainer[uuid][aItem]
      }
    }
  }

  var sortable = []
  for (c in subContainerUnableToMap) {
    sortable.push([subContainerUnableToMap[c].depth, subContainerUnableToMap[c]])
  }

  sortable.sort((a, b) => {
    return a[0] - b[0]
  }).reverse()

  // build a lookup of all the children
  var childrenContainers = {}
  for (mmsContainer in data.mmsContainers) {
    mmsContainer = data.mmsContainers[mmsContainer]
    if (mmsContainer.containerUuid) {
      if (!childrenContainers[mmsContainer.containerUuid]) childrenContainers[mmsContainer.containerUuid] = []
      if (childrenContainers[mmsContainer.containerUuid].indexOf(mmsContainer._id)) {
        if (mmsContainer.containerUuid !== mmsContainer._id) {
          childrenContainers[mmsContainer.containerUuid].push(mmsContainer._id)
        }
      }
    }
  }

  var containerToComponentMap = {}
  var closeMappings = 0

  // go through an resolve the deepest hiearchies first and remove them from the possible candiddates

  // find all the containers that are the children of this container
  for (x in sortable) {
    var thisUuid = sortable[x][1].uuid
    var thisArchivesIndex = sortable[x][1].archivesDb

    for (mmsContainer in data.mmsContainers) {
      mmsContainer = data.mmsContainers[mmsContainer]

      // id this conatiner a child of the one we are looping thorugh?

      if (childrenContainers[thisUuid].indexOf(mmsContainer._id) > -1) {
        // //any subcontainer children items are now mine
        if (itemsByContainer[mmsContainer._id]) {
          containerToComponentMap[mmsContainer._id] = thisArchivesIndex

          for (item in itemsByContainer[mmsContainer._id]) {
            item = itemsByContainer[mmsContainer._id][item]
            itemMappings[item._id] = thisArchivesIndex
            closeMappings++
          }

          removeItems = Object.keys(itemMappings)
          deleteing = 0
          // delete these from the items by components
          // so if we map them over to the container level we do not include them
          for (uuid in itemsByContainer) {
            for (aItem in itemsByContainer[uuid]) {
              if (removeItems.indexOf(itemsByContainer[uuid][aItem]._id) > -1) {
                deleteing++
                delete itemsByContainer[uuid][aItem]
              }
            }
          }
        }
      }
    }
  }

  if (warnings.length > 0) {
    // errorLib.error('Warning: low confidence container match ', warnings.join(' | '))
    console.log('Warning: low confidence container match:\n', warnings.join('\n'))
  }

  var results = {info: {totalItems: data.mmsItems.length, totalMapped: Object.keys(itemMappings).length, closeMapped: closeMappings, percentMapped: Math.floor(Object.keys(itemMappings).length / data.mmsItems.length * 100)}}

  results.itemMap = []
  results.containerMapMerge = []
  results.containerMapInherit = []

  // console.log('itemMappings')
  for (uuid in itemMappings) {
    var mssDb = itemMappings[uuid]

    // console.log('[http://metadata.nypl.org/items/show/' + itemsLookup[uuid].mmsDb + ']', '(http://archives.nypl.org/detail/' + archivesLookup[mssDb].mss + ')')
    results.itemMap.push({ uuid: uuid, mssDb: mssDb })
  }
  // console.log('containerMapMerge')
  for (mssDb in containerMappings) {
    uuid = containerMappings[mssDb]

    results.containerMapMerge.push({ uuid: uuid, mssDb: mssDb })
  // console.log('[http://metadata.nypl.org/containers/show/' + mmsContainerLookup[uuid].mmsDb + ']', '(http://archives.nypl.org/detail/' + archivesLookup[mssDb].mss + ')', mmsContainerLookup[uuid].title)
  }
  // console.log('containerMapInherit')
  for (uuid in containerToComponentMap) {
    mssDb = containerToComponentMap[uuid]

    // console.log('[http://metadata.nypl.org/containers/show/' + mmsContainerLookup[uuid].mmsDb + ']', '(http://archives.nypl.org/detail/' + archivesLookup[mssDb].mss + ')')
    results.containerMapInherit.push({ uuid: uuid, mssDb: mssDb })
  }

  // console.log(itemMappings)
  // console.log(itemMappings)
  // console.log('>>>>', Object.keys(itemMappings).length)

  // console.log(containerToComponentMap)
  // console.log(Object.keys(itemMappings).length, closeMappings)
  return results
}
