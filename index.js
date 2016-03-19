'use strict'

function MmsMapping () {
  /**
   * Maps MMS collections to Archive collections based on MSS and bNumber and callnumber
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsCollectionsToArchivesCollections = require(`${__dirname}/lib/mms_collections_to_archives_collections`)

  /**
   * Maps MMS collections to Archive collections on titles matches
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsCollectionsToArchivesCollectionsByTitle = require(`${__dirname}/lib/mms_collections_to_archives_collections_by_title`)

  /**
   * Maps MMS items, that are collections (top level items) to Archive collections based on MSS and bNumber and callnumber
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsItemCollectionsToArchivesCollections = require(`${__dirname}/lib/mms_item_collections_to_archives_collections`)

  /**
   * Maps MMS containers to Archive components based on MSS and bNumber
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsContainerToArchivesComponents = require(`${__dirname}/lib/mms_containers_to_archives_components`)
}

module.exports = exports = new MmsMapping()
