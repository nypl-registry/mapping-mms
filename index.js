'use strict'

function MmsMapping () {
  /**
   * Ingest the Archives collections
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsCollectionsToArchivesCollections = require(`${__dirname}/lib/mms_collections_to_archives_collections`)
}

module.exports = exports = new MmsMapping()
