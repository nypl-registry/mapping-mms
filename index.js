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

  /**
   * Maps MMS items to Archive components based on MSS and bNumber if they have not been matched yet
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsItemsToArchivesComponents = require(`${__dirname}/lib/mms_items_to_archives_components`)

  /**
   * Maps MMS items to Archive components based the archives REPO Objects tables data
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsItemsToArchivesComponentsByRepo = require(`${__dirname}/lib/mms_items_to_archives_components_by_repo`)

  /**
   * Maps MMS cols/con/items to archvies compoents based on their hierarchy and matching data, a cluster script spawns many processes
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsToArchivesByHierarchy = require(`${__dirname}/lib/mms_to_archives_by_hierarchy`)

  /**
   * Maps MMS items to TMS object based on tmsObject, tmsId and callNumber if they have not been matched yet
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsItemsToTmsObjects = require(`${__dirname}/lib/mms_items_to_tms_objects`)

  /**
   * Maps MMS items to TMS objects based on shared image name in mms captures and tms objects
   *
   * @param  {function} cb - Nothing returned
   */
  this.mmsItemsToTmsObjectsByImage = require(`${__dirname}/lib/mms_items_to_tms_objects_by_image`)
}

module.exports = exports = new MmsMapping()
