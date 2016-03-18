'use strict'
// var lexicon = require('nypl-registry-utils-lexicon')
var utils = require('nypl-registry-utils-normalize')

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
