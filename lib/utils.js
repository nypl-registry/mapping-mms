'use strict'
// var lexicon = require('nypl-registry-utils-lexicon')
var utils = require('nypl-registry-utils-normalize')

/**
* Given possible collection level matches it will compare titles to see if they are a match. Depending how broad the callnumber the title needs to be a high match
*
* @param  {function} cb - Nothing returned
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
