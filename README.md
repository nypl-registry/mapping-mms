# mapping-mms
[![travis](https://travis-ci.org/nypl-registry/mapping-mms.svg)](https://travis-ci.org/nypl-registry/mapping-mms/)


Map resources from MMS to Archives/TMS/Catalog


###mmsCollectionsToArchivesCollections
Maps MMS collections to Archive collections based on MSS and bNumber
Updates mmsCollections and archivesCollections collections.
MMS Collections will have these properties if matched

```
matchedArchives: true,
matchedArchivesType: 'identifier',
archivesCollectionDb: [ 6496 ]
```

Archives will have these values

```
matchedMms: true,
matchedMmsType: 'identifier',
mmsUuid: 'ea489f60-c602-012f-a845-58d385a7bc34'
```

---
###mmsCollectionsToArchivesCollectionsByTitle
Finds mms collections that have no identifiers that can be used and does a very high threshold title match agains archives collections. Sets the same data as above except

```
matchedArchivesType: 'title',
```
---
###mmsItemCollectionsToArchivesCollections
Maps MMS items, that are collections (top level items) to Archive collections based on MSS and bNumber. Sets the same data as above.

---
###mmsContainerToArchivesComponents
Maps MMS containers to Archive components based on MSS and bNumber. Sets the same data as above.

---

###mmsItemsToArchivesComponents
Maps MMS items to Archive components based on MSS and bNumber. Sets the same data as above.

---
###mmsItemsToArchivesComponentsByRepo
Maps MMS items/containers to Archive components based on Repo ids (UUID) found in archvies repo objects table. Sets the same data as above except

```
matchedArchivesType: 'uuid',
```

---

###mmsToArchivesByHierarchy

Maps together items/containers to archives components in a complicated analysis of the collection hierarchy. It is passed all the item/container and component data and tries to group them into three types of matches.
#####Item Map / hierarchyItem

```
matchedArchivesType: 'hierarchyItem'
---
matchedMmsType: 'hierarchyItem'
```

These are one to one matches from a single component to a single item. There can be multiple MMS items to a single archives component. In serialization the archives component will be merged with the MMS info (mostly just the captures)
Examples:

[http://metadata.nypl.org/items/show/4211877](http://metadata.nypl.org/items/show/4211877) -> [http://archives.nypl.org/detail/1029160](http://archives.nypl.org/detail/1029160)

[http://metadata.nypl.org/items/show/4211862](http://metadata.nypl.org/items/show/4211862) -> [http://archives.nypl.org/detail/1029114](http://archives.nypl.org/detail/1029114)


#####containerMapMerge / containerMerge

```
matchedArchivesType: 'containerMerge'
---
matchedMmsType: 'containerMerge'
```

These get the container and series to the right level. Any items items in that level that are not one-to-one mapped can be added into the archives hieararchy here.



[http://metadata.nypl.org/containers/show/270925](http://metadata.nypl.org/containers/show/270925) -> [http://archives.nypl.org/detail/1029112](http://archives.nypl.org/detail/1029112) Correspondence.
[http://metadata.nypl.org/containers/show/270927](http://metadata.nypl.org/containers/show/270927) -> [http://archives.nypl.org/detail/1029114](http://archives.nypl.org/detail/1029114) Letters to Welles
[http://metadata.nypl.org/containers/show/270928](http://metadata.nypl.org/containers/show/270928) -> [http://archives.nypl.org/detail/1029151](http://archives.nypl.org/detail/1029151) Writings


#####containerMapInherit / containerMulti

```
matchedArchivesType: 'containerMulti'
---
matchedMmsType: 'containerMulti'
```

Maps at a higher level, matches containers to the parent series.


[http://metadata.nypl.org/containers/show/270926](http://metadata.nypl.org/containers/show/270926) -> [http://archives.nypl.org/detail/1029112](http://archives.nypl.org/detail/1029112)
[http://metadata.nypl.org/containers/show/270927](http://metadata.nypl.org/containers/show/270927) -> [http://archives.nypl.org/detail/1029112](http://archives.nypl.org/detail/1029112)


---

###mmsItemsToTmsObjects / mmsItemsToTmsObjectsByImage
Updates MMS Items with the TMS object ID based on TmsObject ID, callnumber, image ID. 


```
matchedTms: true,
matchedTmsType: 'identifier',
tmsId: 155453,
allTmsIds: [155453]
```

The allTmsIds are for when a lossy call number match is made, to figure out later.

